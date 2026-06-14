# Handoff Report - Database Purge Script Design

## 1. Observation
From reading `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\seed_database.sql`, the following details were observed:

* **Mock Customers** (inserted at lines 240-245):
  * Line 241: `('c1100000-0000-0000-0000-000000000001', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Priya Sharma', ...)`
  * Line 242: `('c1100000-0000-0000-0000-000000000002', ...)` (Arjun Kapoor)
  * Line 243: `('c1100000-0000-0000-0000-000000000003', ...)` (Meera Nair)
  * Line 244: `('c1100000-0000-0000-0000-000000000004', ...)` (Kabir Singh)
  * Line 245: `('c1100000-0000-0000-0000-000000000005', ...)` (Ananya Desai)

* **Mock Orders** (inserted at lines 257-263):
  * Line 258: `('o1100000-0000-0000-0000-000000000001', ...)`
  * Line 259: `('o1100000-0000-0000-0000-000000000002', ...)`
  * Line 260: `('o1100000-0000-0000-0000-000000000003', ...)`
  * Line 261: `('o1100000-0000-0000-0000-000000000004', ...)`
  * Line 262: `('o1100000-0000-0000-0000-000000000005', ...)`
  * Line 263: `('o1100000-0000-0000-0000-000000000006', ...)`

* **Mock Appointments** (inserted at lines 299-302):
  * Line 300: `('a1100000-0000-0000-0000-000000000001', ...)`
  * Line 301: `('a1100000-0000-0000-0000-000000000002', ...)`
  * Line 302: `('a1100000-0000-0000-0000-000000000003', ...)`

* **Dependent Tables with Foreign Keys**:
  * Line 142: `customer_measurements.customer_id REFERENCES customers(id) ON DELETE CASCADE`
  * Line 80: `order_items.order_id REFERENCES orders(id) ON DELETE CASCADE`
  * Line 92: `payments.order_id REFERENCES orders(id) ON DELETE CASCADE`
  * Line 93: `payments.customer_id REFERENCES customers(id) ON DELETE CASCADE`
  * Line 65: `orders.customer_id REFERENCES customers(id) ON DELETE CASCADE`
  * Line 106: `appointments.customer_id REFERENCES customers(id) ON DELETE CASCADE`
  * Line 107: `appointments.order_id REFERENCES orders(id) ON DELETE CASCADE`

* **Database Triggers**:
  * Line 400: `CREATE TRIGGER trg_update_balances_on_payment AFTER INSERT OR UPDATE OR DELETE ON payments ...`
  * Line 439: `CREATE TRIGGER trg_update_customer_outstanding_on_order AFTER INSERT OR UPDATE OF amount_outstanding, customer_id OR DELETE ON orders ...`

* **Replication/Trigger Control Setting**:
  * Line 164: `SET session_replication_role = 'replica';`
  * Line 305: `SET session_replication_role = 'origin';`

---

## 2. Logic Chain
1. To safely delete data from a relational database, all foreign key relationships must be satisfied.
2. The dependency hierarchy (from child to parent) shows that:
   * `appointments`, `payments`, `order_items`, and `customer_measurements` are child tables.
   * `orders` is a parent to `payments`, `order_items`, and `appointments`, but a child to `customers`.
   * `customers` is the root parent table for this set of data.
3. Therefore, deleting child tables (`appointments`, `payments`, `order_items`, `customer_measurements`) before parent tables (`orders`, then `customers`) guarantees no foreign key constraint violations occur during deletion (independent of CASCADE settings).
4. Deleting from tables `payments`, `orders`, and `customers` invokes user-defined triggers (`trg_update_balances_on_payment` and `trg_update_customer_outstanding_on_order`). These triggers attempt to update order and customer outstanding balances during deletion.
5. If parents are deleted concurrently or triggers fire in a cascading delete sequence, triggers will redundantly execute calculations and try to modify rows that are already in the process of deletion.
6. To avoid redundant executions and potential constraint trigger side-effects, we must set `session_replication_role = 'replica';` at the beginning of the transaction block. This disables all triggers during deletion. Resetting it to `'origin'` before committing restores normal trigger operations.
7. Putting these statements in a single transaction block (`BEGIN;` ... `COMMIT;`) ensures atomicity.

