# Project: Multi-tenant Boutique SaaS Enhancements

## Architecture
- **Frontend**: Next.js 14 App Router (pages: onboarding, settings, customer profile, auth). Integrates Zustand for auth state (`frontend/store/authStore.ts`), React Query for API fetching, and Supabase client-side library (`frontend/utils/supabase.ts`).
- **Backend**: Express + TypeScript server hosted on Vercel (`backend/api/index.ts`). Integrates Supabase Admin SDK (`supabaseAdmin` in `backend/src/config/supabase.ts`) to manage staff creation bypassing RLS.
- **Database**: PostgreSQL (Supabase). Contains triggers for order number prefixing and balance updates. Staff records map to Supabase Auth UUIDs.
- **Vercel Constraints**: Must run exclusively in Vercel environment. Environment variables (Supabase URL, Service Role, JWT Secret, CORS domains) must be fully compatible with Vercel deployment and Supabase production (no assumptions of localhost).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | E2E Test Suite Creation | Create comprehensive opaque-box test suite (Tiers 1-4) matching user requirements. Produce `TEST_INFRA.md` and `TEST_READY.md`. | None | DONE |
| M2 | Database Clean-up & Dynamic Customer Detail View | Truncate seeded mock customer data via transaction script. Update `/dashboard/customers/[id]` to query live data dynamically. | M1 | IN_PROGRESS |
| M3 | Authentication & Onboarding Flow | Implement login/signup switch, routing guards (redirect to `/` or `/onboarding`), `/onboarding` page, and `/api/auth/onboard` route. | M1 | IN_PROGRESS |
| M4 | Staff Invitation System | Create `/api/auth/invite-staff` backend admin route. Update settings page coworker UI and form to use live API endpoint. | M1 | IN_PROGRESS |
| M5 | E2E Integration Testing & Hardening | Run E2E verification, check code coverage with adversarial testing (Tier 5), and resolve gaps. | M2, M3, M4 | PLANNED |

## Interface Contracts
### Client (Frontend) ↔ Server (Backend)
- `POST /api/auth/onboard`
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ business_name: string, owner_name: string, address: string, description: string }`
  - Returns: `{ success: true, staff: StaffProfile }`
- `POST /api/auth/invite-staff`
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ name: string, email: string, password: string }`
  - Returns: `{ success: true, staff: StaffProfile }`
- `GET /api/staff`
  - Headers: `Authorization: Bearer <token>`
  - Returns: `StaffProfile[]`

## Code Layout
- `frontend/app/` - Next.js App Router root
- `frontend/app/onboarding/page.tsx` - New onboarding page
- `frontend/app/dashboard/customers/[id]/page.tsx` - Dynamic customer details
- `frontend/app/dashboard/settings/page.tsx` - Coworker/Staff settings
- `backend/src/routes/auth.ts` - New authentication/onboarding routes
- `backend/src/middleware/auth.ts` - Middleware for token and role validation
