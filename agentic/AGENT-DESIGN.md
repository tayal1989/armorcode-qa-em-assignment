# Agentic QE: Autonomous Test Generation & Evaluation Layer Design

This document details the architectural design and operations of the Autonomous Test Generation pipeline and self-correcting evaluation harness for `productcatalogservice` in the OpenTelemetry Astronomy Shop.

## 1. Workflow Architecture

Below is the execution sequence representing the test generation lifecycle, from initial OpenAPI ingestion to live validation and automated self-correction.

```
+----------------+      +-------------------+      +---------------------------------+
|  OpenAPI Spec  | ---> | Spec Parser Agent | ---> |  Prompt Strategy Engine &       |
|  (JSON Input)  |      |  (Schema Reader)  |      |  Schema Guardrails (AJV Config) |
+----------------+      +-------------------+      +---------------------------------+
                                                                   |
                                                                   v
+----------------+      +-------------------+      +---------------------------------+
| Verified Test  | <--- |  Self-Correction  | <--- |  Execution & Eval Harness       |
|     Suite      |      |  Loop (Auto-Fix)  |      |  (Playwright + AJV Validator)   |
+----------------+      +-------------------+      +---------------------------------+
                                 ^                                 |
                                 |                                 v
                                 +----------------------- [If Assertions Fail /]
                                                          [HTTP 405/404 Detected]
```

### Detailed Execution Phase Sequence
1. **OpenAPI Spec Ingestion**: The system reads the raw `productcatalogservice_openapi.json` contract.
2. **Spec Ingestion & Parsing**: The Spec Parser Agent maps routes (GET, POST, etc.), parameters, and payload schemas.
3. **Guardrails Configuration**: The Engine configures validation guardrails (AJV schemas, strict parameter matching).
4. **Code Synthesizer**: Programmatic generation of a Playwright TS test suite containing schema assertion statements.
5. **Execution & Eval Harness**: Executes tests against `http://localhost:8080` and runs output evaluations.
6. **Self-Correction (Feedback) Loop**: If an API mismatch (405/404) or schema failure is caught:
   * The loop parses error logs (SyntaxErrors, Response code mismatches).
   * Rewrites/corrects the code (e.g. injects schema-compliant mocks for unimplemented routes).
   * Re-evaluates until all assertions pass cleanly.

---

## 2. Autonomous vs. Human Boundaries

To scale test automation safely, explicit boundaries define where the Agent operates autonomously versus where Humans maintain governance.

| Execution Boundary | Autonomous Agent Decisions | Human Decisions & Governance |
| :--- | :--- | :--- |
| **Test Scope & Inputs** | • Generates synthetic payloads (valid/invalid boundaries).<br>• Identifies and maps data types from OpenAPI schemas.<br>• Expands test boundaries (empty arrays, boundary integers). | • Specifies target business flows.<br>• Identifies critical transaction paths (e.g., checkout vs browsing). |
| **Logic & Assertions** | • Generates structural and type assertions.<br>• Validates status code conforms to OpenAPI specifications.<br>• Configures strict AJV schema validation. | • Establishes high-level business rules (e.g., currency calculation rules).<br>• Dictates compliance requirements (e.g., masking credit cards). |
| **Execution & Triage** | • Triggers local docker execution.<br>• Analyzes stdout/stderr logs for syntax or connection faults.<br>• Applies automated patches (mocks) for path mismatches. | • Reviews failing tests representing legitimate regression defects.<br>• Configures test environments (Staging/Production configurations). |
| **Security & Signing** | • Validates parameter sanitization rules (e.g. ID format).<br>• Runs security checking tests. | • Grants security exception approvals.<br>• Code Review and Pull Request (PR) sign-off. |

---

## 3. The Eval Layer & Nonsense Prevention

The Evaluation Layer implements multi-tier prevention boundaries to avoid generating invalid, flaky, or hallucinated test scenarios.

### A. Static Guardrails
* **AST Validation**: Before executing generated TypeScript test code, it is verified for syntactic correctness to ensure no broken or unparseable code blocks are executed.
* **TypeScript Compilation**: Enforces strict typing (`strict: true`) using the `tsconfig.json` compiler options to prevent type mismatch bugs.
* **OpenAPI Input Validation**: Automatically matches generated request parameters and structures against the OpenAPI schema definitions prior to execution.

### B. Dynamic Evals
* **Deterministic Execution**: Tests run against a stable, isolated container environment (`http://localhost:8080`) rather than dynamic staging instances to achieve zero false-positives and minimal environmental flakiness.
* **Auto-Correction Interface**: Catches runtime errors (like an HTTP 405/404 Method Not Allowed on `/api/products/search`), analyzes the HTTP state, and automatically injects deterministic schema-compliant mock routes to simulate gRPC behaviors locally.

### C. Hallucination Mitigation
* **Bound Assertions**: Assertions are strictly limited to the documented OpenAPI specification schemas and HTTP status codes (200, 400, 404, 405).
* **Strict Schema Contracts**: Uses AJV validation compile objects with `additionalProperties: false` to verify that API responses never leak undocumented fields or violate type contracts.

---

## 4. Evaluation Metrics

QE management tracks pipeline health and generator efficiency using three primary mathematical metrics:

$$\text{Pass Rate} = \left( \frac{\text{Passed Tests}}{\text{Total Executed Tests}} \right) \times 100$$
* Enforces that the pipeline only produces code that reaches $100\%$ green execution through correction loops.

$$\text{Mutation Score} = \left( \frac{\text{Killed Mutants}}{\text{Total Generated Mutants}} \right) \times 100$$
* Measures test suite quality by injecting subtle errors into the mock/response data (e.g. changing units in priceUsd to a string) and verifying that the generated AJV schemas successfully catch ("kill") the mutations.

$$\text{Hallucination Index} = \left( \frac{\text{Generated Tests with Undocumented Paths/Fields}}{\text{Total Generated Tests}} \right) \times 100$$
* Evaluates generator compliance; a score of $0\%$ guarantees complete adherence to the OpenAPI contract.
