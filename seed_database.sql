-- Drop existing tables to ensure a clean setup
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS customer_measurements CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS measurement_field_templates CASCADE;
DROP TABLE IF EXISTS measurement_templates CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

-- Drop existing custom types
DROP TYPE IF EXISTS staff_role CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS appointment_type CASCADE;
DROP TYPE IF EXISTS appointment_stage CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;

-- Create custom enums matching codebase
CREATE TYPE staff_role AS ENUM ('owner', 'assistant');
CREATE TYPE order_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered', 'cancelled');
CREATE TYPE appointment_type AS ENUM ('walk_in', 'linked_to_order');
CREATE TYPE appointment_stage AS ENUM ('initial_measurement', 'trial_1', 'trial_2', 'final_fitting', 'delivery');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- 1. Vendors (Studio/Boutique Tenants)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Staff Profiles (Linked to Supabase Auth Users)
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role staff_role DEFAULT 'assistant',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  total_outstanding NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Custom Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE,
  description TEXT,
  notes TEXT,
  total_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  amount_outstanding NUMERIC DEFAULT 0,
  delivery_date TIMESTAMPTZ,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_mode TEXT DEFAULT 'UPI',
  payment_method TEXT DEFAULT 'UPI',
  reference_note TEXT,
  paid_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  appointment_type appointment_type DEFAULT 'walk_in',
  stage appointment_stage,
  scheduled_date TIMESTAMPTZ NOT NULL,
  appointment_date TIMESTAMPTZ,
  time_slot TEXT,
  status appointment_status DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Legacy Measurement Templates
CREATE TABLE measurement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  columns JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Custom Measurement Field Templates (Used by Settings form)
CREATE TABLE measurement_field_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  unit TEXT DEFAULT 'inches',
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Customer Measurements Snapshots
CREATE TABLE customer_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES measurement_templates(id) ON DELETE SET NULL,
  label TEXT,
  values JSONB DEFAULT '{}',
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Disable Row Level Security (RLS) to prevent any permission issues in verification/testing
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

-- Disable triggers temporarily during setup
SET session_replication_role = 'replica';

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------
-- AUTHENTICATION SEED: CREATE ADMIN USER
-- -------------------------------------------------------------
-- Delete existing admin user if any
DELETE FROM auth.users WHERE email = 'vsoham19@gmail.com';

-- Insert admin auth user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmed_at,
  is_sso_user
) VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', -- Fixed admin UUID
  '00000000-0000-0000-0000-000000000000',
  'vsoham19@gmail.com',
  crypt('123', gen_salt('bf')), -- Hashed '123'
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Soham Vaghasia"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  now(),
  false
);

-- Insert associated vendor/store
INSERT INTO vendors (id, business_name, created_at)
VALUES ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Stitch & Soul Atelier', now());

-- Insert staff mapping to auth user
INSERT INTO staff (id, vendor_id, auth_user_id, name, full_name, email, role, is_active, created_at)
VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', -- matches auth user id
  'd290f1ee-6c54-4b01-90e6-d701748f0851',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Soham Vaghasia',
  'Soham Vaghasia',
  'vsoham19@gmail.com',
  'owner',
  true,
  now()
);

