import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Avatar,
  Collapse,
  Button,
  TextField,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArchiveIcon from '@mui/icons-material/Archive'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ReplyIcon from '@mui/icons-material/Reply'
import ReplyAllIcon from '@mui/icons-material/ReplyAll'
import ForwardIcon from '@mui/icons-material/Forward'
import SendIcon from '@mui/icons-material/Send'
import apiClient from '../api/client'
import ComposeModal from '../components/ComposeModal'
import { getAvatarColor } from '../utils/avatarColor'

interface EmailMessage {
  uid: number
  subject: string
  from: string
  fromEmail: string
  to: string[]
  date: string
  body: string
  bodyHtml?: string
  snippet?: string
}

function parseFrom(from: string): { name: string; email: string } {
  // "Display Name <email@example.com>" or just "email@example.com"
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].replace(/^"|"$/g, '').trim() || match[2], email: match[2] }
  }
  return { name: from, email: from }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function getInitial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}

const ThreadPage: React.FC = () => {
  const { uid } = useParams<{ uid: string }>()
  const [searchParams] = useSearchParams()
  const folder = searchParams.get('folder') ?? 'INBOX'
  // 'from' param stores the URL to navigate back to (e.g. /search?q=xxx)
  const fromUrl = searchParams.get('from') ?? '/inbox'
  const navigate = useNavigate()

  const [message, setMessage] = useState<EmailMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expand/collapse state (always expanded for single message)
  const [expanded, setExpanded] = useState(true)

  // More menu
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)

  // Reply state
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replySent, setReplySent] = useState(false)

  // ComposeModal (for Reply All / Forward)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeReplyTo, setComposeReplyTo] = useState<
    { name: string; email: string; subject: string; uid?: string | number } | undefined
  >()

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setError(null)
    apiClient
      .get(`/messages/${uid}`, { params: { folder } })
      .then((res) => {
        const data = res.data
        // Normalise field names from the API
        const from = data.from ?? data.fromEmail ?? ''
        const parsed = parseFrom(from)
        setMessage({
          uid: data.uid ?? Number(uid),
          subject: data.subject ?? '(no subject)',
          from: parsed.name,
          fromEmail: parsed.email,
          to: Array.isArray(data.to) ? data.to : [data.to ?? ''],
          date: data.date ?? '',
          body: data.body ?? data.textBody ?? '',
          bodyHtml: data.bodyHtml ?? data.htmlBody ?? '',
          snippet: data.snippet ?? '',
        })
      })
      .catch((e) => {
        setError(e?.response?.data?.error ?? 'Failed to load message')
      })
      .finally(() => setLoading(false))
  }, [uid, folder])

  const handleReply = () => {
    setReplyOpen(true)
    setReplySent(false)
    setReplyError(null)
    setReplyBody('')
  }

  const handleSendReply = async () => {
    if (!message || !replyBody.trim()) return
    setReplySending(true)
    setReplyError(null)
    try {
      await apiClient.post('/messages/send', {
        to: [message.fromEmail],
        subject: `Re: ${message.subject}`,
        body: replyBody,
        replyToUid: message.uid,
      })
      setReplySent(true)
      setReplyOpen(false)
      setReplyBody('')
    } catch (e: any) {
      setReplyError(e?.response?.data?.error ?? 'Failed to send reply')
    } finally {
      setReplySending(false)
    }
  }

  const openComposeReplyAll = () => {
    if (!message) return
    setComposeReplyTo({
      name: message.from,
      email: message.fromEmail,
      subject: message.subject,
      uid: message.uid,
    })
    setComposeOpen(true)
  }

  const openComposeForward = () => {
    if (!message) return
    setComposeReplyTo(undefined) // forward: blank To, keep subject
    setComposeOpen(true)
  }

  const safeHtml = message?.bodyHtml
    ? DOMPurify.sanitize(message.bodyHtml, { USE_PROFILES: { html: true } })
    : null

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#1f1f1f',
        color: '#e8eaed',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderBottom: '1px solid #3c4043',
          background: '#1f1f1f',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Tooltip title="Back">
          <IconButton onClick={() => navigate(fromUrl)} sx={{ color: '#9aa0a6', mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        {message && (
          <Typography
            variant="h5"
            sx={{ flex: 1, color: '#e8eaed', fontWeight: 400, fontSize: { xs: 18, sm: 22 }, mr: 2 }}
            noWrap
          >
            {message.subject}
          </Typography>
        )}

        <Tooltip title="Archive">
          <IconButton sx={{ color: '#9aa0a6' }}>
            <ArchiveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton sx={{ color: '#9aa0a6' }}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: { xs: 1, sm: 3 }, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress sx={{ color: '#1a73e8' }} />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#f28b82' }}>{error}</Typography>
            <Button
              variant="outlined"
              sx={{ mt: 2, color: '#1a73e8', borderColor: '#1a73e8' }}
              onClick={() => navigate(fromUrl)}
            >
              Go Back
            </Button>
          </Box>
        )}

        {message && !loading && (
          <>
            {/* Message Card */}
            <Box
              sx={{
                background: '#2d2d2f',
                borderRadius: 2,
                mb: 2,
                overflow: 'hidden',
              }}
            >
              {/* Collapsed header (click to toggle) */}
              {!expanded ? (
                <Box
                  onClick={() => setExpanded(true)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    gap: 1.5,
                    '&:hover': { background: '#35363a' },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: 14,
                      background: getAvatarColor(message.from),
                      flexShrink: 0,
                    }}
                  >
                    {getInitial(message.from)}
                  </Avatar>
                  <Typography sx={{ color: '#e8eaed', fontWeight: 600, fontSize: 14, minWidth: 120 }} noWrap>
                    {message.from}
                  </Typography>
                  <Typography sx={{ color: '#9aa0a6', fontSize: 13, flex: 1 }} noWrap>
                    {message.snippet || message.body.slice(0, 100)}
                  </Typography>
                  <Typography sx={{ color: '#9aa0a6', fontSize: 12, flexShrink: 0 }}>
                    {formatDate(message.date)}
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Expanded header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', px: 2, pt: 2, pb: 1, gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        fontSize: 18,
                        background: getAvatarColor(message.from),
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpanded(false)}
                    >
                      {getInitial(message.from)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#e8eaed', fontWeight: 600, fontSize: 14 }}>
                          {message.from}
                        </Typography>
                        <Typography sx={{ color: '#9aa0a6', fontSize: 13 }}>
                          to me ▾
                        </Typography>
                      </Box>
                      <Typography sx={{ color: '#9aa0a6', fontSize: 12 }}>
                        {formatDate(message.date)}
                      </Typography>
                    </Box>
                    <Tooltip title="More options">
                      <IconButton
                        size="small"
                        sx={{ color: '#9aa0a6' }}
                        onClick={(e) => setMenuAnchor(e.currentTarget)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Menu
                      anchorEl={menuAnchor}
                      open={Boolean(menuAnchor)}
                      onClose={() => setMenuAnchor(null)}
                      PaperProps={{ sx: { background: '#2d2d2f', color: '#e8eaed' } }}
                    >
                      <MenuItem onClick={() => { setMenuAnchor(null) }} sx={{ '&:hover': { background: '#35363a' } }}>
                        Print
                      </MenuItem>
                      <MenuItem onClick={() => { setMenuAnchor(null) }} sx={{ '&:hover': { background: '#35363a' } }}>
                        Show original
                      </MenuItem>
                      <MenuItem onClick={() => { setMenuAnchor(null) }} sx={{ '&:hover': { background: '#35363a' } }}>
                        Report spam
                      </MenuItem>
                    </Menu>
                  </Box>

                  {/* Body */}
                  <Box sx={{ px: 2, py: 1 }}>
                    {safeHtml ? (
                      <Box
                        component="div"
                        dangerouslySetInnerHTML={{ __html: safeHtml }}
                        sx={{
                          color: '#e8eaed',
                          fontSize: 14,
                          lineHeight: 1.6,
                          '& a': { color: '#8ab4f8' },
                          '& img': { maxWidth: '100%' },
                          '& *': { maxWidth: '100%' },
                        }}
                      />
                    ) : (
                      <Typography
                        component="pre"
                        sx={{
                          color: '#e8eaed',
                          fontSize: 14,
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'inherit',
                          m: 0,
                        }}
                      >
                        {message.body}
                      </Typography>
                    )}
                  </Box>

                  {/* Footer action buttons */}
                  <Box sx={{ display: 'flex', gap: 1, px: 2, py: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ReplyIcon />}
                      onClick={handleReply}
                      sx={{
                        color: '#e8eaed',
                        borderColor: '#5f6368',
                        textTransform: 'none',
                        borderRadius: 20,
                        '&:hover': { borderColor: '#9aa0a6', background: '#35363a' },
                      }}
                    >
                      Reply
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ReplyAllIcon />}
                      onClick={openComposeReplyAll}
                      sx={{
                        color: '#e8eaed',
                        borderColor: '#5f6368',
                        textTransform: 'none',
                        borderRadius: 20,
                        '&:hover': { borderColor: '#9aa0a6', background: '#35363a' },
                      }}
                    >
                      Reply All
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ForwardIcon />}
                      onClick={openComposeForward}
                      sx={{
                        color: '#e8eaed',
                        borderColor: '#5f6368',
                        textTransform: 'none',
                        borderRadius: 20,
                        '&:hover': { borderColor: '#9aa0a6', background: '#35363a' },
                      }}
                    >
                      Forward
                    </Button>
                  </Box>
                </>
              )}
            </Box>

            {/* Reply section */}
            <Collapse in={replyOpen}>
              <Box
                sx={{
                  background: '#2d2d2f',
                  borderRadius: 2,
                  p: 2,
                  mb: 2,
                  border: '1px solid #3c4043',
                }}
              >
                <Typography sx={{ color: '#9aa0a6', fontSize: 13, mb: 1 }}>
                  Reply to {message.from}
                </Typography>
                <TextField
                  multiline
                  minRows={4}
                  fullWidth
                  placeholder="Write your reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#e8eaed',
                      background: '#1f1f1f',
                      borderRadius: 1,
                      '& fieldset': { borderColor: '#3c4043' },
                      '&:hover fieldset': { borderColor: '#5f6368' },
                      '&.Mui-focused fieldset': { borderColor: '#1a73e8' },
                    },
                    '& textarea': { color: '#e8eaed', fontSize: 14 },
                  }}
                />
                {replyError && (
                  <Typography sx={{ color: '#f28b82', fontSize: 12, mt: 0.5 }}>{replyError}</Typography>
                )}
                {replySent && (
                  <Typography sx={{ color: '#81c995', fontSize: 12, mt: 0.5 }}>Reply sent!</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={replySending || !replyBody.trim()}
                    onClick={handleSendReply}
                    endIcon={<SendIcon />}
                    sx={{
                      background: '#1a73e8',
                      borderRadius: 20,
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2,
                      '&:hover': { background: '#1557b0' },
                    }}
                  >
                    {replySending ? 'Sending…' : 'Send'}
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => { setReplyOpen(false); setReplyBody('') }}
                    sx={{ color: '#9aa0a6', textTransform: 'none', borderRadius: 20 }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </>
        )}
      </Box>

      {/* ComposeModal for Reply All / Forward */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        replyTo={composeReplyTo}
      />
    </Box>
  )
}

export default ThreadPage
