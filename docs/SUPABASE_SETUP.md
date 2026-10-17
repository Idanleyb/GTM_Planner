# Supabase setup

Project: `qwjtocmtsbbnezmyxymd` — https://supabase.com/dashboard/project/qwjtocmtsbbnezmyxymd

## 1. Apply the schema (once)

1. Open **SQL Editor → New query**.
2. Paste the full contents of `supabase/migrations/20261017120000_initial_schema.sql` and click **Run**.
3. Check **Table Editor**: you should see `profiles`, `workspaces`, `workspace_members`, `workspace_invites`, `projects`, `project_activity`, each marked RLS enabled.

Alternative with the CLI: `npx supabase link --project-ref qwjtocmtsbbnezmyxymd` then `npx supabase db push`.

### 1b. Second migration (Step 8)

Also run `supabase/migrations/20261017200000_accept_invites.sql` in the SQL editor. It lets someone who already has an account join a workspace they were invited to the next time they sign in.

## 2. Auth settings

- **Authentication → Sign In / Providers → Email**: enabled (magic link).
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:5173` for now; switch to the Vercel URL after deploy.
  - Redirect URLs: `http://localhost:5173/**` and later `https://<your-vercel-domain>/**`.
- Open the sign-in link **in the same browser** you requested it from (the app uses the secure PKCE flow, which ties the link to that browser).
- Supabase's built-in email sender allows only a few sign-in emails per hour. If you hit the limit while testing, wait, or set up your own SMTP under **Authentication → Emails → SMTP Settings** (e.g. Resend, Postmark).

## 3. Local environment

```bash
cp .env.example .env.local   # then fill in the URL and anon key
npm run dev
```

The engine preview page shows a **Supabase** line:
- "schema installed and anonymous access is blocked" → everything is in place.
- "projects table is missing" → step 1 hasn't been run.

## 4. Vercel (Step 12)

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project → Settings → Environment Variables**. The anon key is designed to be public; Row Level Security enforces access. Never put the `service_role` key in the frontend or in Vercel env vars prefixed with `VITE_`.

## What the access rules guarantee

Tested in `supabase/tests/rls.test.ts` against the real migration:

| Who | Can |
|---|---|
| Anonymous visitor | Nothing |
| Any signed-in user | Gets a personal workspace as owner on sign-up; sees only workspaces they belong to |
| Viewer | Read projects, activity and teammates' profiles |
| Editor | + create and edit projects (saves are rejected if someone saved in between), append activity as themselves |
| Owner | + delete projects, manage members and invites, delete the workspace |

Also enforced: a workspace always keeps at least one owner; members can't promote themselves; a project can't be moved to another workspace or have its creator rewritten; activity entries can't be edited, deleted or attributed to someone else; invites are accepted automatically when the invited email signs up.
