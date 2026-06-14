## Challenge Summary

**Overall risk assessment**: MEDIUM

## Challenges

### [Medium] Challenge 1: Infinite Loading State on Query Failure
- **Assumption challenged**: Assumes that the `id` route parameter is a valid UUID, that the customer exists in the database, and that the database query always succeeds.
- **Attack scenario**: A user navigates to `/dashboard/customers/some-invalid-id` or the database connection fails. Supabase returns an error, resulting in `profile` remaining `undefined`.
- **Blast radius**: The page hangs indefinitely on the message "Synchronizing profile ledger summaries..." with no indication of error, locking the tab.
- **Mitigation**: Handle the `isError` state of the React Query hooks and render an error panel or redirect the user back to the customer directory.

### [Low] Challenge 2: Non-Atomic Database Purge Steps
- **Assumption challenged**: Assumes database connection stability and lack of concurrent activity during the execution of `purge.js`.
- **Attack scenario**: The connection drops or the script is interrupted halfway through execution. Because the deletes are executed as separate, sequential HTTP calls, some tables will be purged while others remain intact.
- **Blast radius**: Creates a partially-wiped database state with orphans.
- **Mitigation**: Use a single PostgreSQL RPC or a transaction block to make the purge atomic if it is ever adapted for non-dev operations.

### [Low] Challenge 3: Ledger Mapping Structural Vulnerability
- **Assumption challenged**: Assumes the Supabase JS client always returns the joined `orders` relation as either an array or a single object.
- **Attack scenario**: If the relationship metadata changes or multiple orders can somehow map to a single payment, the mapper might access the incorrect index or fail if properties are null.
- **Blast radius**: Overview tab ledger table crashes.
- **Mitigation**: The code has an inline array/object check, but using a strict database view or custom function to fetch ledger lines would decouple the UI structure from raw Supabase join patterns.

## Stress Test Results

- **Invalid UUID Parameter** → Visit `/dashboard/customers/non-existent-uuid` → Page hangs on loading message forever. → **FAIL**
- **Null Optional Fields** → Fetch profile with null `email`, `address`, or `notes` → Fallback values (`'No email on file'`, etc.) display correctly. → **PASS**
- **Clean Customer (No orders/measurements/appointments)** → Fetch profile with no related records → Correctly renders empty table state/list placeholders without crashing. → **PASS**

## Unchallenged Areas

- **Backend API Tenant Isolation** — reason not challenged: The user request specifically asked to review `backend/purge.js` and `frontend/app/dashboard/customers/[id]/page.tsx`, so backend controller endpoint security was outside the core scope of this review.
