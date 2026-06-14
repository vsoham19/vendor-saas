# Original User Request

## Initial Request — 2026-06-10T23:10:21Z

Multi-tenant boutique/atelier SaaS platform where new vendors can sign up, create their store profiles, manage customer details, orders, payments, appointments, and invite assistant team members.

Working directory: c:\Users\vsoha\Desktop\Work\igloo\vendor-saas
Integrity mode: development

## Requirements

### R1. Authentication & Onboarding Redirection
- Update the login and sign-up flows so new users can create an account (e.g. via Supabase Auth signup).
- After successful registration, if the user does not have an associated store (vendor) in the database, redirect them to an `/onboarding` page.
- On the `/onboarding` page, the user must name their store (boutique/vendor name), input the physical address, and provide a small description.
- Submitting the onboarding form must:
  1. Create a record in the `vendors` table with the store details.
  2. Create a record in the `staff` table linking the user's Auth ID as the `owner` of the newly created vendor store.
- Once completed, the user is redirected to the main dashboard.

### R2. Staff Invitation System (Settings)
- In the Dashboard Settings page, the owner (store creator) must have options to add new team members (assistants).
- Direct assistant creation: The owner enters the assistant's name, email, and password. The system must create the assistant's auth user record in Supabase and associate them as an `assistant` role under the same `vendor_id` in the `staff` table.

### R3. Remove Old Mock Data & Enable Dynamic Customer Detail View
- Provide a SQL clean-up script or transaction to remove the old mock customers/orders/appointments that were generated initially.
- Update the Customer Details page (`/dashboard/customers/[id]/page.tsx`) to query and display real customer data (profile, orders, ledger, measurements, appointments) dynamically fetched from Supabase, resolving the hardcoded Priya Sharma redirection bug.

## Acceptance Criteria

### User Onboarding Flow
- [ ] Users can sign up via a new registration screen on the landing page.
- [ ] Registered users without a store are blocked from accessing `/dashboard` and redirected to `/onboarding`.
- [ ] Onboarding submission creates a vendor record and a staff record mapping the owner's Auth ID.
- [ ] Logged-in owners see their store name and profile details correctly.

### Staff/Assistant Addition
- [ ] The store owner can add an assistant by entering Name, Email, and Password in settings.
- [ ] The new assistant can log in successfully and access the same boutique store dashboard with their assistant privileges (e.g., restricted access to analytics if required by settings).

### Live Database Views
- [ ] Wiping old data successfully leaves the database clean.
- [ ] Customer Detail page `/dashboard/customers/[id]` displays correct data corresponding to the selected customer's ID, rather than static placeholders.

## Follow-up — 2026-06-10T17:41:50Z

Critical Context Update: The user and their team run the application exclusively on Vercel (not localhost). Do not assume running on localhost. Make sure all environment variables, CORS configurations, and redirect URIs are fully compatible with Vercel deployment URLs and Supabase production environments.
