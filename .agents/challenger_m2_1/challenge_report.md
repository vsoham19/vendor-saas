# Challenge Report — Milestone 2 Correctness & Robustness Review

**Overall Risk Assessment**: MEDIUM

---

## 1. Purge Script Robustness (Idempotency with 0 Counts)
- **Status**: **PASS (Verified)**
- **Verification Method**: Executed `npm run purge` inside the `backend` workspace on a database that had no mock records.
- **Findings**:
  - The script successfully queries and detects 0 records for payments, orders, appointments, measurements, etc.
  - It utilizes conditional guards (e.g., `if (preDetails.payments.length > 0)`) before executing deletion mutations.
  - Output completes successfully with: `SUCCESS: All mock records successfully wiped!` and preserves critical production-level data (Tenant vendor and admin staff accounts).
  - Program exits with status code `0` and does not throw any errors.

---

## 2. Customer Profile Error Handling (Invalid & Non-Existent UUIDs)
- **Status**: **FAIL (Usability & Robustness Flaw)**
- **Risk Level**: **MEDIUM**
- **Verification Method**: Analyzed `frontend/app/dashboard/customers/[id]/page.tsx` and ran target queries in `backend/test_robustness.js`.
- **Findings**:
  - If a user navigates to `/dashboard/customers/<id>` where `<id>` is a non-existent UUID or an invalid format, the query to fetch the profile `supabase.from('customers').select(...).eq('id', customerId).single()` returns error codes `PGRST116` (not found) or `22P02` (invalid syntax).
  - The component fetcher throws the error, which stops loading, but leaves `profile` as `undefined`.
  - The page rendering condition is:
    ```typescript
    if (isProfileLoading || !profile) {
      return <div className="p-10 text-center text-sm text-on-surface-variant">Synchronizing profile ledger summaries...</div>;
    }
    ```
  - Since `profile` is undefined and loading is complete, `isProfileLoading || !profile` remains `true`.
  - **Result**: The page hangs permanently displaying `"Synchronizing profile ledger summaries..."` without showing any error message or redirecting. It does not crash, but it blocks the UI indefinitely.
- **Mitigation**:
  - Check for query errors using React Query's `isError` or `error`.
  - If an error is present, display a user-friendly error card (e.g., "Customer Profile Not Found") and a button to return to the directory.

---

## 3. Numeric Casts Robustness (`toLocaleString`)
- **Status**: **PASS (Verified)**
- **Verification Method**: Checked all occurrences of `toLocaleString` on dynamic properties and ran value-casting simulations in `backend/test_robustness.js`.
- **Findings**:
  - Every instance of `toLocaleString` in `frontend/app/dashboard/customers/[id]/page.tsx` is safe.
  - Values are cast using `Number(val || 0)`.
  - Inputs of `undefined`, `null`, and `""` cleanly fall back to `0`, formatting to `₹0` without throwing.
  - Non-numeric strings (e.g. `'abc'`) resolve to `NaN`, which formats to `₹NaN` and does not throw.
  - No crash scenarios exist for numeric casting.

---

## 4. Critical Integration Finding: Global JWT Verification & Tenant Context Mismatch
- **Status**: **CRITICAL BUG (Unrelated to frontend changes, but blocks backend API execution)**
- **Risk Level**: **HIGH**
- **Verification Method**: Run the backend test suite in `e2e-tests`.
- **Findings**:
  - The backend server is configured to run `authMiddleware` globally (`app.use(authMiddleware)` in `backend/api/index.ts`).
  - `authMiddleware` parses incoming tokens using `jwt.verify(token, process.env.JWT_SECRET)`. However, the frontend and E2E test client use Supabase Auth client tokens, which are signed by the Supabase JWT secret. This results in the error: `JWT verification failed: JsonWebTokenError: invalid algorithm` and returns a `401 Unauthorized` response.
  - Additionally, `authMiddleware` does not populate `req.vendorId` or `req.role` on the request. Protected routes rely on `req.vendorId` to isolate database queries, resulting in queries running with `vendorId = undefined`.
  - The correct middleware `requireAuth` in `backend/src/middleware/auth.ts` exists and calls `supabaseAdmin.auth.getUser` and sets both `vendorId` and `role`, but it is **never mounted**.
- **Mitigation**:
  - Replace the global `authMiddleware` with the `requireAuth` middleware from `backend/src/middleware/auth.ts` in `backend/api/index.ts` to properly validate Supabase client tokens and populate the tenant context.
