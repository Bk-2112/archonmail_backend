import React, { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import SendIcon from '@mui/icons-material/Send'
import apiClient from '../api/client'

interface ComposeModalProps {
  open: boolean
  onClose: () => void
  replyTo?: {
    name: string
    email: string
    subject: string
    uid?: string | number
  }
}

const MODAL_WIDTH = 560

const ComposeModal: React.FC<ComposeModalProps> = ({ open, onClose, replyTo }) => {
  const [minimized, setMinimized] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [to, setTo] = useState(replyTo?.email ?? '')
  const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject}` : '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (replyTo) {
      setTo(replyTo.email)
      setSubject(`Re: ${replyTo.subject}`)
      setBody('')
    }
  }, [replyTo?.email, replyTo?.subject])

  if (!open) return null

  const headerTitle = replyTo ? `Reply to: ${replyTo.name}` : 'New Message'

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return
    setSending(true)
    setError(null)
    try {
      await apiClient.post('/messages/send', {
        to: [to.trim()],
        subject,
        body,
        ...(replyTo?.uid ? { replyToUid: replyTo.uid } : {}),
      })
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setTo('')
    setSubject('')
    setBody('')
    setError(null)
    setMinimized(false)
    setMaximized(false)
    onClose()
  }

  return (
    <Box
      sx={{
        position: 'fixed' as const,
        ...(maximized
          ? { top: 0, left: 0, right: 0, bottom: 0, width: '100%' }
          : { bottom: 0, right: 16, width: MODAL_WIDTH, maxWidth: '100vw' }),
        display: 'flex',
        flexDirection: 'column',
        background: '#2d2d2f',
        borderRadius: maximized ? 0 : '8px 8px 0 0',
        zIndex: 1300,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          background: '#3c4043',
          borderRadius: maximized ? 0 : '8px 8px 0 0',
          cursor: minimized ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => minimized && setMinimized(false)}
      >
        <Typography sx={{ flex: 1, color: '#e8eaed', fontSize: 14, fontWeight: 500 }}>
          {headerTitle}
        </Typography>
        <Tooltip title="Minimize">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); setMaximized(false) }}
            sx={{ color: '#9aa0a6' }}
          >
            <MinimizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={maximized ? 'Restore' : 'Maximize'}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setMaximized((m) => !m); setMinimized(false) }}
            sx={{ color: '#9aa0a6' }}
          >
            {maximized ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Close">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClose() }} sx={{ color: '#9aa0a6' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {!minimized && (
        <>
          <Box sx={{ px: 2, pt: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TextField
              variant="standard"
              placeholder="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              fullWidth
              sx={{
                borderBottom: '1px solid #3c4043',
                mb: 1,
                '& .MuiInput-root': { color: '#e8eaed' },
                '& .MuiInput-root:before': { borderColor: '#3c4043' },
                '& .MuiInput-root:after': { borderColor: '#1a73e8' },
              }}
            />
            <TextField
              variant="standard"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              fullWidth
              sx={{
                borderBottom: '1px solid #3c4043',
                mb: 1,
                '& .MuiInput-root': { color: '#e8eaed' },
                '& .MuiInput-root:before': { borderColor: '#3c4043' },
                '& .MuiInput-root:after': { borderColor: '#1a73e8' },
              }}
            />
            <TextField
              variant="standard"
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              minRows={maximized ? 14 : 6}
              fullWidth
              InputProps={{ disableUnderline: true }}
              sx={{
                flex: 1,
                '& .MuiInput-root': { color: '#e8eaed', alignItems: 'flex-start' },
                '& textarea': { resize: 'none', color: '#e8eaed', fontSize: 14 },
              }}
            />
            {error && (
              <Typography sx={{ color: '#f28b82', fontSize: 12, mt: 0.5 }}>{error}</Typography>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 1,
              gap: 0.5,
              borderTop: '1px solid #3c4043',
            }}
          >
            <Button
              variant="contained"
              size="small"
              disabled={sending || !to.trim()}
              onClick={handleSend}
              endIcon={<SendIcon />}
              sx={{
                background: '#1a73e8',
                borderRadius: 20,
                textTransform: 'none',
                fontWeight: 600,
                px: 2,
                mr: 1,
                '&:hover': { background: '#1557b0' },
              }}
            >
              {sending ? 'Sending…' : 'Send'}
            </Button>
            <Tooltip title="Bold">
              <IconButton size="small" sx={{ color: '#9aa0a6' }}>
                <FormatBoldIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton size="small" sx={{ color: '#9aa0a6' }}>
                <FormatItalicIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Underline">
              <IconButton size="small" sx={{ color: '#9aa0a6' }}>
                <FormatUnderlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Attach file">
              <IconButton size="small" sx={{ color: '#9aa0a6' }}>
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}
    </Box>
  )
}

export default ComposeModal
