# Putting the site live on ninthmind.ai

The domain is registered at GoDaddy. Right now it shows GoDaddy's "Launching Soon" page, which comes from GoDaddy's website builder (Airo).

The website builder can't run this site. The site is a program, not a set of pages: it sends Nine's emails, stores leads and visits, and mails Anup the weekly report. So it runs on a small server, and GoDaddy keeps the domain and simply points it there.

```
visitor ──> ninthmind.ai (DNS at GoDaddy) ──> our server: Caddy (HTTPS) ──> the site (Bun)
```

## 1. A server

Any small Linux VPS is enough: 1 vCPU, 1 GB RAM and 25 GB of disk, with Ubuntu 24.04. A GoDaddy VPS works the same way as DigitalOcean, Hetzner or AWS Lightsail. Write down its **public IP address**.

On the server, install Docker and copy the project:

```sh
curl -fsSL https://get.docker.com | sh
git clone <the repository> ninthmind && cd ninthmind
cp .env.example .env && nano .env        # see "Settings" below
```

## 2. Point the domain at it (GoDaddy)

At GoDaddy, open **My Products → ninthmind.ai → DNS → Manage DNS**:

1. If the domain is connected to the website builder, disconnect it first. In the Airo/Websites + Marketing site settings, remove the domain, or unpublish the site. Otherwise GoDaddy keeps putting its own records back.
2. Edit the records:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | the server's IP | 1 hour |
| CNAME | `www` | `ninthmind.ai` | 1 hour |

   Delete any other `A` record on `@` and any "Parked"/forwarding entry. **Don't touch the `MX` records** or existing `TXT` records for email. They carry the team's mailboxes.
3. Check it has spread (minutes to a few hours): `nslookup www.ninthmind.ai` should return the server's IP.

## 3. Start it

On the server:

```sh
cd deploy
docker compose up -d --build
```

Caddy gets free HTTPS certificates for both `ninthmind.ai` and `www.ninthmind.ai` on its first request. It also renews them by itself, and sends the bare domain to `https://www.ninthmind.ai`. The site's own data (leads, visits, report state) is kept in the `data` Docker volume, so rebuilding doesn't lose it.

Check:

```sh
curl -I https://ninthmind.ai             # 301 → https://www.ninthmind.ai/
curl https://www.ninthmind.ai/healthz    # ok
docker compose logs -f web               # the site's log
```

To update after new commits: `git pull && docker compose up -d --build` (from `deploy/`).

## 4. Email (needed before going live)

Without an email service, the production site refuses to pretend it sent anything. It tells the visitor and offers their own email app. Pick one of these:

- **Resend** (simplest). Create an account and add the domain `ninthmind.ai`. Resend shows 3–4 DNS records (a `TXT` for DKIM such as `resend._domainkey`, plus an `MX` and a `TXT` on the `send` subdomain). Add them in GoDaddy's DNS exactly as shown. They don't affect the existing mailboxes. When Resend says "Verified", put the API key in `RESEND_API_KEY`.
- **The team's own mail** (Microsoft 365 or Google Workspace). Use a mailbox such as `nine@ninthmind.ai` and fill `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`. Microsoft 365 needs SMTP AUTH turned on for that mailbox.

## Settings (`.env` on the server)

| Setting | What to put |
|---|---|
| `RESEND_API_KEY` *or* `SMTP_*` | the email service from step 4 |
| `MAIL_FROM` | `Nine at Ninth Mind <nine@ninthmind.ai>` (must be on the verified domain) |
| `LEADS_TO` | who receives Nine's summaries and the contact form |
| `REPORT_TO` | who receives the website report (Anup) |
| `REPORT_FREQUENCY` | `weekly` (default), `daily`, `monthly` or `off` |
| `REPORT_KEY` | a long random secret, to view the report at `/api/report?key=…&days=7` |

`TRUST_PROXY` and `CANONICAL_HOST` are already set in `deploy/docker-compose.yml`.

Generate a secret with `openssl rand -hex 24`.

## After it's live

- **Google Search Console**: add `https://www.ninthmind.ai` (verify with a `TXT` record at GoDaddy) and submit `https://www.ninthmind.ai/sitemap.xml`. Do the same in **Bing Webmaster Tools**; Bing also feeds ChatGPT and Copilot search.
- **Backups**: `docker run --rm -v deploy_data:/d -v $PWD:/b alpine tar czf /b/ninthmind-data.tgz -C /d .` copies the leads and analytics. Run it weekly with cron.
- **Firewall**: allow only ports 22, 80 and 443 (`ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable`).

## Without a VPS

The same `Dockerfile` runs on container hosts such as Fly.io, Render or Railway. The setup there:

- Give the app a persistent volume mounted at `/app/.data`.
- Set `TRUST_PROXY=true` and `CANONICAL_HOST=www.ninthmind.ai`.
- Point GoDaddy's DNS at the records the host gives you.
- Keep exactly one instance running, so the weekly report is sent once.
