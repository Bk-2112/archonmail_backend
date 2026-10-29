import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Avatar from '@mui/material/Avatar'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'

import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import SettingsIcon from '@mui/icons-material/Settings'
import EditIcon from '@mui/icons-material/Edit'
import InboxIcon from '@mui/icons-material/Inbox'
import StarIcon from '@mui/icons-material/Star'
import ScheduleIcon from '@mui/icons-material/Schedule'
import LabelImportantIcon from '@mui/icons-material/LabelImportant'
import SendIcon from '@mui/icons-material/Send'
import DraftsIcon from '@mui/icons-material/Drafts'
import AllInboxIcon from '@mui/icons-material/AllInbox'
import ReportIcon from '@mui/icons-material/Report'
import DeleteIcon from '@mui/icons-material/Delete'
import LabelIcon from '@mui/icons-material/Label'

import { useAuthStore } from '../store/authStore'
import { useConfigStore } from '../store/configStore'
import ComposeModal from './ComposeModal'

const SIDEBAR_WIDTH = 256

const FOLDERS = [
  { id: 'INBOX', name: 'Inbox', icon: InboxIcon, count: 0 },
  { id: 'Starred', name: 'Starred', icon: StarIcon, count: 0 },
  { id: 'Snoozed', name: 'Snoozed', icon: ScheduleIcon, count: 0 },
  { id: 'Important', name: 'Important', icon: LabelImportantIcon, count: 0 },
  { id: 'Sent', name: 'Sent', icon: SendIcon, count: 0 },
  { id: 'Drafts', name: 'Drafts', icon: DraftsIcon, count: 0 },
  { id: 'All Mail', name: 'All Mail', icon: AllInboxIcon, count: 0 },
  { id: 'Spam', name: 'Spam', icon: ReportIcon, count: 0 },
  { id: 'Trash', name: 'Trash', icon: DeleteIcon, count: 0 },
]

