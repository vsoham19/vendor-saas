# Analysis Report: Customer Detail Page Refactoring (`[id]/page.tsx`)

This report provides a read-only architectural investigation and query formulation strategy to replace the hardcoded mock data in `frontend/app/dashboard/customers/[id]/page.tsx` with live data fetched via the client-side Supabase client instance.

---

## 1. Executive Summary
The customer detail page (`frontend/app/dashboard/customers/[id]/page.tsx`) currently queries mock data across five separate `useQuery` hooks. This investigation defines the mapping between these UI data requirements and the backend database schema defined in `seed_database.sql`. We propose a replacement query strategy using client-side Supabase queries (`supabase`) with clear TypeScript mapping structures.

---

## 2. Identified useQuery Hooks with Mock Data

There are five `useQuery` hooks in `frontend/app/dashboard/customers/[id]/page.tsx` that return hardcoded mock values inside their `queryFn` implementations:

### Query 1: Core Profile Metadata (`customer-profile`)
* **Lines**: 68–83
* **Target Interface**: `CustomerProfile`
* **Current Mock Behavior**:
  ```typescript
  const { data: profile, isLoading: isProfileLoading } = useQuery<CustomerProfile>({
    queryKey: ['customer-profile', customerId],
    queryFn: async () => {
      return {
        id: customerId,
        full_name: 'Priya Sharma',
        phone: '9810012345',
        email: 'priya.sharma@example.com',
        address: 'H-24, Green Park Extension, New Delhi, 110016',
        notes: 'Prefers deep neck cuts on blouses. Prefers traditional Banarasi borders.',
        total_outstanding: 45000.00
      };
    }
  });
  ```

### Query 2: Financial Payment History / Ledger (`customer-ledger`)
* **Lines**: 86–94
* **Target Interface**: `LedgerItem[]`
* **Current Mock Behavior**:
  ```typescript
  const { data: ledger = [] } = useQuery<LedgerItem[]>({
    queryKey: ['customer-ledger', customerId],
    queryFn: async () => {
      return [
        { id: 'p1', amount: 25000.00, payment_mode: 'UPI', reference_note: 'Advance via GPay', paid_at: '2026-05-10T11:00:00Z', order_number: 'ORD-202605-0042' },
        { id: 'p2', amount: 15000.00, payment_mode: 'Cash', reference_note: 'Fitting trial update', paid_at: '2026-06-01T15:30:00Z', order_number: 'ORD-202605-0042' }
      ];
    }
  });
  ```

### Query 3: Customer Production Orders (`customer-orders`)
* **Lines**: 97–104
* **Target Interface**: `OrderItemSummary[]`
* **Current Mock Behavior**:
  ```typescript
  const { data: orders = [] } = useQuery<OrderItemSummary[]>({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      return [
        { id: 'o1', order_number: 'ORD-202605-0042', description: 'Bridal Banarasi Lehenga with custom embroidery panels', total_amount: 85000.00, amount_outstanding: 45000.00, status: 'in_progress', delivery_date: '2026-11-15' }
      ];
    }
  });
  ```

### Query 4: Custom Measurement Records (`customer-measurements`)
* **Lines**: 107–114
* **Target Interface**: `MeasurementRecord[]`
* **Current Mock Behavior**:
  ```typescript
  const { data: measurements = [] } = useQuery<MeasurementRecord[]>({
    queryKey: ['customer-measurements', customerId],
    queryFn: async () => {
      return [
        { id: 'm1', label: 'Lehenga Consultation - Initial', values: { 'Kamar': '32', 'Seena': '36', 'Gala': '7.5', 'Length': '41' }, notes: 'Measured with standard 3-inch bridal heels on.', recorded_at: '2026-05-10' }
      ];
    }
  });
  ```

