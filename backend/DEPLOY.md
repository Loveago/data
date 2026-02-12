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

# Encart (daytime provider)
ENCART_API_KEY=
ENCART_BASE_URL=https://encartastores.com/api
ENCART_NETWORK_MAP={"mtn":"YELLO","telecel":"TELECEL","airteltigo":"AT_PREMIUM","at-bigtime":"AT_BIGTIME"}
ENCART_CAPACITY_MAP={}

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
1. `ENCART_CAPACITY_MAP` / `DATAHUBNET_CAPACITY_MAP` let you override capacity (GB) per product slug or volume (MB). Keep them `{}` unless you need custom mappings.
2. `ENCART_NETWORK_MAP` must point category slugs → Encart network keys (`mtn→YELLO`, etc.).
3. If you need to test a provider manually, set `FULFILLMENT_FORCE_PROVIDER` to `encart` or `datahubnet`, then restart the backend. Remove it afterward.

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
