## 2026-06-10T17:46:56Z
**Context**: Implement SQL cleanup and customer details dynamic query (Milestone 2).
**Content**:
You are tasked with implementing Milestone 2:
1. Write a script `backend/purge.js` that connects to the database via `@supabase/supabase-js` using the credentials in `backend/.env`. It must delete the mock customers, mock orders, mock appointments, and their related records (payments, order items, customer measurements) in the correct logical sequence to prevent foreign key errors. Make sure it leaves the primary tenant (vendor `d290f1ee-6c54-4b01-90e6-d701748f0851`) and admin staff account (`a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`) intact.
Run this script to wipe the mock data from the database. Verify that all count checks for the wiped records return 0.
2. Refactor `frontend/app/dashboard/customers/[id]/page.tsx` to replace the 5 mock-data `useQuery` hooks with client-side Supabase queries using the client-side `supabase` instance imported from `@/utils/supabase` (or correct import path). Map database fields to the UI interfaces correctly:
   - Profile: customer record matching `id` (name, full_name, phone, email, address, notes, total_outstanding).
   - Ledger: payments table filtered by `customer_id`, joining orders on `order_id` to fetch the `order_number`.
   - Orders: orders table filtered by `customer_id`.
   - Measurements: customer_measurements table filtered by `customer_id`.
   - Appointments: appointments table filtered by `customer_id`.
Ensure typescript casts/mapping are correct (e.g., parsing numeric strings as `Number(...)` to avoid formatting crashes).
3. Run `npm run build` in `frontend/` and `npm run build` in `backend/` to verify everything builds successfully.
4. Document your changes in `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\worker_m2\changes.md` and write your handoff in `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\.agents\worker_m2\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
**Action**: Implement the changes, verify the builds, execute the purge script, and reply with the paths to your changes and handoff reports.
