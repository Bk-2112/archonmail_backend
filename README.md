# Team Archon Mail

> **Enterprise-grade, secure, self-hosted webmail platform for `teamarchon.in`.**  
> Built with React (Vite/TypeScript), ASP.NET Core 8, Supabase Auth & PostgreSQL, and Stalwart Mail Server on Ubuntu 24.04 LTS.

[![Frontend: Vercel](https://img.shields.io/badge/Frontend-mail.teamarchon.in-blue)](https://mail.teamarchon.in)
[![API: VPS](https://img.shields.io/badge/API-api.teamarchon.in-green)](https://api.teamarchon.in)
[![Mail Server: Stalwart](https://img.shields.io/badge/Mail_Server-mx.teamarchon.in-purple)](https://mx.teamarchon.in)
[![Auth: Supabase](https://img.shields.io/badge/Auth-Supabase-3ECF8E)](https://supabase.com)

---

## 1. System Architecture

```
                       [ User Browser ]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       [ Frontend on Vercel ]        [ Supabase Cloud ]
       https://mail.teamarchon.in     • Supabase Auth (JWT)
               │                     • Application Metadata DB
               │ (Bearer JWT)        • Mailbox Assignments
               ▼
   [ Ubuntu 24.04 VPS (151.242.187.244) ]
   ┌──────────────────────────────────────────────────────────┐
   │ Caddy Reverse Proxy (HTTPS)                              │
   │  • api.teamarchon.in ──► 127.0.0.1:8787                   │
   │  • (CMSClipper on PM2 preserved untouched)               │
   ├──────────────────────────────────────────────────────────┤
   │ ASP.NET Core 8 Web API (:8787)                           │
   │  • Supabase JWT Signature & Issuer Validation            │
   │  • Mailbox Permissions & Administrative Approval Check   │
   │  • Server-side AES-256 IMAP/SMTP Credential Resolution   │
   ├──────────────────────────────────────────────────────────┤
   │ Stalwart Mail Server (Rust, ~45MB RAM)                   │
   │  • IMAP (Port 993 TLS)                                   │
   │  • SMTP / Submission (Port 587 STARTTLS & Port 25)       │
   │  • Hostname: mx.teamarchon.in                            │
   │  • Domain: teamarchon.in                                 │
   │  • Physical storage on VPS (/var/lib/stalwart-mail)      │
   └──────────────────────────────────────────────────────────┘
```

---

## 2. Key Security Properties

1. **Supabase Auth Integration**:
   - Primary user identity and session management is handled via Supabase Auth (`@supabase/supabase-js`).
   - The backend validates the Supabase JWT against the official project issuer and signing key.
2. **Strict Mailbox Isolation & RBAC**:
   - Email server credentials (IMAP/SMTP passwords) are **never returned to the frontend**.
   - Credentials are stored encrypted with AES-256 on the server.
   - Users cannot access any mailbox unless explicitly granted access and marked as `is_approved = true` in Supabase PostgreSQL (`user_mailboxes`).
3. **Storage Separation**:
   - Actual email messages, MIME parts, and attachments are physically managed by Stalwart on the VPS (`/var/lib/stalwart-mail`).
   - Supabase PostgreSQL only stores application accounts, approval status, user profiles, labels, and metadata.

---

## 3. Directory Layout

```
mail.teamarchon.in/
├── aeromail-api/             # ASP.NET Core 8 Web API
│   ├── Controllers/          # REST API endpoints (Mailboxes, Messages, Labels, Filters)
│   ├── Services/             # MailboxService, AuthService, ImapService, SmtpService
│   ├── Database/             # PostgreSQL connection & schema initialization
│   ├── Models/               # Mailbox, UserProfile, Message, Filter DTOs
│   └── appsettings.json      # Connection strings & configuration
├── aeromail-web/             # React + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── api/              # Axios client with JWT interceptor & Supabase client
│   │   ├── components/       # Layout, ComposeModal, RequireAuth
│   │   ├── pages/            # LoginPage, InboxPage, ThreadPage, SearchPage, SettingsPage
│   │   ├── store/            # authStore, configStore (Zustand)
│   │   └── config/           # branding.ts (Team Archon Mail)
│   ├── vercel.json           # Vercel deployment & SPA rewrites configuration
│   └── package.json
├── deploy/                   # Production Deployment Assets
│   ├── supabase_migration.sql # Run this in Supabase SQL Editor
│   ├── teamarchon-api.service# Systemd service with 1GB VPS memory limits
│   ├── stalwart-install.sh   # Stalwart Mail Server automated installer
│   └── Caddyfile.snippet     # Caddy reverse proxy configuration
└── .env.example              # Environment variables template
```

---

## 4. Deployment Instructions

### Step 1: Run Supabase SQL Migration
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) -> Select your project -> **SQL Editor**.
2. Open [`deploy/supabase_migration.sql`](deploy/supabase_migration.sql).
3. Paste and run the script. It creates:
   - `mailboxes`
   - `user_profiles`
   - `user_mailboxes`
   - `labels`, `filters`, `messages` cache
   - Automatic user profile trigger on signup.

### Step 2: Deploy Frontend to Vercel
1. In Vercel -> **Add New Project** -> Import GitHub repository `Bk-2112/mail_teamarchon`.
2. Configure Project:
   - **Framework Preset**: Vite
   - **Root Directory**: `aeromail-web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables in Vercel:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_API_BASE_URL=https://api.teamarchon.in/api
   ```
4. Assign custom domain: `mail.teamarchon.in`.

### Step 3: Setup Stalwart Mail Server on Ubuntu VPS
1. SSH into your VPS: `ssh root@151.242.187.244`.
2. Run the automated Stalwart installer:
   ```bash
   chmod +x deploy/stalwart-install.sh
   ./deploy/stalwart-install.sh
   sudo systemctl start stalwart-mail
   sudo systemctl status stalwart-mail
   ```
3. Create your initial admin mailbox via Stalwart CLI:
   ```bash
   stalwart-cli -u admin@teamarchon.in account create admin@teamarchon.in
   ```

### Step 4: Deploy ASP.NET Core API on Ubuntu VPS
1. Publish the backend binary:
   ```bash
   cd aeromail-api
   dotnet publish -c Release -o /var/www/teamarchon-api
   ```
2. Configure `/etc/teamarchon-api/teamarchon-api.env`:
   ```env
   ASPNETCORE_ENVIRONMENT=Production
   ASPNETCORE_URLS=http://127.0.0.1:8787
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_JWT_SECRET=your-supabase-jwt-secret
   DB_CONNECTION_STRING=Host=aws-0-us-east-1.pooler.supabase.com;Port=6543;Database=postgres;Username=postgres.your-project;Password=your-db-password;SslMode=Require;
   AES_KEY=your-super-secret-32-byte-aes-key__
   ```
3. Install and start the systemd service:
   ```bash
   sudo cp deploy/teamarchon-api.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable teamarchon-api
   sudo systemctl start teamarchon-api
   ```

### Step 5: Verify Caddy Reverse Proxy
Your Caddy service already routes `api.teamarchon.in` to `127.0.0.1:8787`.
Verify using:
```bash
curl -I https://api.teamarchon.in/api/auth/health
```
It will return:
```json
{"status":"ok","version":"2.0.0"}
```
CMSClipper remains fully intact on its port and PM2 process.

---

## 5. Verification & Testing

- **Frontend Tests**: Run `npm test` inside `aeromail-web/` (25/25 passing).
- **Frontend Build**: Run `npm run build` inside `aeromail-web/` (Vite build clean).
- **Backend Build**: Builds via `dotnet build -c Release` on .NET 8 SDK.
