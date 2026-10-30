# Team Archon Mail — Ground Zero Step-by-Step Workplan
## Clean-Slate Execution Roadmap: Discord OAuth2 + Server/Role Gating + Supabase DB + Categorized Webhook Logging

---

## Overview & Ground Zero Strategy

We are starting from **Square 1**. All legacy setup wizards, old auth forms, and intermediate workarounds are retired. 
Every component is built cleanly according to the Ground Zero Architecture:
- **Authentication**: Discord OAuth2 with mandatory Guild & Role verification.
- **Database**: Supabase PostgreSQL for users, mailboxes, and audit logs.
- **Observability**: 100% categorized Discord Webhook logging (`AUTH`, `MAIL`, `ERROR`, `SYSTEM`).
- **Mail Engine**: Stalwart on VPS (`127.0.0.1:993` / `127.0.0.1:465`).
- **Hosting**: Frontend on Vercel (`mail.teamarchon.in`), Backend on VPS (`api.teamarchon.in:8787`).

---

## Phase 0: Ground Zero Preparation & Cleanup
*Goal: Remove all legacy setup artifacts, unused routes, and outdated auth logic.*

- [ ] **Step 0.1**: Remove legacy setup wizard routes from [aeromail-web/src/App.tsx](file:///c:/Users/notmr/Desktop/mail.teamarchon.in/aeromail-web/src/App.tsx) and deprecate `SetupWizard.tsx`.
- [ ] **Step 0.2**: Remove legacy `SetupController.cs` and `SetupService.cs` from `aeromail-api`.
- [ ] **Step 0.3**: Clean up unused legacy models and obsolete migration scripts in `deploy/`.

---

## Phase 1: Ground Zero Database Migration (Supabase)
*Goal: Establish the pristine database schema in Supabase Cloud.*

- [ ] **Step 1.1**: Create `deploy/ground_zero_supabase_migration.sql`:
  - `public.users`: Discord snowflake ID, username, avatar URL, verified email, guild roles array, active flag, timestamps.
  - `public.mailboxes`: Physical mailbox records pointing to Stalwart (`127.0.0.1:993` / `127.0.0.1:465`) with server-side AES-256 encrypted passwords.
  - `public.user_mailboxes`: RBAC table mapping Discord users to mailboxes (`owner`, `member`, `read_only`).
  - `public.audit_logs`: Append-only audit trail capturing every user and system event with IP address and JSON metadata.
  - Optimized indexes for fast lookup by Discord ID, email, and created timestamps.
- [ ] **Step 1.2**: Execute the script in [Supabase SQL Editor](https://supabase.com/dashboard) and verify clean table creation.

---

## Phase 2: Discord Application & Webhook Setup
*Goal: Prepare Discord OAuth credentials and logging channels.*

- [ ] **Step 2.1**: In the [Discord Developer Portal](https://discord.com/developers/applications):
  - Register/Configure Application: **Team Archon Mail**.
  - Add OAuth2 Redirect URI: `https://mail.teamarchon.in/auth/callback` (and `http://localhost:5173/auth/callback` for dev).
  - Copy `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
- [ ] **Step 2.2**: In the Team Archon Discord Server:
  - Copy Server ID (`DISCORD_GUILD_ID`).
  - Copy the Required Role ID (`DISCORD_REQUIRED_ROLE_ID`).
  - Create 4 webhook URLs (in dedicated channels or one central logging channel):
    - `DISCORD_WEBHOOK_AUTH` (Logins, Signups, Access Denials)
    - `DISCORD_WEBHOOK_MAIL` (Sends, Receives, Deletions)
    - `DISCORD_WEBHOOK_ERROR` (500s, Socket Timeouts, IMAP/SMTP Failures)
    - `DISCORD_WEBHOOK_SYSTEM` (Service Boots, Health Checks, Deployments)

---

## Phase 3: Backend API Ground Zero Implementation (`aeromail-api`)
*Goal: Build the secure Discord auth gateway, categorized webhook logger, and Supabase data layer.*

### 3.1 Categorized Discord Webhook Logging Engine
- [ ] **Step 3.1.1**: Implement `IDiscordLogService` and `DiscordLogBackgroundService`:
  - Asynchronous, non-blocking `Channel<DiscordLogItem>` queue.
  - Rich Discord Embed builder with color codes (`#2ecc71` Green, `#e74c3c` Red, `#3498db` Blue, `#992d22` Dark Red, `#9b59b6` Purple).
  - Sanitization logic to strip sensitive credentials and tokens before sending.
  - Automatic exponential backoff handling Discord HTTP 429 rate limits.
- [ ] **Step 3.1.2**: Register `DiscordLogBackgroundService` as an ASP.NET Core Hosted Service (`IHostedService`).

### 3.2 Discord OAuth2 & Role-Gating Service
- [ ] **Step 3.2.1**: Implement `IDiscordAuthService` with endpoints:
  - Token exchange: `POST https://discord.com/api/v10/oauth2/token`.
  - User identity: `GET https://discord.com/api/v10/users/@me`.
  - Member verification: `GET https://discord.com/api/v10/users/@me/guilds/{GUILD_ID}/member`.
- [ ] **Step 3.2.2**: Implement strict Gating Logic:
  - If member lookup returns 404 &rarr; User is NOT in guild &rarr; Log to `#auth-logs` (Red) &rarr; Return `403 Forbidden` (`not_in_guild`).
  - If member roles do NOT contain `DISCORD_REQUIRED_ROLE_ID` &rarr; User lacks role &rarr; Log to `#auth-logs` (Red) &rarr; Return `403 Forbidden` (`missing_role`).
  - If valid &rarr; Log to `#auth-logs` (Green) &rarr; Proceed to user registration.

### 3.3 Supabase Database Integration & JWT Issuance
- [ ] **Step 3.3.1**: Implement `UserRepository.cs`:
  - Upsert verified user into Supabase `public.users`.
  - Fetch assigned mailboxes from `public.user_mailboxes`.
  - Auto-assign default domain mailbox if configured.
- [ ] **Step 3.3.2**: Implement JWT Token Generation:
  - Sign JWT using `JWT_SECRET` with claims: `userId`, `discordId`, `username`, `email`, and `roles`.
- [ ] **Step 3.3.3**: Create `AuthController.cs`:
  - `POST /api/auth/discord`: Accepts OAuth `code`, executes gating, returns JWT + user profile.
  - `GET /api/auth/me`: Validates JWT session and returns current user info.

### 3.4 Global Exception & Mail Activity Logging
- [ ] **Step 3.4.1**: Add ASP.NET Core Global Exception Middleware to intercept all unhandled exceptions, format stack traces, and dispatch to `DISCORD_WEBHOOK_ERROR`.
- [ ] **Step 3.4.2**: Hook `MessagesController.cs` and `SmtpService.cs` to dispatch email events (send, trash, sync) to `DISCORD_WEBHOOK_MAIL`.

---

## Phase 4: Frontend Ground Zero UI Overhaul (`aeromail-web`)
*Goal: Modern, sleek Discord-first login experience and profile integration.*

### 4.1 Sleek Discord Login Screen
- [ ] **Step 4.1.1**: Overhaul [LoginPage.tsx](file:///c:/Users/notmr/Desktop/mail.teamarchon.in/aeromail-web/src/pages/LoginPage.tsx):
  - Prominent branded button: **"Sign In with Discord"**.
  - Access Requirement Badges: *"Team Archon Discord Server Member"* & *"Verified Access Role Required"*.
  - User-friendly error alert cards explaining rejection reasons with direct server invite button.

### 4.2 OAuth2 Callback Handler
- [ ] **Step 4.2.1**: Implement `src/pages/AuthCallbackPage.tsx` (`/auth/callback`):
  - Reads `code` from URL query string.
  - Calls `POST /api/auth/discord` with loading spinner.
  - On Success: Saves JWT token to `authStore` and navigates to `/inbox`.
  - On Failure: Redirects to `/login` with clean error messages (`not_in_guild`, `missing_role`, `oauth_error`).

### 4.3 Profile Integration & Clean Routing
- [ ] **Step 4.3.1**: Update [Layout.tsx](file:///c:/Users/notmr/Desktop/mail.teamarchon.in/aeromail-web/src/components/Layout.tsx):
  - Render Discord Avatar, Discord Username, and Role Badge in the header.
  - Clean Logout action clearing session storage and redirecting to `/login`.
- [ ] **Step 4.3.2**: Update [App.tsx](file:///c:/Users/notmr/Desktop/mail.teamarchon.in/aeromail-web/src/App.tsx) router:
  - Route `/login` &rarr; `LoginPage`.
  - Route `/auth/callback` &rarr; `AuthCallbackPage`.
  - Route `/inbox`, `/thread/:id`, `/search`, `/settings` &rarr; Authenticated routes.
  - Fallback &rarr; Redirect to `/login`.

---

## Phase 5: Automated Testing & Build Validation
*Goal: Ensure 100% build health and automated test coverage.*

- [ ] **Step 5.1**: Backend Unit & Integration Tests:
  - Test Discord OAuth exchange mock.
  - Test Guild membership and Role ID gating enforcement (pass, fail-not-in-guild, fail-missing-role).
  - Test Webhook log queue serialization.
  - Run `dotnet test` and confirm all tests pass.
- [ ] **Step 5.2**: Frontend Unit Tests:
  - Test `LoginPage` renders Discord sign-in button.
  - Test `AuthCallbackPage` handles success and error states.
  - Run `npm test` inside `aeromail-web/` and verify all tests pass.
- [ ] **Step 5.3**: Production Bundle Verification:
  - Run `npm run build` inside `aeromail-web/` (confirm clean Vite build).
  - Run `dotnet build -c Release` inside `aeromail-api/`.

---

## Phase 6: Live Production Deployment
*Goal: Deploy the clean-slate platform to VPS and Vercel.*

- [ ] **Step 6.1**: Update VPS Environment:
  - Edit `/etc/teamarchon-api/teamarchon-api.env` on VPS (`151.242.187.244`) with:
    - Discord Client ID, Secret, Redirect URI, Guild ID, Role ID.
    - The 4 Webhook URLs (`AUTH`, `MAIL`, `ERROR`, `SYSTEM`).
    - Supabase PostgreSQL connection string.
- [ ] **Step 6.2**: Deploy Backend to VPS:
  - Pull latest code in `/root/mail_teamarchon`.
  - Run `dotnet publish -c Release -o /var/www/teamarchon-api`.
  - Run `sudo systemctl restart teamarchon-api`.
  - Confirm startup notification arrives in `#system-logs` via Discord webhook!
- [ ] **Step 6.3**: Deploy Frontend to Vercel:
  - Set Vercel environment variables:
    - `VITE_API_BASE_URL=https://api.teamarchon.in/api`
    - `VITE_DISCORD_CLIENT_ID=your_discord_client_id`
    - `VITE_DISCORD_REDIRECT_URI=https://mail.teamarchon.in/auth/callback`
  - Push commit to `origin/main` to trigger automatic Vercel production build.

---

## Phase 7: End-to-End Acceptance Testing

| Test Case | Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :---: |
| **TC-1** | User logs in with Discord who is **NOT** in the Discord Server | 403 Forbidden (`not_in_guild`). UI shows "Join Server" button. Red embed sent to `#auth-logs`. | [ ] |
| **TC-2** | User logs in who is in the server but **DOES NOT** have the role | 403 Forbidden (`missing_role`). UI shows "Missing Role" badge. Red embed sent to `#auth-logs`. | [ ] |
| **TC-3** | User logs in with Discord who **HAS** the required role | 200 OK. Account upserted in Supabase. JWT issued. User enters Inbox. Green embed sent to `#auth-logs`. | [ ] |
| **TC-4** | User sends an email through the webmail composer | Email sent via Stalwart SMTP (`127.0.0.1:465`). Blue embed sent to `#mail-logs`. | [ ] |
| **TC-5** | Backend error triggered | Error handled gracefully by middleware. Dark Red embed with stack trace sent to `#error-logs`. | [ ] |