-- -------------------------------------------------------------
-- SEED DATA: MEASUREMENT FIELD TEMPLATES
-- -------------------------------------------------------------
INSERT INTO measurement_field_templates (id, vendor_id, field_name, unit, display_order, is_active, created_at) VALUES
('f1100000-0000-0000-0000-000000000001', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Kamar (Waist)', 'inches', 1, true, now()),
('f1100000-0000-0000-0000-000000000002', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Seena (Chest)', 'inches', 2, true, now()),
('f1100000-0000-0000-0000-000000000003', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Gala Front (Neck)', 'inches', 3, true, now()),
('f1100000-0000-0000-0000-000000000004', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Length (Ghara Lower)', 'inches', 4, true, now()),
('f1100000-0000-0000-0000-000000000005', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Mori (Ankle sleeve)', 'cm', 5, true, now());

INSERT INTO measurement_templates (id, vendor_id, name, columns, created_at) VALUES
('t1100000-0000-0000-0000-000000000001', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Standard Indian ethnic template', '["Kamar (Waist)", "Seena (Chest)", "Gala Front (Neck)", "Length (Ghara Lower)", "Mori (Ankle sleeve)"]'::jsonb, now());

-- -------------------------------------------------------------
-- SEED DATA: CUSTOMERS
-- -------------------------------------------------------------
INSERT INTO customers (id, vendor_id, name, full_name, phone, email, address, notes, created_at) VALUES
('c1100000-0000-0000-0000-000000000001', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Priya Sharma', 'Priya Sharma', '9810012345', 'priya@sharma.com', 'D-42, Saket, New Delhi', 'Prefers cotton lining for ethnic dresses.', now() - INTERVAL '15 days'),
('c1100000-0000-0000-0000-000000000002', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Arjun Kapoor', 'Arjun Kapoor', '9871122334', 'arjun@kapoor.com', 'B-101, Greater Kailash, New Delhi', 'Requires extra padding for blazer shoulders.', now() - INTERVAL '12 days'),
('c1100000-0000-0000-0000-000000000003', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Meera Nair', 'Meera Nair', '9999887766', 'meera@nair.com', 'C-12, Green Park, New Delhi', 'Always requests traditional borders.', now() - INTERVAL '20 days'),
('c1100000-0000-0000-0000-000000000004', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Kabir Singh', 'Kabir Singh', '9111223344', 'kabir@singh.com', 'A-5, Vasant Vihar, New Delhi', 'Prefers dark colors and slim fit cuts.', now() - INTERVAL '10 days'),
('c1100000-0000-0000-0000-000000000005', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'Ananya Desai', 'Ananya Desai', '9845011223', 'ananya@desai.com', 'F-72, Hauz Khas, New Delhi', 'Urgent orders preferred.', now() - INTERVAL '5 days');

-- -------------------------------------------------------------
-- SEED DATA: CUSTOMER MEASUREMENTS
-- -------------------------------------------------------------
INSERT INTO customer_measurements (id, customer_id, template_id, label, values, notes, updated_at, recorded_at) VALUES
(gen_random_uuid(), 'c1100000-0000-0000-0000-000000000001', 't1100000-0000-0000-0000-000000000001', 'Bridal Lehenga - Oct Initial', '{"Kamar (Waist)": "32", "Seena (Chest)": "36", "Gala Front (Neck)": "7.5", "Length (Ghara Lower)": "40", "Mori (Ankle sleeve)": "12"}'::jsonb, 'Standard waist margin left', now(), now() - INTERVAL '14 days'),
(gen_random_uuid(), 'c1100000-0000-0000-0000-000000000002', 't1100000-0000-0000-0000-000000000001', 'Tuxedo Fitting', '{"Kamar (Waist)": "34", "Seena (Chest)": "40", "Gala Front (Neck)": "8.0", "Length (Ghara Lower)": "42", "Mori (Ankle sleeve)": "14"}'::jsonb, 'Shoulder pads verified', now(), now() - INTERVAL '11 days');

-- -------------------------------------------------------------
-- SEED DATA: ORDERS
-- -------------------------------------------------------------
INSERT INTO orders (id, vendor_id, customer_id, order_number, description, notes, total_amount, status, created_at) VALUES
('o1100000-0000-0000-0000-000000000001', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000001', 'ORD-202606-0042', 'Banarasi Lehenga for wedding reception', 'Dry clean only, golden zari border.', 45000, 'ready', now() - INTERVAL '10 days'),
('o1100000-0000-0000-0000-000000000002', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000002', 'ORD-202606-0041', 'Tuxedo Jacket with satin lapels', 'Ensure slim fit contouring.', 25000, 'in_progress', now() - INTERVAL '8 days'),
('o1100000-0000-0000-0000-000000000003', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000003', 'ORD-202606-0040', 'Silk Blouse (3 pieces bundle)', 'Red, Green, and Cream blouses.', 95000, 'delivered', now() - INTERVAL '15 days'),
('o1100000-0000-0000-0000-000000000004', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000004', 'ORD-202606-0039', 'Casual Blazers for corporate event', 'Navy blue, grey colors.', 32000, 'pending', now() - INTERVAL '5 days'),
('o1100000-0000-0000-0000-000000000005', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000005', 'ORD-202606-0038', 'Cotton Salwar Suit daily wear', 'Standard loose fit.', 15000, 'delivered', now() - INTERVAL '3 days'),
('o1100000-0000-0000-0000-000000000006', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000004', 'ORD-202606-0037', 'Designer Sherwani with heavy embroidery', 'Wedding outfit.', 45000, 'delivered', now() - INTERVAL '12 days');

-- -------------------------------------------------------------
-- SEED DATA: ORDER ITEMS
-- -------------------------------------------------------------
INSERT INTO order_items (id, order_id, item_name, description, quantity, unit_price, total_price) VALUES
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000001', 'Banarasi Lehenga', 'Heavy silk lehenga', 1, 45000, 45000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000002', 'Tuxedo Jacket', 'Italian fabric', 1, 20000, 20000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000002', 'White Dress Shirt', 'Egyptian cotton', 1, 5000, 5000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000003', 'Silk Blouse Red', 'Banarasi silk', 1, 30000, 30000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000003', 'Silk Blouse Green', 'Banarasi silk', 1, 35000, 35000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000003', 'Silk Blouse Cream', 'Banarasi silk', 1, 30000, 30000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000004', 'Navy Blue Blazer', 'Wool blend blazer', 1, 16000, 16000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000004', 'Grey Blazer', 'Wool blend blazer', 1, 16000, 16000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000005', 'Cotton Salwar Suit', 'Organic cotton salwar kameez', 1, 15000, 15000),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000006', 'Designer Sherwani', 'Premium raw silk sherwani', 1, 45000, 45000);

-- -------------------------------------------------------------
-- SEED DATA: PAYMENTS
-- -------------------------------------------------------------
INSERT INTO payments (id, order_id, customer_id, amount, payment_mode, payment_method, reference_note, paid_at, created_at) VALUES
-- Order 2: Paid 13,000, Outstanding 12,000
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000002', 13000, 'UPI', 'UPI', 'Advance payment txn-908234', now() - INTERVAL '8 days', now() - INTERVAL '8 days'),
-- Order 3: Paid 95,000, Outstanding 0
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000003', 50000, 'Card', 'Card', 'Booking advance txn-012938', now() - INTERVAL '15 days', now() - INTERVAL '15 days'),
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000003', 45000, 'Cash', 'Cash', 'Final balance cash payout', now() - INTERVAL '10 days', now() - INTERVAL '10 days'),
-- Order 4: Paid 10,000, Outstanding 22,000
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000004', 10000, 'UPI', 'UPI', 'Advance txn-293847', now() - INTERVAL '5 days', now() - INTERVAL '5 days'),
-- Order 5: Paid 15,000, Outstanding 0
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000005', 'c1100000-0000-0000-0000-000000000005', 15000, 'UPI', 'UPI', 'Full payment UPI txn-382947', now() - INTERVAL '3 days', now() - INTERVAL '3 days'),
-- Order 6: Paid 45,000, Outstanding 0
(gen_random_uuid(), 'o1100000-0000-0000-0000-000000000006', 'c1100000-0000-0000-0000-000000000004', 45000, 'Bank Transfer', 'Bank Transfer', 'IMPS transfer ref-293840234', now() - INTERVAL '12 days', now() - INTERVAL '12 days');

-- -------------------------------------------------------------
-- SEED DATA: APPOINTMENTS
-- -------------------------------------------------------------
INSERT INTO appointments (id, vendor_id, customer_id, order_id, title, appointment_type, stage, scheduled_date, appointment_date, time_slot, status, notes, created_at) VALUES
('a1100000-0000-0000-0000-000000000001', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000001', 'o1100000-0000-0000-0000-000000000001', 'Sherwani First Trial Fit Checks', 'linked_to_order', 'trial_1', now() + INTERVAL '1 day' + INTERVAL '3 hours', now() + INTERVAL '1 day' + INTERVAL '3 hours', '11:30 AM', 'scheduled', 'Verify sleeve lengths specifically with shirts worn.', now()),
('a1100000-0000-0000-0000-000000000002', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000002', 'o1100000-0000-0000-0000-000000000002', 'Evening Gown Final Alteration Checks', 'linked_to_order', 'final_fitting', now() + INTERVAL '1 day' + INTERVAL '6 hours', now() + INTERVAL '1 day' + INTERVAL '6 hours', '02:15 PM', 'scheduled', NULL, now()),
('a1100000-0000-0000-0000-000000000003', 'd290f1ee-6c54-4b01-90e6-d701748f0851', 'c1100000-0000-0000-0000-000000000003', NULL, 'Bespoke Suit Fabric Intake Measurement', 'walk_in', NULL, now() + INTERVAL '2 days' + INTERVAL '8 hours', now() + INTERVAL '2 days' + INTERVAL '8 hours', '04:45 PM', 'scheduled', 'Walk-in reference consultation file entry.', now());

-- Re-enable session replication role for triggers
SET session_replication_role = 'origin';

-- Update the aggregated balances on orders and customers manually to ensure database-level consistency matching seed records
UPDATE orders SET amount_paid = 0, amount_outstanding = total_amount WHERE id = 'o1100000-0000-0000-0000-000000000001';
UPDATE orders SET amount_paid = 13000, amount_outstanding = 12000 WHERE id = 'o1100000-0000-0000-0000-000000000002';
UPDATE orders SET amount_paid = 95000, amount_outstanding = 0 WHERE id = 'o1100000-0000-0000-0000-000000000003';
UPDATE orders SET amount_paid = 10000, amount_outstanding = 22000 WHERE id = 'o1100000-0000-0000-0000-000000000004';
UPDATE orders SET amount_paid = 15000, amount_outstanding = 0 WHERE id = 'o1100000-0000-0000-0000-000000000005';
UPDATE orders SET amount_paid = 45000, amount_outstanding = 0 WHERE id = 'o1100000-0000-0000-0000-000000000006';

UPDATE customers SET total_outstanding = 45000 WHERE id = 'c1100000-0000-0000-0000-000000000001';
UPDATE customers SET total_outstanding = 12000 WHERE id = 'c1100000-0000-0000-0000-000000000002';
UPDATE customers SET total_outstanding = 0 WHERE id = 'c1100000-0000-0000-0000-000000000003';
UPDATE customers SET total_outstanding = 22000 WHERE id = 'c1100000-0000-0000-0000-000000000004';
UPDATE customers SET total_outstanding = 0 WHERE id = 'c1100000-0000-0000-0000-000000000005';

-- -------------------------------------------------------------
-- CREATE SYSTEM TRIGGER ACTIONS
-- -------------------------------------------------------------

-- Trigger function to generate order number
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

CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION generate_order_number();

-- Trigger function to calculate order outstanding balance
CREATE OR REPLACE FUNCTION calculate_order_outstanding()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_outstanding := GREATEST(0, NEW.total_amount - NEW.amount_paid);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_order_outstanding
BEFORE INSERT OR UPDATE OF total_amount, amount_paid ON orders
FOR EACH ROW
EXECUTE FUNCTION calculate_order_outstanding();

-- Trigger function to update order amount_paid and customer total_outstanding on payment updates
CREATE OR REPLACE FUNCTION update_balances_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_customer_id UUID;
  v_paid NUMERIC;
  v_total NUMERIC;
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

CREATE TRIGGER trg_update_balances_on_payment
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_balances_on_payment();

-- Trigger function to update customer total_outstanding on order edits or removals
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

CREATE TRIGGER trg_update_customer_outstanding_on_order
AFTER INSERT OR UPDATE OF amount_outstanding, customer_id OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_outstanding_on_order();
