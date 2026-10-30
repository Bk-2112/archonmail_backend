import React, { useState } from 'react'
import { MailboxRecord } from '../types'
import apiClient from '../api/client'
import { X, Send, Loader2, Paperclip } from 'lucide-react'

interface ComposeModalProps {
  mailbox?: MailboxRecord
  defaultTo?: string
  defaultSubject?: string
  onClose: () => void
  onSent?: () => void
}

export default function ComposeModal({
  mailbox,
  defaultTo = '',
  defaultSubject = '',
  onClose,
  onSent
}: ComposeModalProps) {
  const [to, setTo] = useState(defaultTo)
  const [cc, setCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mailbox) {
      setError('No active mailbox available.')
      return
    }
    if (!to.trim()) {
      setError('Recipient address is required.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await apiClient.post('/mail/send', {
        mailboxId: mailbox.id,
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        bodyHtml: body.replace(/\n/g, '<br />'),
        bodyText: body
      })

      onSent?.()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to dispatch email via SMTP.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '560px',
      maxWidth: 'calc(100vw - 48px)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--border-radius)',
      boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        background: '#18181c',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
          New Message &bull; <span style={{ color: 'var(--accent-red)' }}>{mailbox?.email || 'Mailbox'}</span>
        </span>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.15)',
            borderBottom: '1px solid rgba(231, 76, 60, 0.3)',
            color: '#ff5252',
            padding: '10px 20px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* To field */}
        <div style={{
          padding: '8px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px', width: '40px' }}>To:</span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@domain.com"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '14px'
            }}
            required
          />
          {!showCc && (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}
            >
              Cc
            </button>
          )}
        </div>

        {/* Cc field if expanded */}
        {showCc && (
          <div style={{
            padding: '8px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', width: '40px' }}>Cc:</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="comma separated addresses"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* Subject field */}
        <div style={{
          padding: '8px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px', width: '40px' }}>Subj:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Body TextArea */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your email here..."
          rows={12}
          style={{
            padding: '16px 20px',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '14px',
            resize: 'none',
            lineHeight: 1.6
          }}
        />

        {/* Footer controls */}
        <div style={{
          padding: '12px 20px',
          background: '#0d0d10',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              id="btn-send-email"
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--text-muted)', fontSize: '13px' }}
          >
            Discard
          </button>
        </div>
      </form>
    </div>
  )
}
