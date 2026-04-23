# Profile Intelligence Service

A queryable demographic intelligence API. Enriches names with gender, age, and nationality data from public APIs, persists the results, and exposes a full query engine with filtering, sorting, pagination, and natural language search over 2026 seeded profiles.

## Tech Stack

- **Node.js 18+** with **Express** (serverless on Vercel)
- **Supabase PostgreSQL** via **Prisma ORM**
- **UUID v7** for primary keys
- Deployed on **Vercel**

## Live API

Base URL: `https://profile-azng.vercel.app`

## Database Schema

| Field | Type | Notes |
|---|---|---|
| id | UUID v7 | Primary key |
| name | VARCHAR UNIQUE | Person's full name |
| gender | VARCHAR | `male` or `female` |
| gender_probability | FLOAT | Confidence score (0–1) |
| age | INT | Exact age |
| age_group | VARCHAR | `child`, `teenager`, `adult`, `senior` |
| country_id | VARCHAR(2) | ISO 3166-1 alpha-2 code (e.g. `NG`, `KE`) |
| country_name | VARCHAR | Full country name |
| country_probability | FLOAT | Confidence score (0–1) |
| created_at | TIMESTAMP | Auto-generated UTC |

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/profiles` | Create a profile (idempotent on `name`) |
| GET | `/api/profiles` | List/filter profiles with sorting and pagination |
| GET | `/api/profiles/search` | Natural language profile search |
| GET | `/api/profiles/:id` | Get a single profile by UUID |
| DELETE | `/api/profiles/:id` | Delete a profile |

---

## GET /api/profiles

List profiles with optional filtering, sorting, and pagination. All filters are combinable (AND logic).

### Filter Parameters

| Param | Type | Description | Example |
|---|---|---|---|
| `gender` | string | `male` or `female` | `?gender=male` |
| `age_group` | string | `child`, `teenager`, `adult`, `senior` | `?age_group=adult` |
| `country_id` | string | ISO alpha-2 code | `?country_id=NG` |
| `min_age` | integer | Minimum age (inclusive) | `?min_age=25` |
| `max_age` | integer | Maximum age (inclusive) | `?max_age=40` |
| `min_gender_probability` | float | Minimum gender confidence | `?min_gender_probability=0.9` |
| `min_country_probability` | float | Minimum country confidence | `?min_country_probability=0.5` |

### Sort Parameters

| Param | Values | Default |
|---|---|---|
| `sort_by` | `age`, `created_at`, `gender_probability` | `created_at` |
| `order` | `asc`, `desc` | `desc` |

### Pagination Parameters

| Param | Default | Max |
|---|---|---|
| `page` | `1` | — |
| `limit` | `10` | `50` |

### Response

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "019605a3-1234-7abc-8def-000000000001",
      "name": "amara",
      "gender": "female",
      "gender_probability": 0.95,
      "age": 28,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.62,
      "created_at": "2026-04-22T10:00:00.000Z"
    }
  ]
}
```

### Examples

```bash
# Males from Nigeria aged 25+
GET /api/profiles?gender=male&country_id=NG&min_age=25

# Adults sorted by age descending, page 2
GET /api/profiles?age_group=adult&sort_by=age&order=desc&page=2&limit=20

# High-confidence gender results
GET /api/profiles?min_gender_probability=0.95
```

---

## GET /api/profiles/search

Natural language query interface. Converts plain English into filters using rule-based parsing (no AI/LLMs).

### Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | Yes | Natural language query |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 10, max: 50) |

### Parsing Rules

| Query pattern | Extracted filter |
|---|---|
| `male` / `males` | `gender = male` |
| `female` / `females` | `gender = female` |
| `young` | `min_age = 16, max_age = 24` |
| `child` / `children` | `age_group = child` |
| `teenager` / `teenagers` | `age_group = teenager` |
| `adult` / `adults` | `age_group = adult` |
| `senior` / `seniors` | `age_group = senior` |
| `above N` / `over N` | `min_age = N` |
| `below N` / `under N` | `max_age = N` |
| `aged N` / `age N` | exact age (`min_age = max_age = N`) |
| `from <country>` / `in <country>` | `country_id` via country name lookup |

### Example Queries

