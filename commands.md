# WSL Commands (Postgres + Backend + Frontend)

> These commands are intended to be run inside your WSL distro (Ubuntu).
> Your repo is on Windows at `D:\data`, so inside WSL it is available at `/mnt/d/data`.

## 1) Start PostgreSQL

postgresql://corelly_user:strongpassword@localhost:5432/corelly_db
```bash
sudo service postgresql start
sudo service postgresql status
pg_isready
```
https://pdd.gh.999yes.xyz/gh/?guid=4287197&key=friend
npx prisma migrate deploy && npx prisma db seed && npm run start

## 2) Backend (Express + Prisma)

Open a new WSL terminal (or a new tab) and run:

```bash
cd /mnt/d/data/backend
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Default backend URL:

- `http://localhost:4000/api/health`

## 3) Frontend (Next.js)

Open another WSL terminal and run:

```bash
cd /mnt/d/data/frontend
npm install
npm run dev
```

Default frontend URL:

- `http://localhost:3000`

## Notes / Troubleshooting

### Node.js is required inside WSL

If `node` is missing in WSL (`node: command not found`), you must install Node.js in Ubuntu (WSL) before you can run the backend/frontend there.

### Optional: run WSL commands from Windows

You can start things from Windows PowerShell like this (examples):

```powershell
# Start Postgres (runs as root inside WSL)
wsl -d Ubuntu -u root -e bash -lc "service postgresql start && pg_isready"

# Start backend (runs in the foreground; better to run from a WSL terminal)
wsl -d Ubuntu -e bash -lc "cd /mnt/d/data/backend && npm run dev"

# Start frontend (runs in the foreground; better to run from a WSL terminal)
wsl -d Ubuntu -e bash -lc "cd /mnt/d/data/frontend && npm run dev"
```
