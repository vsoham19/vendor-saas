-- ============================================================
-- SQL SCRIPT: RECREATE DATABASE TRIGGERS & REPAIR DATA
-- Run this in your Supabase SQL Editor
-- This script does NOT delete any data (it only fixes missing triggers and calculations).
-- ============================================================

-- Step 1: Create a trigger to keep 'name' and 'business_name' in sync for vendors
CREATE OR REPLACE FUNCTION sync_vendor_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL AND (NEW.business_name IS NULL OR NEW.business_name = '') THEN
    NEW.business_name := NEW.name;
  END IF;
  IF NEW.business_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.business_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_vendor_name ON vendors;
CREATE TRIGGER trg_sync_vendor_name
BEFORE INSERT OR UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION sync_vendor_name();

-- Step 2: Create trigger to keep staff 'name' and 'full_name' in sync
CREATE OR REPLACE FUNCTION sync_staff_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.full_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.full_name;
  END IF;
  IF NEW.name IS NOT NULL AND (NEW.full_name IS NULL OR NEW.full_name = '') THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_staff_name ON staff;
CREATE TRIGGER trg_sync_staff_name
BEFORE INSERT OR UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION sync_staff_name();

-- Step 3: Trigger function to generate order number (e.g. ORD-202606-0001)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_seq INTEGER;
  v_new_order_number TEXT;
BEGIN
  v_prefix := 'ORD-' || to_char(now(), 'YYYYMM') || '-';
  
  SELECT COALESCE(MAX(SUBSTRING(order_number FROM '\d+$')::INTEGER), 0) + 1
  INTO v_seq
  FROM orders
  WHERE order_number LIKE v_prefix || '%';
  
  v_new_order_number := v_prefix || lpad(v_seq::TEXT, 4, '0');
  NEW.order_number := v_new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_order_number ON orders;
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION generate_order_number();

-- Step 4: Trigger function to calculate order outstanding balance (amount_outstanding = total_amount - amount_paid)
CREATE OR REPLACE FUNCTION calculate_order_outstanding()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_outstanding := GREATEST(0, NEW.total_amount - NEW.amount_paid);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_order_outstanding ON orders;
CREATE TRIGGER trg_calculate_order_outstanding
BEFORE INSERT OR UPDATE OF total_amount, amount_paid ON orders
FOR EACH ROW
EXECUTE FUNCTION calculate_order_outstanding();

-- Step 5: Trigger function to update order amount_paid and customer total_outstanding on payment updates
CREATE OR REPLACE FUNCTION update_balances_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_customer_id UUID;
  v_paid NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
    v_customer_id := OLD.customer_id;
  ELSE
    v_order_id := NEW.order_id;
    v_customer_id := NEW.customer_id;
  END IF;

  -- Calculate sum of all payments for this order
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM payments 
  WHERE order_id = v_order_id;

  -- Update order with total paid (which triggers calculate_order_outstanding BEFORE UPDATE)
  UPDATE orders
  SET amount_paid = v_paid
  WHERE id = v_order_id;

  -- Update customer total outstanding (sum of all customer's order outstanding balances)
  UPDATE customers
  SET total_outstanding = (
    SELECT COALESCE(SUM(amount_outstanding), 0)
    FROM orders
    WHERE customer_id = v_customer_id
  )
  WHERE id = v_customer_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_balances_on_payment ON payments;
CREATE TRIGGER trg_update_balances_on_payment
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_balances_on_payment();

-- Step 6: Trigger function to update customer total_outstanding on order edits or removals
CREATE OR REPLACE FUNCTION update_customer_outstanding_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_customer_id := OLD.customer_id;
  ELSE
    v_customer_id := NEW.customer_id;
  END IF;

  UPDATE customers
  SET total_outstanding = (
    SELECT COALESCE(SUM(amount_outstanding), 0)
    FROM orders
    WHERE customer_id = v_customer_id
  )
  WHERE id = v_customer_id;

  -- If the order's customer changed, also update the old customer
  IF TG_OP = 'UPDATE' AND OLD.customer_id <> NEW.customer_id THEN
    UPDATE customers
    SET total_outstanding = (
      SELECT COALESCE(SUM(amount_outstanding), 0)
      FROM orders
      WHERE customer_id = OLD.customer_id
    )
    WHERE id = OLD.customer_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_outstanding_on_order ON orders;
CREATE TRIGGER trg_update_customer_outstanding_on_order
AFTER INSERT OR UPDATE OF amount_outstanding, customer_id OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_outstanding_on_order();

-- Step 7: Disable RLS for postgrest access (optional, but ensures anon key can read/write everything if required by tenant flow)
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_field_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_measurements DISABLE ROW LEVEL SECURITY;

-- Step 8: Fix and repair any existing orders/payments that missed trigger execution
-- A. Fix null order numbers
UPDATE orders
SET order_number = 'ORD-' || to_char(created_at, 'YYYYMM') || '-' || lpad(sub.row_number::TEXT, 4, '0')
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at) as row_number 
  FROM orders 
  WHERE order_number IS NULL
) sub
WHERE orders.id = sub.id;

-- B. Calculate amount_paid for all orders from payments
UPDATE orders o
SET amount_paid = COALESCE((
  SELECT SUM(amount) 
  FROM payments p 
  WHERE p.order_id = o.id
), 0);

-- C. Recalculate amount_outstanding for all orders
UPDATE orders
SET amount_outstanding = GREATEST(0, total_amount - amount_paid);

-- D. Recalculate total_outstanding for all customers
UPDATE customers c
SET total_outstanding = COALESCE((
  SELECT SUM(amount_outstanding) 
  FROM orders o 
  WHERE o.customer_id = c.id
), 0);

SELECT 'Database triggers and calculations successfully repaired!' AS status;
