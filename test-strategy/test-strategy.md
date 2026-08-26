# Quality Engineering Test Strategy: OpenTelemetry Astronomy Shop
**(Document Metadata: Version 1.0.0 | Role: QA Engineering Manager | Scope: Polyglot Microservices)**

## 1. High-Risk Services & Flows
In a polyglot (written in more than 1 language) microservices system like the OpenTelemetry Astronomy Shop, risks are amplified by network boundaries, serial blocking execution paths, and asynchronous eventual consistency. Our codebase inspection has identified the following three high-risk microservices and workflows.

### 1.1 The Checkout Orchestration Flow (`checkoutservice` - Go)
The `checkoutservice` (written in Go) acts as a centralized, synchronous state machine orchestrating order completion. During a `PlaceOrder` request, it executes a long chain of synchronous gRPC calls:
1. Retrieves cart details from `cartservice` (C#).
2. Queries `productcatalogservice` (Go) for product pricing.
3. Converts pricing using `currencyservice` (C++).
4. Pulls shipping quotes from `shippingservice` (Go), which downstream queries `quoteservice` (PHP).
5. Invokes `paymentservice` (Node.js) to charge the card.
6. Signals `shippingservice` again to dispatch the items.
7. Instructs `cartservice` to clear the cache.
8. Triggers `emailservice` (Ruby) for confirmation.
9. Publishes order details to the `kafka` broker (Java).

**Risk Analysis:**
* **Cascading Timeout Storms:** The entire chain runs synchronously. If the database for `productcatalogservice` is slow, or `paymentservice` has a network bottleneck, the Go routines inside `checkoutservice` block, quickly depleting connection pools. This propagates latency directly up to the user interface, causing checkout abandonment.
* **Transactional State Desynchronization:** This demo lacks a distributed transaction framework (like the Saga Pattern or Two-Phase Commit). If `paymentservice` charges the user's card successfully, but a subsequent gRPC call to `shippingservice` fails or times out, the client is charged but the order is marked failed, creating a severe operational anomaly.
* **Security & Compliance Violations:** A critical vulnerability exists where the `PlaceOrder` function sets OpenTelemetry span attributes containing raw credit card numbers and CVVs (`demo.payment.card_number` and `demo.payment.card_cvv`). This represents a severe PCI-DSS breach, exporting sensitive financial data in plaintext to Jaeger, Prometheus, and OpenSearch.

### 1.2 Financial Blast Radius (`paymentservice` - Node.js)
The `paymentservice` (JavaScript/Node.js) handles mock payment authorizations. 
* **Precision Risk:** It receives localized currency data from `checkoutservice` computed in floating-point nano-units (`Money` message fields `units` and `nanos`). Any mismatch in numerical rounding during translation inside the C++ `currencyservice` or Go serialization can result in rounding underflows/overflows, leading to over- or under-charging customer credit cards.
* **Fraud Ingestion Timing:** The system employs a Kafka-based asynchronous consumer (`fraud-detection` service in Java) to detect fraudulent activity. However, because this consumer processes events *after* the payment has been completed and the checkout service responds, a fraudster can successfully complete checkouts immediately. By the time the async engine flags the transaction, the order has been processed, leaving the business vulnerable to chargeback disputes.

### 1.3 State Synchronization (`cartservice` - C# & `productcatalogservice` - Go)
* **Pricing Race Conditions:** Product prices are retrieved dynamically at checkout. If a price is updated in PostgreSQL (`astronomy-db`) while a user is browsing, a race condition occurs. Since there is no cart locking mechanism, the user might see price A on the storefront, but checkout will query and charge price B, leading to consumer disputes.
* **Valkey Memory Volatility:** `cartservice` relies on Valkey (`valkey-cart`) to store cart items. Valkey is stateless and in-memory. Under sudden resource constraints, cart eviction policies can drop active cart states.

---

## 2. Test Pyramid & Deliberate Gaps

To build an efficient quality assurance funnel, we align our testing effort against a modified Test Pyramid designed for polyglot systems.

```
       / \         <- E2E / System (Playwright - 5%)
      /   \        <- Performance & Stress (k6 - 10%)
     /     \       <- Integration & Database (20%)
    /       \      <- Contract & API Schema (Buf/Pact - 25%)
   /_________\     <- Unit & Component Testing (40%)
```

### 2.1 The Testing Layers
* **Unit Testing (40%):** Focuses on pure business logic inside individual directories (e.g., currency conversion math in C++, tax logic in Go, ad targeting in Java). Dependencies are strictly mocked using native frameworks (like Go's `gomock` or .NET's `Moq`).
* **Contract & API Schema Testing (25%):** Leverages **Buf** to validate protobuf files against backward-compatibility rules (`buf breaking`) during code generation. We use **Pact** for consumer-driven contract testing between the `checkoutservice` and `paymentservice` to guarantee semantic contract fulfillment.
* **Integration Testing (20%):** Validates database persistence (e.g., `accountingservice` inserts to Postgres) and cache states (e.g., `cartservice` writes to Valkey). These run in isolated Docker environments in CI pipelines.
* **Performance Testing (10%):** Employs **k6** (driven by the `load-generator`) to simulate high-concurrency checkouts, verifying system throughput, resource bottlenecks (e.g., Go memory limits `GOMEMLIMIT=16MiB`), and trace propagation metrics.
* **End-to-End System Testing (5%):** Verifies critical user journeys (happy-path catalog-to-checkout flows) using Playwright in dynamic test environments.

### 2.2 Deliberate QA Gaps (Un-Automated Areas)
To optimize ROI and control maintenance costs, we deliberately choose to leave the following areas un-automated:
1. **Telemetry Exporter Dashboards (Jaeger/Grafana UI):** We do not automate browser scripts to verify that spans are correctly rendered on Jaeger/Grafana dashboards. Visual automated checks on third-party monitoring platforms are extremely brittle. Instead, we use static CLI compilation checks (`weaver registry check`) in our pipeline to verify that all emitted attributes comply with telemetry schema definitions.
2. **Dynamic UI Recommendation Blocks Visuals:** The Astronomy Shop renders dynamic product recommendations that vary based on AI algorithms. Writing visual pixel-diff tests for these sections leads to false-positive test failures. We bypass visual diffing and instead use semantic DOM assertions to check that *some* product cards are loaded, ignoring their specific images or visual positioning.
3. **Live Sandbox Payment Gateway Calls:** We do not trigger automated transactions against external payment sandboxes in our daily CI/CD pipeline. External sandboxes suffer from frequent downtime, throttling, and API rate limits, which destabilize PR builds. All payment validation in CI is restricted to local gRPC mock stubs.

---

## 3. Quality Ownership in a Pod Model

With a lean team of **1 Engineering Manager (EM) and 4 QA Engineers** overseeing **20+ polyglot services**, the traditional model of "QA tests developers' code" is mathematically impossible. We will structure the organization under a **Domain-Pod Model**, redefining the QA role from "testers" to **Quality Tech Leads**.

### 3.1 Domain-Pod Organizational Structure
We will group the microservices into four domain-pods, assigning one QA Engineer as the Quality Lead for each:

1. **Core Storefront Pod (QA Lead 1):** 
   * *Services:* `frontend`, `frontend-proxy`, `adservice`, `recommendation`, `image-provider`.
   * *Focus:* Browser rendering, client-side tracing, SEO headers, localization, and storefront UI usability.
2. **Purchase, Payments & Ledger Pod (QA Lead 2):** 
   * *Services:* `paymentservice`, `cartservice`, `currencyservice`, `accountingservice`, `fraud-detection`, `astronomy-db`.
   * *Focus:* Currency precision math, checkout billing transactions, cart state volatility, ledger database locking, and asynchronous fraud scan verification.
3. **Checkout, Logistics & Routing Pod (QA Lead 3):** 
   * *Services:* `checkoutservice`, `shippingservice`, `quoteservice`, `emailservice`, `kafka`.
   * *Focus:* gRPC orchestrator workflow execution, shipping quote lookups, event messaging broker publishing, and customer notification delivery.
4. **Platform, Infra & Performance Pod (QA Lead 4):** 
   * *Services:* `otel-collector`, `flagd`, `load-generator`, CI/CD pipelines.
   * *Focus:* Scale testing, feature flag matrix checks, pipeline efficiency, and telemetry schema validation.

### 3.2 Shift-Left Integration & QA Accountability
QA Engineers do not spend their days manually running tickets. Instead, they embed within Dev sprints as Quality Tech Leads, enforcing the following shift-left initiatives:
* **Co-authored Test Design:** During the technical design phase of a feature, the QA Lead collaborates with Devs to write the test scenarios *before* code implementation.
* **Test Infrastructure Enablement:** The QA Lead builds, maintains, and scales the shared test frameworks (e.g., Playwright or Pact boilerplate code). Developers write their own unit and contract tests using these pre-built frameworks.
* **PR Code & Test Review:** Developers are required to submit automated tests with every functional PR. QA Leads review the tests (not just the code) to ensure correct mocking practices, edge-case coverage, and assert quality standard fulfillment before merge approval.

---

## 4. CI/CD Quality Gates

To prevent regressions from entering main branches and production, we establish progressive Quality Gates across the delivery pipeline.

```
+--------------+     +--------------+     +---------------+     +----------------+
| Pre-Commit   | --> | PR Build     | --> | Pre-Merge     | --> | Nightly        |
| (Local Dev)  |     | (Staging)    |     | (Release Cand)|     | (Pre-Prod)     |
+--------------+     +--------------+     +---------------+     +----------------+
- Lint / Format      - Unit Tests         - Buf Breaking  - Stress Test
- Buf Lint           - Component Mock     - Smoke E2E     - Security Scan
- Fast Unit Tests    - Coverage check     - Telemetry check - Full E2E Suite
```

### 4.1 Gate 1: Pre-Commit (Local Developer Environment)
* **Objective:** Catch syntax issues and micro-bugs before code leaves the dev workstation.
* **Checks:**
  * Code formatting and linting (e.g., `gofmt`, `eslint`, `dotnet-format`, `rubocop`, `black`).
  * Protobuf API definition verification (`buf lint`).
  * Execution of fast-running unit tests (restricted to < 10 seconds).

### 4.2 Gate 2: Pull Request (PR) Build
* **Objective:** Ensure isolation safety and core functionality logic.
* **Checks:**
  * Docker compilation of modified service containers.
  * Execution of all Unit and mock-based Integration tests.
  * API Contract validation checks via Pact.
  * **Pass/Fail Criteria:** 100% test pass rate, code coverage of modified lines must exceed 80%.

### 4.3 Gate 3: Pre-Merge to Main (Release Candidate)
* **Objective:** Validate integration across the entire microservice graph.
* **Checks:**
  * Ephemeral Docker Compose deploy of the full stack.
  * API backward-compatibility validation (`buf breaking` against the main branch).
  * Happy-path E2E smoke suite execution (Playwright).
  * Telemetry schema verification (`weaver registry check` to validate OpenTelemetry naming metrics).
  * **Pass/Fail Criteria:** Zero test failures, zero breaking API schema alerts.

### 4.4 Gate 4: Nightly / Pre-Production Releases
* **Objective:** Stress system resources and scan security baselines.
* **Checks:**
  * Comprehensive E2E regression suite covering edge cases and error-injection flows.
  * Security scanning (OSV-Scanner, SAST, dependency updates).
  * 1-hour load generation and performance test (k6) under target traffic limits.
  * Trace propagation tracking to flag dropped span contexts.

---

## 5. Metrics & SLAs

To ensure accountability and prevent quality deterioration, we track five actionable metrics linked to engineering SLAs.

| Metric | Definition | Target SLA | Impact & Accountability |
| :--- | :--- | :--- | :--- |
| **Defect Leakage Rate** | `(Bugs Escaped to Prod / Total Bugs Found) * 100` | **< 5%** | Drives thoroughness in local/PR testing. High leakage results in retro review. |
| **Escaped Defects by Severity** | Production bugs grouped by priority (Sev 1: Critical, Sev 2: High, Sev 3: Medium) | **Sev 1: 0 (Tolerance)**<br>**Sev 2: Resolved < 24h**<br>**Sev 3: Resolved < 7d** | Holds developers accountable to fix production incidents immediately. |
| **Flaky Test Index** | `% of tests failing and then passing without code changes` | **< 1%** | Flaky tests must be quarantined. If not fixed in 48 hours, they are deleted. |
| **Test Execution Lead Time** | Total time to run all automated checks in a pipeline | **PR: < 10 minutes**<br>**Pre-Merge: < 20 minutes** | Fast feedback prevents pipeline bypassing. Ensures developer velocity. |
| **Automation Coverage Ratio** | Ratio of automated test assertions to defined manual test scenarios | **Critical Paths: 95%**<br>**High/Med Paths: > 80%** | Prevents accumulation of manual testing debt. Checked before release merges. |

### How SLAs Drive Developer Accountability
These SLAs are not merely reported on dashboards; they are integrated directly into the engineering team's definition of done. If a pod's Defect Leakage Rate exceeds the 5% SLA threshold, the pod's sprint priority is automatically adjusted: they must suspend feature work in the next sprint to focus solely on resolving test gaps and technical debt. Similarly, a flaky test index check is run on every commit; if a service's flaky index exceeds 1%, the CI gate will automatically quarantine the test and alert the service owner, preventing any further PR merges until the test is repaired.

---
Assisted-by: Antigravity 1.0
