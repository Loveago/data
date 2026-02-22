---
title: Backend environment & VPS deployment
---

## 1. Environment variables
Copy these into `backend/.env` (or your host-level secret manager). JSON values must stay on a single line.

```
# Core services
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
JWT_SECRET=<random string>
PAYSTACK_SECRET_KEY=<paystack-key>

# GrandAPI (daytime provider)
GRANDAPI_API_KEY=
GRANDAPI_BASE_URL=https://grandapi.duckdns.org/api
GRANDAPI_NETWORK_MAP={"mtn":"MTN","telecel":"TELECEL","airteltigo":"AIRTELTIGO","at-bigtime":"AIRTELTIGO"}
GRANDAPI_CAPACITY_MAP={}
# Optional overrides
GRANDAPI_PACKAGE_MAP={}
# EXPIRING or NON_EXPIRING (per GrandAPI packages)
GRANDAPI_BUNDLE_TYPE=EXPIRING
# Optional callback for order status webhooks
GRANDAPI_CALLBACK_URL=
# Package cache TTL in ms (default 300000)
GRANDAPI_PACKAGE_CACHE_TTL_MS=300000

# Datahubnet (night provider)
DATAHUBNET_API_KEY=
DATAHUBNET_BASE_URL=https://api.datahubnet.com
DATAHUBNET_NETWORK_MAP={}
DATAHUBNET_CAPACITY_MAP={}
DATAHUBNET_TELECEL_NETWORK=telecel

# Fulfillment dispatcher
FULFILLMENT_DISPATCH_INTERVAL_MS=13000
# leave unset in production so time-based routing applies
# FULFILLMENT_FORCE_PROVIDER=
```

Notes:
1. `GRANDAPI_CAPACITY_MAP` / `DATAHUBNET_CAPACITY_MAP` let you override capacity (GB) per product slug or volume (MB). Keep them `{}` unless you need custom mappings.
2. `GRANDAPI_NETWORK_MAP` must point category slugs → GrandAPI network keys (`mtn→MTN`, `telecel→TELECEL`, etc.).
3. `GRANDAPI_PACKAGE_MAP` can override package IDs. You can map by size or by network+size (e.g. `{ "MTN": { "1": "package-id" } }`).
4. To test a provider manually, set `FULFILLMENT_FORCE_PROVIDER` to `grandapi` or `datahubnet`, then restart the backend so the dispatcher re-reads the env. Remove it afterward.

## 2. VPS deployment checklist
1. **Prerequisites**
   - Node.js 18+
   - npm 9+
   - PostgreSQL reachable from the VPS
   - Process manager (PM2 / systemd) for the backend

2. **Fetch source & install**
   ```bash
   git clone https://github.com/Loveago/data.git
   cd data/backend
   npm install
   ```

3. **Configure environment**
   - Copy your secrets into `backend/.env` using the template above.
   - Ensure the `.env` file is readable by the process user but not world-readable.

4. **Database migrations**
   ```bash
   npx prisma migrate deploy
   # optional fresh seed (only for new DBs)
   # npx prisma db seed
   ```

5. **Build & start**
   ```bash
   npm run build   # optional—code currently runs directly via npm start
   pm2 start npm --name backend -- start
   # or: NODE_ENV=production npm start
   ```

6. **Verify services**
   - Hit `http://<server>:4000/health` (or login portal) to confirm API is up.
   - Place one MTN 1GB test order to confirm routing & fulfillment.

7. **Ongoing operations**
   - Logs: `pm2 logs backend`
   - Restart after env changes: `pm2 restart backend`
   - Pull updates: `git pull origin main && npm install && pm2 restart backend`

## 3. Forcing a provider during investigation
```
# example: force Datahubnet regardless of time window
FULFILLMENT_FORCE_PROVIDER=datahubnet
```
1. Add the variable (or export it) on the VPS.
2. Restart the backend (`pm2 restart backend`).
3. Verify new orders show `fulfillmentProvider` matching the forced value.
4. Remove the line when done and restart again so time-based routing resumes.
