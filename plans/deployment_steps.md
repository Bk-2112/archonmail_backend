# Team Archon Mail - Complete Ground Zero Deployment Guide

This guide details the step-by-step procedure to deploy the Team Archon Webmail system to production.

---

## 1. Architectural Architecture Overview

```
                        ┌────────────────────────────────────────┐
                        │      Client Browser (User)             │
                        └──────────────────┬─────────────────────┘
                                           │
                        ┌──────────────────┴─────────────────────┐
                        ▼                                        ▼
             https://mail.teamarchon.in             https://api.teamarchon.in/api
             ┌─────────────────────────┐            ┌────────────────────────────┐
             │     Frontend (Vercel)   │            │   Backend (.NET 8 Web API) │
             │  React + Vite + TS SPA  │            │     Ubuntu VPS (:8787)     │
             └─────────────────────────┘            └──────────────┬─────────────┘
                                                                   │
                                   ┌───────────────────────────────┼──────────────────────────────┐
                                   ▼                               ▼                              ▼
                        ┌────────────────────┐          ┌────────────────────┐         ┌────────────────────┐
                        │  Supabase Postgres │          │  Stalwart (VPS)    │         │  Discord Webhooks  │
                        │  Users & Mailboxes │          │  IMAP:993/SMTP:465 │         │ 4 Categorized Chs  │
                        └────────────────────┘          └────────────────────┘         └────────────────────┘
```

---

## 2. Pre-Deployment Credentials Checklist

Before starting, gather the following credentials:

### A. Discord Developer Portal (`https://discord.com/developers/applications`)
- [ ] **Client ID** (Application ID)
- [ ] **Client Secret**
- [ ] **Redirect URI registered**: `https://mail.teamarchon.in/auth/callback`
- [ ] **Target Server ID** (`DISCORD_GUILD_ID`)
- [ ] **Target Access Role ID** (`DISCORD_REQUIRED_ROLE_ID`)

### B. Discord Webhooks (Server Settings > Integrations > Webhooks)
- [ ] **#auth-logs Webhook URL** (`DISCORD_WEBHOOK_AUTH`)
- [ ] **#mail-logs Webhook URL** (`DISCORD_WEBHOOK_MAIL`)
- [ ] **#error-logs Webhook URL** (`DISCORD_WEBHOOK_ERROR`)
- [ ] **#system-logs Webhook URL** (`DISCORD_WEBHOOK_SYSTEM`)

### C. Supabase Project
- [ ] **PostgreSQL Connection String** (Session/Transaction pooler from Database settings)

---

## 3. Phase 1: Supabase Database Migration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and navigate to the **SQL Editor**.
3. Open [`deploy/ground_zero_supabase_migration.sql`](../deploy/ground_zero_supabase_migration.sql) or copy its contents:
4. Click **Run**.
5. Verify the tables exist in **Table Editor**:
   - `public.users`
   - `public.mailboxes`
   - `public.user_mailboxes`
   - `public.audit_logs`

---

## 4. Phase 2: Configure Backend on Ubuntu VPS

Connect to your VPS via SSH:
```bash
ssh root@151.242.187.244
```

### Step 2.1: Pull Latest Code
```bash
cd /root/mail_teamarchon
git pull origin main
```

### Step 2.2: Create Backend Environment Configuration
Create the directory and configuration file:
```bash
mkdir -p /etc/teamarchon-api
nano /etc/teamarchon-api/teamarchon-api.env
```

Paste and fill out your exact values:
```env
# Runtime
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:8787

# Supabase Database
DB_CONNECTION_STRING=Host=aws-0-us-east-1.pooler.supabase.com;Port=6543;Database=postgres;Username=postgres.your-ref;Password=your_password;SslMode=Require;

# Discord OAuth & Server Gate
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://mail.teamarchon.in/auth/callback
DISCORD_GUILD_ID=your_teamarchon_discord_guild_id
DISCORD_REQUIRED_ROLE_ID=your_required_role_id

# Categorized Discord Webhook Logging
DISCORD_WEBHOOK_AUTH=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_MAIL=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_ERROR=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_SYSTEM=https://discord.com/api/webhooks/.../...

# Security Secrets
JWT_SECRET=team_archon_super_secret_jwt_key_minimum_32_characters!
AES_KEY=team_archon_aes_key_32_char_len!

# Stalwart Mail Server Loopback
STALWART_IMAP_HOST=127.0.0.1
STALWART_IMAP_PORT=993
STALWART_SMTP_HOST=127.0.0.1
STALWART_SMTP_PORT=465
```
Secure the file permissions:
```bash
chmod 600 /etc/teamarchon-api/teamarchon-api.env
chown www-data:www-data /etc/teamarchon-api/teamarchon-api.env
```

