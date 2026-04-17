# Profile Intelligence Service

A REST API that enriches a given name with gender, age, and nationality data by aggregating responses from three public APIs (Genderize, Agify, Nationalize) and persisting the structured result.

## Tech Stack

- **Node.js 18+** with **Express** (serverless on Vercel)
- **Supabase PostgreSQL** via **Prisma ORM**
- **UUID v7** for primary keys
- Deployed on **Vercel**

## Live API

Base URL: `https://YOUR-APP.vercel.app` _(update after deploy)_

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/profiles` | Create a profile (idempotent on `name`) |
| GET | `/api/profiles` | List profiles; filter by `gender`, `country_id`, `age_group` |
| GET | `/api/profiles/:id` | Get a single profile by UUID |
| DELETE | `/api/profiles/:id` | Delete a profile |

### POST /api/profiles

**Request:**
```json
{ "name": "ella" }
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DRC",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

If the name already exists, returns `200` with `"message": "Profile already exists"` and the existing record.

### Processing Rules

- **Gender**: from Genderize; `count` is renamed to `sample_size`.
- **Age**: from Agify, classified as:
  - `0–12` → `child`
  - `13–19` → `teenager`
  - `20–59` → `adult`
  - `60+` → `senior`
- **Country**: country with the highest `probability` from Nationalize.

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing or empty `name` |
| 422 | `name` is wrong type |
| 404 | Profile not found |
| 502 | Upstream API returned invalid data |
| 500 | Internal server error |

Upstream errors follow the spec shape:
```json
{ "status": "502", "message": "Genderize returned an invalid response" }
```

All other errors:
```json
{ "status": "error", "message": "..." }
```

## Deployment

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Pick a **strong database password** (you'll need it in a minute).
3. Pick a region close to you (e.g. `West EU (Ireland)` for Nigeria).
4. Wait ~2 minutes for the database to provision.

### Step 2 — Get your connection strings

1. In the Supabase dashboard, click **Connect** at the top of the page.
2. You'll see three tabs: **Direct connection**, **Transaction pooler**, **Session pooler**. You need two of them.

**`DATABASE_URL`** — from the **Transaction pooler** tab (port **6543**). Append `?pgbouncer=true&connection_limit=1`:
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**`DIRECT_URL`** — from the **Session pooler** tab (port **5432**), no extra flags:
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Replace `[YOUR-PASSWORD]` in the string with the password from Step 1.

> **Why two URLs?** Prisma Migrate can't run through the transaction pooler (PgBouncer doesn't support the prepared statements migrations need). The app uses the transaction pooler at runtime because Vercel serverless functions create many short-lived connections, which the pooler is built to handle.

### Step 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/REPO.git
git branch -M main
git push -u origin main
```

### Step 4 — Apply the migration to Supabase

Run this **once** locally before deploying:

```bash
# Create .env with BOTH URLs
cat > .env <<EOF
DATABASE_URL="your-transaction-pooler-url-with-pgbouncer-flag"
DIRECT_URL="your-session-pooler-url"
EOF

npm install
npx prisma migrate deploy
```

You should see `All migrations have been successfully applied`. The `profiles` table now exists in Supabase.

### Step 5 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your repo.
2. Under **Environment Variables**, add both:
   - `DATABASE_URL` (transaction pooler, port 6543, with `pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` (session pooler, port 5432)
3. Click **Deploy**.

### Step 6 — Test

```bash
curl -X POST https://YOUR-APP.vercel.app/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"emmanuel"}'

curl https://YOUR-APP.vercel.app/api/profiles
curl "https://YOUR-APP.vercel.app/api/profiles?gender=male&country_id=NG"
```

## Local Development

```bash
npm install
cp .env.example .env            # fill in your Supabase URLs
npx prisma migrate deploy       # first time only
npx vercel dev                  # emulates Vercel locally
```

## Project Structure

```
api/
  index.js              Vercel serverless entry (wraps Express)
lib/
  app.js                Express app with all routes
  prisma.js             Singleton Prisma client
  enrichment.js         External API orchestration
  formatter.js          Response shaping
prisma/
  schema.prisma         Profile model with dual-URL datasource
  migrations/           SQL migrations
vercel.json             Routes all traffic to api/index.js
```

## Troubleshooting

**`prepared statement "s0" already exists`** — you forgot `?pgbouncer=true` on `DATABASE_URL`. Add it and redeploy.

**`Can't reach database server`** during `prisma migrate deploy` — check that `DIRECT_URL` uses port **5432**, not 6543.

**`Max client connections reached`** — remove `connection_limit=1` only if you're certain you need more; otherwise close extra Prisma clients or disable Vercel Fluid Compute (there's a known interaction issue).
