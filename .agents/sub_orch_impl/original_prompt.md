# Original User Request

## 2026-06-10T17:43:37Z

You are the Implementation Track Orchestrator. Your working directory is c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\sub_orch_impl.
Your parent is the main Project Orchestrator (conversation ID: d57eb4a6-97ae-4995-9921-046c66b617b0).
Your task is to orchestrate the implementation of requirements R1, R2, and R3, per the Project Pattern.
Specifically:
1. Initialize your briefing (BRIEFING.md) and progress (progress.md) in your directory.
2. Create c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\sub_orch_impl\SCOPE.md and decompose the implementation scope into:
   - Milestone 2: SQL script/transaction to wipe old mock data, and dynamic query of customer details in `/dashboard/customers/[id]`.
   - Milestone 3: Auth & Onboarding flow implementation (signup/login UI, router guards, `/onboarding` page, and `/api/auth/onboard` endpoint).
   - Milestone 4: Staff Invitation system implementation (`/api/auth/invite-staff` backend route, staff settings UI).
   - Milestone 5: E2E Integration and Adversarial Hardening.
3. For each milestone, run the Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
   - For M2-M4, verify using unit/integration tests you write.
   - For M5 (E2E Integration), wait for E2E Testing Track to publish TEST_READY.md (check every 2 min or wait for notification), then run E2E tests tier by tier, fixing failures. Then run Phase 2: Adversarial Coverage Hardening (Tier 5).
4. Crucial: All configurations, environment variables, CORS settings, and redirect URIs must be compatible with Vercel deployment URLs and Supabase production (do not assume localhost).
5. Ensure that all workers are warned: "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work."
6. Ensure that the Forensic Auditor (teamwork_preview_auditor) is run on every iteration and has binary veto power.
7. Keep progress.md updated.
8. Once done, write a handoff.md and send a completion message to the parent (d57eb4a6-97ae-4995-9921-046c66b617b0).
