# Turso Migration — Codex Implementation Instructions

## Context

The Socratic Tutor app (`/socratic-tutor`) currently uses SQLite with `better-sqlite3` for local
development. This task migrates the production database to Turso Cloud (hosted libsql), while
keeping `better-sqlite3` for local development. The code changes have already been made — your
job is to verify them, install dependencies, sync the schema, and prepare the repo for Vercel
deployment.

---

## What Has Already Been Changed

The following files have already been updated. Verify each one looks correct before proceeding.

### 1. `prisma/schema.prisma`
The generator block must include `previewFeatures = ["driverAdapters"]`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

### 2. `prisma.config.ts`
The datasource URL must check for `TURSO_DATABASE_URL` first:

```typescript
datasource: {
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db",
},
```

### 3. `src/lib/db.ts`
Must branch between libsql (production) and better-sqlite3 (local dev):

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(client);
    return new PrismaClient({ adapter } as never);
  }

  const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
  return new PrismaClient({ adapter } as never);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 4. `package.json`
The build script must run Prisma before Next.js builds:

```json
"build": "prisma generate && prisma db push && next build",
```

The following packages must be present in `dependencies`:

```json
"@libsql/client": "^0.14.0",
"@prisma/adapter-libsql": "^7.7.0",
```

---

## Tasks to Execute

### TASK 1 — Install dependencies

From inside the `socratic-tutor/` directory, run:

```bash
npm install
```

Verify that `node_modules/@libsql` and `node_modules/@prisma/adapter-libsql` both exist after
the install completes.

### TASK 2 — Set local environment variables

Add the following to `socratic-tutor/.env.local` (create the file if it does not exist):

```
TURSO_DATABASE_URL=libsql://learningtutor-shughes-mp.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=<paste the token here — do not commit this file>
```

Confirm that `.env.local` is listed in `.gitignore`. The root `.gitignore` should contain `.env*`.
If it does not, add it.

### TASK 3 — Regenerate Prisma client

From inside `socratic-tutor/`, run:

```bash
npx prisma generate
```

Expected: no errors. The generated client should include driver adapter support.

### TASK 4 — Push schema to Turso

From inside `socratic-tutor/`, run:

```bash
npx prisma db push
```

Expected output includes confirmation that all tables were created in Turso. The command connects
to `TURSO_DATABASE_URL` as configured in `prisma.config.ts`.

If this fails with a connection error, verify:
- `TURSO_DATABASE_URL` starts with `libsql://` (not `https://`)
- `TURSO_AUTH_TOKEN` is present and not expired
- `prisma.config.ts` correctly reads `process.env.TURSO_DATABASE_URL`

### TASK 5 — Verify local dev still works

Run the app locally to confirm `better-sqlite3` still works when `TURSO_DATABASE_URL` is not set:

```bash
# Temporarily rename .env.local to confirm fallback works, then rename back
npm run dev
```

The app should start without errors and use the local `dev.db` file.

### TASK 6 — Verify no secrets in tracked files

Run the following and confirm none of these files contain the Turso URL or token:

```bash
git grep "turso.io" -- ':!*.env*'
git grep "TURSO_AUTH_TOKEN=" -- ':!*.env*'
```

Both commands should return no results. If either does, remove the secret from the offending
file and add it to `.env.local` instead.

### TASK 7 — Commit and push to GitHub

Stage only safe files:

```bash
git add prisma/schema.prisma prisma.config.ts src/lib/db.ts package.json package-lock.json
git commit -m "Migrate to Turso Cloud for production database"
git push
```

Do NOT stage or commit `.env.local`.

---

## Vercel Deployment (human step — not for Codex)

After the commit is pushed, the human operator must:

1. Go to vercel.com → import the GitHub repo
2. Set the following environment variables in Vercel's dashboard (Settings → Environment
   Variables):
   - `TURSO_DATABASE_URL` = `libsql://learningtutor-shughes-mp.aws-eu-west-1.turso.io`
   - `TURSO_AUTH_TOKEN` = (the token — get a fresh one from Turso after rotating)
   - `ANTHROPIC_API_KEY` = (the Anthropic API key — get a fresh one after rotating)
3. Deploy. Vercel will run `prisma generate && prisma db push && next build` automatically.

---

## Acceptance Criteria

- [ ] `npm install` completes with no errors
- [ ] `npx prisma generate` completes with no errors
- [ ] `npx prisma db push` successfully creates all tables in Turso (check Turso dashboard)
- [ ] `npm run dev` still works locally using `better-sqlite3`
- [ ] No secrets appear in any git-tracked file
- [ ] Vercel deployment builds and starts without errors
- [ ] The app is reachable at the Vercel URL and the instructor page loads
