import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Checkbox,
  Avatar,
  IconButton,
  Skeleton,
  Tooltip,
  Button,
  Chip,
} from '@mui/material'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import StarIcon from '@mui/icons-material/Star'
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox'
import DeleteIcon from '@mui/icons-material/Delete'
import SnoozeIcon from '@mui/icons-material/Snooze'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import CloseIcon from '@mui/icons-material/Close'
import apiClient from '../api/client'
import { getAvatarColor } from '../utils/avatarColor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  uid: number
  from: string
  fromName?: string
  subject: string
  snippet: string
  date: string
  read: boolean
  starred?: boolean
  folder?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getSenderInitial(fromName: string | undefined, from: string): string {
  const name = fromName || from
  return name.charAt(0).toUpperCase()
}

function getSenderDisplay(fromName: string | undefined, from: string): string {
  return fromName || from.replace(/<.*>/, '').trim() || from
}

// ─── Highlight matching terms ─────────────────────────────────────────────────

interface HighlightedTextProps {
  text: string
  query: string
}

function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query.trim() || !text) {
    return <span>{text}</span>
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              backgroundColor: 'rgba(138,180,248,0.3)',
              color: '#e8eaed',
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

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

// ─── Email Row ────────────────────────────────────────────────────────────────

interface EmailRowProps {
  message: Message
  query: string
  onNavigate: (uid: number) => void
  onStar: (uid: number) => void
  onArchive: (uid: number) => void
  onDelete: (uid: number) => void
}

function EmailRow({ message, query, onNavigate, onStar, onArchive, onDelete }: EmailRowProps) {
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
        background: message.read
          ? hovered ? 'rgba(255,255,255,0.04)' : 'transparent'
          : hovered ? 'rgba(26,41,66,0.6)' : 'rgba(26,41,66,0.4)',
        transition: 'background 0.15s',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Checkbox */}
      <Box
        sx={{ width: 24, flexShrink: 0, visibility: hovered || checked ? 'visible' : 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          size="small"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          sx={{ p: 0, color: '#9aa0a6', '&.Mui-checked': { color: '#1a73e8' } }}
        />
      </Box>

      {/* Star */}
      <Box onClick={(e) => { e.stopPropagation(); onStar(message.uid) }} sx={{ flexShrink: 0 }}>
        {message.starred ? (
          <StarIcon sx={{ fontSize: 18, color: '#f6c142', cursor: 'pointer' }} />
        ) : (
          <StarBorderIcon
            sx={{ fontSize: 18, color: hovered ? '#9aa0a6' : 'transparent', cursor: 'pointer', transition: 'color 0.15s' }}
          />
        )}
      </Box>

      {/* Avatar */}
      <Avatar
        sx={{ width: 36, height: 36, bgcolor: avatarBg, fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}
      >
        {initial}
      </Avatar>

      {/* Sender */}
      <Typography
        sx={{
          width: 160,
          flexShrink: 0,
          fontSize: '0.875rem',
          fontWeight: message.read ? 400 : 700,
          color: message.read ? '#9aa0a6' : '#e8eaed',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <HighlightedText text={senderLabel} query={query} />
      </Typography>

      {/* Subject + Snippet */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 0.5, overflow: 'hidden' }}>
        <Typography
          component="span"
          sx={{
            fontSize: '0.875rem',
            fontWeight: message.read ? 400 : 700,
            color: '#e8eaed',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            maxWidth: '40%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-block',
          }}
        >
          <HighlightedText text={message.subject || '(no subject)'} query={query} />
        </Typography>
        <Typography
          component="span"
          sx={{
            fontSize: '0.875rem',
            color: '#9aa0a6',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-block',
          }}
        >
          &nbsp;·&nbsp;<HighlightedText text={message.snippet} query={query} />
        </Typography>
      </Box>

      {/* Action icons OR timestamp */}
      {hovered ? (
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Archive">
            <IconButton size="small" onClick={() => onArchive(message.uid)} sx={{ color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }}>
              <MoveToInboxIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => onDelete(message.uid)} sx={{ color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Snooze">
            <IconButton size="small" sx={{ color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }}>
              <SnoozeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: message.read ? '#9aa0a6' : '#e8eaed',
            fontWeight: message.read ? 400 : 600,
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

// ─── Search Page ──────────────────────────────────────────────────────────────

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setMessages([])

    apiClient
      .get('/search', { params: { q: query, limit: 50 } })
      .then((r) => setMessages(r.data.messages ?? r.data ?? []))
      .catch((err: unknown) => {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setError(axiosErr?.response?.data?.message || 'Search failed.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    runSearch(q)
  }, [q, runSearch])

  const handleNavigate = (uid: number) => {
    // Pass current search query as 'from' so thread back button returns here
    navigate(`/thread/${uid}?from=${encodeURIComponent(`/search?q=${encodeURIComponent(q)}`)}`)
  }

  const handleClearSearch = () => {
    setSearchParams({})
    navigate('/inbox')
  }

  const handleStar = (uid: number) => {
    setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, starred: !m.starred } : m)))
  }

  const handleArchive = (uid: number) => {
    setMessages((prev) => prev.filter((m) => m.uid !== uid))
  }

  const handleDelete = (uid: number) => {
    setMessages((prev) => prev.filter((m) => m.uid !== uid))
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#1f1f1f' }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #2d2d2d',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: title + result count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#e8eaed',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Search results for{' '}
            <Box component="span" sx={{ color: '#8ab4f8' }}>
              "{q}"
            </Box>
          </Typography>

          {!loading && !error && q && (
            <Chip
              label={`${messages.length} result${messages.length !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                bgcolor: 'rgba(138,180,248,0.12)',
                color: '#8ab4f8',
                fontSize: '0.75rem',
                height: 24,
                flexShrink: 0,
              }}
            />
          )}
        </Box>

        {/* Right: Clear search button */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<CloseIcon fontSize="small" />}
          onClick={handleClearSearch}
          sx={{
            color: '#9aa0a6',
            borderColor: '#5f6368',
            textTransform: 'none',
            borderRadius: '20px',
            fontSize: '0.8125rem',
            flexShrink: 0,
            '&:hover': {
              borderColor: '#9aa0a6',
              color: '#e8eaed',
              background: 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Clear search
        </Button>
      </Box>

      {/* Results */}
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <EmailRowSkeleton key={i} />)
        ) : error ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#f28b82' }}>{error}</Typography>
          </Box>
        ) : !q.trim() ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2 }}>
            <Typography sx={{ color: '#9aa0a6', fontSize: '1rem' }}>
              Enter a search term in the search bar above
            </Typography>
          </Box>
        ) : messages.length === 0 ? (
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
            <SearchOffIcon sx={{ fontSize: 72, color: '#3d3d3d' }} />
            <Typography sx={{ color: '#9aa0a6', fontSize: '1rem' }}>
              No results for "{q}"
            </Typography>
            <Button
              variant="text"
              onClick={handleClearSearch}
              sx={{ color: '#8ab4f8', textTransform: 'none' }}
            >
              Clear search
            </Button>
          </Box>
        ) : (
          messages.map((message) => (
            <EmailRow
              key={message.uid}
              message={message}
              query={q}
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
