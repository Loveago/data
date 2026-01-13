# intruction.md

This project has 2 folders:

- `frontend/` = Next.js website (the store + admin panel)
- `backend/` = Express API + Prisma + PostgreSQL

Below are **step-by-step** instructions for running locally and deploying.

---

## 1) Requirements

- Node.js (you already have this)
- PostgreSQL installed and running

---

## 2) Local setup (the easiest way)

## 2A) Windows: Install PostgreSQL (so localhost works)

Your project needs PostgreSQL for the database.

### If you do NOT have Docker/WSL

Install PostgreSQL directly on Windows:

1. Download the installer:

- https://www.postgresql.org/download/windows/

2. During installation:

- Keep the default port: `5432`
- Set a password for the `postgres` user (write it down)
- pgAdmin is optional but helpful

3. Create a database named:

- `gigshub_clone`

After installing, you should be able to run `psql` from a terminal.

---

## 2B) WSL option (Ubuntu): PostgreSQL inside WSL

If you are using WSL (Ubuntu), you can run PostgreSQL inside WSL and connect from the Windows backend.

### Step 1: Install PostgreSQL in WSL

In Windows PowerShell run:

- `wsl -d Ubuntu -u root -- bash -lc "apt -o Acquire::Check-Valid-Until=false -o Acquire::Check-Date=false update && apt install -y postgresql postgresql-contrib"`

### Step 2: Start PostgreSQL

- `wsl -d Ubuntu -u root -- service postgresql start`

### Step 3: Check the PostgreSQL port

On some WSL setups the default cluster runs on port `5433`.

- `wsl -d Ubuntu -u postgres -- psql -tAc "SHOW port;"`

If it prints `5433`, use that in `DATABASE_URL`.

### Step 4: Create DB user + database

Create a dev user and database:

- `wsl -d Ubuntu -u postgres -- psql -p 5433 -c "CREATE ROLE gigshub LOGIN PASSWORD 'gigshub123';"`
- `wsl -d Ubuntu -u postgres -- createdb -p 5433 -O gigshub gigshub_clone`

Give the user permission needed by Prisma migrate (shadow database):

- `wsl -d Ubuntu -u postgres -- psql -p 5433 -c "ALTER ROLE gigshub CREATEDB;"`

### Step 5: Set `DATABASE_URL` in `backend/.env`

Use:

`postgresql://gigshub:gigshub123@localhost:5433/gigshub_clone?schema=public`

Then continue with migrations + seed.

### Step A: Create the backend `.env`

1. Go to `backend/`
2. Copy `backend/.env.example` to `backend/.env`
3. Edit `backend/.env` and set:

- `DATABASE_URL` (important)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (set to random strings)

Example `DATABASE_URL`:

`postgresql://postgres:password@localhost:5432/gigshub_clone?schema=public`

### Step B: Create the database

In PostgreSQL create a database named `gigshub_clone` (or change the name in `DATABASE_URL`).

### Step C: Run Prisma migration (creates tables)

Open a terminal in `backend/` and run:

- `npx prisma migrate dev --name init`

### Step D: Seed initial admin + demo products

Still in `backend/`:

- `npm run seed`

This creates:

