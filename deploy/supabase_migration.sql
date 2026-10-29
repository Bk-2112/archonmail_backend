-- ==============================================================================
-- Team Archon Mail - Supabase PostgreSQL Schema Migration
-- Execute this script in your Supabase Project -> SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Mailboxes: Real IMAP/SMTP accounts managed on VPS
CREATE TABLE IF NOT EXISTS public.mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    imap_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_ssl BOOLEAN NOT NULL DEFAULT true,
    smtp_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_ssl BOOLEAN NOT NULL DEFAULT false,
    encrypted_password TEXT NOT NULL,
    color VARCHAR(7) DEFAULT '#2563eb',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

-- 2. User Profiles: Mirrors Supabase Auth Users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin', 'user'
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Mailbox Assignments: Permissions & Multi-Tenant Access
CREATE TABLE IF NOT EXISTS public.user_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin', 'member', 'read_only'
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, mailbox_id)
);

-- 4. Backward Compatibility View for legacy "accounts" queries
CREATE OR REPLACE VIEW public.accounts AS 
SELECT 
    id, email, display_name, 
    imap_host, imap_port, imap_ssl, 
    smtp_host, smtp_port, smtp_ssl, 
    encrypted_password, color, is_active, 
    created_at, last_synced_at
FROM public.mailboxes;

-- 5. Labels (Linked to mailboxes)
CREATE TABLE IF NOT EXISTS public.labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#2563eb',
    is_system BOOLEAN NOT NULL DEFAULT false,
    imap_mailbox VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

-- 6. Filters (Linked to mailboxes)
CREATE TABLE IF NOT EXISTS public.filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    from_pattern VARCHAR(255),
    to_pattern VARCHAR(255),
    subject_pattern VARCHAR(255),
    has_words TEXT,
    action VARCHAR(50) NOT NULL,
    action_label_id UUID REFERENCES public.labels(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Messages Metadata Cache
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    imap_uid BIGINT NOT NULL,
    message_id VARCHAR(500),
    thread_id VARCHAR(500),
    folder VARCHAR(255) NOT NULL DEFAULT 'INBOX',
    from_name VARCHAR(255),
    from_email VARCHAR(255) NOT NULL,
    to_emails JSONB NOT NULL DEFAULT '[]',
    cc_emails JSONB NOT NULL DEFAULT '[]',
    subject TEXT,
    snippet TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_starred BOOLEAN NOT NULL DEFAULT false,
    is_important BOOLEAN NOT NULL DEFAULT false,
    has_attachments BOOLEAN NOT NULL DEFAULT false,
    size_bytes INTEGER,
    labels JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, folder, imap_uid)
);

-- 8. Message Body Cache
CREATE TABLE IF NOT EXISTS public.message_bodies (
    message_id UUID PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
    body_html TEXT,
    body_text TEXT,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Attachments Metadata
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255),
    size_bytes INTEGER,
    imap_section VARCHAR(100)
);

-- 10. Sync State
CREATE TABLE IF NOT EXISTS public.sync_state (
    account_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    folder VARCHAR(255) NOT NULL,
    last_uid BIGINT NOT NULL DEFAULT 0,
    uidvalidity BIGINT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(account_id, folder)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user ON public.user_mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_approved ON public.user_mailboxes(user_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON public.messages(account_id, folder);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(account_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(account_id, folder, is_read) WHERE is_read = false;

-- Trigger to auto-create user_profiles on Supabase auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role, is_approved)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), 'user', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security (RLS) Enablement
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.user_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Allow authenticated users to view approved mailbox assignments
CREATE POLICY "Users can view assigned mailboxes" 
ON public.user_mailboxes FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id AND is_approved = true);
