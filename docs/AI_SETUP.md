# AI assist setup

AI assist adds **Draft this step**, **Fill the gaps** and **Critique** to every step. It runs as a Supabase Edge Function (`supabase/functions/ai-assist`) that calls Claude. Your Anthropic API key stays in Supabase; it never reaches the browser or the repo.

About 10 minutes, once.

## 1. Run the usage migration

Supabase → **SQL Editor → New query** → paste `supabase/migrations/20261017210000_ai_usage.sql` → **Run**.
This creates the `ai_usage` table used for the daily limit per user.

## 2. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys → Create Key**. Copy it (it starts with `sk-ant-`).
2. Recommended: **Billing → Limits** and set a monthly spend limit.

## 3. Deploy the function (PowerShell)

```powershell
cd $HOME\Documents\GTM_Planner
git pull
npx supabase login
npx supabase link --project-ref qwjtocmtsbbnezmyxymd
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
npx supabase functions deploy ai-assist --use-api
```

- `login` opens the browser to authorise the CLI.
- If `link` asks for the database password, press Enter to skip; it isn't needed for functions.
- `--use-api` deploys without Docker.
- You can also add the secret in the dashboard: **Edge Functions → Secrets**.

## 4. Check it

Open the app → any plan → **Pricing & packaging** → **Draft this step**. After a few seconds you'll see suggestions with **Apply** and **Skip**. Nothing changes in the plan until you apply.

## Settings (optional secrets)

| Secret | Default | What it does |
|---|---|---|
| `AI_MODEL` | `claude-sonnet-5-5` | Use `claude-haiku-5-5` for lower cost, `claude-opus-5-5` for the strongest output |
| `AI_DAILY_LIMIT` | `30` | Requests per user per 24 hours |

Change with `npx supabase secrets set AI_DAILY_LIMIT=50` (no redeploy needed).

## Cost

A request sends the step plus a summary of the plan: roughly 4,000–7,000 input tokens and up to 1,500 output tokens. With Sonnet 5.5 ($2 / $10 per million tokens) that is about **USD 0.01–0.03 per request**, so a user hitting the daily limit of 30 costs under USD 1 that day. Usage per user, step and model is logged in the `ai_usage` table.

## Who can do what

- Owners and editors: Draft, Fill the gaps, Critique.
- Viewers: Critique only.
- Everyone: suggestions are shown for review; only **Apply** changes the plan, and applied changes save like any other edit.

## Troubleshooting

| Message in the app | Fix |
|---|---|
| AI assist isn’t deployed yet | Run step 3 |
| AI assist isn’t set up yet: the ANTHROPIC_API_KEY secret is missing | `npx supabase secrets set ANTHROPIC_API_KEY=...` |
| The Anthropic API key was rejected … “invalid x-api-key” | The key is wrong or disabled. Create a new key, run `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (no quotes or brackets), then try again. Function logs show the first and last characters of the key in use, so you can confirm which one is set. |
| Your Anthropic account has no credit left | console.anthropic.com → **Billing** → add credit. API usage is billed separately from a Claude.ai subscription. |
| This Anthropic API key isn’t allowed to use the model | The key's workspace can't use that model. Use a key from your default workspace, or set `AI_MODEL=claude-haiku-5-5` |
| Couldn’t check your AI usage | Run the step 1 migration |
| You’ve used all 30 AI requests… | Wait, or raise `AI_DAILY_LIMIT` |

Function logs: Supabase → **Edge Functions → ai-assist → Logs**.
