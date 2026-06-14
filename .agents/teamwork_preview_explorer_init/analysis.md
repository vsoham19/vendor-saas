# Codebase Analysis & Design Report

## Overview
This report provides a detailed analysis of the current frontend, backend, and database structures of the `vendor-saas` fashion boutique ERP application, identifies existing architectural gaps, and proposes a complete implementation and testing strategy for requirements R1, R2, and R3.

---

## 1. Current Frontend Structure

The frontend is a Next.js 14 App Router application structured with React Query (`@tanstack/react-query`) for state synchronization and Zustand (`useAuthStore`) for client session cache management.

### Key Directories and Files Analyzed:
- `frontend/app/page.tsx`: Contains the client-side login form (`LoginPage`). It handles user authentication with `supabase.auth.signInWithPassword` and queries the `staff` table to fetch the associated user profile.
- `frontend/app/dashboard/layout.tsx`: Sidebar/nav drawer wrapper. Exposes pages depending on owner privileges. It falls back to mock user data (`Alex Mercer` with `owner` role) if no active session is found, and lacks navigation route guards or redirects.
- `frontend/app/dashboard/page.tsx`: Main dashboard overview showing the 4-point Bento metric row. Uses React Query to compile stats, today's appointments, and recent orders.
- `frontend/app/dashboard/customers/[id]/page.tsx`: Customer detail profile page. Contains severe data redirection bugs because all queries (`customer-profile`, `customer-ledger`, `customer-orders`, `customer-measurements`, `customer-appointments`) ignore the ID parameter and return hardcoded mock data (e.g., `Priya Sharma`).
- `frontend/app/dashboard/settings/page.tsx`: Settings dashboard panel. Provides UI forms for modifying measurement fields and inviting staff, but relies on mock data and dummy mutations instead of calling active API endpoints.
- `frontend/hooks/`: Contains modular React Query wrappers:
  - `useCustomer.ts`: Interacts directly with the `customers` table using the client-side Supabase client.
  - `useOrders.ts`: Handles order listing and composite order insertion.
  - `useMeasurements.ts`: Manages measurement templates and client snapshots.
  - `useAppointments.ts`: Queries and updates fit schedules.
- `frontend/store/authStore.ts`: Defines `useAuthStore` using Zustand to cache the authenticated `StaffUser` session token.
- `frontend/utils/api.ts`: Exposes a custom `apiFetch` utility for talking to the Express backend.
- `frontend/utils/supabase.ts`: Exposes the anonymous client-side Supabase client.

---

## 2. Current Backend Structure

The backend is a Node.js Express server written in TypeScript and configured for Vercel Serverless deployments.

### Key Files and Routes:
- `backend/api/index.ts`: The main Express server entry point. It applies CORS white-listing for Vercel, mounts routes under `/api`, and applies a global `authMiddleware`.
- `backend/src/config/supabase.ts`: Instantiates `supabaseAdmin` using `SUPABASE_SERVICE_ROLE_KEY` to bypass Row-Level Security (RLS) for server operations.
- `backend/src/middleware/authMiddleware.ts`: Verifies incoming tokens against `process.env.JWT_SECRET` and attaches the payload to `req.user`.
- `backend/src/middleware/auth.ts`: Defines two unused middlewares:
  - `requireAuth`: Validates bearer tokens against Supabase API and fetches staff profiles, binding `req.vendorId` and `req.role`.
  - `requireOwner`: Rejects incoming requests if the staff role is not `'owner'`.
- `backend/src/routes/`:
  - `customer.ts`: Implements `/api/customers` endpoints using `req.vendorId`.
  - `order.ts`: Implements `/api/orders` endpoints using `req.vendorId`.
  - `appointments.ts`: Implements `/api/appointments` endpoints.
  - `analytics.ts`: Implements `/api/analytics` endpoints (restricted to owners).
  - `auth.ts` / `payment.ts`: Empty placeholder files.

---

## 3. Database Schema Analysis (`seed_database.sql`)

