# Vendor SaaS Backend

Vercel deploys this backend from `api/index.ts` as a Node serverless function.

Required production environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional environment variables:

- `CORS_ORIGIN` - set this to the deployed frontend URL. If omitted, the API allows all origins.
- `FRONTEND_VERCEL_URL` - supported as a fallback if this is already configured in Vercel.

Before pushing, run:

```bash
npm run build
```