| Query | Filters applied |
|---|---|
| `young males from nigeria` | `gender=male, min_age=16, max_age=24, country_id=NG` |
| `females above 30` | `gender=female, min_age=30` |
| `adult males from kenya` | `gender=male, age_group=adult, country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager, min_age=17` |
| `people from angola` | `country_id=AO` |
| `senior females` | `gender=female, age_group=senior` |

### Response

Same shape as `GET /api/profiles` (`status`, `page`, `limit`, `total`, `data`).

### Error — Unrecognized query

```json
{ "status": "error", "message": "Unable to interpret query" }
```

### Error — Missing `q`

```json
{ "status": "error", "message": "Invalid query parameters" }
```

---

## POST /api/profiles

Create a profile by enriching a name from Genderize, Agify, and Nationalize. Idempotent — submitting the same name twice returns the existing record.

**Request:**
```json
{ "name": "amara" }
```

**Response (201 created / 200 already exists):**
```json
{
  "status": "success",
  "data": {
    "id": "019605a3-1234-7abc-8def-000000000001",
    "name": "amara",
    "gender": "female",
    "gender_probability": 0.95,
    "age": 28,
    "age_group": "adult",
    "country_id": "NG",
    "country_name": "Nigeria",
    "country_probability": 0.62,
    "created_at": "2026-04-22T10:00:00.000Z"
  }
}
```

**Age group classification:**
- `0–12` → `child`
- `13–19` → `teenager`
- `20–59` → `adult`
- `60+` → `senior`

---

## GET /api/profiles/:id

Returns a single profile by its UUID v7.

```bash
GET /api/profiles/019605a3-1234-7abc-8def-000000000001
```

---

## DELETE /api/profiles/:id

Deletes a profile. Returns `204 No Content` on success.

---

## Error Responses

All errors follow this structure:

```json
{ "status": "error", "message": "<description>" }
```

| Status | Condition |
|---|---|
| 400 | Missing or empty required parameter |
| 422 | Invalid parameter type or value |
| 404 | Profile not found |
| 502 | Upstream API (Genderize/Agify/Nationalize) returned invalid data |
| 500 | Internal server error |

---

## Data Seeding

The database is pre-seeded with 2026 profiles. To re-seed (idempotent — safe to re-run):

```bash
node prisma/seed.js
```

Seed data is read from `seed_profiles.json` at the project root. Re-running skips duplicates via `createMany({ skipDuplicates: true })`.

---

## Project Structure

```
api/
  index.js              Vercel serverless entry (re-exports Express app)
lib/
  app.js                Express app — mounts all routes, error handlers
  prisma.js             Singleton Prisma client
  enrichment.js         Fetches from Genderize, Agify, Nationalize
  formatter.js          Shapes Prisma records into API response format
  query-parser.js       Rule-based NLP parser for /search endpoint
  routes/
    profiles.js         GET /api/profiles — filters, sort, pagination
    search.js           GET /api/profiles/search — NLP query
prisma/
  schema.prisma         Profile model definition
  seed.js               Seeds 2026 profiles idempotently
seed_profiles.json      Source data (2026 profiles)
vercel.json             Routes all traffic to api/index.js
```

---

## Deployment

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Pick a strong database password.
3. Wait ~2 minutes for provisioning.

### Step 2 — Get your connection strings

In the Supabase dashboard, click **Connect**.

**`DATABASE_URL`** — from the **Transaction pooler** tab (port 6543):
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**`DIRECT_URL`** — from the **Session pooler** tab (port 5432):
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

### Step 3 — Apply schema and seed

```bash
# Set up .env
cat > .env <<EOF
DATABASE_URL="your-transaction-pooler-url"
DIRECT_URL="your-session-pooler-url"
EOF

npm install
npx prisma db push
node prisma/seed.js
```

### Step 4 — Deploy on Vercel

1. Push to GitHub.
2. Import repo on [vercel.com](https://vercel.com).
3. Add `DATABASE_URL` and `DIRECT_URL` as environment variables.
4. Deploy.

---

## Local Development

```bash
npm install
cp .env.example .env      # fill in your Supabase URLs
npx prisma db push        # sync schema
node prisma/seed.js       # seed 2026 profiles
npx vercel dev            # start local server
```

---

## Troubleshooting

**`prepared statement "s0" already exists`** — add `?pgbouncer=true` to `DATABASE_URL`.

**`Can't reach database server`** during schema push — check that `DIRECT_URL` uses port **5432**.

**`Max client connections reached`** — ensure `connection_limit=1` is set on `DATABASE_URL`.
