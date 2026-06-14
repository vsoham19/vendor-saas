# Challenge Report — Milestone 2 Correctness & Robustness Review

**Overall Risk Assessment**: MEDIUM

---

## Challenge Summary

This report reviews the Milestone 2 implementation of the database purge script and the dynamic customer profile page. While the purge script is robust and numeric casting is safe from exceptions, the customer details page contains a critical usability bug where it hangs indefinitely when queried with invalid or non-existent UUIDs. Additionally, a mismatch in the backend's authentication middleware configuration blocks integration testing.

---

## Challenges

### [Medium] Challenge 1: Permanent UI Loading Hang on Invalid or Non-Existent UUIDs

- **Assumption challenged**: The page assumes the query will either succeed or loading state is sufficient representation of fetching state.
- **Attack scenario**: Navigating to `/dashboard/customers/invalid-uuid-format` or `/dashboard/customers/d290f1ee-6c54-4b01-90e6-d701748f0899` (non-existent).
- **Blast radius**: The page displays a generic loading message `"Synchronizing profile ledger summaries..."` indefinitely. It does not crash (no white screen), but the user is locked on a loading state with no error feedback.
- **Mitigation**: Handle React Query's `isError` or `error` state. If the customer profile is not found or the database query returns an error, render a clean error card (e.g. "Customer profile not found") with a link to return to the Customer Directory.

### [High] Challenge 2: Global JWT Verification & Tenant Context Mismatch

- **Assumption challenged**: The backend mounts the correct token verification and context-injection middleware.
- **Attack scenario**: Executing API calls with Supabase tokens.
- **Blast radius**: 13 out of 17 tests in the E2E suite fail. The backend server globally mounts `authMiddleware` which verifies signatures symmetrically against `process.env.JWT_SECRET`. Because Supabase client tokens are signed by the Supabase project auth key, this symmetric check fails with `invalid algorithm` and returns a `401 Unauthorized` response. Additionally, `authMiddleware` does not populate `req.vendorId`, causing downstream protected routes to execute queries with an undefined vendor context.
- **Mitigation**: Replace the global `authMiddleware` in `backend/api/index.ts` with the robust `requireAuth` middleware from `backend/src/middleware/auth.ts`, which calls `supabaseAdmin.auth.getUser` and injects both the user profile and the vendor context.

---

## Stress Test Results

- **Scenario 1: Purge script run on an empty database (0 mock records)**
  - *Expected behavior*: Exit code 0, 0 deletion counts logged, no Postgres or Javascript exceptions.
  - *Actual behavior*: Pre-purge check reports 0 mock records, skips Supabase deletions, prints success message, and exits with code 0.
  - *Verdict*: **PASS**

- **Scenario 2: Fetch customer details with invalid UUID format**
  - *Expected behavior*: Backend API returns 400 or 500 error; frontend gracefully shows error.
  - *Actual behavior*: Backend returns 404 (due to postgres error caught in the `if (customerErr || !customer)` block). React Query fails to fetch, keeping `profile` as `undefined`. Frontend UI stays stuck on `"Synchronizing profile ledger summaries..."` indefinitely.
  - *Verdict*: **FAIL**

- **Scenario 3: Fetch customer details with non-existent UUID format**
  - *Expected behavior*: Backend API returns 404; frontend gracefully shows error.
  - *Actual behavior*: Backend returns 404. React Query fails to fetch, keeping `profile` as `undefined`. Frontend UI stays stuck on `"Synchronizing profile ledger summaries..."` indefinitely.
  - *Verdict*: **FAIL**

- **Scenario 4: Numeric casting with null, undefined, or empty values**
  - *Expected behavior*: Falling back to 0, ensuring `toLocaleString` does not throw.
  - *Actual behavior*: `Number(undefined || 0)` -> 0 -> formatted as `₹0`. `Number(null || 0)` -> 0 -> formatted as `₹0`. `Number("" || 0)` -> 0 -> formatted as `₹0`.
  - *Verdict*: **PASS**

- **Scenario 5: Numeric casting with non-numeric string values**
  - *Expected behavior*: Fallback behavior resolves without throwing Javascript exception.
  - *Actual behavior*: `Number("abc" || 0)` -> `NaN` -> formatted to `₹NaN` without throwing any exceptions.
  - *Verdict*: **PASS**

---

## Unchallenged Areas

- **Frontend-Backend Integration under deployment constraints**: Not fully stress-tested in a live Vercel environment because we are restricted to local simulation and review.
