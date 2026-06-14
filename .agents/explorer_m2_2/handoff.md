# Handoff Report — explorer_m2_2

## 1. Observation
- Target component: `frontend/app/dashboard/customers/[id]/page.tsx`
- Five mock-data `useQuery` hooks were identified:
  - **Query 1 (Profile)**: Lines 68–83, returning static profile details for `'Priya Sharma'`.
  - **Query 2 (Ledger)**: Lines 86–94, returning a hardcoded two-item array with `order_number: 'ORD-202605-0042'`.
  - **Query 3 (Orders)**: Lines 97–104, returning a hardcoded order summary with `status: 'in_progress'`.
  - **Query 4 (Measurements)**: Lines 107–114, returning a single measurement consultation record.
  - **Query 5 (Appointments)**: Lines 117–124, returning a single mock appointment titled `'Lehenga First Fitting Trial'`.
- Database schema found in `seed_database.sql` has the following corresponding tables:
  - `customers`: Holds profile details (`id`, `full_name`, `phone`, `email`, `address`, `notes`, `total_outstanding`).
  - `payments`: Holds payment ledger lines (`id`, `customer_id`, `order_id`, `amount`, `payment_mode`, `reference_note`, `paid_at`).
  - `orders`: Holds customer orders (`id`, `customer_id`, `order_number`, `description`, `total_amount`, `amount_outstanding`, `status`, `delivery_date`).
  - `customer_measurements`: Holds measurement snapshots (`id`, `customer_id`, `label`, `values` JSONB, `notes`, `recorded_at`).
  - `appointments`: Holds appointments (`id`, `customer_id`, `title`, `scheduled_date`, `stage`, `status`).

---

## 2. Logic Chain
1. *Goal*: Convert frontend/app/dashboard/customers/[id]/page.tsx from mock data queries to live client-side Supabase queries.
2. *Data mapping*:
   - The React component extracts the customer ID via `const customerId = params.id as string;` (line 60).
   - This ID maps directly to foreign keys/primary keys in the Supabase schema:
     - `customers.id = customerId` for the core profile.
     - `orders.customer_id = customerId` for the customer's orders.
     - `payments.customer_id = customerId` for the ledger.
     - `customer_measurements.customer_id = customerId` for the customer's measurements.
     - `appointments.customer_id = customerId` for the customer's appointments.
   - For `payments`, the UI displays the `order_number` column (line 25), which exists in the `orders` table. Thus, our query must use a relational select: `select('..., orders (order_number)')` to perform a client-side join.
3. *Outstanding Balance calculation*:
   - Triggers defined in `seed_database.sql` (e.g., `trg_calculate_order_outstanding`, `trg_update_balances_on_payment`, and `trg_update_customer_outstanding_on_order`) ensure the database tables maintain accurate balances automatically.
   - Therefore, the client application can fetch `total_outstanding` and `amount_outstanding` directly from the database columns without manual client-side computation.

---

## 3. Caveats
- Since this is a read-only investigation, the proposed queries have not been directly integrated into the source files.
- The typescript compilation of any query mapping depends on the typings of the local supabase client and database schema types, which may require typecasting or numeric conversion (`Number(val)`).

---

## 4. Conclusion
We have identified all mock data queries in the customer profile page and formulated a clean client-side Supabase query strategy to fetch live data from the database. The queries fetch from their corresponding tables (`customers`, `payments`, `orders`, `customer_measurements`, `appointments`) by filtering on the customer's UUID and leveraging client-side relational joins where necessary.

---

## 5. Verification Method
1. **Source Code Inspection**: Inspect `frontend/app/dashboard/customers/[id]/page.tsx` (specifically lines 68-124) to verify the target mock data structures.
2. **Build and Compilation**: Run `npm run build` in the `frontend` directory to ensure no typing regressions occur when replacing query hook logic.
3. **Lint checks**: Run `npm run lint` in the `frontend` directory to verify code style and TypeScript compliance.
