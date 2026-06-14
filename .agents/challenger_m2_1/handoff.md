# Handoff Report — Milestone 2 Correctness & Robustness Review

This handoff contains the detailed findings and verification of the correctness of Milestone 2 (SQL clean-up and customer details page queries).

## 1. Observation

- **Purge Script Execution**:
  - Run command: `npm run purge` inside `c:\Users\vsoha\Desktop\Work\igloo\vendor-saas\backend`
  - Result:
    ```
    --- Database Pre-purge Check ---
    Pre-purge Mock Record Counts: {
      mockCustomers: 0,
      mockOrders: 0,
      mockAppointments: 0,
      mockPayments: 0,
      mockOrderItems: 0,
      mockCustomerMeasurements: 0
    }
    ...
    SUCCESS: All mock records successfully wiped!
    --- Critical Data Preservation Checks ---
    Vendor d290f1ee-6c54-4b01-90e6-d701748f0851 count: 1 (Expected: 1)
    Staff a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d count: 1 (Expected: 1)
    SUCCESS: Primary tenant and admin staff account are intact.
    ```
  - Exit Code: `0` (Success).

- **Customer Page Rendering Error Conditions**:
  - File: `frontend/app/dashboard/customers/[id]/page.tsx`
  - Line 198:
    ```typescript
    if (isProfileLoading || !profile) {
      return <div className="p-10 text-center text-sm text-on-surface-variant">Synchronizing profile ledger summaries...</div>;
    }
    ```
  - Results of running custom queries for non-existent and invalid UUIDs in `backend/test_robustness.js`:
    - Non-existent UUID `'d290f1ee-6c54-4b01-90e6-d701748f0899'` returns: `{ code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' }`
    - Invalid UUID format `'invalid-uuid-format'` returns: `{ code: '22P02', message: 'invalid input syntax for type uuid: "invalid-uuid-format"' }`

- **Numeric Casting Check**:
  - File: `frontend/app/dashboard/customers/[id]/page.tsx`
  - Casting uses: `Number(val || 0)` (e.g. `Number(data.total_outstanding || 0)` on line 88).
  - Formatting uses: `total_outstanding.toLocaleString('en-IN')` (line 222).
  - Robustness script tests (`test_robustness.js`):
    - `Number(undefined || 0)` -> `0` (Safe)
    - `Number(null || 0)` -> `0` (Safe)
    - `Number("" || 0)` -> `0` (Safe)
    - `Number("abc" || 0)` -> `NaN` -> `NaN.toLocaleString('en-IN')` formats to `"NaN"` and does not throw (Safe).

- **E2E Test Failures**:
  - Log file: `C:\Users\vsoha\.gemini\antigravity\brain\98281415-e181-4692-b339-3157da376e8a\.system_generated\tasks\task-43.log`
  - Verbatim error log:
    ```
    JWT verification failed: JsonWebTokenError: invalid algorithm
        at C:\Users\vsoha\Desktop\Work\igloo\vendor-saas\backend\node_modules\jsonwebtoken\verify.js:145:19
        ...
        at authMiddleware (C:\Users\vsoha\Desktop\Work\igloo\vendor-saas\backend\src\middleware\authMiddleware.ts:24:25)
    ```
  - Express app mounting: `backend/api/index.ts` mounts `app.use(authMiddleware)` on line 59.
  - Active middleware file: `backend/src/middleware/authMiddleware.ts` does not stamp `req.vendorId` or `req.role` on the request context, and attempts to verify Supabase JWTs symmetrically against a symmetric local string `process.env.JWT_SECRET`.

---

## 2. Logic Chain

1. Since `npm run purge` executes with 0 counts on empty data and exits cleanly with code 0 (Observation 1), the purge script is robust and idempotent on pre-purged or empty databases.
2. If the user passes an invalid or non-existent UUID in the route, the Supabase query throws a Postgres error (Observation 2). Because the frontend client-side rendering only checks `!profile` and `isProfileLoading` but does not check for query errors (Observation 2), the page remains permanently stuck displaying `"Synchronizing profile ledger summaries..."` instead of displaying a clean error state.
3. Because all numeric displays on the customer profile page use `Number(val || 0)` (Observation 3), they fallback to safe default values (`0` or `NaN`) which do not trigger runtime exceptions inside JavaScript's `toLocaleString` function (Observation 3). Therefore, formatting will never crash the page due to missing numeric values.
4. The test suite fails 13 out of 17 tests (Observation 4) due to `authMiddleware.ts` attempting symmetric validation on Supabase JWT tokens (Observation 4). Since the backend routes depend on `req.vendorId` which is never populated by `authMiddleware` (Observation 4), the API endpoints are structurally broken for authenticated clients until the global middleware is swapped to use the database-backed `requireAuth` middleware from `backend/src/middleware/auth.ts`.

---

## 3. Caveats

- We did not modify any implementation code to respect the "Review-only" constraint.
- The UI error-state behavior is analyzed by static code tracing and database query replication, rather than using a mock browser, as there is no local browser runner configured.

---

## 4. Conclusion

- **Purge script correctness**: **Passed** (safe and idempotent).
- **Numeric casting robustness**: **Passed** (safe from throwing exceptions).
- **Customer profile error page**: **Failed** (user-facing hang bug when queried with invalid or non-existent UUIDs).
- **Backend authentication integration**: **Critical Issue** (mismatch between the global middleware and Supabase Auth client tokens).

---

## 5. Verification Method

- Run the robustness script to verify casting and Supabase Postgres error returns:
  ```bash
  cd backend
  node test_robustness.js
  ```
- Run the purge script to verify 0-count safety:
  ```bash
  cd backend
  npm run purge
  ```
- Inspect file `frontend/app/dashboard/customers/[id]/page.tsx` line 198 to verify the absence of error-state handlers.
