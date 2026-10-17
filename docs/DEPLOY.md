# Deploy to Vercel

The repo is ready to deploy: `vercel.json` sets the build, security headers and caching. You only connect the accounts and add two environment variables. About 10 minutes.

## 1. Import the repo

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New… → Project**.
3. Find `Idanleyb/GTM_Planner` and click **Import**.
   If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to that repo.
4. Leave **Framework Preset** on *Vite* and the build settings as they are (they come from `vercel.json`).

## 2. Add the environment variables

Before clicking Deploy, open **Environment Variables** and add both, for all environments:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://qwjtocmtsbbnezmyxymd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the anon (public) key from Supabase → Project Settings → API |

Then click **Deploy**. When it finishes, copy your address, e.g. `https://gtm-planner.vercel.app`.

> If you deploy without these variables the app still loads, but in demo mode (nothing is saved). Add them under **Settings → Environment Variables** and redeploy.

## 3. Tell Supabase about the new address

Supabase → **Authentication → URL Configuration**:

- **Site URL**: your Vercel address, e.g. `https://gtm-planner.vercel.app`
- **Redirect URLs**: keep `http://localhost:5173/**` and add
  - `https://gtm-planner.vercel.app/**`
  - `https://gtm-planner-*.vercel.app/**` (preview deployments for pull requests; use your project name)

Without this step the sign-in email links back to localhost.

## 4. Check it

1. Open the Vercel address, sign in with your email, open the link **in the same browser**.
2. Create a plan, type in the brief, wait for **Saved at …** in the rail, then reload the page. Your text should still be there.
3. Open **Plan summary → Download Word doc**.

## After that

- Every push to `main` deploys automatically. Pull requests get their own preview link.
- GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, unit tests, database access-rule tests and browser tests on each push. A red ✗ on the commit means something broke; the browser-test report is attached to the run.
- Sign-in emails: Supabase's built-in sender allows only a few per hour. Before inviting a team, set up your own sender under **Authentication → Emails → SMTP Settings** (e.g. Resend), and consider a custom domain in Vercel (**Settings → Domains**). If you add a domain, add it to the Supabase redirect URLs too.
