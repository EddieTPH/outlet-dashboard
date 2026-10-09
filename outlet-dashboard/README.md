# Outlet performance dashboard

Vite (vanilla JS) dashboard that reads the `outlet_weeks` table from Supabase.

## Run locally

```bash
npm install
cp .env.example .env     # holds the Supabase URL and publishable key
npm run dev              # http://localhost:5173
```

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: Add New > Project > import the repo. Vercel detects Vite automatically
   (build command `npm run build`, output directory `dist`).
3. Before deploying, add two Environment Variables (Production, Preview, Development):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY` (the publishable key, not a secret/service_role key)
4. Deploy. If you change a variable later, redeploy so it is baked into the build.

## Data

All loading is in `loadData()` in `src/main.js`. The table needs a read-only
(`select`) row-level-security policy for the `anon` role, which is already set up.
If live loading fails, the page shows sample data with a banner instead of breaking.
