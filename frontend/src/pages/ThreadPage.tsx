import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import apiClient from '../api/client'
import { EmailDetail } from '../types'
import DOMPurify from 'dompurify'
import {
  ArrowLeft,
  Reply,
  Forward,
  Trash2,
  Paperclip,
  Download,
  Loader2
} from 'lucide-react'
import ComposeModal from '../components/ComposeModal'

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const folder = searchParams.get('folder') || 'INBOX'

  const navigate = useNavigate()
  const { mailboxes, activeMailboxId } = useAuthStore()
  const activeMailbox = mailboxes.find((m) => m.id === activeMailboxId) || mailboxes[0]

  const [message, setMessage] = useState<EmailDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)

  useEffect(() => {
    if (!id || !activeMailbox) return

    setLoading(true)
    setError(null)

    apiClient.get(`/mail/message/${id}`, {
      params: {
        mailboxId: activeMailbox.id,
        folder
      }
    })
      .then((res) => {
        setMessage(res.data)
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to read message from mail server.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, activeMailbox?.id, folder])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Thread Action Bar */}
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-dark)'
      }}>
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {message && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setReplyOpen(true)}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              <Reply size={14} />
              <span>Reply</span>
            </button>
          </div>
        )}
      </div>

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
          <span>Loading message...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ padding: '24px 32px', color: '#ff5252' }}>
          {error}
        </div>
      )}

      {/* Message Content */}
      {!loading && message && (
        <div style={{ padding: '32px', maxWidth: '900px', width: '100%' }}>
          {/* Subject */}
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>
            {message.subject}
          </h1>

          {/* Sender Header Card */}
          <div className="glass-panel" style={{
            padding: '20px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'var(--accent-red-light)',
                border: '1px solid rgba(211, 47, 47, 0.3)',
                color: 'var(--accent-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '16px'
              }}>
                {(message.fromName || message.from)[0]?.toUpperCase()}
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>
                  {message.fromName} <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 400 }}>&lt;{message.from}&gt;</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  to {message.to}
                </div>
              </div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {new Date(message.date).toLocaleString()}
            </div>
          </div>

          {/* Attachments if any */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Attachments ({message.attachments.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {message.attachments.map((att, idx) => (
                  <div key={idx} style={{
                    background: '#1a1a1f',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px'
                  }}>
                    <Paperclip size={14} color="var(--accent-red)" />
                    <span>{att.fileName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      ({Math.round(att.size / 1024)} KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Body */}
          <div
            style={{
              lineHeight: 1.7,
              fontSize: '15px',
              color: '#dedede',
              background: '#0d0d10',
              padding: '24px',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)'
            }}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(message.htmlBody || message.textBody || '')
            }}
          />
        </div>
      )}

      {/* Reply Modal */}
      {replyOpen && message && (
        <ComposeModal
          mailbox={activeMailbox}
          defaultTo={message.from}
          defaultSubject={`Re: ${message.subject}`}
          onClose={() => setReplyOpen(false)}
        />
      )}
    </div>
  )
}