---

## 3. Caveats
* **Tenant & Profile Retention**: The primary vendor (`d290f1ee-6c54-4b01-90e6-d701748f0851`), staff user (`a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`), and measurement field templates are NOT deleted. Doing so would remove the workspace's default configuration and primary administrative account details, preventing access to the system.
* **Superuser Requirement**: The `session_replication_role` change requires superuser privileges (which the `postgres` role in Supabase typically has). If this script is run under a restricted role, the replica commands will fail. However, the deletion sequence itself will still execute successfully because it follows the correct child-to-parent deletion order.

---

## 4. Conclusion
A transactional SQL script that disables triggers via `session_replication_role = 'replica'` and deletes the mock records in the sequence `appointments` -> `payments` -> `order_items` -> `customer_measurements` -> `orders` -> `customers` is the optimal and safest design.

The complete proposed SQL transaction is:
```sql
BEGIN;
SET session_replication_role = 'replica';

-- 1. Delete appointments
DELETE FROM appointments 
WHERE id IN (
  'a1100000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000002',
  'a1100000-0000-0000-0000-000000000003'
);

-- 2. Delete payments
DELETE FROM payments 
WHERE order_id IN (
  'o1100000-0000-0000-0000-000000000001',
  'o1100000-0000-0000-0000-000000000002',
  'o1100000-0000-0000-0000-000000000003',
  'o1100000-0000-0000-0000-000000000004',
  'o1100000-0000-0000-0000-000000000005',
  'o1100000-0000-0000-0000-000000000006'
) OR customer_id IN (
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
);

-- 3. Delete order items
DELETE FROM order_items 
WHERE order_id IN (
  'o1100000-0000-0000-0000-000000000001',
  'o1100000-0000-0000-0000-000000000002',
  'o1100000-0000-0000-0000-000000000003',
  'o1100000-0000-0000-0000-000000000004',
  'o1100000-0000-0000-0000-000000000005',
  'o1100000-0000-0000-0000-000000000006'
);

-- 4. Delete customer measurements
DELETE FROM customer_measurements 
WHERE customer_id IN (
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
);

-- 5. Delete orders
DELETE FROM orders 
WHERE id IN (
  'o1100000-0000-0000-0000-000000000001',
  'o1100000-0000-0000-0000-000000000002',
  'o1100000-0000-0000-0000-000000000003',
  'o1100000-0000-0000-0000-000000000004',
  'o1100000-0000-0000-0000-000000000005',
  'o1100000-0000-0000-0000-000000000006'
);

-- 6. Delete customers
DELETE FROM customers 
WHERE id IN (
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
);

SET session_replication_role = 'origin';
COMMIT;
```

---

## 5. Verification Method
1. Connect to the database CLI or manager.
2. Run the count queries defined in the **Verification Plan** section of `analysis.md` (reproduced below) to confirm the mock data exists:
   ```sql
   SELECT COUNT(*) FROM appointments WHERE id IN ('a1100000-0000-0000-0000-000000000001','a1100000-0000-0000-0000-000000000002','a1100000-0000-0000-0000-000000000003');
   SELECT COUNT(*) FROM orders WHERE id IN ('o1100000-0000-0000-0000-000000000001','o1100000-0000-0000-0000-000000000002','o1100000-0000-0000-0000-000000000003','o1100000-0000-0000-0000-000000000004','o1100000-0000-0000-0000-000000000005','o1100000-0000-0000-0000-000000000006');
   SELECT COUNT(*) FROM customers WHERE id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005');
   ```
3. Execute the SQL Transaction script.
4. Run the count queries again. They must all return `0`.
5. Run the application (or run backend integration tests, e.g. `npm test`) to ensure no DB errors or constraint violations are raised and that the app loads cleanly without displaying seed mock data.