### Query 5: Fitting Appointments (`customer-appointments`)
* **Lines**: 117–124
* **Target Interface**: `AppointmentItem[]`
* **Current Mock Behavior**:
  ```typescript
  const { data: appointments = [] } = useQuery<AppointmentItem[]>({
    queryKey: ['customer-appointments', customerId],
    queryFn: async () => {
      return [
        { id: 'a1', title: 'Lehenga First Fitting Trial', scheduled_date: '2026-06-15', stage: 'trial_1', status: 'scheduled' }
      ];
    }
  });
  ```

---

## 3. SQL Tables and Fields to Query

Based on `seed_database.sql`, here is the database mapping for all five query components:

| UI Domain | SQL Table | Fields Requested by UI / Types | Query Conditions / Join Strategy |
| :--- | :--- | :--- | :--- |
| **Customer Profile** | `customers` | `id` (UUID), `full_name` (TEXT), `phone` (TEXT), `email` (TEXT), `address` (TEXT), `notes` (TEXT), `total_outstanding` (NUMERIC) | `id = customerId` |
| **Running Ledger** | `payments` joined with `orders` | `payments.id` (UUID), `payments.amount` (NUMERIC), `payments.payment_mode` (TEXT), `payments.reference_note` (TEXT), `payments.paid_at` (TIMESTAMPTZ), `orders.order_number` (TEXT) | `payments.customer_id = customerId` (join via `payments.order_id = orders.id`) |
| **Customer Orders** | `orders` | `id` (UUID), `order_number` (TEXT), `description` (TEXT), `total_amount` (NUMERIC), `amount_outstanding` (NUMERIC), `status` (`order_status` enum), `delivery_date` (TIMESTAMPTZ) | `orders.customer_id = customerId` |
| **Measurements** | `customer_measurements` | `id` (UUID), `label` (TEXT), `values` (JSONB), `notes` (TEXT), `recorded_at` (TIMESTAMPTZ) | `customer_measurements.customer_id = customerId` |
| **Appointments** | `appointments` | `id` (UUID), `title` (TEXT), `scheduled_date` (TIMESTAMPTZ), `stage` (`appointment_stage` enum), `status` (`appointment_status` enum) | `appointments.customer_id = customerId` |

---

## 4. Query Strategy & Client-Side Supabase Snippets

Below is the formulated data fetching strategy using the client-side Supabase client (`supabase`).

### Proposed Query 1: Core Profile Fetch
Retrieve the customer record matching `customerId`.
```typescript
// Replace lines 68-83:
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
  }
});
```

### Proposed Query 2: Ledger History with Order Joins
Retrieve all payments received for the customer, joining the `orders` relation to extract `order_number` if it exists.
```typescript
// Replace lines 86-94:
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
  }
});
```

### Proposed Query 3: Customer Production Orders
Fetch custom order documents representing outstanding and historical sales.
```typescript
// Replace lines 97-104:
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
  }
});
```

### Proposed Query 4: Measurement Sessions
Fetch historical measurements snapshots recorded for the customer.
```typescript
// Replace lines 107-114:
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
  }
});
```

### Proposed Query 5: Fitting Appointments
Retrieve outfit trials and measurement consultations scheduled for this customer.
```typescript
// Replace lines 117-124:
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
  }
});
```

---

## 5. Architectural & Data Consistency Caveats

1. **Outstanding Balance Synchronization**:
   * The customer profile and order outstanding balance variables (`total_outstanding` and `amount_outstanding`) are automatically calculated and updated on the database side via triggers (`trg_calculate_order_outstanding`, `trg_update_balances_on_payment`, `trg_update_customer_outstanding_on_order`).
   * Therefore, client-side queries only need to perform a basic fetch of these values rather than recalculating them dynamically.
2. **Numeric Precision Casts**:
   * Numeric fields in PostgreSQL (`NUMERIC`) may map to string types in certain client adapters. Explicitly casting them using `Number(...)` or parse utils prevents UI formatting errors (such as crashes when calling `toLocaleString`).
3. **Data Relations**:
   * In Query 2, we execute a client-side join on `orders (order_number)`. This maps to a JSON sub-object structure in Supabase JS response, which is handled cleanly in our mapping array step: `order_number: item.orders?.order_number`.
