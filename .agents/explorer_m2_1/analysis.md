# Database Mock Data Purge Analysis & Design

## Overview
This document analyzes the database schema and triggers defined in `seed_database.sql` to design a safe, transactional SQL script to delete old mock customers, orders, and appointments. The goal is to clean up the workspace's mock database records without breaking any triggers, constraints, or table structures.

---

## 1. Identified Tables and Mock Records

From `seed_database.sql`, we identify the following mock records that need to be deleted:

### A. Core Entities (Explicit IDs)
* **Appointments** (`appointments`):
  * `a1100000-0000-0000-0000-000000000001`
  * `a1100000-0000-0000-0000-000000000002`
  * `a1100000-0000-0000-0000-000000000003`
* **Orders** (`orders`):
  * `o1100000-0000-0000-0000-000000000001`
  * `o1100000-0000-0000-0000-000000000002`
  * `o1100000-0000-0000-0000-000000000003`
  * `o1100000-0000-0000-0000-000000000004`
  * `o1100000-0000-0000-0000-000000000005`
  * `o1100000-0000-0000-0000-000000000006`
* **Customers** (`customers`):
  * `c1100000-0000-0000-0000-000000000001`
  * `c1100000-0000-0000-0000-000000000002`
  * `c1100000-0000-0000-0000-000000000003`
  * `c1100000-0000-0000-0000-000000000004`
  * `c1100000-0000-0000-0000-000000000005`

### B. Dependent Entities (Dynamic IDs)
Some tables contain records with dynamically generated UUIDs (`gen_random_uuid()`), which must be cleared by targeting their foreign key relationships with the above explicit IDs:
* **Order Items** (`order_items`):
  * Items linked to mock orders: `order_id IN ('o1100000-0000-0000-0000-000000000001', ...)`
* **Payments** (`payments`):
  * Payments linked to mock orders or mock customers: `order_id IN ('o1100000-0000-0000-0000-000000000001', ...)` or `customer_id IN ('c1100000-0000-0000-0000-000000000001', ...)`
* **Customer Measurements** (`customer_measurements`):
  * Measurements linked to mock customers: `customer_id IN ('c1100000-0000-0000-0000-000000000001', ...)`

---

## 2. Foreign Key Constraint Hierarchy

To delete records without relying solely on cascading deletions (which can trigger unintended side-effects) and to satisfy foreign key constraints in an enforced environment, we must delete child records before their parents.

The schema's reference chain is:
1. `appointments` references `customers` and `orders`.
2. `order_items` references `orders`.
3. `payments` references `customers` and `orders`.
4. `customer_measurements` references `customers`.
5. `orders` references `customers`.
6. `customers` has no child-referencing foreign keys (it only references `vendors`).

### Correct Order of Deletion
To avoid violating foreign key constraints:
1. **Delete from `appointments`** (depends on `orders` and `customers`).
2. **Delete from `payments`** (depends on `orders` and `customers`).
3. **Delete from `order_items`** (depends on `orders`).
4. **Delete from `orders`** (depends on `customers`).
5. **Delete from `customer_measurements`** (depends on `customers`).
6. **Delete from `customers`** (no child dependencies left).

---

## 3. Database Triggers Analysis & Replica Settings

The database contains several triggers designed to maintain data aggregation and business logic consistency:
* `trg_update_balances_on_payment` (`AFTER INSERT OR UPDATE OR DELETE ON payments`):
  Recalculates and updates order paid balances and customer outstanding balances when payments are modified/deleted.
* `trg_update_customer_outstanding_on_order` (`AFTER INSERT OR UPDATE OR DELETE ON orders`):
  Recalculates and updates customer total outstanding balances when orders are modified/deleted.

### Impact of Deletions on Triggers
If triggers are enabled during deletion:
1. Deleting a payment will invoke `trg_update_balances_on_payment`, trying to update parent `orders` and `customers`.
2. Deleting an order will invoke `trg_update_customer_outstanding_on_order`, trying to update parent `customers`.
3. If parents are deleted in a single step (cascade), child triggers will attempt to update rows that are marked for deletion or already deleted. This can result in:
   * Performance overhead (redundant updates on doomed records).
   * Potential deadlock conditions or unexpected write lock contentions.

### Replica Settings Solution
To bypass these triggers safely, we can temporarily set the replication role for the current session to `'replica'`. In PostgreSQL, standard user-defined triggers do not fire in replica mode.
* **Command**: `SET session_replication_role = 'replica';`
* **Restore Command**: `SET session_replication_role = 'origin';`

