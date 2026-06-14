# Scope: Implementation Track

## Architecture
- React Frontend (Next.js) & Supabase Backend (Supabase client libraries).
- Authentication: Supabase Auth.
- Routing/Redirection: Next.js router guards, `/onboarding` page, and `/dashboard`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 2 | SQL Cleanup & Customer Detail Page | SQL script/transaction to wipe old mock data, and dynamic query of customer details in `/dashboard/customers/[id]` to fetch real database records. | None | IN_PROGRESS |
| 3 | Auth & Onboarding Flow | Signup/login UI, router guards (prevent `/dashboard` access if store is missing, redirect to `/onboarding`), and `/api/auth/onboard` endpoint to create vendor & staff records. | Milestone 2 | PLANNED |
| 4 | Staff Invitation System | `/api/auth/invite-staff` backend route and dashboard staff settings UI for direct creation of assistant user accounts with staff database records. | Milestone 3 | PLANNED |
| 5 | E2E Integration & Hardening | Wait for E2E Testing Track to publish `TEST_READY.md`, run E2E tests tier-by-tier and fix failures. Run Phase 2 adversarial coverage hardening. | Milestones 2, 3, 4 | PLANNED |

## Interface Contracts
### Database Tables
- `vendors`: stores boutique info (`id`, `name`, `address`, `description`, `created_at`).
- `staff`: maps Supabase Auth user IDs to roles and vendor stores (`id`, `user_id`/`auth_id`, `vendor_id`, `role` [owner, assistant], `name`, `email`, `created_at`).
- `customers`: stores customer records (`id`, `vendor_id`, `name`, `email`, `phone`, `notes`, etc.).
