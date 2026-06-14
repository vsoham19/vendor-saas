# BRIEFING — 2026-06-10T23:23:00+05:30

## Mission
Implement SQL cleanup and customer details dynamic query (Milestone 2).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\worker_m2
- Original parent: 6d08705b-04b8-4a4b-a318-1c50bc1faaa3
- Milestone: Milestone 2

## 🔒 Key Constraints
- CODE_ONLY network mode: No external websites, curl, wget.
- Do not write code/test files inside `.agents` (only metadata).
- Follow minimal change principle. Do not perform unrelated refactoring.

## Current Parent
- Conversation ID: 6d08705b-04b8-4a4b-a318-1c50bc1faaa3
- Updated: not yet

## Task Summary
- **What to build**: Purge script in `backend/purge.js` that connects to Supabase and deletes mock data, leaving primary tenant and admin staff account intact. Refactor `frontend/app/dashboard/customers/[id]/page.tsx` to replace mock query hooks with client-side Supabase queries mapping fields to the UI.
- **Success criteria**:
  1. `backend/purge.js` executes successfully and deletes mock records (payments, order items, customer measurements, appointments, orders, customers). Count checks verify they return 0. Primary tenant and admin staff account remain intact.
  2. `frontend/app/dashboard/customers/[id]/page.tsx` loads customer data from Supabase. UI compiles and functions correctly.
  3. `npm run build` succeeds in both `frontend/` and `backend/`.
- **Interface contracts**: Supabase schema and React component typescript interfaces.
- **Code layout**: Frontend in `frontend/`, backend in `backend/`.

## Key Decisions Made
- Checked UUID correctness using a regex filter inside `purge.js` to prevent Postgres engine crashes due to malformed UUID inputs (e.g. mock IDs starting with 'o' or 't').
- Standardized TanStack Query keys to match individual customer queries (`customer-profile`, `customer-ledger`, etc.) ensuring React Query caches state properly.

## Change Tracker
- **Files modified**:
  - `backend/purge.js` (Created/updated: SQL mock data cleanup script)
  - `frontend/app/dashboard/customers/[id]/page.tsx` (Refactored: Client-side dynamic Supabase querying)
- **Build status**: Backend passed. Frontend building in background.
- **Pending issues**: None

## Quality Status
- **Build/test result**: Backend built successfully. Frontend build in progress.
- **Lint status**: To be verified after build.
- **Tests added/modified**: None

## Loaded Skills
- None

## Artifact Index
- `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\worker_m2\original_prompt.md` — Original request prompt.
