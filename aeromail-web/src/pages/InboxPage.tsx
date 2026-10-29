import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Checkbox,
  Avatar,
  Typography,
  IconButton,
  Skeleton,
  Tooltip,
} from '@mui/material'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import StarIcon from '@mui/icons-material/Star'
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox'
import DeleteIcon from '@mui/icons-material/Delete'
import SnoozeIcon from '@mui/icons-material/Snooze'
import InboxIcon from '@mui/icons-material/Inbox'
import apiClient from '../api/client'
import { getAvatarColor } from '../utils/avatarColor'

interface Message {
  uid: number
  from: string
  fromName?: string
  subject: string
  snippet: string
  date: string
  isRead: boolean
  isStarred?: boolean
  folder?: string
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getSenderInitial(fromName: string | undefined, from: string): string {
  const name = fromName || from
  return name.charAt(0).toUpperCase()
}

function getSenderDisplay(fromName: string | undefined, from: string): string {
  return fromName || from.replace(/<.*>/, '').trim() || from
}

function EmailRowSkeleton() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        px: 2,
        gap: 2,
        borderBottom: '1px solid #2d2d2d',
      }}
    >
      <Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: '#333', flexShrink: 0 }} />
      <Skeleton variant="text" width={100} sx={{ bgcolor: '#333' }} />
      <Skeleton variant="text" sx={{ bgcolor: '#333', flex: 1 }} />
      <Skeleton variant="text" width={50} sx={{ bgcolor: '#333' }} />
    </Box>
  )
}

interface EmailRowProps {
  message: Message
  onNavigate: (uid: number) => void
  onStar: (uid: number) => void
  onArchive: (uid: number) => void
  onDelete: (uid: number) => void
}

function EmailRow({ message, onNavigate, onStar, onArchive, onDelete }: EmailRowProps) {
  const [hovered, setHovered] = useState(false)
  const [checked, setChecked] = useState(false)

  const senderLabel = getSenderDisplay(message.fromName, message.from)
  const initial = getSenderInitial(message.fromName, message.from)
  const avatarBg = getAvatarColor(senderLabel)

  return (
    <Box
      onClick={() => onNavigate(message.uid)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        px: 2,
        gap: 1.5,
        cursor: 'pointer',
        borderBottom: '1px solid #2d2d2d',
        background: message.isRead
          ? hovered
            ? 'rgba(255,255,255,0.04)'
            : 'transparent'
          : hovered
          ? 'rgba(26,41,66,0.6)'
          : 'rgba(26,41,66,0.4)',
        transition: 'background 0.15s',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Checkbox — visible on hover */}
      <Box
        sx={{ width: 24, flexShrink: 0, visibility: hovered || checked ? 'visible' : 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          size="small"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          sx={{
            p: 0,
            color: '#9aa0a6',
            '&.Mui-checked': { color: '#1a73e8' },
          }}
        />
      </Box>

      {/* Star */}
      <Box onClick={(e) => { e.stopPropagation(); onStar(message.uid) }} sx={{ flexShrink: 0 }}>
        {message.isStarred ? (
          <StarIcon sx={{ fontSize: 18, color: '#f6c142', cursor: 'pointer' }} />
        ) : (
          <StarBorderIcon
            sx={{
              fontSize: 18,
              color: hovered ? '#9aa0a6' : 'transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          />
        )}
      </Box>

      {/* Avatar */}
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: avatarBg,
          fontSize: '0.875rem',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initial}
      </Avatar>

      {/* Sender */}
      <Typography
        sx={{
          width: 160,
          flexShrink: 0,
          fontSize: '0.875rem',
          fontWeight: message.isRead ? 400 : 700,
          color: message.isRead ? '#9aa0a6' : '#e8eaed',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {senderLabel}
      </Typography>

      {/* Subject + Snippet */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 0.5, overflow: 'hidden' }}>
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: message.isRead ? 400 : 700,
            color: '#e8eaed',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            maxWidth: '40%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {message.subject || '(no subject)'}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.875rem',
            color: '#9aa0a6',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          · {message.snippet}
        </Typography>
      </Box>

      {/* Action icons OR timestamp */}
      {hovered ? (
        <Box
          sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="Archive">
            <IconButton
              size="small"
              onClick={() => onArchive(message.uid)}
              sx={{ color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }}
            >
              <MoveToInboxIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => onDelete(message.uid)}
              sx={{ color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Snooze">
            <IconButton
              size="small"
              sx={{ color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }}
            >
              <SnoozeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: message.isRead ? '#9aa0a6' : '#e8eaed',
            fontWeight: message.isRead ? 400 : 600,
            flexShrink: 0,
            minWidth: 56,
            textAlign: 'right',
          }}
        >
          {formatTimestamp(message.date)}
        </Typography>
      )}
    </Box>
  )
}

export default function InboxPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await apiClient.get('/messages', {
          params: { folder: 'INBOX', limit: 50 },
        })
        setMessages(res.data.messages ?? res.data)
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr?.response?.data?.message || 'Failed to load messages.')
      } finally {
        setLoading(false)
      }
    }
    fetchMessages()
  }, [])

  const handleNavigate = (uid: number) => {
    navigate(`/thread/${uid}?folder=INBOX`)
  }

  const handleStar = (uid: number) => {
    setMessages((prev) =>
      prev.map((m) => (m.uid === uid ? { ...m, isStarred: !m.isStarred } : m))
    )
  }

  const handleArchive = (uid: number) => {
    setMessages((prev) => prev.filter((m) => m.uid !== uid))
  }

  const handleDelete = (uid: number) => {
    setMessages((prev) => prev.filter((m) => m.uid !== uid))
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#1f1f1f' }}>
      {/* Toolbar */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #2d2d2d',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography
          sx={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#e8eaed',
            letterSpacing: '-0.25px',
          }}
        >
          Inbox
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {loading ? (
          // Skeleton loading state
          Array.from({ length: 5 }).map((_, i) => <EmailRowSkeleton key={i} />)
        ) : error ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#f28b82' }}>{error}</Typography>
          </Box>
        ) : messages.length === 0 ? (
          // Empty state
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 12,
              gap: 2,
            }}
          >
            <InboxIcon sx={{ fontSize: 72, color: '#3d3d3d' }} />
            <Typography sx={{ color: '#9aa0a6', fontSize: '1rem' }}>
              Your inbox is empty
            </Typography>
          </Box>
        ) : (
          messages.map((message) => (
            <EmailRow
              key={message.uid}
              message={message}
              onNavigate={handleNavigate}
              onStar={handleStar}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
