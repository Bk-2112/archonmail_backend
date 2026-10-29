# AeroMail v2

> **Self-hosted, open-source webmail with a Gmail-equivalent experience.**  
> Connect to any IMAP/SMTP server. Own your data. Zero vendor lock-in.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-webmail.aeroverra.com-green)](https://webmail.aeroverra.com)

---

## What Is AeroMail?

AeroMail is a **self-hosted webmail client** that delivers Gmail-level productivity — conversation threading, labels, filters, search, offline access, and PWA installability — while keeping your mail on your own server.

- 🔒 **Data sovereignty** — your email stays on your infrastructure
- 🔌 **No vendor lock-in** — works with any IMAP4rev1/SMTP server
- 🕵️ **Privacy-first** — no AI scanning, no telemetry, no analytics
- 📖 **Open source** — MIT licensed, fully auditable

**Live instance:** [https://webmail.aeroverra.com](https://webmail.aeroverra.com)

---

## Features

| Category | Features |
|---|---|
| **Mail** | IMAP/SMTP with any provider (Gmail, Outlook, iCloud, Fastmail, self-hosted) |
| **UI** | Gmail-identical interface — dark mode by default, light mode toggle |
| **Organization** | Labels, filters/rules, conversation threading, starred/important/snoozed |
| **Search** | Full-text search with operators (`from:`, `to:`, `subject:`, `has:attachment`, `after:`, `before:`) |
| **Compose** | Rich text editor, attachments, CC/BCC, drafts auto-save, reply/reply-all/forward |
| **Settings** | Display name, signature, reply mode, emails per page, IMAP/SMTP account config |
| **Branding** | White-label configurable — custom app name, logo, primary color via environment variables |
| **PWA** | Installable on Chrome desktop and mobile, offline compose queue, app shell caching |
| **Mobile** | Mobile-first responsive layout, full-screen drawer navigation, touch-optimized |

### Provider Presets (auto-configures IMAP host/port)

Gmail · Outlook/Office 365 · Yahoo · iCloud · Fastmail · Custom (any IMAP server)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite 5 + TypeScript (PWA via Workbox) |
| **Backend** | C# ASP.NET Core 8 |
| **Database** | PostgreSQL 16 |
| **Infrastructure** | Docker Compose (4 containers: web, api, db, proxy) |
| **Component Library** | [@aero-vi/aero-ui](https://aero-vi.github.io/aero-ui/) |
| **Mail Protocol** | MailKit + MimeKit (IMAP4rev1, IMAP IDLE, SMTP) |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- A domain with DNS pointed to your server (or use `localhost` for local dev)

### Deploy

```bash
git clone https://github.com/Aero-VI/aeromail.git
cd aeromail
cp .env.example .env
# Edit .env — set JWT_SECRET, AES_KEY, DB_PASSWORD, and your domain
docker compose up -d
```

Open your browser to `http://localhost` (or your domain). The first-run setup wizard at `/setup` will guide you through:

1. Mail server configuration (IMAP + SMTP)
2. Admin account creation
3. Connection test
4. Launch

### Environment Variables

```env
# Required — change before production
JWT_SECRET=your-secret-key-min-32-chars
AES_KEY=your-aes-256-key-exactly-32-bytes

# Database
DB_PASSWORD=your-db-password

# White-label (optional)
APP_NAME=AeroMail
PRIMARY_COLOR=#1a73e8
LOGO_URL=/logo.svg
FAVICON_URL=/favicon.ico
```

> ⚠️ **Never use default/placeholder values in production.** Set `JWT_SECRET` and `AES_KEY` to strong random values.

---

## Architecture

```
Browser / PWA
│
│  HTTPS
▼
Nginx Reverse Proxy
├── /api/* → ASP.NET Core 8 API
└── /*     → React SPA (Vite build)
                │
                │ SQL (Dapper + Npgsql)
                ▼
         PostgreSQL 16
                │
                │ IMAP / SMTP (external)
                ▼
    Your mail server (any IMAP4rev1/SMTP)
```

**Containers:**

| Container | Purpose |
|---|---|
| `proxy` | Nginx reverse proxy — TLS termination, routes /api vs. static |
| `web` | Nginx serving the compiled React PWA |
| `api` | ASP.NET Core 8 — mail sync, auth, REST API |
| `db` | PostgreSQL 16 — message metadata cache, labels, rules, users |

---

## Security

| Control | Implementation |
|---|---|
| **Authentication** | JWT (HS256) — validated on every API request |
| **Credential storage** | IMAP passwords encrypted with AES-256 (random IV per record) |
| **HTML sanitization** | DOMPurify applied to all email body rendering — strips `<script>`, event handlers, `javascript:` URIs |
| **HTTP headers** | `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security` |
| **SQL** | All queries parameterized via Dapper — zero string concatenation |
| **Dependencies** | `npm audit` passes with zero HIGH/CRITICAL vulnerabilities |
| **CORS** | Specific origins whitelisted — no wildcard |
| **Secrets** | All secrets loaded from environment variables — never hardcoded |

> A full security audit was performed as part of v2 release. See `processes/m_aeromail_v2-security-audit.md` in the internal repo for the complete report.

---

## Component Library

AeroMail is built on **Aero-UI**, an in-house React component library:

📦 **[https://aero-vi.github.io/aero-ui/](https://aero-vi.github.io/aero-ui/)**

Components include `EmailRow`, `ThreadCard`, `ComposeModal`, `Sidebar`, `AppBar`, `SearchBar`, `LabelChip`, `Avatar`, `FilterWizard`, and all primitive UI elements.

```bash
npm install @aero-vi/aero-ui
```

---

## Screenshots

| Screen | Description |
|---|---|
| Login | Provider presets, IMAP config, credential entry |
| Inbox | High-density thread list, bulk actions, labels |
| Thread View | Conversation threading, inline reply, attachments |
| Compose | Floating modal, rich text, chip-based recipients |
| Settings | Labels, filters/rules, account configuration |

---

## Development

### Frontend

```bash
cd aeromail-web
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
```

### Backend

```bash
cd aeromail-api
dotnet restore
dotnet run        # http://localhost:5000
```

### Database

PostgreSQL schema is auto-applied on API startup via `DatabaseService`. See `aeromail-api/schema.sql` for the full schema.

---

## API Overview

All endpoints (except auth, config, setup) require `Authorization: Bearer <token>`.

| Resource | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Folders | `GET /api/folders`, `POST /api/folders/sync` |
| Messages | `GET /api/messages`, `GET /api/messages/:id`, `POST /api/messages/send`, `DELETE /api/messages/:id` |
| Search | `GET /api/messages/search?q=...` |
| Labels | `GET/POST /api/labels`, `PUT/DELETE /api/labels/:id` |
| Rules | `GET/POST /api/rules`, `PUT/DELETE /api/rules/:id` |
| Attachments | `POST /api/attachments/upload`, `GET /api/attachments/:id` |
| Config | `GET /api/config` (public — returns white-label config) |
| Setup | `GET /api/setup/status`, `POST /api/setup/*` (first-run only) |

---

## White-Label Configuration

Deploy AeroMail as your own branded webmail. All branding is configurable via environment variables — no code changes required:

```env
APP_NAME=MyMail
PRIMARY_COLOR=#007bff
LOGO_URL=https://mycompany.com/logo.svg
FAVICON_URL=https://mycompany.com/favicon.ico
```

The frontend fetches `GET /api/config` on load and applies branding dynamically via CSS custom properties.

---

## License

MIT — see [LICENSE](LICENSE)

---

## Contributing

Pull requests welcome. Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit with conventional commits (`feat:`, `fix:`, `docs:`)
4. Open a PR against `main`

---

*Built with ❤️ by [Aero-VI](https://github.com/Aero-VI)*
