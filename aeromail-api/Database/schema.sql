-- Team Archon Mail Database Schema (PostgreSQL / Supabase)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mailboxes: Real IMAP/SMTP accounts managed on VPS
CREATE TABLE IF NOT EXISTS mailboxes (
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
    color VARCHAR(7) DEFAULT '#1a73e8',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

-- User Profiles (Mirrors Supabase Auth Users)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY, -- Maps to Supabase auth.users(id)
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin', 'user'
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mailbox Assignments (Permissions & Access Control)
CREATE TABLE IF NOT EXISTS user_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Supabase auth.users(id)
    mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin', 'member', 'read_only'
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, mailbox_id)
);

-- Backward compatibility view for legacy "accounts" table queries
CREATE OR REPLACE VIEW accounts AS 
SELECT 
    id, email, display_name, 
    imap_host, imap_port, imap_ssl, 
    smtp_host, smtp_port, smtp_ssl, 
    encrypted_password, color, is_active, 
    created_at, last_synced_at
FROM mailboxes;

-- Labels (Linked to mailboxes)
CREATE TABLE IF NOT EXISTS labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#1a73e8',
    is_system BOOLEAN NOT NULL DEFAULT false,
    imap_mailbox VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

-- Filters (Linked to mailboxes)
CREATE TABLE IF NOT EXISTS filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    from_pattern VARCHAR(255),
    to_pattern VARCHAR(255),
    subject_pattern VARCHAR(255),
    has_words TEXT,
    action VARCHAR(50) NOT NULL,
    action_label_id UUID REFERENCES labels(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages cache (metadata only)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
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

-- Message body cache
CREATE TABLE IF NOT EXISTS message_bodies (
    message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    body_html TEXT,
    body_text TEXT,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255),
    size_bytes INTEGER,
    imap_section VARCHAR(100)
);

-- IMAP sync state
CREATE TABLE IF NOT EXISTS sync_state (
    account_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    folder VARCHAR(255) NOT NULL,
    last_uid BIGINT NOT NULL DEFAULT 0,
    uidvalidity BIGINT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(account_id, folder)
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user ON user_mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_approved ON user_mailboxes(user_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages(account_id, folder);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(account_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(account_id, folder, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(snippet,'') || ' ' || coalesce(from_email,'')));
