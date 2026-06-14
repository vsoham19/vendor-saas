# Milestone 2 Integration Synthesis & Verification Plan

## Executive Summary
This document synthesizes the integration points between the backend and frontend databases for **Milestone 2** of the boutique/atelier multi-tenant SaaS platform. Specifically, it covers:
1. **Compatibility of Database Triggers with React Query**: Analysis of how PostgreSQL triggers on orders/payments impact the client-side TanStack React Query cache, identification of cache-staleness risks, query key mismatches, and formulation of an invalidation policy.
2. **Dynamic Customer Detail Refactoring**: Designing the query replacements for the customer details page (`/dashboard/customers/[id]/page.tsx`) to pull live data from Supabase.
3. **Verification and Testing Plan**: A concrete, step-by-step test plan to verify customer creation, UI rendering, and the mock data purge SQL script.

---

## 1. Compatibility of Database Triggers with React Query

### A. PostgreSQL Triggers Overview
The database schema defined in `seed_database.sql` uses four triggers to manage serial values and financial aggregation logic automatically on the database layer:

1. **`trg_generate_order_number`** (`BEFORE INSERT ON orders`):
   - Generates a serial order number (e.g., `ORD-202606-0001`) if none is provided.
   - *UI Impact*: The client does not need to generate order numbers when posting orders. However, if the client mutation response does not include the server-returned row, the client will lack the generated order number.
2. **`trg_calculate_order_outstanding`** (`BEFORE INSERT OR UPDATE ON orders`):
   - Computes `amount_outstanding = total_amount - amount_paid`.
   - *UI Impact*: Client-side calculations of order outstanding balances are redundant. The server-computed column is the single source of truth.
3. **`trg_update_balances_on_payment`** (`AFTER INSERT OR UPDATE OR DELETE ON payments`):
   - Recalculates order `amount_paid` (which triggers `trg_calculate_order_outstanding`) and updates the customer's `total_outstanding` balance as the sum of outstanding balances from all their orders.
   - *UI Impact*: Any mutation to `payments` (adding, editing, deleting) has cascading updates on both `orders` and `customers` tables.
4. **`trg_update_customer_outstanding_on_order`** (`AFTER INSERT OR UPDATE OR DELETE ON orders`):
   - Recalculates `total_outstanding` on `customers`. It also handles reassignment of orders between customers, updating both old and new customers' outstanding balances.
   - *UI Impact*: Creating, modifying, or deleting orders directly modifies the customer's aggregated total dues.

---

### B. Integration Hazards & Cache Staleness Matrix
Because these calculations happen in PostgreSQL on the server side, client-side React Query caches will immediately become stale unless explicitly invalidated. The following matrix traces database mutations, their side-effects, and the query keys that must be invalidated to prevent UI desynchronization:

| Trigger / DB Mutation | Cascading Database Side-Effects | Stale Query Keys (Need Invalidation) | Impact of Neglecting Invalidation |
| :--- | :--- | :--- | :--- |
| **Create Order**<br>`INSERT INTO orders`<br>(potentially with initial advance payment) | - Generates `order_number`<br>- Computes `amount_outstanding`<br>- Adds payment (if advance given)<br>- Increases customer `total_outstanding` | - `['orders']` (orders list)<br>- `['customers-list']` (customers list)<br>- `['customer-profile', customerId]` / `['customer', customerId]` (profile details)<br>- `['customer-orders', customerId]` (orders on detail page)<br>- `['customer-ledger', customerId]` (payments ledger) | - The customer profile page will show a stale outstanding dues balance.<br>- The customer list page will show an outdated outstanding balance and incorrect active order counts.<br>- The ledger tab on the customer page will miss the advance payment transaction. |
| **Record Payment**<br>`INSERT INTO payments` | - Computes order `amount_paid` & `amount_outstanding`<br>- Decreases customer `total_outstanding` | - `['order', orderId]` (order detail)<br>- `['orders']` (orders list)<br>- `['customers-list']` (customers list)<br>- `['customer-profile', customerId]` / `['customer', customerId]` (profile details)<br>- `['customer-ledger', customerId]` (payments ledger)<br>- `['customer-orders', customerId]` (orders list on detail page) | - The orders directory page will show incorrect order dues.<br>- The customer directory page will show outdated total dues (e.g. still marked as "due" instead of "settled").<br>- The ledger list will not display the newly logged payment. |
| **Modify/Delete Order**<br>`UPDATE/DELETE orders` | - Recomputes customer `total_outstanding`<br>- Updates outstanding balances | - `['orders']`<br>- `['order', orderId]`<br>- `['customers-list']`<br>- `['customer-profile', customerId]` / `['customer', customerId]` | - Client view of order status, amount, and customer outstanding balance is out-of-sync. |
| **Modify/Delete Payment**<br>`UPDATE/DELETE payments` | - Recalculates order `amount_paid` / `amount_outstanding`<br>- Recalculates customer `total_outstanding` | - `['order', orderId]` / `['orders']`<br>- `['customers-list']`<br>- `['customer-profile', customerId]` / `['customer', customerId]`<br>- `['customer-ledger', customerId]` | - Order balances and customer outstanding totals remain stale on details and summary pages. |

