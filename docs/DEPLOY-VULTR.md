# Hosting on a Vultr VPS

This puts the app online at your own address with HTTPS, e.g. `https://procurement.yourstore.ae`.
Everything runs in Docker on one server:

- **app**: FPV Procurement Hub
- **db**: PostgreSQL (not reachable from the internet)
- **caddy**: web server that gets and renews the HTTPS certificate automatically
- **backup**: nightly database + uploaded-files backup into `~/Procurement-Dashboard/backups` (kept 14 days)

Time needed: about 30 minutes.

---

## 1. Create the server on Vultr

1. Sign in at https://my.vultr.com → **Deploy +** → **Deploy New Server**.
2. **Type:** Cloud Compute (Shared CPU) is enough.
3. **Location:** the one closest to your team (for Dubai, Mumbai is usually the lowest latency).
4. **Image:** Ubuntu **24.04 LTS x64**.
5. **Plan:** at least **2 GB RAM** (1 vCPU is fine). 1 GB works only with the swap the setup script adds, and builds are slow.
6. **Additional features:** turn on **Automatic Backups** (a small monthly add-on). This is a second safety net besides the app's own nightly backups.
7. **SSH key:** add your key if you have one (recommended). Otherwise Vultr shows a root password on the server page.
8. **Hostname:** e.g. `procurement`. Click **Deploy Now** and wait until it says *Running*. Note the **IP address**.

## 2. Point your domain at the server

In your domain provider's DNS settings, add an **A record**:

| Type | Name | Value |
|---|---|---|
| A | `procurement` (or `@` for the bare domain) | your server's IP |

This gives `procurement.yourdomain.com`. DNS can take a few minutes to an hour to work.

**No domain yet?** Use a free `sslip.io` name made from your IP: for IP `203.0.113.10` use
`203-0-113-10.sslip.io`. It points at your server automatically and gets a real HTTPS certificate.
You can switch to your own domain later.

## 3. Connect to the server

On Windows, open PowerShell (on Mac, Terminal):

```
ssh root@YOUR_SERVER_IP
```

Type `yes` the first time, then the password from the Vultr server page (or it uses your SSH key).

## 4. Prepare the server (once)

```
git clone https://github.com/mrbotanist/Procurement-Dashboard.git
cd Procurement-Dashboard
bash deploy/setup-server.sh
```

This installs Docker, turns on the firewall (only SSH, HTTP and HTTPS open), adds swap, enables automatic security updates and sets the timezone to Dubai.

> **If the repository is private**, `git clone` asks for a username and password. Use your GitHub username and a **personal access token** as the password: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → *Generate new token*, give it read-only **Contents** access to this repository only.

## 5. Start the app

```
bash deploy/deploy.sh procurement.yourdomain.com
```

Use your real address (or the `sslip.io` one). The first build takes 3–8 minutes. The script:

- creates `.env` with a random database password and login secret,
- builds the app, starts all four services, applies database migrations,
- Caddy then fetches the HTTPS certificate (needs step 2 to be working).

## 6. Create your admin account

```
docker compose -f docker-compose.prod.yml exec app npm run create-admin -- --email you@yourstore.ae --name "Your Name" --password "a long password"
```

Open `https://procurement.yourdomain.com`, sign in, and add your team under **Settings**.
The server starts **empty** (no sample data). Import your suppliers/products/orders if you like — see "Importing" below.

---

## Everyday operations

All commands run on the server inside `~/Procurement-Dashboard` (`ssh root@IP` then `cd Procurement-Dashboard`).

| Task | Command |
|---|---|
| Update to the latest version | `bash deploy/update.sh` (backs up first) |
| See if everything is running | `docker compose -f docker-compose.prod.yml ps` |
| App logs | `docker compose -f docker-compose.prod.yml logs -f app` (Ctrl+C to stop) |
| Restart the app | `docker compose -f docker-compose.prod.yml restart app` |
| Back up right now | `docker compose -f docker-compose.prod.yml exec backup sh /backup.sh now` |
| Reset a user's password | same `create-admin` command as step 6 (it resets an existing account and makes it admin), or use Settings in the app |
| Run the daily check now | `docker compose -f docker-compose.prod.yml exec app npm run jobs:daily` |
| Stop everything | `docker compose -f docker-compose.prod.yml down` (data is kept) |

The app restarts automatically after a server reboot.

### Backups