- An admin user (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`)
- Some categories
- Some demo products

### Step E: Start the backend API

In `backend/`:

- `npm run dev`

Backend will run on:

- `http://localhost:4000`

Health check:

- `http://localhost:4000/api/health`

### Step F: Start the frontend website

Open another terminal in `frontend/`:

- `npm run dev`

Frontend will run on:

- `http://localhost:3000`

### Step G: Login and open admin

1. Go to `http://localhost:3000/login`
2. Login with the seeded admin email/password
3. You will see an **Admin** link in the navbar
4. Open:

- `http://localhost:3000/admin`

---

## 3) Production build (for deployment)

### Backend

In `backend/`:

- `npm install`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run start`

### Frontend

In `frontend/`:

- `npm install`
- `npm run build`
- `npm run start`

---

## 4) Deploy from a hosting panel (beginner-friendly)

Panels are different (cPanel / Plesk / CyberPanel). The goal is the same:

- Run the backend Node app (Express) on a port (example `4000`)
- Run the frontend Node app (Next.js) on a port (example `3000`)
- Point your domain to the frontend, and proxy `/api` to the backend

### Option A (recommended): VPS + Nginx (most reliable)

1. Get a VPS (Ubuntu)
2. Install:

- Node
- PostgreSQL
- Nginx

3. Upload the project (`frontend/` and `backend/`) to the server
4. Create `backend/.env`
5. Run migrations:

- `cd backend && npm install && npx prisma migrate deploy && npm run seed`

6. Start apps (use a process manager like `pm2` if your panel supports it)

- Backend: `cd backend && npm run start`
- Frontend: `cd frontend && npm install && npm run build && npm run start`

7. Configure Nginx:

- Proxy `https://yourdomain.com/` -> `http://127.0.0.1:3000`
- Proxy `https://yourdomain.com/api/` -> `http://127.0.0.1:4000/api/`

### Option B: cPanel “Setup Node.js App” (2 apps)

1. Upload and extract `frontend/` and `backend/`
2. Create a Node app for `backend`:

- Application root: `backend`
- Startup file: `src/server.js`
- Environment variables: from `backend/.env.example` (especially `DATABASE_URL`)
- Run: `npm install`

3. Run Prisma migration:

- `npx prisma migrate deploy`
- `npm run seed`

4. Create a second Node app for `frontend`:

- Application root: `frontend`
- Startup command: `npm run start`
- First run: `npm install` then `npm run build`

5. In the panel (or via Nginx / reverse proxy rules) forward:

- `/` to frontend app
- `/api` to backend app

---

## 4B) cPanel deployment (very detailed step-by-step)

This is the **most noob-friendly** way to deploy on cPanel.

### Recommended approach (easiest): use 2 subdomains

- `https://yourdomain.com` (or `https://www.yourdomain.com`) = **frontend** (Next.js)
- `https://api.yourdomain.com` = **backend** (Express API)

This avoids hard reverse-proxy rules inside Apache.

### Step 1: Database (PostgreSQL)

This app needs **PostgreSQL**.

- **If your cPanel has PostgreSQL tools**:
  - Create a database (example): `gigshub_clone`
  - Create a database user + password
  - Add the user to the database with ALL privileges

- **If your cPanel does NOT support PostgreSQL** (very common on shared hosting):
  - Use an external Postgres provider (easy options):
    - Supabase
    - Neon
    - Railway
  - You will get a `DATABASE_URL` from the provider.

### Step 2: Upload your files to the server

In cPanel:

1. Open **File Manager**
2. Upload a ZIP of this project (containing `frontend/` and `backend/`) to your home directory.
3. Extract it.

You should end up with something like:

```
/home/YOURUSER/gigshub/
  frontend/
  backend/
```

### Step 3: Create the BACKEND Node app (api subdomain)

1. Open **cPanel → Setup Node.js App**
2. Click **Create Application**
3. Fill it like this:

- **Node version:** latest available (18+)
- **Application mode:** Production
- **Application root:** `gigshub/backend`
- **Application URL:** choose or create `https://api.yourdomain.com`
- **Application startup file:** `src/server.js`

4. Click **Create**

5. Set **Environment Variables** in the cPanel UI (copy from `backend/.env.example`):

- `PORT` = (leave blank if cPanel provides it automatically, otherwise set something like `4000`)
- `CORS_ORIGIN` = `https://yourdomain.com,https://www.yourdomain.com`
- `DATABASE_URL` = your postgres connection string
- `JWT_ACCESS_SECRET` = random long string
- `JWT_REFRESH_SECRET` = random long string
- `SEED_ADMIN_EMAIL` = your admin email
- `SEED_ADMIN_PASSWORD` = your admin password

6. In the cPanel Node app page, run:

- `npm install`

7. Run Prisma migration and seed.

If your cPanel provides a terminal:

- `cd gigshub/backend`
- `npx prisma migrate deploy`
- `npm run seed`

If you do NOT have a terminal, look for “Run script / NPM scripts” options. If you can only run ONE command, run:

- `npx prisma migrate deploy`

then run:

- `npm run seed`

8. Restart the backend app.

Test backend health:

- `https://api.yourdomain.com/api/health`

### Step 4: Create the FRONTEND Node app (main domain)

Important:

- Next.js reads `NEXT_PUBLIC_*` environment variables at **build time**.
- So you must set `NEXT_PUBLIC_API_URL` **before** running `npm run build`.

1. Open **cPanel → Setup Node.js App**
2. Click **Create Application**
3. Fill it like this:

- **Node version:** same as backend
- **Application mode:** Production
- **Application root:** `gigshub/frontend`
- **Application URL:** `https://yourdomain.com` (or `https://www.yourdomain.com`)
- **Application startup file:** (use what your cPanel expects; the app ultimately needs to run `npm run start`)

4. Set **Environment Variables**:

- `NODE_ENV` = `production`
- `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com`

5. Install + build:

- `npm install`
- `npm run build`

6. Start/restart the frontend app.

Now open:

- `https://yourdomain.com`

### Step 5: Verify everything

1. Open the site.
2. Go to `/store` and confirm products load.
3. Login at `/login` using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
4. Open `/admin` and confirm it loads.

### OPTIONAL: Single domain (advanced)

If you insist on `https://yourdomain.com/api` instead of an `api.` subdomain, you need Apache reverse proxy rules (not always allowed on shared hosting).

If your hosting supports it, you want:

- `/` -> frontend
- `/api` -> backend

If your cPanel/host does not support reverse proxy rules, **use the subdomain approach**.

---

## 5) If something doesn’t work

- If frontend shows "Failed to load products": backend is not running, or `CORS_ORIGIN` is wrong.
- If login fails: seed again (`npm run seed`) and confirm your DB connection.
- If Prisma migration fails: check PostgreSQL credentials in `DATABASE_URL`.

---

## 6) Quick localhost test checklist

1. Make sure PostgreSQL is running.
2. Create `backend/.env` from `backend/.env.example`.
3. Run in `backend/`:

- `npx prisma migrate dev --name init`
- `npm run seed`
- `npm run dev`

4. Run in `frontend/`:

- `npm run dev`

5. Open:

- `http://localhost:3000`

---

## 7) Resume later checklist (copy/paste)

When you come back later, do this in order:

### A) Postgres

- [ ] Install PostgreSQL on Windows
- [ ] Create database: `gigshub_clone`

OR

- [ ] Use PostgreSQL inside WSL Ubuntu
- [ ] Start Postgres: `wsl -d Ubuntu -u root -- service postgresql start`
- [ ] Confirm port (often `5433`): `wsl -d Ubuntu -u postgres -- psql -tAc "SHOW port;"`
- [ ] Ensure user+db exist: `gigshub` / `gigshub_clone`

### B) Backend

- [ ] Create `backend/.env` (copy from `.env.example`)
- [ ] Set `DATABASE_URL` (example below)

`postgresql://postgres:YOUR_PASSWORD@localhost:5432/gigshub_clone?schema=public`

WSL example:

`postgresql://gigshub:gigshub123@localhost:5433/gigshub_clone?schema=public`

- [ ] Run: `cd backend` then `npm install`
- [ ] Run: `npx prisma migrate dev --name init`
- [ ] Run: `npm run seed`
- [ ] Run: `npm run dev`
- [ ] Check: `http://localhost:4000/api/health`

### C) Frontend

- [ ] Run: `cd frontend` then `npm install`
- [ ] Run: `npm run dev`
- [ ] Open: `http://localhost:3000`

### D) Test flows

- [ ] Open `/store` and confirm products load
- [ ] Login with the seeded admin account
- [ ] Open `/admin` and confirm you can create categories/products