---

### C. Query Key Mismatches & Codebase Audits
A critical review of the current frontend codebase reveals significant query key inconsistencies between custom hooks and direct page queries. These mismatches mean that even when invalidations are called, they fail to refresh the active page views:

1. **Customer Directory Listing**:
   - `frontend/hooks/useCustomer.ts` defines `useList()` with query key: `['customers']`.
   - `frontend/app/dashboard/customers/page.tsx` fetches list with query key: `['customers-list']`.
   - *Result*: Adding a customer via the hook does not refresh the customer directory view because `['customers-list']` is not invalidated.
2. **Customer Detail Profile**:
   - `frontend/hooks/useCustomer.ts` defines `useProfile(id)` with query key: `['customer', id]`.
   - `frontend/app/dashboard/customers/[id]/page.tsx` fetches profile with query key: `['customer-profile', customerId]`.
   - `frontend/hooks/useOrders.ts`'s `useCreate` and `useRecordPayment` mutations invalidate `['customer-profile', customerId]`.
   - *Result*: If the profile details are refactored to use the hook's `['customer', id]`, the mutations in `useOrders.ts` will fail to invalidate the cache because they target the wrong key.
3. **Customer Orders**:
   - `frontend/hooks/useOrders.ts` defines `useList()` with query key: `['orders']`.
   - `frontend/app/dashboard/customers/[id]/page.tsx` fetches customer-specific orders using query key: `['customer-orders', customerId]`.
   - *Result*: Creating or editing an order invalidates `['orders']` but leaves `['customer-orders', customerId]` stale on the customer profile page.

#### Recommended Action for Developers:
Unify query keys across hooks and components. All developers must adopt the following standardized naming schema:
- List of all customers: `['customers']`
- Single customer profile: `['customer', id]`
- Single customer's orders: `['customer-orders', id]`
- Single customer's ledger: `['customer-ledger', id]`
- Single customer's measurements: `['customer-measurements', id]`
- Single customer's appointments: `['customer-appointments', id]`
- List of all orders: `['orders']`
- Single order details: `['order', id]`

---

## 2. Dynamic Customer Details Query Replacement Strategy
The customer details page (`frontend/app/dashboard/customers/[id]/page.tsx`) currently returns hardcoded mock data for the profile, orders, ledger, measurements, and appointments. To make this page fully dynamic and database-driven, replace the mock `queryFn` implementations with client-side Supabase queries as follows:

### 1. Core Profile Fetch
Retrieve the customer record filtering by the `id` param.
```typescript
// Replace lines 68-83 in [id]/page.tsx
const { data: profile, isLoading: isProfileLoading } = useQuery<CustomerProfile>({
  queryKey: ['customer-profile', customerId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, address, notes, total_outstanding')
      .eq('id', customerId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Customer profile not found');

    return {
      id: data.id,
      full_name: data.full_name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      notes: data.notes,
      total_outstanding: Number(data.total_outstanding || 0)
    };
  },
  enabled: !!customerId
});
```

