# Team Archon Mail — Ground Zero Architecture Specification
## Built From Square 1: Discord OAuth2 + Server/Role Gating + Supabase DB + Categorized Discord Webhook Logging

---

## 1. Ground Zero Philosophy & System Principles

This system is designed from **Square 1** with zero reliance on legacy webmail setups, wizard configurations, or local password stores. 

### Core Architectural Pillars
1. **Discord-Exclusive Authentication & Gating**:
   - There are **no local username/password accounts** and **no setup wizards**.
   - Authentication is handled exclusively through **Discord OAuth2** (`identify`, `email`, `guilds.members.read`).
   - **Mandatory Guild Gate**: The user must be an active member of the official Team Archon Discord Server (`DISCORD_GUILD_ID`).
   - **Mandatory Role Gate**: The user must hold a designated Access Role (`DISCORD_REQUIRED_ROLE_ID`).
   - Users missing the server or the role are rejected immediately at the gateway, with a clean user-facing rejection message and an automated security alert dispatched to Discord.
2. **Supabase PostgreSQL as System Database**:
   - Clean, normalized database schema built specifically for Discord identity mapping.
   - Stores users (keyed by Discord Snowflake ID), server-side encrypted mailbox credentials, user-to-mailbox RBAC assignments, and permanent audit logs.
3. **100% Categorized Real-Time Discord Webhook Logging**:
   - 100% of all events, security decisions, mail actions, and backend exceptions are logged to Discord channels via webhooks.
   - Categorized into 4 distinct streams: **`AUTH`**, **`MAIL`**, **`ERROR`**, **`SYSTEM`**.
   - Built with an asynchronous, non-blocking background queue (`Channel<T>`) so logging operations introduce **zero latency** to webmail interactions.
4. **Physical Email Engine (Stalwart on VPS)**:
   - Self-hosted Stalwart Mail Server on Ubuntu 24.04 VPS (`151.242.187.244`).
   - ASP.NET Core 8 API communicates with Stalwart locally over loopback:
     - **IMAP**: `127.0.0.1:993` (SSL/TLS)
     - **SMTP**: `127.0.0.1:465` (SSL/TLS)
   - Real email messages are stored securely on the VPS disk (`/var/lib/stalwart/`).
5. **Modern Frontend (Vercel)**:
   - React 18 + Vite + TypeScript web application deployed on Vercel at `https://mail.teamarchon.in`.
   - Sleek enterprise dark-mode UI with Discord profile integration, live inbox, thread viewer, draft editor, and rich email composer.

---

## 2. End-to-End System Topology

```
                         [ User Browser ]
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        [ Frontend on Vercel ]      [ Discord OAuth2 API ]
        mail.teamarchon.in          • /oauth2/authorize
                 │                  • Scopes: identify, email, guilds.members.read
                 │                             │
                 │ (OAuth Code Exchange)       │
                 ▼                             ▼
   [ Ubuntu VPS API: api.teamarchon.in (Caddy ──► :8787) ]
    ├── 1. Exchange OAuth Code for Discord User Token
    ├── 2. Query Discord: GET /users/@me/guilds/{GUILD_ID}/member
    │      ├── Verify Guild Membership (404 = Rejected)
    │      └── Verify Required Role (Missing = Rejected)
    ├── 3. Upsert User Profile into Supabase PostgreSQL
    ├── 4. Generate Team Archon Session JWT
    ├── 5. Queue Embed to Discord Webhook (Async Background Task)
    └── 6. Proxy IMAP/SMTP Operations to Localhost Stalwart (993/465)
            │
            ├──────────────► [ Discord Webhook Channels ]
            │                • #auth-logs   (Logins, Signups, Access Denials)
            │                • #mail-logs   (Sends, Receives, Deletions)
            │                • #error-logs  (500s, Socket Timeouts, IMAP/SMTP Fails)
            │                • #system-logs (Service Boots, Schema Migrations)
            ▼
    [ Supabase Cloud PostgreSQL ]
     • users, mailboxes, user_mailboxes, audit_logs
```

---

## 3. Discord OAuth2 & Role Gate Specification

### 3.1 OAuth2 Scopes
- `identify`: Retrieves user ID (`id`), username, and avatar hash.
- `email`: Retrieves verified email associated with the Discord account.
- `guilds.members.read`: Allows inspecting the authenticated user's membership and roles inside the designated guild.

