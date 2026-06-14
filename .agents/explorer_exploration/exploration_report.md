# Codebase Exploration & Analysis Report

This report presents the findings from an investigation of the **vendor-saas** multi-tenant boutique SaaS codebase. It details the existing architecture, gaps, bugs, and proposed implementations across authentication, staff invitation, database management, and testing setup.

---

## 1. Authentication & Onboarding Redirection Flow

### Current Implementation Details
* **Login Form (`frontend/app/page.tsx`)**:
  * Users enter email and password.
  * Form calls `supabase.auth.signInWithPassword(...)`.
  * On success, it queries the `staff` table:
    ```typescript
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, vendor_id, full_name, email, role, is_active')
      .eq('auth_user_id', authData.user.id)
      .single();
    ```
  * If the user is found, the Zustand auth store (`useAuthStore`) is populated via `setAuth(...)` and the user is redirected to `/dashboard`.
  * **Gap (Blocking Bug)**: If a newly registered user logs in but does not have a staff record (i.e. onboarding has not occurred), `staffError || !staffData` triggers an error: `"No associated boutique workspace profile found for this account."` It does not redirect to `/onboarding`.
* **Registration UI**:
  * The link to register a studio tenant in the footer of `frontend/app/page.tsx` is a dead link: `<a href="#" ...>Register Studio Tenant</a>`.
* **Redirection Guards & `/onboarding` Page**:
  * No `/onboarding` page or route exists in the `frontend/app` folder.
  * No route guards exist in `frontend/app/dashboard/layout.tsx`. Unauthenticated users are not redirected to `/` (login); instead, a mock user session is hydrated via fallback properties:
    ```typescript
    const activeUser = user || { fullName: 'Alex Mercer', role: 'owner' };
    const studioName = 'Stitch & Soul Atelier';
    ```

### Missing Onboarding Process & Database Inserts
To implement a complete registration and onboarding flow:
1. **Zustand State (`frontend/store/authStore.ts`)**: Update state definition to handle users in a "pending onboarding" state (e.g., token available but no `vendorId`).
2. **Global Auth Guard**: Listen to `supabase.auth.onAuthStateChange` in `frontend/app/layout.tsx` or a custom auth provider.
   * If a user is unauthenticated and tries to access `/dashboard/*`, redirect them to `/`.
   * If a user is authenticated but has no `vendorId` in the `staff` table, redirect them to `/onboarding`.
3. **Onboarding Page (`frontend/app/onboarding/page.tsx`)**:
   * Collects `business_name`, `address`, and `notes`.
   * Invokes a new backend onboarding endpoint or inserts records directly via the Supabase client.
4. **Onboarding Endpoint (`backend/src/routes/auth.ts` or direct client logic)**:
   * **Insert 1 (Vendor)**: Inserts a row in `vendors` table, generating a new `id` (UUID).
   * **Insert 2 (Staff)**: Inserts a row in `staff` table, setting `vendor_id` to the newly created vendor's `id`, `auth_user_id` to the authenticated user's ID, and `role` to `'owner'`.
5. **Critical Middleware Chicken-and-Egg Bug**:
   * The backend's tenant-gatekeeper middleware `requireAuth` (`backend/src/middleware/auth.ts`) requires a `staff` record to exist for the user:
     ```typescript
     const { data: staffMember, error: dbError } = await supabaseAdmin
       .from('staff')
       .select('vendor_id, role')
       .eq('id', user.id) // Bug: checks 'id' instead of 'auth_user_id'
       .single();
     ```
   * Because a new user does not have a `staff` record yet, any onboarding endpoint protected by `requireAuth` will return a `403 Forbidden` error.
   * **Resolution**: The onboarding endpoint must use a separate authentication check (or the lightweight `authMiddleware` in `backend/src/middleware/authMiddleware.ts` which only validates the token signature/claims) to establish `req.user.sub` as the user's Auth ID without checking the `staff` table.

---

## 2. Staff Invitation System

### Current Implementation Details
* **Frontend Settings (`frontend/app/dashboard/settings/page.tsx`)**:
  * An inline form is provided for adding assistants, taking a "Full Name" and "Authorization Invite Email Address".
  * **Gap (Stubbed Form)**: The "Invite" button click handler is currently stubbed to only display a local error:
    ```typescript
    onClick={() => { setSectionError('Supabase Invitation transmission framework requires verification key activation.'); }}
    ```
  * No API fetch or Supabase client call is made to invite a staff member.

### Recommended System Design & Architecture
To implement assistant onboarding under the owner's tenant scope:
1. **Endpoint `POST /api/auth/invite-staff`**:
   * Protected by both `requireAuth` and `requireOwner` middleware in the backend, ensuring only logged-in owners can invite assistants.
2. **Supabase User Creation (via Backend Service Role)**:
   * Standard client-side signups require email confirmations. To bypass this for employee onboarding, the backend uses `supabaseAdmin` with administrative privileges:
     ```typescript
     const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
       email: inviteEmail,
       password: generatedOrTempPassword,
       email_confirm: true, // Auto-confirm email to bypass activation friction
       user_metadata: { full_name: inviteName }
     });
     ```
3. **Staff Database Entry Creation**:
   * Insert a matching record in the `staff` table:
     ```typescript
     const { data: staffRecord, error: staffErr } = await supabaseAdmin
       .from('staff')
       .insert([{
         vendor_id: req.vendorId, // Scoped to the inviting owner's vendor context
         auth_user_id: authUser.user.id,
         name: inviteName,
         full_name: inviteName,
         email: inviteEmail,
         role: 'assistant', // Force role to assistant
         is_active: true
       }]);
     ```
