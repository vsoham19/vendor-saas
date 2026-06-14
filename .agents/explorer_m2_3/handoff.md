# Handoff Report: Milestone 2 Integration & Testing Synthesis

## 1. Observation
- **Database Schema & Triggers**:
  - Located in `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\seed_database.sql`.
  - Four main triggers were identified:
    1. `trg_generate_order_number` (line 344) triggers on `BEFORE INSERT ON orders`.
    2. `trg_calculate_order_outstanding` (line 359) triggers on `BEFORE INSERT OR UPDATE OF total_amount, amount_paid ON orders`.
    3. `trg_update_balances_on_payment` (line 400) triggers on `AFTER INSERT OR UPDATE OR DELETE ON payments`.
    4. `trg_update_customer_outstanding_on_order` (line 439) triggers on `AFTER INSERT OR UPDATE OF amount_outstanding, customer_id OR DELETE ON orders`.
- **Frontend Query Configurations & Hooks**:
  - Found in `frontend/hooks/useCustomer.ts`, `frontend/hooks/useOrders.ts`, `frontend/hooks/useAppointments.ts`, and `frontend/app/dashboard/customers/page.tsx` and `frontend/app/dashboard/customers/[id]/page.tsx`.
  - Audited existing invalidation triggers on mutation:
    - In `useOrders.ts`, `useCreate` order invalidates `['orders']` and `['customer-profile', customer_id]`.
    - In `useOrders.ts`, `useRecordPayment` invalidates `['order', orderId]` and `['customer-profile', customer_id]`.
  - Mismatch observed:
    - Customer list page queries `['customers-list']` (line 43 in `customers/page.tsx`).
    - Customer list hook queries `['customers']` (line 23 in `useCustomer.ts`).
    - Customer profile page queries `['customer-profile', customerId]` (line 70 in `[id]/page.tsx`).
    - Customer profile hook queries `['customer', id]` (line 37 in `useCustomer.ts`).
- **Target Page for Dynamic Content Refactoring**:
  - `frontend/app/dashboard/customers/[id]/page.tsx`. Currently, it returns hardcoded mock data for all queries (lines 68–124) returning `'Priya Sharma'` profile, orders, ledger, measurements, and appointments.
- **Project Test Environment**:
  - No existing tests or test frameworks were found in `backend/package.json` or `frontend/package.json`.

---

## 2. Logic Chain
- **Trigger-React Query Compatibility**:
  1. The server-side triggers calculate the output of orders and customer balances reactively based on inserts/updates on `payments` and `orders`.
  2. Because React Query relies on client-side state caches, mutations performed in the UI (e.g. logging a payment or creating an order) result in backend changes that React Query is unaware of.
  3. Therefore, unless React Query explicitly invalidates and refetches all related queries, the UI will display stale, inconsistent balances.
  4. The current invalidations are inadequate. When a payment is recorded, `['orders']` (the order directory list) and `['customers-list']` (the customer directory list) are not invalidated, which leaves outstanding balances and paid sums out-of-sync in those views.
  5. The mismatch between query keys used in custom hooks (e.g. `['customers']`, `['customer', id]`) and directory/profile pages (e.g. `['customers-list']`, `['customer-profile', id]`) will cause invalidation failure when components transition to custom hooks.
- **Dynamic Customer Details page**:
  1. The profile details page needs to fetch live Supabase data.
  2. The extracted `customerId` from URL params maps to the database primary key `customers.id`, and foreign keys `orders.customer_id`, `payments.customer_id`, `customer_measurements.customer_id`, and `appointments.customer_id`.
  3. Relational joins must be performed to associate tables (e.g., querying `payments` and fetching `orders (order_number)`).
- **Purge Validation**:
  1. The SQL cleanup script deletes mock data.
  2. Because constraints are configured as `ON DELETE CASCADE` (verified in table structures in `seed_database.sql`), deleting mock customers with ID prefix `c1100000%` will cascade delete all associated order items, payments, appointments, measurements, and orders.
  3. Disabling triggers via `session_replication_role = 'replica'` avoids calculation triggers firing redundantly on records marked for deletion, avoiding deadlock or lock contention in single transactions.

---

## 3. Caveats
- Since this is a read-only investigation, the proposed code corrections and playwright test configuration are designed in `analysis.md` but not directly written to the codebase files.
- The `session_replication_role` change requires superuser credentials in PostgreSQL. If the cleanup script is run using a role without superuser privileges, it will throw an error. In that scenario, standard cascading deletes must be run with triggers active, which will execute calculations on rows before they are deleted.

---

## 4. Conclusion
- React Query invalidation policies must be extended. Recording payments or orders must invalidate the master customer list (`['customers']` or `['customers-list']`), order list (`['orders']`), ledger list (`['customer-ledger', id]`), and customer orders (`['customer-orders', id]`).
- Query keys must be unified across the codebase (specifically alignment of `['customers']` vs `['customers-list']` and `['customer']` vs `['customer-profile']`).
- Refactoring `frontend/app/dashboard/customers/[id]/page.tsx` to call `supabase` directly using parameterized queries (as formulated in Section 2 of `analysis.md`) will correctly make the customer profile dynamic.
- The SQL cleanup transaction is safe and must follow correct sequence controls (child to parent) or use `session_replication_role = 'replica'` to deactivate trigger side-effects during deletion.

---

## 5. Verification Method
1. **Query Key Verification**: Verify that the query keys in `frontend/hooks/useCustomer.ts` and `frontend/app/dashboard/customers/[id]/page.tsx` have been updated to match exactly to prevent desynchronization.
2. **Page Refactor Inspection**: Inspect `frontend/app/dashboard/customers/[id]/page.tsx` to verify that all five query hooks retrieve data from Supabase client (`supabase.from(...)`) using `customerId` instead of hardcoded JSON.
3. **Database Purge Test**: 
   - Execute the SQL pre-checks to verify counts.
   - Execute the cleanup SQL script.
   - Run the post-check queries. Ensure all counts for mock data are `0` and that the vendor `d290f1ee-6c54-4b01-90e6-d701748f0851` and staff `a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d` are intact.
4. **Integration Test Verification**: Run `npm run check` or `npm run build` in the `backend` and `frontend` folders to ensure TypeScript compilation passes. Once Vitest and Playwright are set up, execute:
   - `npx playwright test e2e/customer-details.spec.ts` (verifies page rendering).
   - `npx vitest run test/customer-creation.test.ts` (verifies customer programmatic creation).