### 3.2 Authorization Gateway Protocol
```
User clicks "Sign In with Discord"
  │
  ▼
Redirect to Discord: https://discord.com/oauth2/authorize
  │
  ▼
Discord redirects back: https://mail.teamarchon.in/auth/callback?code=XXXX
  │
  ▼
Frontend posts code to Backend: POST /api/auth/discord
  │
  ├── 1. Backend exchanges code for Discord Access Token:
  │      POST https://discord.com/api/v10/oauth2/token
  │
  ├── 2. Backend queries user info:
  │      GET https://discord.com/api/v10/users/@me
  │
  ├── 3. Backend queries member record in target guild:
  │      GET https://discord.com/api/v10/users/@me/guilds/{DISCORD_GUILD_ID}/member
  │
  ├── [Check A] Is User in Guild?
  │   └── NO (HTTP 404):
  │       • Dispatch RED Embed to #auth-logs ("Access Denied: Not a member of Team Archon server")
  │       • Return HTTP 403 Forbidden: { code: "not_in_guild", message: "You must be a member of the official Team Archon Discord server." }
  │
  ├── [Check B] Does User have DISCORD_REQUIRED_ROLE_ID?
  │   └── NO (!member.roles.Contains(REQUIRED_ROLE_ID)):
  │       • Dispatch RED Embed to #auth-logs ("Access Denied: Missing required role")
  │       • Return HTTP 403 Forbidden: { code: "missing_role", message: "You do not hold the required Discord role to access Team Archon Mail." }
  │
  └── [Success] User is Verified:
      • Upsert user record into Supabase `public.users`
      • Issue signed JWT session token
      • Dispatch GREEN Embed to #auth-logs ("User Logged In / Account Verified")
      • Return HTTP 200 OK: { token, user }
```

---

## 4. 100% Categorized Discord Webhook Logging

### 4.1 Log Categories & Webhook Channels

| Category | Environment Variable | Monitored Events | Embed Color |
| :--- | :--- | :--- | :--- |
| **Auth / Security** | `DISCORD_WEBHOOK_AUTH` | Successful login, first account creation, failed guild check, failed role check, logout | Green (`#2ecc71`) / Red (`#e74c3c`) |
| **Mail Activity** | `DISCORD_WEBHOOK_MAIL` | Email sent, email received, email deleted, draft saved, folder sync completed | Blue (`#3498db`) / Orange (`#e67e22`) |
| **Error / Alert** | `DISCORD_WEBHOOK_ERROR`| Unhandled 500 exceptions, IMAP socket timeout, SMTP delivery failures, DB pool errors | Dark Red (`#992d22`) |
| **System / Audit** | `DISCORD_WEBHOOK_SYSTEM`| API service startup, DB migration ran, health check pings, configuration reloads | Purple (`#9b59b6`) |

### 4.2 Non-Blocking Asynchronous Background Queue
All logging is managed by an ASP.NET Core `IHostedService` background worker consuming from a bounded `System.Threading.Channels.Channel<DiscordLogItem>`:
- **Zero latency penalty**: Webmail HTTP requests return immediately without waiting for Discord HTTP requests.
- **Resilience**: Automatic retry on HTTP 429 (Discord rate limits) with exponential backoff.
- **Privacy protection**: Passwords, auth tokens, and full email bodies are stripped/sanitized before dispatching embeds.

---

## 5. Ground Zero Database Schema (Supabase PostgreSQL)

```sql
-- ==============================================================================
-- Team Archon Mail - Clean Slate Schema
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table (Primary identity from Discord OAuth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id VARCHAR(64) UNIQUE NOT NULL,
    discord_username VARCHAR(100) NOT NULL,
    discord_avatar VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Mailboxes table (Physical Stalwart accounts on VPS)
CREATE TABLE IF NOT EXISTS public.mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    imap_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    imap_port INT NOT NULL DEFAULT 993,
    imap_ssl BOOLEAN NOT NULL DEFAULT true,
    smtp_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    smtp_port INT NOT NULL DEFAULT 465,
    smtp_ssl BOOLEAN NOT NULL DEFAULT true,
    encrypted_password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User to Mailbox Access Control (RBAC)
CREATE TABLE IF NOT EXISTS public.user_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'member', 'read_only'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, mailbox_id)
);

-- 4. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON public.users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

---

## 6. Environment Variables Blueprint

### Backend Environment (`/etc/teamarchon-api/teamarchon-api.env`)
```env
# Runtime
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:8787

# Discord OAuth2 & Gating
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://mail.teamarchon.in/auth/callback
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_REQUIRED_ROLE_ID=your_required_role_id

# Categorized Discord Webhook Logging
DISCORD_WEBHOOK_AUTH=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_MAIL=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_ERROR=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_SYSTEM=https://discord.com/api/webhooks/.../...

# Supabase Database
DB_CONNECTION_STRING=Host=aws-0-us-east-1.pooler.supabase.com;Port=6543;Database=postgres;Username=postgres.your-project;Password=your-password;SslMode=Require;

# Security & Stalwart Credentials
JWT_SECRET=super_secret_jwt_signing_key_at_least_32_characters_long!
AES_KEY=32_byte_aes_encryption_key_here!
STALWART_IMAP_HOST=127.0.0.1
STALWART_IMAP_PORT=993
STALWART_SMTP_HOST=127.0.0.1
STALWART_SMTP_PORT=465
```

### Frontend Environment (`Vercel Project Settings`)
```env
VITE_API_BASE_URL=https://api.teamarchon.in/api
VITE_DISCORD_CLIENT_ID=your_discord_client_id
VITE_DISCORD_REDIRECT_URI=https://mail.teamarchon.in/auth/callback
```
