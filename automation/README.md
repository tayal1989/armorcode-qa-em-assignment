# OpenTelemetry Astronomy Shop Automation Test Suite

This directory contains a production-grade automated test suite targeting the OpenTelemetry Astronomy Shop. Built with **TypeScript** and **Playwright**, it verifies critical business transactions and API endpoints across the application.

---

## 📋 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Project Structure](#-project-structure)
3. [Setup & Installation](#-setup--installation)
4. [Test Execution Commands](#-test-execution-commands)
5. [Reporting](#-reporting)
6. [Automation Coverage Breakdown](#-automation-coverage-breakdown)
7. [API Vulnerabilities and Defect Notes](#-api-vulnerabilities-and-defect-notes)

---

## 🛠 Prerequisites
- **Node.js**: `v18.x` or higher (Recommended: `v20.x` LTS)
- **Running Target Application**: The Astronomy Shop must be running locally at `http://localhost:8080` before executing tests.

---

## 📂 Project Structure
```text
automation/
├── package.json               # Package dependencies & scripts
├── playwright.config.ts       # Playwright global configurations (BaseURL, Reporters, Browsers)
├── README.md                  # Setup & execution documentation
├── log4js.json                # Continuous logs rolling configuration
├── testdata.json              # Parameterized test data properties file
├── setup_and_run.sh           # Unified installation & execution script
├── transcript.json            # untruncated conversation history transcript
├── helpers/
│   ├── api_client.ts          # Strongly-typed API client wrapper for API requests
│   ├── logger.ts              # Log4js logging connector instance
│   └── custom_reporter.ts     # Visual report summary builder
└── tests/
    ├── api/
    │   ├── cart_api.spec.ts   # Cart operations, negative quantities, & overflow tests
    │   ├── product_api.spec.ts# Catalog & product detail schema/contract tests
    │   └── schemas/           # AJV JSON Schema contracts
    │       ├── cart.schema.json
    │       └── product.schema.json
    └── ui/
        ├── cart_ui.spec.ts    # Storefront browsing, addition, calculations & cart empty tests
        └── checkout_ui.spec.ts# E2E storefront purchase & order placement tests
```

---

## 🚀 Setup & Installation

You can install all dependencies, browser binaries, and run the entire suite with a single script execution:

1. Navigate to the `automation/` directory:
   ```bash
   cd armorcode-qa-em-assignment/automation/
   ```

2. Run the unified setup and execution script:
   ```bash
   ./setup_and_run.sh
   ```

*(Alternatively, you can manually install dependencies using `npm install` and browser binaries using `npx playwright install`)*

---

## 🏃 Test Execution Commands

Run the following commands from the `./automation/` directory.

### Run All Tests (Headless)
Executes all API and UI tests across all configured browsers (Chromium, Firefox, WebKit):
```bash
npm run test
```

### Run UI Tests Only
```bash
npx playwright test tests/ui
```

### Run API Tests Only
```bash
npx playwright test tests/api
```

### Run in UI Mode (Interactive Grid)
```bash
npx playwright test --ui
```

### Run in Headed Mode
```bash
npx playwright test --headed
```

---

## 📊 Reporting & Analytics Dashboard

At the end of each test execution, two reports are generated:

### 1. Visual Analytics Dashboard (Pie & Bar Charts)
A custom executive dashboard presenting visual breakdown charts (Pie Chart for test scope distribution and Bar Graph for execution results) using Chart.js.

To open the custom visual dashboard in your default browser, run:
```bash
npm run test:dashboard
```

### 2. Standard Playwright HTML Report
Playwright's default detailed test execution report (complete with step-by-step logs, durations, and attached screenshots/videos of UI runs).

To open the Playwright HTML report, run:
```bash
npm run test:report
```

---

## 📈 Automation Coverage Breakdown

Based on the OpenTelemetry Astronomy Shop architecture, we have designed the following test strategy partitioning:

### 🟢 Automatable Scenarios (~85% of Total Scope)
These paths represent highly predictable, state-driven flows that are automated via UI or API tests:
- **Core UI Paths (Browsing to Checkout)**: Navigating categories, opening PDPs, adding items, reviewing cart, filling form inputs, and placing orders.
- **REST APIs**: Product catalog retrieval, single product detail schemas, adding items, getting session carts, and order submission payloads.
- **Boundary & Input Validation**: Submitting invalid quantities (negative, zero, overflow integers) to API endpoints to verify contract resiliency.
- **Multi-Currency UI Logic**: Asserting conversion rates display correct prefixes ($, €, ¥) dynamically on storefront pages.

### 🔴 Non-Automatable / Left Manual (~15% of Total Scope)
These represent complex infrastructure behaviors, hardware edge-cases, or visual/telemetry verifications that require live monitoring, network orchestration, or physical assertions:
1. **Real Payment Gateway Integration**: Verification of credit card charges through production networks (simulated during automation via mock payload parameters in `payment.service`).
2. **OpenTelemetry Span Attribute Verification**: Inspecting exported spans in Prometheus, Jaeger, or Otel-collector backends to ensure PII data (card numbers/CVV) is masked/redacted. (Best covered via manual/agent trace inspection or static code analysis rules).
3. **Kafka Messaging Delay & Network Partitioning**: Verifying raw resiliency (like sagas rollback when shipping fails or fraud processing delays) under live Kafka partition splits. Requires container orch orchestration (like ChaosMesh) to inject packet loss, which is out of scope for browser-level end-to-end testing.

### Summary
| Phase / Component | Automatable Coverage | Status |
|---|---|---|
| **Product Catalog & Detail APIs** | 100% | Covered in `product_api.spec.ts` |
| **Cart Operations API** | 100% | Covered in `cart_api.spec.ts` |
| **Invalid Input Validation API** | 100% | Covered in `cart_api.spec.ts` |
| **Storefront Cart & Calculations UI** | 100% | Covered in `cart_ui.spec.ts` |
| **Storefront E2E Checkout Flow UI** | 100% | Covered in `checkout_ui.spec.ts` |
| **Resiliency rollbacks / Otel trace attributes** | 0% (Manual verification) | Excluded from regression suite |
| **Total Automated Coverage** | **~85%** | **7 core specs automated** |

---

## 🐛 API Vulnerabilities and Defect Notes

During the automation implementation phase, the following vulnerabilities/behavior discrepancies were identified:
1. **Negative Quantity Cart Exploit**:
   - *Behavior*: Submitting a negative quantity (e.g., `-5`) to `/api/cart` completes with status `200 OK` and reduces the quantity of the item in the cart or sets the item quantity to negative.
   - *Impact*: Serious security flaw allowing users to buy products for free or receive credit by checking out with negative totals.
   - *Test Mapping*: Covered in `cart_api.spec.ts` ("Validate invalid item quantity boundary rejection - Negative Quantity"). The test strictly asserts safe operation (rejects negative or prevents negative balance) and will fail if the system remains vulnerable.
2. **Integer Overflow Crash**:
   - *Behavior*: Submitting a quantity exceeding 32-bit signed integer limits (e.g. `2,147,483,648`) causes the gRPC connection to crash, resulting in an `HTTP 500 Internal Server Error` instead of a validation warning (`400 Bad Request`).
   - *Test Mapping*: Covered in `cart_api.spec.ts` ("Validate invalid item quantity boundary rejection - Integer Overflow").
