# Going live on Vercel (free tiers)

```
Your Mac (office network / VPN)                Cloud
───────────────────────────────                ─────────────────────────────────
npm run daily  10:00 · 14:00 · 18:00           Neon Postgres (free, Singapore)
  RMI + SAP sync → reports → publish ──────►     dashboard tables only (~40 MB)
                                                        ▲ reads
                                               Vercel dashboard (free, Singapore)
                                                 sign-in required, read-only
```

- SAP and RMI passwords stay on the Mac. Vercel only gets the database address and the sign-in secret.
- If the Mac is off, the dashboard keeps working with the last published data; the header shows when it was synced.

## 1. Neon (database)
1. Sign up at neon.tech (free plan). Create a project: name `display-tracker`, region **AWS Asia Pacific (Singapore)**.
2. In *Connect*, copy two connection strings:
   - **Direct** (host without `-pooler`) → for the Mac.
   - **Pooled** (host with `-pooler`) → for Vercel.
3. On the Mac, open `.env` and add one line (paste the direct string yourself):
   `PUBLISH_DATABASE_URL=postgresql://…?sslmode=require`
4. Run `npm run publish`. It creates the tables in Neon and copies the data (about a minute).

## 2. Users
On the Mac (passwords are printed once; give each person their own):
```
npm run users -- add you@nitco.in "Your Name" admin
npm run users -- add someone@nitco.in "Zonal Manager" zonal "East Zone 1"
npm run users -- add rmi@nitco.in "Samrat Dutta" rmi "Samrat Dutta"
npm run users -- import users.csv          # columns: email,name,role,scope
npm run publish                            # copy the user list to Neon now
```
Also: `npm run users -- list | reset <email> | disable <email> | enable <email>`.

## 3. Vercel (dashboard)
1. Sign up at vercel.com (Hobby).
2. On the Mac, in the project folder: `npx vercel login`, then `npx vercel link` (create a new project).
3. In the Vercel project → Settings → Environment Variables (Production), add:
   - `DATABASE_URL` = the **pooled** Neon string
   - `AUTH_SECRET` = output of `openssl rand -hex 32`
   - `READ_ONLY` = `1`
4. Deploy: `npx vercel deploy --prod`. `.vercelignore` keeps `.env`, `data/`, `reports/`, `logs/` and `certs/` off Vercel.
5. Open the URL Vercel prints, sign in with your admin account.

## 4. Automatic refresh (already installed)
`scripts/mac/setup-schedule.sh` runs `npm run daily` at 10:00, 14:00 and 18:00 (a missed run happens when the
Mac wakes). Each run publishes to Neon. Remove with `./scripts/mac/setup-schedule.sh remove`.

## Updating the app later
After code changes: `npx vercel deploy --prod`. Database changes are applied by the next `npm run publish`.
