CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts: IMAP/SMTP credentials per user
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_ssl BOOLEAN NOT NULL DEFAULT true,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_ssl BOOLEAN NOT NULL DEFAULT true,
    encrypted_password TEXT NOT NULL,
    color VARCHAR(7),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

-- Labels (user-created + system labels)
CREATE TABLE IF NOT EXISTS labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#1a73e8',
    is_system BOOLEAN NOT NULL DEFAULT false,
    imap_mailbox VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, name)
);

-- Messages cache (metadata only — bodies fetched on demand)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255),
    size_bytes INTEGER,
    imap_section VARCHAR(100)
);

-- Filter rules
CREATE TABLE IF NOT EXISTS filters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    from_pattern VARCHAR(255),
    to_pattern VARCHAR(255),
    subject_pattern VARCHAR(255),
    has_words TEXT,
    action VARCHAR(50) NOT NULL,
    action_label_id UUID REFERENCES labels(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IMAP sync state
CREATE TABLE IF NOT EXISTS sync_state (
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder VARCHAR(255) NOT NULL,
    last_uid BIGINT NOT NULL DEFAULT 0,
    uidvalidity BIGINT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(account_id, folder)
);

-- System settings (setup wizard config)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_account_folder ON messages(account_id, folder);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(account_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(account_id, folder, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(snippet,'') || ' ' || coalesce(from_email,'')));