The database schema is designed for multi-tenant isolation, though RLS is currently disabled on all tables (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`).

### Core Tables:
1. `vendors`: Represents boutique tenants.
2. `staff`: Studio coworkers mapped to Supabase Auth (`auth_user_id`). Defines `role` (`owner` or `assistant`) and `is_active`.
3. `customers`: Customer records containing outstanding dues.
4. `orders` & `order_items`: Business invoices and itemizations.
5. `payments`: Logged cash/UPI/Card ledger events.
6. `appointments`: Trial schedules and consultation records.
7. `measurement_field_templates`: Customizable columns configured in Settings (e.g., Waist, Chest).
8. `customer_measurements`: Snapshots of client fit data stored in JSONB values.

### Database Triggers:
- `trg_generate_order_number`: Automatically generates serial order numbers (e.g., `ORD-YYYYMM-0001`).
- `trg_calculate_order_outstanding`: Maintains `amount_outstanding = total_amount - amount_paid`.
- `trg_update_balances_on_payment`: Sums payment amounts to update order paid balances and updates customer outstanding balances.
- `trg_update_customer_outstanding_on_order`: Recalculates `total_outstanding` on customer profiles when orders are inserted, updated, or removed.

---

## 4. Implementation Strategy

### R1. Authentication & Onboarding Flow

1. **Sign-up Interface & Registration**:
   - Update `frontend/app/page.tsx` with a toggle to switch between **Login** and **Sign Up** states.
   - When registering, prompt for `Email`, `Password`, and `Full Name`.
   - On submit, trigger `supabase.auth.signUp(...)` and redirect to `/onboarding`.

2. **Route Guard & Auto-Redirection Logic**:
   - Create a global auth listener hook inside `frontend/app/provider.tsx` that triggers on mount and listens to `onAuthStateChange`:
     - Checks if a valid session exists. If yes, query the `staff` table for a record matching `auth_user_id === user.id`.
     - Hydrate `useAuthStore` with the profile details and token. If no staff profile is found, populate user info but set `vendorId: ''`.
   - Update `frontend/app/dashboard/layout.tsx` to protect all nested routes:
     - If `isLoading` is true, render a spinner.
     - If `isAuthenticated` is false, redirect to `/`.
     - If `isAuthenticated` is true but `user.vendorId` is empty, redirect to `/onboarding`.

3. **Onboarding Page (`frontend/app/onboarding/page.tsx`)**:
   - Provide fields for `Business Name`, `Owner Name`, `Address`, and `Notes/Description`.
   - On submit, POST the data to the backend `/api/auth/onboard` endpoint with the owner's bearer token.

4. **Backend Onboarding Route (`backend/src/routes/auth.ts`)**:
   - Create a lightweight JWT verification step to parse the user's Auth payload from Supabase.
   - In a database transaction/sequential logic:
     - Create a record in `vendors` mapping `business_name`.
     - Create a record in `staff` mapping `vendor_id`, `auth_user_id: user.id`, `id: user.id` (to support the existing `requireAuth` middleware query), `name: owner_name`, `email: user.email`, and `role: 'owner'`.
     - Seed default measurement fields in `measurement_field_templates` for the new `vendor_id`.
     - Return the created profile to hydrate the frontend store and redirect the owner to `/dashboard`.

---

### R2. Staff Invitation System (Settings)

1. **Invite Endpoint (`backend/src/routes/auth.ts`)**:
   - Implement `POST /api/auth/invite-staff` wrapped in `requireAuth` and `requireOwner` middleware.
   - Using `supabaseAdmin.auth.admin.createUser`, provision the assistant's credential set directly inside Supabase Auth with `email_confirm: true`.
   - Insert an associated record into `staff` containing the created user's `id`, `vendor_id: req.vendorId`, `role: 'assistant'`, and `is_active: true`.
   - Wrap in rollback logic: if the staff insertion fails, delete the auth user to keep the tables in sync.

2. **Frontend UI Integration (`frontend/app/dashboard/settings/page.tsx`)**:
   - Update Settings page fields: add `Password` input to the assistant setup form.
   - Replace the mock queries for fetching coworkers with a query referencing `GET /api/staff` (which will be mounted and mapped in the backend).
   - Wire the "Invite" form submit button to trigger the backend `/api/auth/invite-staff` route.
   - Integrate status toggles to send requests to a status patch route (e.g., `PATCH /api/staff/:id/toggle`) to safely mute or enable assistant dashboards.

---

### R3. Mock Data Clean-up & Dynamic Customer Detail View

1. **SQL Wipe Script**:
   Provide a transactional script to purge seeded mock business entries without damaging the structural triggers or tables:
   ```sql
   BEGIN;
   SET session_replication_role = 'replica'; -- Disables constraint triggers during truncation

   DELETE FROM appointments WHERE id IN ('a1100000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000002', 'a1100000-0000-0000-0000-000000000003');
   DELETE FROM customer_measurements WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000005');
   DELETE FROM payments WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000005');
   DELETE FROM order_items WHERE order_id IN ('o1100000-0000-0000-0000-000000000001', 'o1100000-0000-0000-0000-000000000002', 'o1100000-0000-0000-0000-000000000003', 'o1100000-0000-0000-0000-000000000004', 'o1100000-0000-0000-0000-000000000005', 'o1100000-0000-0000-0000-000000000006');
   DELETE FROM orders WHERE customer_id IN ('c1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000005');
   DELETE FROM customers WHERE id IN ('c1100000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000005');

   SET session_replication_role = 'origin';
   COMMIT;
   ```

2. **Frontend Dynamic Customer Data Integration**:
   - Reconstruct all queries in `frontend/app/dashboard/customers/[id]/page.tsx` using the active client-side `supabase` instance:
     - **Query 1 (Profile)**: Fetches customer by `id === customerId` matching fields like name, phone, outstanding dues.
     - **Query 2 (Ledger)**: Queries the `payments` table mapping `customer_id === customerId` and joins order details.
     - **Query 3 (Orders)**: Pulls order metadata filtered by `customer_id === customerId`.
     - **Query 4 (Measurements)**: Queries `customer_measurements` snapshots for the active customer ID.
     - **Query 5 (Appointments)**: Lists chronological fits for the active customer ID.
   - This removes the hardcoded mock outputs and loads real-time tenant-scoped values seamlessly.

---

## 5. Suggested Testing Strategy

### Unit Testing (Backend & Middleware)
- **Framework**: Jest with Supertest (`supertest`).
- **Tests**:
  1. `requireAuth` Middleware:
     - Verify it blocks requests with missing or malformed `Authorization` header (`401 Unauthorized`).
     - Verify it decodes valid tokens, maps the user to the `staff` profile, and binds `req.vendorId` and `req.role` to the request object.
     - Catch Edge Cases: Handle when the database query throws errors or returns an inactive staff profile.
  2. `requireOwner` Middleware:
     - Verify requests continue if `req.role === 'owner'`.
     - Verify it blocks requests with `403 Forbidden` if `req.role !== 'owner'`.
  3. Database Triggers (SQL Unit Tests):
     - Insert a test order and verify the automatically generated prefix `ORD-`.
     - Insert a payment record and verify that `orders.amount_paid` and `customers.total_outstanding` reflect updates instantly.

### Integration / E2E Testing (System Flow)
- **Framework**: Playwright or Cypress.
- **Tests**:
  1. **Owner Sign-up & Onboarding**:
     - Register a new account via the frontend.
     - Assert that the landing checks redirect the new session immediately to `/onboarding`.
     - Submit the onboarding form.
     - Verify the backend creates the vendor record, links the staff role, seeds measurement field templates, and navigates to `/dashboard`.
  2. **Staff Invitation & Session Privileges**:
     - Log in as the newly onboarded owner.
     - Invite an assistant with a designated name, email, and password.
     - Assert the staff is listed in Settings.
     - Log in as the assistant.
     - Verify access to the dashboard.
     - Verify the assistant is restricted from accessing `/dashboard/settings` or `/dashboard/analytics` (both routes should redirect or return `403` status).
  3. **Live Customer Views & Deletes**:
     - Wipe seed records using the SQL script and assert that no listings remain in the customers and orders tables.
     - Create a customer record and add an order with a partial payment.
     - Open the Customer details page.
     - Verify that all tabs (Overview, Orders, Measurements, Appointments) fetch and display correct data.
