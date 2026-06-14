-- ============================================================
-- FIX DATABASE SCHEMA & CLEAN DATA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Clean all existing data (correct FK order)
DELETE FROM customer_measurements;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM appointments;
DELETE FROM orders;
DELETE FROM customers;
DELETE FROM measurement_field_templates;
DELETE FROM measurement_templates;
DELETE FROM staff;
DELETE FROM vendors;

-- Step 2: Delete ALL existing auth users to start fresh
DELETE FROM auth.users;

-- Step 3: Add missing columns to vendors table if they don't exist
DO $$ BEGIN
  -- Add 'name' column as alias for 'business_name'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'name') THEN
    ALTER TABLE vendors ADD COLUMN name TEXT;
  END IF;

  -- Add 'address' column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'address') THEN
    ALTER TABLE vendors ADD COLUMN address TEXT;
  END IF;

  -- Add 'description' column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'description') THEN
    ALTER TABLE vendors ADD COLUMN description TEXT;
  END IF;
END $$;

-- Step 4: Create a trigger to keep 'name' and 'business_name' in sync
CREATE OR REPLACE FUNCTION sync_vendor_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If name is provided but business_name is not, copy name to business_name
  IF NEW.name IS NOT NULL AND (NEW.business_name IS NULL OR NEW.business_name = '') THEN
    NEW.business_name := NEW.name;
  END IF;
  -- If business_name is provided but name is not, copy business_name to name
  IF NEW.business_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := NEW.business_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_sync_vendor_name ON vendors;
CREATE TRIGGER trg_sync_vendor_name
BEFORE INSERT OR UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION sync_vendor_name();

-- Step 5: Add 'name' column to staff table if missing (alongside 'full_name')
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'name') THEN
    ALTER TABLE staff ADD COLUMN name TEXT;
  END IF;
END $$;

-- Step 6: Create trigger to keep staff 'name' and 'full_name' in sync
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

-- Step 7: Ensure RLS is disabled for all tables (for the anon key to work)
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

-- Step 8: Recreate all core database triggers (for order number auto-generation, outstanding calculations, balance updates)

-- Trigger A: generate_order_number
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

-- Trigger B: calculate_order_outstanding
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

-- Trigger C: update_balances_on_payment
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

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM payments WHERE order_id = v_order_id;

  UPDATE orders
  SET amount_paid = v_paid
  WHERE id = v_order_id;

  UPDATE customers
  SET total_outstanding = (
    SELECT COALESCE(SUM(amount_outstanding), 0)
    FROM orders
    WHERE customer_id = v_customer_id
  )
  WHERE id = v_customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_balances_on_payment ON payments;
CREATE TRIGGER trg_update_balances_on_payment
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_balances_on_payment();

-- Trigger D: update_customer_outstanding_on_order
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

  IF TG_OP = 'UPDATE' AND OLD.customer_id <> NEW.customer_id THEN
    UPDATE customers
    SET total_outstanding = (
      SELECT COALESCE(SUM(amount_outstanding), 0)
      FROM orders
      WHERE customer_id = OLD.customer_id
    )
    WHERE id = OLD.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_outstanding_on_order ON orders;
CREATE TRIGGER trg_update_customer_outstanding_on_order
AFTER INSERT OR UPDATE OF amount_outstanding, customer_id OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_outstanding_on_order();

-- Step 9: Fix any existing orders/payments that missed trigger execution
UPDATE orders
SET order_number = 'ORD-' || to_char(created_at, 'YYYYMM') || '-' || lpad(sub.row_number::TEXT, 4, '0')
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at) as row_number 
  FROM orders 
  WHERE order_number IS NULL
) sub
WHERE orders.id = sub.id;

UPDATE orders o
SET amount_paid = COALESCE((
  SELECT SUM(amount) 
  FROM payments p 
  WHERE p.order_id = o.id
), 0);

UPDATE orders
SET amount_outstanding = GREATEST(0, total_amount - amount_paid);

UPDATE customers c
SET total_outstanding = COALESCE((
  SELECT SUM(amount_outstanding) 
  FROM orders o 
  WHERE o.customer_id = c.id
), 0);

-- Step 10: Verify the fix
SELECT 'Schema fix complete' AS status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
ORDER BY ordinal_position;
