# Scope: E2E Testing Track

## Architecture
- **Frontend**: Next.js App Router. Integrates Supabase Client SDK for Auth. Communicates with Backend API for business logic.
- **Backend**: Express API on Node.js/TypeScript. Accesses Supabase Database.
- **Database**: Supabase PostgreSQL with tables: `vendors`, `staff`, `customers`, `orders`, `order_items`, `payments`, `appointments`, `measurement_templates`, `measurement_field_templates`, `customer_measurements`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Codebase Exploration | Explore codebase auth, staff, db clean-up, and customers implementation | None | IN_PROGRESS |
| 2 | Test Runner Design | Design the custom E2E test runner to run locally and against Vercel/Supabase | 1 | PLANNED |
| 3 | Tier 1-4 Tests Implementation | Implement feature coverage, boundary, cross-feature, and real-world workload tests | 2 | PLANNED |
| 4 | Integration & Deployment Validation | Validate the tests run against production/Vercel environments | 3 | PLANNED |
| 5 | Test Infra & Ready Reporting | Write TEST_INFRA.md and publish TEST_READY.md | 4 | PLANNED |

## Interface Contracts
- **Auth & Onboarding**:
  - Sign-up: Supabase Auth client signup.
  - Verification: `/onboarding` checks if `staff` table has owner mapping. If not, renders form.
  - Submission: POST to onboarding endpoint or direct insert (to be confirmed by exploration) creating `vendors` and `staff` record.
- **Staff Invitation**:
  - Direct addition via Dashboard Settings: API endpoint or Supabase signup that creates assistant auth record and `staff` record with `assistant` role.
- **Database Clean-up**:
  - Wipes out mock customers/orders/appointments.
- **Customer Details**:
  - Endpoint/Page: `/dashboard/customers/[id]` dynamically queries client-side or server-side Supabase for customer profile, orders, ledger, measurements, appointments.
