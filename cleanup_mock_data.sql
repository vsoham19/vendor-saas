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

-- Step 8: Verify the fix
SELECT 'Schema fix complete' AS status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
ORDER BY ordinal_position;
