import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { EmailSummary } from '../types'
import {
  RotateCw,
  Star,
  Paperclip,
  MailOpen,
  Mail as MailIcon,
  Inbox as InboxIcon,
  Loader2
} from 'lucide-react'

export default function InboxPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mailboxes, activeMailboxId } = useAuthStore()

  const [messages, setMessages] = useState<EmailSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeMailbox = mailboxes.find((m) => m.id === activeMailboxId) || mailboxes[0]

  // Map path to IMAP folder name
  const getFolderName = () => {
    switch (location.pathname) {
      case '/sent': return 'Sent'
      case '/drafts': return 'Drafts'
      case '/trash': return 'Trash'
      default: return 'INBOX'
    }
  }

  const folderName = getFolderName()

  const fetchMessages = () => {
    if (!activeMailbox) return

    setLoading(true)
    setError(null)

    apiClient.get('/mail/messages', {
      params: {
        mailboxId: activeMailbox.id,
        folder: folderName,
        limit: 50
      }
    })
      .then((res) => {
        setMessages(res.data || [])
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to sync emails from Stalwart IMAP.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchMessages()
  }, [activeMailbox?.id, folderName])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="email-list-panel">
      {/* List Header */}
      <div className="email-list-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
            {folderName === 'INBOX' ? 'Inbox' : folderName}
          </h2>
          {messages.length > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ({messages.length} messages)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Refresh Mailbox"
          >
            <RotateCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          padding: '14px 24px',
          background: 'rgba(231, 76, 60, 0.1)',
          borderBottom: '1px solid rgba(231, 76, 60, 0.3)',
          color: '#ff5252',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--text-muted)'
        }}>
          <Loader2 size={28} color="var(--accent-red)" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '13px' }}>Loading emails from {activeMailbox?.email}...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && messages.length === 0 && !error && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--text-muted)'
        }}>
          <InboxIcon size={48} color="#333" />
          <h3 style={{ fontSize: '16px', color: '#888' }}>No emails in {folderName}</h3>
          <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>
            Connected to Stalwart on {activeMailbox?.email}
          </p>
        </div>
      )}

      {/* Email Rows */}
      {!loading && messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {messages.map((email) => (
            <div
              key={email.id}
              className={`email-row ${!email.isRead ? 'unread' : ''}`}
              onClick={() => navigate(`/thread/${email.uid}?folder=${folderName}`)}
            >
              {/* Unread indicator */}
              {!email.isRead ? (
                <div className="unread-dot" title="Unread" />
              ) : (
                <div style={{ width: '8px' }} />
              )}

              {/* Star toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // toggle star
                }}
                style={{ color: email.isStarred ? '#ffca28' : '#444' }}
              >
                <Star size={16} fill={email.isStarred ? '#ffca28' : 'none'} />
              </button>

              {/* Sender */}
              <div className="email-sender">
                {email.fromName || email.from}
              </div>

              {/* Subject & Snippet */}
              <div className="email-content">
                <span className="email-subject">{email.subject}</span>
                <span className="email-snippet">&mdash; {email.snippet}</span>
              </div>

              {/* Attachment Icon */}
              {email.hasAttachments && (
                <Paperclip size={14} color="var(--text-muted)" />
              )}

              {/* Date */}
              <div className="email-date">
                {formatDate(email.date)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
