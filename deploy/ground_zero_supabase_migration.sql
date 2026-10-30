-- ==============================================================================
-- Team Archon Mail - Ground Zero Supabase Database Migration
-- Execute this script in your Supabase Project -> SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop legacy tables to start 100% clean
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_mailboxes CASCADE;
DROP TABLE IF EXISTS public.mailboxes CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.labels CASCADE;
DROP TABLE IF EXISTS public.filters CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP VIEW IF EXISTS public.accounts CASCADE;

-- 1. Users Table: Managed via Discord OAuth2 or Email/Password Credentials
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id VARCHAR(64) UNIQUE,
    discord_username VARCHAR(100),
    discord_avatar VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- Secure PBKDF2 hash (salt.hash)
    roles TEXT[] DEFAULT '{member}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Mailboxes Table: Physical accounts on VPS Stalwart Mail Server
CREATE TABLE public.mailboxes (
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
CREATE TABLE public.user_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'member', 'read_only'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, mailbox_id)
);

-- 4. Audit Log Table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Performance Indexes
CREATE INDEX idx_users_discord_id ON public.users(discord_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_mailboxes_email ON public.mailboxes(email);
CREATE INDEX idx_user_mailboxes_user_id ON public.user_mailboxes(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 6. Insert Default Primary Mailbox (Stalwart on VPS)
INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
VALUES (
    'admin@teamarchon.in',
    'Team Archon Admin',
    '127.0.0.1',
    993,
    true,
    '127.0.0.1',
    465,
    true,
    -- AES encrypted placeholder (updated automatically by backend or admin)
    'k6aD4V0d6L+uBqN8/2Z80A==',
    true
)
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- Quick Migration Patch for existing databases (run this if you already deployed):
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
-- ALTER TABLE public.users ALTER COLUMN discord_id DROP NOT NULL;
-- ==============================================================================
