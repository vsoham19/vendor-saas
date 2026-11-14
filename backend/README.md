# Vendor SaaS Backend

Vercel deploys this backend from `api/index.ts` as a Node serverless function.

Required production environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional environment variables:

- `CORS_ORIGIN` - comma-separated list of exact frontend origins allowed to call the API.
- `FRONTEND_VERCEL_URL` - supported as a fallback if this is already configured in Vercel.

CORS uses an exact-match allowlist. `http://localhost:3000` and `https://vendor-saas.vercel.app`
are always allowed; preview deployments must be added explicitly (wildcards such as
`*.vercel.app` are intentionally not supported).

Before pushing, run:

```bash
npm run build
```