### Step 2.3: Compile & Publish Backend
```bash
cd /root/mail_teamarchon/backend
dotnet publish -c Release -o /var/www/teamarchon-api
chown -R www-data:www-data /var/www/teamarchon-api
```

### Step 2.4: Install & Start Systemd Service
```bash
cp /root/mail_teamarchon/deploy/teamarchon-api.service /etc/systemd/system/teamarchon-api.service
systemctl daemon-reload
systemctl enable --now teamarchon-api
systemctl restart teamarchon-api
```

### Step 2.5: Verify Backend Health
```bash
# Check service status
systemctl status teamarchon-api

# Check health endpoint
curl -i http://127.0.0.1:8787/api/system/health
```
Expected output:
```json
HTTP/1.1 200 OK
{"status":"ok","version":"3.0.0","service":"Team Archon Mail API (Ground Zero)","database":"connected","timestamp":"..."}
```
*Note: A system startup embed will immediately appear in your `#system-logs` Discord channel.*

---

## 5. Phase 3: Deploy Frontend on Vercel

1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import the GitHub repository: `Bk-2112/mail_teamarchon`.
4. Configure Build and Output Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and set to `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Configure Environment Variables:
   - `VITE_API_BASE_URL` = `https://api.teamarchon.in/api`
   - `VITE_DISCORD_CLIENT_ID` = `<Your Discord Client ID>`
   - `VITE_DISCORD_REDIRECT_URI` = `https://mail.teamarchon.in/auth/callback`
6. Click **Deploy**.
7. In the project **Settings > Domains**, attach the production domain:
   - Domain: `mail.teamarchon.in`

---

## 6. Phase 4: Mailbox Setup & Linking in Supabase

When users log in, they need an approved mailbox to view and send messages.

### Step 4.1: Create Account in Stalwart
On your VPS, create the mailboxes in Stalwart:
```bash
# Via Stalwart web interface or CLI
stalwart-cli -u admin@teamarchon.in account create admin@teamarchon.in
stalwart-cli -u support@teamarchon.in account create support@teamarchon.in
```

### Step 4.2: Insert Mailbox into Supabase
Run in Supabase SQL editor:
```sql
INSERT INTO public.mailboxes (email, display_name, imap_user, imap_password_encrypted, smtp_user, smtp_password_encrypted)
VALUES (
    'admin@teamarchon.in',
    'Team Archon Admin',
    'admin@teamarchon.in',
    'PASSWORD_HERE', -- or encrypted via backend helper
    'admin@teamarchon.in',
    'PASSWORD_HERE'
) RETURNING id;
```

### Step 4.3: Assign Mailbox to User
Once a user logs in via Discord, assign them access to the mailbox:
```sql
INSERT INTO public.user_mailboxes (user_id, mailbox_id, role)
VALUES (
    (SELECT id FROM public.users WHERE discord_username = 'your_username' LIMIT 1),
    (SELECT id FROM public.mailboxes WHERE email = 'admin@teamarchon.in' LIMIT 1),
    'owner'
);
```

---

## 7. Phase 5: Verification & Acceptance Testing

| Test Case | Steps | Expected Result | Discord Webhook Channel |
| :--- | :--- | :--- | :--- |
| **Service Boot** | Start `teamarchon-api` | 200 OK on health endpoint | **#system-logs** (Purple Embed) |
| **Authorized Login** | User with required Discord role clicks "Sign In" | Redirected to `/inbox`, JWT issued, user data saved in Supabase | **#auth-logs** (Green Embed) |
| **Unauthorized Login** | User without role clicks "Sign In" | HTTP 403, UI shows "Access Role Required" alert with server link | **#auth-logs** (Red Embed) |
| **Fetch Inbox** | Authorized user views `/inbox` | List of emails retrieved from Stalwart IMAP (993) | — |
| **Send Email** | Click "New Message", enter recipient, click Send | Email delivered via Stalwart SMTP (465) | **#mail-logs** (Blue Embed) |
| **System Exceptions** | Trigger bad request or error | Error sanitized and caught by Global Error Middleware | **#error-logs** (Dark Red Embed) |