4. **Addressing the Middleware ID Column Bug**:
   * In `backend/src/middleware/auth.ts`, the query to locate a staff profile matches on the primary key `id` instead of the unique key `auth_user_id`:
     ```typescript
     .eq('id', user.id) // Fails for dynamically created staff since 'id' is a new random UUID
     ```
   * **Resolution**: Change this filter to `.eq('auth_user_id', user.id)`.

---

## 3. Database Clean-up Script/Action

### Current Implementation Details
* There is **no cleanup script or endpoint** defined in the codebase.
* The file `seed_database.sql` drops and recreates tables, then seeds initial mock data.

### PURGE Strategy (SQL Transaction)
Because the database utilizes foreign key constraints with `ON DELETE CASCADE` behaviors:
* `orders` references `customers` with `ON DELETE CASCADE`.
* `payments` references `orders` and `customers` with `ON DELETE CASCADE`.
* `customer_measurements` references `customers` with `ON DELETE CASCADE`.
* `appointments` references `customers` and `orders` with `ON DELETE CASCADE`.

To clean up all initial mock data without affecting production user records, a transaction that deletes customers by their fixed seed UUIDs can be triggered. A cascade sweep will automatically delete all child tables (orders, payments, measurements, appointments).

```sql
BEGIN;

-- Disable triggers temporarily if necessary to bypass verification checks
SET session_replication_role = 'replica';

-- purge the 5 seeded customer files
DELETE FROM customers 
WHERE id IN (
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
);

-- Re-enable normal trigger routines
SET session_replication_role = 'origin';

COMMIT;
```

---

## 4. Customer Details View Page

### Current Implementation Details
* **File Location**: `frontend/app/dashboard/customers/[id]/page.tsx`
* **Current Data Fetching**:
  * Utilizes React Query `useQuery` hooks but with **hardcoded resolvers** inside `queryFn` that bypass Supabase entirely and return stubbed values.
  * For example, the `customer-profile` query is structured as:
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
  * Similar stubs exist for `customer-ledger`, `customer-orders`, `customer-measurements`, and `customer-appointments`.
  * Navigating to `/dashboard/customers/<any-id>` will always render Priya Sharma's mock records.

### Dynamic Loading Proposal & Mapping Mismatches
To dynamically load the profile and associated records, replace the mock resolvers with calls utilizing the `supabase` client.
* **Ledger Join Structure Mismatch**:
  * The ledger query in the mock expects the `LedgerItem` structure to contain a top-level `order_number` property.
  * A dynamic Supabase query joining the `orders` table to fetch the order number will look like:
    ```typescript
    const { data, error } = await supabase
      .from('payments')
      .select('*, orders(order_number)')
      .eq('customer_id', customerId);
    ```
  * In the response, the order number is nested: `item.orders.order_number` instead of `item.order_number`.
  * **Fallback Bug Risk**: If this nested structure is not flat-mapped during the query resolution (`.map(p => ({ ...p, order_number: p.orders?.order_number }))`), the running ledger table will render all source entries as `'Standalone Payment'` because `item.order_number` evaluates to undefined.

---

## 5. Environment Setup & Deployment Configurations

### Frontend Configuration (`frontend/utils/supabase.ts` & `api.ts`)
* Uses client-safe environment variables which are inlined at build time by Next.js:
  * `NEXT_PUBLIC_SUPABASE_URL`: The Supabase project base URL.
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The anonymous client key.
  * `NEXT_PUBLIC_API_URL`: Points to the Express backend deployed on Vercel or localhost.

### Backend Configuration (`backend/src/config/supabase.ts` & `api/index.ts`)
* Uses environment variables read at runtime:
  * `SUPABASE_URL`: Connected Supabase backend instance URL.
  * `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key used by `supabaseAdmin` to bypass RLS policies during admin operations (like user creation, seeding).
  * `JWT_SECRET`: Secret used to verify authorization headers in Express middleware.

### Redirection Flow & CORS Whitelist Constraints
* **CORS Constraints (`backend/api/index.ts`)**:
  * The Express server configures CORS using a hardcoded whitelist:
    ```typescript
    const allowedOrigins = ['http://localhost:3000', 'https://vendor-saas.vercel.app'];
    ```
  * **Constraint**: Any other domains (such as Vercel preview branch deployments or secondary domains) will trigger a CORS blocking error in browsers.
  * **Solution**: Replace the hardcoded array with a dynamic whitelist loaded from a backend environment variable (e.g. `process.env.ALLOWED_ORIGINS` parsed as an array) or use a regex to dynamically match subdomains ending with `.vercel.app`.
* **Supabase Authentication Redirects**:
  * For password resets and signup verification links to function correctly under a Vercel-deployed workflow, the redirect URI parameters passed to `supabase.auth.signUp()` must match whitelisted URLs configured in the Supabase Project Dashboard under **Auth -> Redirect URIs**.

---

## 6. Test Setup

* **Findings**:
  * Both `frontend/package.json` and `backend/package.json` **lack any testing frameworks or test script configurations**.
  * There are no traces of `jest`, `playwright`, `cypress`, `mocha`, `ts-jest`, or `@testing-library/react` in the dependencies or devDependencies.
  * The scripts block in the frontend:
    ```json
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    }
    ```
  * The scripts block in the backend:
    ```json
    "scripts": {
      "build": "tsc --noEmit",
      "check": "tsc --noEmit",
      "vercel-build": "npm run build"
    }
    ```
  * There are no test directories (`__tests__`, `tests`, `spec`) in either the frontend or backend folders.