### 2. Financial Ledger History (with relational Order join)
Query the payments table and join orders to fetch the `order_number`.
```typescript
// Replace lines 86-94 in [id]/page.tsx
const { data: ledger = [] } = useQuery<LedgerItem[]>({
  queryKey: ['customer-ledger', customerId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        payment_mode,
        reference_note,
        paid_at,
        orders (
          order_number
        )
      `)
      .eq('customer_id', customerId)
      .order('paid_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      amount: Number(item.amount || 0),
      payment_mode: item.payment_mode,
      reference_note: item.reference_note,
      paid_at: item.paid_at,
      order_number: item.orders?.order_number
    }));
  },
  enabled: !!customerId
});
```

### 3. Customer Orders
Retrieve all orders associated with the customer ID.
```typescript
// Replace lines 97-104 in [id]/page.tsx
const { data: orders = [] } = useQuery<OrderItemSummary[]>({
  queryKey: ['customer-orders', customerId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, description, total_amount, amount_outstanding, status, delivery_date')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((ord: any) => ({
      id: ord.id,
      order_number: ord.order_number,
      description: ord.description,
      total_amount: Number(ord.total_amount || 0),
      amount_outstanding: Number(ord.amount_outstanding || 0),
      status: ord.status,
      delivery_date: ord.delivery_date
    }));
  },
  enabled: !!customerId
});
```

### 4. Custom Measurement Snapshots
Query the `customer_measurements` table to retrieve custom measurement fields.
```typescript
// Replace lines 107-114 in [id]/page.tsx
const { data: measurements = [] } = useQuery<MeasurementRecord[]>({
  queryKey: ['customer-measurements', customerId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('customer_measurements')
      .select('id, label, values, notes, recorded_at')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((rec: any) => ({
      id: rec.id,
      label: rec.label || 'Unnamed Session',
      values: rec.values || {},
      notes: rec.notes,
      recorded_at: rec.recorded_at
    }));
  },
  enabled: !!customerId
});
```

### 5. Fitting Appointments
Retrieve scheduled fitting trials.
```typescript
// Replace lines 117-124 in [id]/page.tsx
const { data: appointments = [] } = useQuery<AppointmentItem[]>({
  queryKey: ['customer-appointments', customerId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, title, scheduled_date, stage, status')
      .eq('customer_id', customerId)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((appt: any) => ({
      id: appt.id,
      title: appt.title,
      scheduled_date: appt.scheduled_date,
      stage: appt.stage,
      status: appt.status
    }));
  },
  enabled: !!customerId
});
```

---

## 3. Test Plan for Verifying Dynamic Customer Details

Since the project does not have a testing framework installed, it is recommended to set up:
1. **Vitest** (or Jest) in the backend to perform database and integration unit tests.
2. **Playwright** (or Cypress) in the frontend for End-to-End browser flow verification.

### Test Case 1: Programmatic Customer Creation & Database Verification
- **Objective**: Verify that a customer record is successfully added to the database with all details, and check that the initial outstanding balance is 0.
- **Verification Commands (Vitest Integration Test)**:
  ```typescript
  // test/customer-creation.test.ts
  import { describe, it, expect, beforeAll } from 'vitest';
  import { createClient } from '@supabase/supabase-js';
  
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  describe('Programmatic Customer Creation', () => {
    const testCustomerId = 'e9f8d7c6-b5a4-4321-9876-000000000001';
    const testVendorId = 'd290f1ee-6c54-4b01-90e6-d701748f0851'; // Seeded Stitch & Soul
    
    beforeAll(async () => {
      // Clean up previous test run if any
      await supabase.from('customers').delete().eq('id', testCustomerId);
    });
  
    it('should insert customer successfully and initialize outstanding balance to 0', async () => {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          id: testCustomerId,
          vendor_id: testVendorId,
          name: 'Test Customer Integration',
          full_name: 'Test Customer Integration',
          phone: '9999988888',
          email: 'integration@test.com',
          address: 'Test House, Suite 404, New Delhi',
          notes: 'Likes custom testing'
        }])
        .select()
        .single();
  
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.full_name).toBe('Test Customer Integration');
      expect(data.phone).toBe('9999988888');
      
      // Database level default value check
      expect(Number(data.total_outstanding)).toBe(0);
    });
  });
  ```

### Test Case 2: Dynamic Customer Details Page Verification
- **Objective**: Verify that `/dashboard/customers/[id]` displays the database-sourced values for the newly created customer instead of the hardcoded Priya Sharma details.
- **Verification Steps (Playwright E2E Test)**:
  ```typescript
  // e2e/customer-details.spec.ts
  import { test, expect } from '@playwright/test';
  
  test.describe('Customer Detail Page Verification', () => {
    const testCustomerId = 'e9f8d7c6-b5a4-4321-9876-000000000001';
    
    test('should show correct customer details and verify dynamic fields', async ({ page }) => {
      // 1. Perform login
      await page.goto('/login');
      await page.fill('input[type="email"]', 'vsoham19@gmail.com');
      await page.fill('input[type="password"]', '123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // 2. Navigate directly to the dynamic customer details URL
      await page.goto(`/dashboard/customers/${testCustomerId}`);
      
      // 3. Assert profile info displays correctly (real DB values)
      await expect(page.locator('h2')).toContainText('Test Customer Integration');
      await expect(page.locator('text=9999988888')).toBeVisible();
      await expect(page.locator('text=integration@test.com')).toBeVisible();
      await expect(page.locator('text=Test House, Suite 404')).toBeVisible();
      await expect(page.locator('text=Likes custom testing')).toBeVisible();
      
      // 4. Assert Outstanding dues reads database trigger state
      // Expected ₹0 since no orders are created yet
      await expect(page.locator('text=₹0')).toBeVisible();
    });
  });
  ```

### Test Case 3: SQL Cleanup Script Verification
- **Objective**: Verify that the database cleanup script deletes all mock data (5 customers, 6 orders, 3 appointments, and associated payments, items, measurements) while leaving core config data intact.
- **Verification SQL Script Sequence**:
  ```sql
  -- A. Pre-execution count checks (Assert mock data exists)
  SELECT COUNT(*) AS mock_customers_count FROM customers WHERE id IN (
    'c1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002',
    'c1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000004',
    'c1100000-0000-0000-0000-000000000005'
  ); -- Expected: 5
  
  SELECT COUNT(*) AS mock_orders_count FROM orders WHERE id IN (
    'o1100000-0000-0000-0000-000000000001', 'o1100000-0000-0000-0000-000000000002',
    'o1100000-0000-0000-0000-000000000003', 'o1100000-0000-0000-0000-000000000004',
    'o1100000-0000-0000-0000-000000000005', 'o1100000-0000-0000-0000-000000000006'
  ); -- Expected: 6
  
  SELECT COUNT(*) AS mock_appointments_count FROM appointments WHERE id IN (
    'a1100000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000002',
    'a1100000-0000-0000-0000-000000000003'
  ); -- Expected: 3

  -- B. Execute cleanup transaction
  BEGIN;
  SET session_replication_role = 'replica';
  
  DELETE FROM appointments WHERE id IN ('a1100000-0000-0000-0000-000000000001','a1100000-0000-0000-0000-000000000002','a1100000-0000-0000-0000-000000000003');
  DELETE FROM customer_measurements WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005');
  DELETE FROM payments WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005');
  DELETE FROM order_items WHERE order_id IN ('o1100000-0000-0000-0000-000000000001','o1100000-0000-0000-0000-000000000002','o1100000-0000-0000-0000-000000000003','o1100000-0000-0000-0000-000000000004','o1100000-0000-0000-0000-000000000005','o1100000-0000-0000-0000-000000000006');
  DELETE FROM orders WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005');
  DELETE FROM customers WHERE id IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000002','c1100000-0000-0000-0000-000000000003','c1100000-0000-0000-0000-000000000004','c1100000-0000-0000-0000-000000000005');
  
  SET session_replication_role = 'origin';
  COMMIT;

  -- C. Post-execution count checks (Assert mock data is wiped)
  -- Running the SELECT COUNT(*) queries from A must all return 0.

  -- D. Critical Data Preservation Checks
  -- Ensure primary tenant (vendor), admin staff account, and templates are NOT deleted:
  SELECT COUNT(*) FROM vendors WHERE id = 'd290f1ee-6c54-4b01-90e6-d701748f0851'; -- Expected: 1
  SELECT COUNT(*) FROM staff WHERE id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'; -- Expected: 1
  SELECT COUNT(*) FROM measurement_field_templates WHERE vendor_id = 'd290f1ee-6c54-4b01-90e6-d701748f0851'; -- Expected: 5
  SELECT COUNT(*) FROM measurement_templates WHERE vendor_id = 'd290f1ee-6c54-4b01-90e6-d701748f0851'; -- Expected: 1
  ```