By running our purge statements within a transaction block after changing this session variable, we ensure:
1. No triggers are executed, preventing any side effects.
2. The entire cleanup succeeds or rolls back atomically.

---

## 4. Transaction SQL Script Design

Below is the proposed SQL transaction script to perform the deletion cleanly.

```sql
-- Start transaction
BEGIN;

-- 1. Disable user triggers and foreign key trigger executions for the current session
SET session_replication_role = 'replica';

-- 2. Delete child records to satisfy constraints logically
-- A. Delete mock appointments
DELETE FROM appointments 
WHERE id IN (
  'a1100000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000002',
  'a1100000-0000-0000-0000-000000000003'
);

-- B. Delete mock payments (dynamic IDs, mapped via mock order and customer IDs)
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

-- C. Delete mock order items (dynamic IDs, mapped via mock order IDs)
DELETE FROM order_items 
WHERE order_id IN (
  'o1100000-0000-0000-0000-000000000001',
  'o1100000-0000-0000-0000-000000000002',
  'o1100000-0000-0000-0000-000000000003',
  'o1100000-0000-0000-0000-000000000004',
  'o1100000-0000-0000-0000-000000000005',
  'o1100000-0000-0000-0000-000000000006'
);

-- D. Delete mock customer measurements (dynamic IDs, mapped via mock customer IDs)
DELETE FROM customer_measurements 
WHERE customer_id IN (
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
);

-- 3. Delete parent records
-- E. Delete mock orders
DELETE FROM orders 
WHERE id IN (
  'o1100000-0000-0000-0000-000000000001',
  'o1100000-0000-0000-0000-000000000002',
  'o1100000-0000-0000-0000-000000000003',
  'o1100000-0000-0000-0000-000000000004',
  'o1100000-0000-0000-0000-000000000005',
  'o1100000-0000-0000-0000-000000000006'
);

-- F. Delete mock customers
DELETE FROM customers 
WHERE id IN (
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
);

-- 4. Re-enable triggers for the session
SET session_replication_role = 'origin';

-- Commit transaction
COMMIT;
```

---

## 5. Verification Plan

To verify that the script executes correctly and has fully purged the mock data:

### Pre-execution Counts
Before running the purge, verify that the records exist. Running these queries should return counts matching the numbers in parentheses:
```sql
SELECT COUNT(*) FROM appointments WHERE id IN ('a1100000-0000-0000-0000-000000000001','a1100000-0000-0000-0000-000000000002','a1100000-0000-0000-0000-000000000003'); -- Expected: 3
SELECT COUNT(*) FROM orders WHERE id IN ('o1100000-0000-0000-0000-000000000001','o1100000-0000-0000-0000-000000000002','o1100000-0000-0000-0000-000000000003','o1100000-0000-0000-0000-000000000004','o1100000-0000-0000-0000-000000000005','o1100000-0000-0000-0000-000000000006'); -- Expected: 6
SELECT COUNT(*) FROM customers WHERE id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005'); -- Expected: 5
SELECT COUNT(*) FROM payments WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005'); -- Expected: 6
SELECT COUNT(*) FROM order_items WHERE order_id IN ('o1100000-0000-0000-0000-000000000001','o1100000-0000-0000-0000-000000000002','o1100000-0000-0000-0000-000000000003','o1100000-0000-0000-0000-000000000004','o1100000-0000-0000-0000-000000000005','o1100000-0000-0000-0000-000000000006'); -- Expected: 10
SELECT COUNT(*) FROM customer_measurements WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005'); -- Expected: 2
```

### Post-execution Counts
After running the transaction script, run the exact same queries. All should return a count of `0`.

---

## 6. Assumptions and Caveats
* **Tenant Preservation**: This script does NOT delete the vendor record `d290f1ee-6c54-4b01-90e6-d701748f0851` ('Stitch & Soul Atelier') or the staff record `a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d` ('Soham Vaghasia') or their auth details. This is intentional as they represent the primary admin session credentials and boutique configurations required to use the system.
* **Superuser Permission**: Changing `session_replication_role` to `'replica'` requires superuser privilege in PostgreSQL (in Supabase, the default `postgres` connection role has this privilege). If run by a non-privileged user, it will fail. In that case, the deletion order chosen (child to parent) is still valid and will run successfully, but triggers will execute and update the parent tables redundantly before they are deleted.
