# Handoff Report — explorer_exploration

## 1. Observation

Direct observations made in the codebase:
1. **Onboarding / Authentication**:
   * In `frontend/app/page.tsx` (lines 35-43), if the staff query fails, it throws a blocking error without redirection:
     ```typescript
     if (staffError || !staffData) {
       throw new Error('No associated boutique workspace profile found for this account.');
     }
     ```
   * The registration link in `frontend/app/page.tsx` (line 159) is stubbed:
     ```html
     <a href="#" className="font-semibold text-secondary hover:underline underline-offset-2">
       Register Studio Tenant
     </a>
     ```
   * In `frontend/app/dashboard/layout.tsx` (lines 28-29), a visual bypass is active:
     ```typescript
     const activeUser = user || { fullName: 'Alex Mercer', role: 'owner' };
     const studioName = 'Stitch & Soul Atelier';
     ```
2. **Staff Invitation**:
   * In `frontend/app/dashboard/settings/page.tsx` (lines 281-285), the invite submit button displays a mock alert:
     ```typescript
     onClick={() => { setSectionError('Supabase Invitation transmission framework requires verification key activation.'); }}
     ```
3. **Database Cleanup**:
   * Only `seed_database.sql` exists; no runtime database cleanup code or REST endpoints are defined in either the frontend or backend folders.
4. **Customer Details Page**:
   * In `frontend/app/dashboard/customers/[id]/page.tsx` (lines 71-82), all React Query `queryFn` implementations return hardcoded mock responses:
     ```typescript
     queryFn: async () => {
       return {
         id: customerId,
         full_name: 'Priya Sharma',
         ...
       };
     }
     ```
5. **Environment Configuration**:
   * `backend/api/index.ts` (lines 26-27) hardcodes CORS allowed origins:
     ```typescript
     const allowedOrigins = ['http://localhost:3000', 'https://vendor-saas.vercel.app'];
     ```
   * `backend/src/middleware/auth.ts` (lines 31-36) contains a column query mismatch mismatch:
     ```typescript
     const { data: staffMember, error: dbError } = await supabaseAdmin
       .from('staff')
       .select('vendor_id, role')
       .eq('id', user.id)
       .single();
     ```
6. **Test Setup**:
   * `frontend/package.json` and `backend/package.json` contain no test-related scripts, dependencies, or configuration keys. No test folders exist.

---

## 2. Logic Chain

1. **Authentication / Onboarding**:
   * Since `frontend/app/page.tsx` throws an error and halts on login when `staff` record is not found, and no `/onboarding` page or logic exists, new registrations cannot be completed or authenticated.
   * To fix this, a global auth state listener must detect authenticated users without a `vendor_id` and redirect them to a new `/onboarding` page where they can input store details.
   * The backend middleware `requireAuth` (`backend/src/middleware/auth.ts`) queries the database using `.eq('id', user.id)`. However, in `seed_database.sql`, `id` is a randomly generated UUID while `auth_user_id` links to Supabase. This causes the lookup to fail for any dynamically created user (where `id` and `auth_user_id` differ). It must be changed to `.eq('auth_user_id', user.id)`.
2. **Staff Invitation**:
   * Since the invite form button only triggers a warning message, we need a backend endpoint `POST /api/auth/invite-staff` and corresponding API calling code on the settings page.
   * Because the backend has access to `SUPABASE_SERVICE_ROLE_KEY`, it can dynamically create auth users in Supabase via `admin.createUser` and insert matching `staff` records with `'assistant'` roles.
3. **Database Cleanup**:
   * Because there is no cleanup script, mock data (like Priya Sharma) seeded by `seed_database.sql` remains.
   * Since all relational tables use `ON DELETE CASCADE` on their foreign keys referencing `customers`, a SQL transaction deleting customer records matching seed UUIDs will clean up all mock data.
4. **Customer Details Page**:
   * Since `customers/[id]/page.tsx` returns mock data directly, it must be updated to query Supabase using the client.
   * The query structure on the frontend expects a flat `order_number` in the ledger array. However, joining `payments` and `orders` in Supabase yields `{ orders: { order_number: string } }`, which must be flat-mapped to avoid rendering receipts as standalone payments.
5. **Environment Configuration**:
   * In Vercel deployments, CORS failures will happen if the dynamic Vercel domain is not whitelisted. Therefore, the backend must dynamically read allowed origins from environment variables or handle `.vercel.app` patterns.
6. **Test Setup**:
   * Because there are no testing libraries in `package.json`, unit or integration tests (using Jest or Playwright) must be set up from scratch.

---

## 3. Caveats

* **Assumptions**: We assume that any clean-up script is meant to be run administrative-only. We assume that newly created staff accounts (assistants) do not need email validation, and can be directly created with a temporary password via `auth.admin.createUser`.
* **Uninvestigated**: The mailer configuration of Supabase to send custom invitations was not explored as email triggers happen within Supabase's hosted layer.

---

## 4. Conclusion

1. The authentication & onboarding flow needs:
   * Next.js routing guards.
   * A new `/onboarding` frontend page.
   * An onboarding backend route that bypasses `requireAuth` to create the initial `vendors` and `staff` entries.
   * Resolving the `eq('id', user.id)` column bug in `backend/src/middleware/auth.ts`.
2. The staff invitation system requires implementing `POST /api/auth/invite-staff` in the backend using Supabase admin controls.
3. The database clean-up can be achieved using a transactional SQL script that deletes seeded customers.
4. The customer details page requires replacing mock resolvers with dynamic Supabase client queries, taking care of flat-mapping the joined `order_number` in the payment ledger table.
5. Environment setup must configure CORS domains dynamically to support custom Vercel deployments.
6. The test setup is currently non-existent and requires manual configuration.

---

## 5. Verification Method

To verify these conclusions and identify where code edits must be placed:
1. Inspect `backend/src/middleware/auth.ts` lines 31-36 to check the `eq('id', user.id)` bug.
2. Inspect `frontend/app/dashboard/customers/[id]/page.tsx` lines 71-124 to verify the hardcoded query functions.
3. Inspect `frontend/app/dashboard/settings/page.tsx` lines 281-285 to confirm the visual-only invite staff trigger.
4. Inspect `frontend/package.json` and `backend/package.json` to confirm the lack of testing configurations.
