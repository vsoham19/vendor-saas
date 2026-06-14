## 2026-06-10T17:47:03Z

You are the teamwork_preview_worker.
Your task is to write and verify a comprehensive E2E testing suite in c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\e2e-tests.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please implement:
1. e2e-tests/package.json
   - Include dependencies: typescript, ts-node, @supabase/supabase-js, dotenv
   - Include script: "test": "ts-node runner.ts"
2. e2e-tests/tsconfig.json (basic tsconfig for Node.js E2E testing)
3. e2e-tests/runner.ts
   - Setup a test runner that reads environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEPLOYED_BACKEND_URL, DEPLOYED_FRONTEND_URL).
   - If env variables are not set in the environment, try to read them from ../frontend/.env and ../backend/.env.
   - Initialize two Supabase clients: one with the anon key and one with the service role key.
   - Fallback DEPLOYED_BACKEND_URL to http://localhost:4000 and DEPLOYED_FRONTEND_URL to http://localhost:3000.
   - Define a TestContext structure containing: supabaseAdmin, supabaseClient, backendUrl, frontendUrl, log(msg), assert(cond, msg), assertEq(act, exp, msg), assertThrows(fn, status, msg).
   - Maintain a registry of test cases across Tiers 1-4 and run them.
   - Output a clean summary (passed, failed, total).
4. Implement all tests in:
   - e2e-tests/tests/tier1-coverage.ts
   - e2e-tests/tests/tier2-boundary.ts
   - e2e-tests/tests/tier3-cross.ts
   - e2e-tests/tests/tier4-workload.ts
   Detailed test cases to cover:
   - Tier 1: Feature Coverage (>=5 tests per feature)
     - Auth & Onboarding (signup, login, guard check before onboarding, onboard submission, post-onboard access)
     - Staff Invitation (invite assistant, login assistant, tenant check, assistant query, non-owner invite rejection)
     - DB Clean-up (check seed data, trigger delete on seed customers, verify seed customers gone, verify cascade delete on orders/payments/appointments/measurements, verify non-seed data is preserved)
     - Dynamic Customer Details (create dynamic customer & dependencies, fetch profile, fetch orders, fetch measurements, fetch appointments)
   - Tier 2: Boundary & Corner Cases (>=5 tests per feature)
     - Auth & Onboarding (empty business name, empty address, invalid JWT, duplicate onboarding, massive string parameters)
     - Staff Invitation (empty name, invalid email format, weak password, duplicate email, invalid JWT / non-owner role)
     - DB Clean-up (idempotent cleanup when already run, non-cascade tables intact, partial uuid not deleted, invalid uuid format, delete without admin privileges)
     - Customer Details (fetch non-existent customer, cross-tenant customer fetch should block, fetch customer with no data, fetch customer with missing optional fields, fetch customer with invalid uuid format)
   - Tier 3: Cross-Feature Combinations (4 tests)
     - Owner A / Owner B multitenant isolation
     - Owner onboards and invites assistant, assistant logs in and accesses the shared store
     - Database cleanup preserves newly registered tenant data
     - Assistant accesses customer details created by the owner
   - Tier 4: Real-World Application Scenarios (5 scenarios)
     - New boutique setup + custom measurement logging
     - Team collaboration on custom order and payment
     - Ledger outstanding calculation flow (two orders, partial payments, total outstanding updates)
     - Appointment scheduling and trial fitting flow
     - System reset (DB clean-up) preserves owner's active data but wipes demo data

Ensure that all network requests to the backend use fetch/axios and hit the DEPLOYED_BACKEND_URL.
Run the compilation check (npm run build or verify with ts-node) to ensure it compiles. Run the E2E tests and log the output. Note that since some backend features are not fully implemented yet, several tests will fail, which is expected. Verify that the test runner executes and reports these failures correctly.

Write a handoff.md in your working directory (e.g. c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\worker_test) summarizing what files were created, the test runner execution results, and compile status.
