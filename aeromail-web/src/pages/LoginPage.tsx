import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Chip,
} from '@mui/material'
import apiClient from '../api/client'
import { supabase } from '../api/supabase'
import { useAuthStore, type UserProfile } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setMailboxes = useAuthStore((s) => s.setMailboxes)
  const setIsApproved = useAuthStore((s) => s.setIsApproved)

  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    if (tab === 'signup') {
      try {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpErr) {
          setError(signUpErr.message)
        } else {
          setSuccessMsg('Account registered successfully! An administrator will approve your mailbox access.')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Registration failed.'
        setError(msg)
      } finally {
        setLoading(false)
      }
      return
    }

    // Sign In Flow
    try {
      let token: string | null = null
      let userEmail = email
      let userId: string | undefined

      // Attempt Supabase Auth first
      try {
        const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (!supaErr && supaData?.session) {
          token = supaData.session.access_token
          userEmail = supaData.user?.email || email
          userId = supaData.user?.id
        }
      } catch {
        // Supabase client might not have valid network endpoint in mock environment
      }

      // Fallback to backend API login if Supabase auth was not completed
      if (!token) {
        const res = await apiClient.post('/auth/login', {
          email,
          password,
          imapHost: '127.0.0.1',
          imapPort: 993,
          imapSsl: true,
          smtpHost: '127.0.0.1',
          smtpPort: 587,
          smtpSsl: false,
        })
        token = res.data.token
        userEmail = res.data.email || email
        userId = res.data.user?.id
      }

      if (token) {
        setAuth(token, userEmail, userId)

        // Fetch user profile and assigned mailboxes
        try {
          const profileRes = await apiClient.get<UserProfile>('/mailboxes/profile', {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (profileRes.data) {
            setIsApproved(profileRes.data.isApproved)
            if (profileRes.data.mailboxes?.length > 0) {
              setMailboxes(profileRes.data.mailboxes)
            }
          }
        } catch {
          // If profile fetch fails, proceed with default approved status
        }

        navigate('/inbox')
      } else {
        setError('Sign in failed. Check your credentials.')
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; error?: string } } }
      setError(axiosErr?.response?.data?.error || axiosErr?.response?.data?.message || 'Sign in failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #090d16 0%, #111827 50%, #0d1527 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(23, 30, 48, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 4,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Header & Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Team Archon Mail
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
              Enterprise Secure Webmail &middot; <span style={{ opacity: 0.7 }}>AeroMail</span>
            </Typography>
            <Chip
              label="teamarchon.in"
              size="small"
              sx={{
                mt: 1.5,
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                fontWeight: 600,
                fontSize: '0.75rem',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            />
          </Box>

          {/* Sign In vs Sign Up Tabs */}
          <Tabs
            value={tab}
            onChange={(_, val) => {
              setTab(val)
              setError(null)
              setSuccessMsg(null)
            }}
            variant="fullWidth"
            sx={{
              mb: 3,
              '& .MuiTabs-indicator': { backgroundColor: '#38bdf8' },
              '& .MuiTab-root': { color: '#94a3b8', fontWeight: 600 },
              '& .Mui-selected': { color: '#38bdf8' },
            }}
          >
            <Tab label="Sign In" value="signin" />
            <Tab label="Create Account" value="signup" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              {successMsg}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              placeholder="user@teamarchon.in"
              autoComplete="email"
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  borderRadius: 2,
                  background: 'rgba(15, 23, 42, 0.6)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                  '&:hover fieldset': { borderColor: '#38bdf8' },
                  '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                },
                '& .MuiInputLabel-root': { color: '#94a3b8' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#38bdf8' },
              }}
            />

            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  borderRadius: 2,
                  background: 'rgba(15, 23, 42, 0.6)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                  '&:hover fieldset': { borderColor: '#38bdf8' },
                  '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                },
                '& .MuiInputLabel-root': { color: '#94a3b8' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#38bdf8' },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #0369a1 100%)',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: '#fff' }} />
              ) : tab === 'signin' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Protected by Supabase Auth &middot; TLS Encrypted IMAP/SMTP
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