const LABELS = [
  { id: 'work', name: 'Work', color: '#4caf50' },
  { id: 'personal', name: 'Personal', color: '#2196f3' },
  { id: 'finance', name: 'Finance', color: '#ff9800' },
]

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const email = useAuthStore((s) => s.email)
  const appName = useConfigStore((s) => s.appName)
  const primaryColor = useConfigStore((s) => s.primaryColor)
  const logoUrl = useConfigStore((s) => s.logoUrl)

  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeFolder, setActiveFolder] = useState('INBOX')
  const [composeOpen, setComposeOpen] = useState(false)

  // Pre-fill search bar from URL when on /search page
  const urlQuery = location.pathname === '/search' ? (searchParams.get('q') || '') : ''
  const [searchQuery, setSearchQuery] = useState(urlQuery)

  useEffect(() => {
    if (location.pathname === '/search') {
      setSearchQuery(searchParams.get('q') || '')
    } else {
      setSearchQuery('')
    }
  }, [location.pathname, searchParams])

  const userInitial = email ? email.charAt(0).toUpperCase() : '?'

  const handleFolderClick = (folderId: string) => {
    setActiveFolder(folderId)
    setMobileOpen(false)
    navigate('/inbox')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate('/search?q=' + encodeURIComponent(searchQuery.trim()))
    }
  }

  // The FAB teal/blue color — fall back to a solid teal if primaryColor isn't set
  const fabColor = primaryColor || '#0ea5a0'

  // Sidebar content — width: '100%' so it fills whatever container it's in
  // (desktop drawer constrains to SIDEBAR_WIDTH via paper width; mobile drawer is 100vw)
  const sidebarContent = (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: '#1f1f1f',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        pt: 1,
      }}
    >
      {/* Compose FAB — pill shaped, top of sidebar */}
      <Box sx={{ px: 2, pb: 2, pt: 1 }}>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => setComposeOpen(true)}
          sx={{
            bgcolor: fabColor,
            color: '#fff',
            borderRadius: '28px',
            px: 3,
            py: 1.5,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
            '&:hover': {
              bgcolor: fabColor,
              filter: 'brightness(1.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            },
          }}
        >
          Compose
        </Button>
      </Box>

      {/* Folder List */}
      <List disablePadding sx={{ px: 1 }}>
        {FOLDERS.map((folder) => {
          const FolderIcon = folder.icon
          const isActive = activeFolder === folder.id
          return (
            <ListItemButton
              key={folder.id}
              onClick={() => handleFolderClick(folder.id)}
              sx={{
                borderRadius: '0 24px 24px 0',
                mb: 0.5,
                bgcolor: isActive ? 'rgba(138,180,248,0.12)' : 'transparent',
                '&:hover': {
                  bgcolor: isActive
                    ? 'rgba(138,180,248,0.18)'
                    : 'rgba(255,255,255,0.06)',
                },
                pl: 2,
                pr: 2,
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: isActive ? '#8ab4f8' : '#e8eaed' }}>
                <FolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={folder.name}
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#8ab4f8' : '#e8eaed',
                }}
              />
            </ListItemButton>
          )
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', my: 1 }} />

      {/* Labels Section */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Typography
          variant="caption"
          sx={{ color: '#9aa0a6', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}
        >
          Labels
        </Typography>
      </Box>
      <List disablePadding sx={{ px: 1 }}>
        {LABELS.map((label) => (
          <ListItemButton
            key={label.id}
            sx={{
              borderRadius: '0 24px 24px 0',
              mb: 0.5,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              pl: 2,
              pr: 2,
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LabelIcon fontSize="small" sx={{ color: label.color }} />
            </ListItemIcon>
            <ListItemText
              primary={label.name}
              primaryTypographyProps={{ fontSize: '14px', color: '#e8eaed' }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#121212' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          height: 64,
          bgcolor: '#1f1f1f',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Toolbar sx={{ height: 64, minHeight: '64px !important', px: 2 }}>

          {/* Left: hamburger (mobile only) + wordmark */}
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: { xs: 'auto', md: SIDEBAR_WIDTH - 16 } }}>
            {/* Hamburger — only on mobile */}
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { xs: 'flex', md: 'none' },
                color: '#e8eaed',
                mr: 1,
              }}
            >
              <MenuIcon />
            </IconButton>

            {/* Logo / App name */}
            {logoUrl ? (
              <Box
                component="img"
                src={logoUrl}
                alt={appName}
                sx={{ height: 32, maxWidth: 160, objectFit: 'contain' }}
              />
            ) : (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 400,
                  fontSize: '22px',
                  color: '#e8eaed',
                  letterSpacing: '-0.5px',
                  userSelect: 'none',
                }}
              >
                {appName}
              </Typography>
            )}
          </Box>

          {/* Center: search bar — desktop only */}
          <Box
            sx={{
              flex: 1,
              display: { xs: 'none', md: 'flex' },
              justifyContent: 'center',
              px: 2,
            }}
          >
            <Box
              sx={{
                width: '60%',
                bgcolor: '#303134',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                px: 2,
                py: 0.5,
                '&:focus-within': {
                  bgcolor: '#3c4043',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                },
              }}
            >
              <SearchIcon sx={{ color: '#9aa0a6', fontSize: 20, mr: 1.5, flexShrink: 0 }} />
              <InputBase
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                sx={{
                  flex: 1,
                  color: '#e8eaed',
                  fontSize: '14px',
                  '& input::placeholder': { color: '#9aa0a6', opacity: 1 },
                }}
              />
              {searchQuery && (
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ color: '#9aa0a6', p: 0.25 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Spacer on mobile so right icons are pushed to the end */}
          <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />

          {/* Right: search icon (mobile) + settings + avatar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Search icon — mobile only */}
            <IconButton
              onClick={() => navigate('/search')}
              sx={{ display: { xs: 'flex', md: 'none' }, color: '#e8eaed' }}
            >
              <SearchIcon />
            </IconButton>

            <IconButton onClick={() => navigate('/settings')} sx={{ color: '#e8eaed' }}>
              <SettingsIcon />
            </IconButton>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: fabColor,
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {userInitial}
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer — temporary, full width, opens when hamburger is tapped */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: '100%',
            bgcolor: '#1f1f1f',
            border: 'none',
            pt: '64px',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Desktop Permanent Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            bgcolor: '#1f1f1f',
            border: 'none',
            pt: '64px',
            overflowX: 'hidden',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: '64px',
          height: '100vh',
          overflow: 'auto',
          bgcolor: '#121212',
        }}
      >
        {children}
      </Box>

      {/* Compose Modal */}
      {composeOpen && (
        <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
      )}
    </Box>
  )
}
