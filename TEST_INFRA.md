# E2E Test Infra: Atelier Boutique SaaS

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Auth & Onboarding Flow | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Staff Invitation System | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | Database Clean-up | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 4 | Dynamic Customer details | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner**: Custom TypeScript runner at `e2e-tests/runner.ts`
- **Invocation**: `cd e2e-tests && npm test`
- **Pass/Fail Semantics**: Logs step-by-step executions and assertions. Returns exit code `0` on completion. If failures are found, outputs detailed stack traces and registers them in the summary.
- **Directory Layout**:
  - `e2e-tests/package.json` - Script configurations and project dependencies
  - `e2e-tests/tsconfig.json` - TS compiler flags and module settings
  - `e2e-tests/runner.ts` - Server orchestration, Supabase client initialization, and runner execution
  - `e2e-tests/tests/tier1-coverage.ts` - Tier 1: Feature Coverage tests
  - `e2e-tests/tests/tier2-boundary.ts` - Tier 2: Boundary & Corner case tests
  - `e2e-tests/tests/tier3-cross.ts` - Tier 3: Cross-Feature combination tests
  - `e2e-tests/tests/tier4-workload.ts` - Tier 4: Real-world scenario tests

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Boutique Setup and Measurement Logging | Onboarding, DB Client, Measurements | Medium |
| 2 | Team Collaboration on Custom Order | Onboarding, Staff invite, Orders | High |
| 3 | Ledger Outstanding Calculation Flow | Orders, Payments, Outstanding updates | High |
| 4 | Fitting Appointment Management Flow | Staff invite, Orders, Appointments | Medium |
| 5 | System Reset & Account Continuity | DB Cleanup, Tenant Isolation | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total: 20 tests)
- Tier 2: ≥5 per feature (Total: 20 tests)
- Tier 3: Pairwise coverage of major feature interactions (Total: 4 tests)
- Tier 4: ≥5 realistic application scenarios (Total: 5 tests)
- **Total test coverage: 49 tests planned across runner suites**