- Every night at 02:30 (Dubai time) the `backup` service writes `backups/db_<date>.sql.gz` (database) and `backups/files_<date>.tar.gz` (uploaded documents), keeping 14 days.
- Copy them off the server now and then, e.g. from your PC:
  `scp root@YOUR_SERVER_IP:~/Procurement-Dashboard/backups/* .`
- Vultr's Automatic Backups (step 1) snapshot the whole server as well.

**Restoring the database** from a backup (this replaces the current data):

```
docker compose -f docker-compose.prod.yml stop app
gunzip -c backups/db_2026-10-01_0230.sql.gz | docker compose -f docker-compose.prod.yml exec -T db sh -c 'dropdb -U fpv fpv_procurement && createdb -U fpv fpv_procurement && psql -q -U fpv fpv_procurement'
docker compose -f docker-compose.prod.yml start app
```

Restoring uploaded files:

```
docker compose -f docker-compose.prod.yml run --rm -v "$PWD/backups:/backups" --entrypoint sh app -c 'tar -xzf /backups/files_2026-10-01_0230.tar.gz -C /app/storage'
```

### Importing your data

Copy the file to the server (from your PC): `scp my-products.xlsx root@YOUR_SERVER_IP:~/Procurement-Dashboard/`
then on the server:

```
docker compose -f docker-compose.prod.yml run --rm -v "$PWD:/import" app npm run import -- products /import/my-products.xlsx --dry-run
```

Remove `--dry-run` to actually import. Use `suppliers`, `products` or `pos` (see `import-templates/README.md`).

### Loading the sample data (demo server only)

```
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

This **wipes everything** and loads the demo data with the `procurement` password for all sample users. Never run it on your real server.

### Email and two-step sign-in (recommended)

With email set up, users can be asked for a **6-digit code sent to their email** after their password,
so a stolen or guessed password alone isn't enough. Email also turns on the nightly digest.

Add to `.env` on the server (`nano .env`), then `docker compose -f docker-compose.prod.yml up -d`:

```
SMTP_URL="smtp://USER:PASSWORD@smtp.yourprovider.com:587"
MAIL_FROM="FPV Procurement Hub <procurement@yourstore.ae>"
TWO_FACTOR="all"
```

- `SMTP_URL`: your email provider's SMTP details (Google Workspace, Microsoft 365, Zoho, or a sending service
  such as Brevo, Mailgun or Amazon SES). If the password has symbols like `@` or `/`, replace them:
  `@` → `%40`, `/` → `%2F`, `:` → `%3A`.
- `TWO_FACTOR`: `all` for everyone, or only some roles, e.g. `TWO_FACTOR="ADMIN,FINANCE"`. `off` turns it off.
- **Test email before turning on `TWO_FACTOR`**: set `SMTP_URL` first, run
  `docker compose -f docker-compose.prod.yml exec app npm run mail:test -- you@yourstore.ae`, and check the inbox
  (and spam folder). Settings in the app shows whether two-step sign-in is on.
- Codes expire after 10 minutes and work once. After 5 wrong passwords or codes the account is blocked for 15 minutes.
- **Locked out because email stopped working?** Set `TWO_FACTOR="off"` in `.env`, run
  `docker compose -f docker-compose.prod.yml up -d`, fix the email settings, then turn it back on.

Vultr blocks outgoing port 25 on new accounts; use your provider's port 587.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser says the site can't be reached | Check the A record points to the server IP (`ping procurement.yourdomain.com`). Check `docker compose -f docker-compose.prod.yml ps` shows all four services *Up*. |
| Certificate / "not secure" warning | DNS wasn't ready when Caddy started. Once DNS works: `docker compose -f docker-compose.prod.yml restart caddy`, then `logs caddy` to see progress. |
| Build stops with "Killed" | Not enough memory. Make sure the server has 2 GB RAM or that `setup-server.sh` added swap (`swapon --show`). |
| "Set POSTGRES_PASSWORD in .env" | `.env` is missing; run `bash deploy/deploy.sh your-domain` again. |
| Sign-in code email never arrives | Check the spam folder, then `docker compose -f docker-compose.prod.yml exec app npm run mail:test -- you@yourstore.ae` and `logs --tail 50 app` for the SMTP error. |
| Something went wrong in the app | `docker compose -f docker-compose.prod.yml logs --tail 100 app` and `docker compose -f docker-compose.prod.yml exec app cat logs/errors.log` |

**Keep `.env` safe** — it has the database password. Don't change `POSTGRES_PASSWORD` after the first start (the database was created with it).
