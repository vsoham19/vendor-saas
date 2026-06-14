## 2026-06-10T17:44:14Z
Please explore the vendor-saas codebase to understand implementation details of:
1. Authentication & Onboarding Redirection flow: How registration/login is handled, where checking for associate store and redirection to /onboarding happens, how the onboarding form creates `vendors` and `staff` records.
2. Staff Invitation System: How store owners add team members (assistants), what endpoint/form is used, how assistant auth user record is created in Supabase, and how staff record with 'assistant' role is created.
3. Database Clean-up script/action: Where the clean-up script/code is or how it can be triggered, and which tables are cleared.
4. Customer details view page (/dashboard/customers/[id]/page.tsx): How it dynamically fetches profile, orders, ledger, measurements, appointments from Supabase (checking for any hardcoded redirect or fallback bugs).
5. Environment setup: How frontend and backend resolve Vercel deployment URLs, redirect URIs, and Supabase config.
6. Test Setup: What testing libraries (Jest, Playwright, etc.) are already present in package.json files.

Write your report to c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\explorer_exploration\exploration_report.md.
