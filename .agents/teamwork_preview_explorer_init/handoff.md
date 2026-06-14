# Handoff Report — teamwork_preview_explorer

## 1. Observation

I have directly observed and analyzed the codebase in `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas` and noted the following structural details:

- **Frontend Mock Queries**:
  In `frontend/app/dashboard/customers/[id]/page.tsx`, lines 69-124, React Query hooks ignore dynamic route parameters and return static mock JSON collections. For example:
  ```typescript
  // Query 1: Fetch core profile metadata
  const { data: profile, isLoading: isProfileLoading } = useQuery<CustomerProfile>({
    queryKey: ['customer-profile', customerId],
    queryFn: async () => {
      // Emulating runtime database trigger evaluations returning calculated total_outstanding
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
  Similarly, `frontend/app/dashboard/settings/page.tsx`, lines 36-59, returns static mock arrays for measurement columns and staff coworkers:
  ```typescript
  // Query A: Fetch Custom User-Defined Column Arrays
  const { data: fields = [] } = useQuery<MeasurementTemplateField[]>({
    queryKey: ['settings-measurement-fields-list'],
    queryFn: async () => {
      return [
        { id: 'f1', field_name: 'Kamar (Waist)', unit: 'inches', display_order: 1, is_active: true },
        ...
  ```

- **Backend Route Configuration**:
  In `backend/api/index.ts`, lines 58-65:
  ```typescript
  // Apply authentication middleware to protected routes
  app.use(authMiddleware);

  // Register API routes (protected)
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/appointments', appointmentRoutes);
  ```
  And `backend/src/routes/auth.ts` is currently completely empty (0 bytes).

- **Middleware ID Parity Defect**:
  In `backend/src/middleware/auth.ts`, line 32-36:
  ```typescript
    // Map internal profile context matching this unique client identifier
    const { data: staffMember, error: dbError } = await supabaseAdmin
      .from('staff')
      .select('vendor_id, role')
      .eq('id', user.id)
      .single();
  ```
  However, the `staff` table in `seed_database.sql`, lines 35-45, defines:
  ```sql
  CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE,
    ...
  ```
  The column mapping to the Supabase Auth UID is `auth_user_id`, not the primary key `id`. For new user registrations, these UUIDs will differ.

- **Missing Redirection and Session Hydration**:
  There are no route guards, checks, or session state listeners configured in `frontend/app/dashboard/layout.tsx` or `frontend/app/layout.tsx`. If `useAuthStore`'s `user` payload is empty, the layout falls back to:
  ```typescript
  const activeUser = user || { fullName: 'Alex Mercer', role: 'owner' };
  const studioName = 'Stitch & Soul Atelier';
  ```

---

## 2. Logic Chain

1. **R1 (Authentication & Onboarding)**: Because there is no onboarding flow implementation, unauthenticated or unregistered sessions are not redirected, causing the application to fall back to mock owner details (`Alex Mercer`). Hydrating the Zustand store from the Supabase session listener on mount (using `onAuthStateChange`) and evaluating `user.vendorId` within the Next.js `layout.tsx` ensures that:
   - Users without accounts are routed to the signup/login screen (`/`).
   - Logged-in users without vendor scopes are blocked and redirected to `/onboarding`.
2. **R2 (Staff Invitation System)**: Since settings lists are currently mock-loaded, a backend API endpoint (`POST /api/auth/invite-staff`) utilizing Supabase's `auth.admin.createUser` and mapping the user in the `staff` table under the owner's `vendorId` is required. The middleware defect (`.eq('id', user.id)`) must be addressed by ensuring staff records insert the Supabase Auth ID as their primary key `id` (or updating the query to match `auth_user_id`) so the auth middleware evaluates them successfully.
3. **R3 (Data Clean-up & Dynamic Customer Detail)**: Because `seed_database.sql` populates specific mock UUIDs for customers and orders, a targeted SQL delete script wrapped in a transaction (and disabling replication triggers) is the safest way to purge the mock data. Replacing the hardcoded `queryFn` scopes in `customers/[id]/page.tsx` with dynamic Supabase client queries resolves the Priya Sharma lock-in bug and loads actual records corresponding to the URL ID parameter.

---

## 3. Caveats

- **Supabase Environment Config**: This implementation plan assumes that `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` are correctly configured in Vercel's deployment environment.
- **CORS Config**: CORS settings on Vercel must include both the development port (e.g. `http://localhost:3000`) and the Vercel app domain to allow cross-origin requests between the backend function and the Next.js client.

---

## 4. Conclusion

The codebase is structured to support multi-tenancy, but it currently lacks routing guards, real-time database endpoints, and proper column mapping, and relies heavily on hardcoded frontend mock states. Implementing the onboarding screen, fixing the auth middleware query/insert parity bug, deploying the admin user invitation route, and swapping Next.js page queries for real Supabase requests will resolve the key requirements.

---

## 5. Verification Method

To independently verify the proposed strategy once implemented:
1. **Database Schema Integrity**: Verify RLS status on Supabase using `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`.
2. **Auth & Onboarding Flow**: Register a new user, confirm they redirect to `/onboarding`, submit store details, and verify that the `vendors` and `staff` tables are populated.
3. **Settings & Coworker List**: Run `curl -X POST -H "Authorization: Bearer <TOKEN>" -d '{"email":"test@assistant.com", "password":"123", "name":"Assistant Test"}' http://<api-url>/api/auth/invite-staff` and assert a `201 Created` response is returned.
4. **Customer detail view**: Query `/dashboard/customers/<non-seeded-id>` and confirm the client UI displays the specific customer's records.
