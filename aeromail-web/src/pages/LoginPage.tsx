import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Divider,
  Link,
} from '@mui/material'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({
    email: '',
    password: '',
    imapHost: 'mail.aeroverra.com',
    imapPort: '993',
    smtpHost: '',
    smtpPort: '587',
    imapSsl: true,
    smtpSsl: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleToggle = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.post('/auth/login', {
        email: form.email,
        password: form.password,
        imapHost: form.imapHost,
        imapPort: parseInt(form.imapPort),
        smtpHost: form.smtpHost || form.imapHost,
        smtpPort: parseInt(form.smtpPort),
        imapSsl: form.imapSsl,
        smtpSsl: form.smtpSsl,
      })
      const { token } = res.data
      setAuth(token, form.email)
      navigate('/inbox')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr?.response?.data?.message || 'Sign in failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#1f1f1f',
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
          background: '#2d2d2d',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Logo / Wordmark */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #1a73e8 0%, #4fc3f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              AeroMail
            </Typography>
            <Typography variant="body2" sx={{ color: '#9aa0a6', mt: 0.5 }}>
              Sign in to your account
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, background: '#3d1515', color: '#f28b82' }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              required
              autoComplete="email"
              sx={fieldSx}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              required
              autoComplete="current-password"
              sx={fieldSx}
            />

            <Divider sx={{ my: 2, borderColor: '#3d3d3d' }}>
              <Typography variant="caption" sx={{ color: '#6f6f6f' }}>
                IMAP
              </Typography>
            </Divider>

            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
              <TextField
                fullWidth
                label="IMAP Host"
                value={form.imapHost}
                onChange={handleChange('imapHost')}
                sx={fieldSx}
              />
              <TextField
                label="Port"
                value={form.imapPort}
                onChange={handleChange('imapPort')}
                sx={{ ...fieldSx, width: 90, flexShrink: 0 }}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={form.imapSsl}
                  onChange={handleToggle('imapSsl')}
                  sx={switchSx}
                />
              }
              label={<Typography variant="body2" sx={{ color: '#9aa0a6' }}>Use SSL/TLS</Typography>}
              sx={{ mb: 1.5, ml: 0 }}
            />

            <Divider sx={{ my: 2, borderColor: '#3d3d3d' }}>
              <Typography variant="caption" sx={{ color: '#6f6f6f' }}>
                SMTP
              </Typography>
            </Divider>

            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
              <TextField
                fullWidth
                label="SMTP Host"
                placeholder={form.imapHost}
                value={form.smtpHost}
                onChange={handleChange('smtpHost')}
                sx={fieldSx}
              />
              <TextField
                label="Port"
                value={form.smtpPort}
                onChange={handleChange('smtpPort')}
                sx={{ ...fieldSx, width: 90, flexShrink: 0 }}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={form.smtpSsl}
                  onChange={handleToggle('smtpSsl')}
                  sx={switchSx}
                />
              }
              label={<Typography variant="body2" sx={{ color: '#9aa0a6' }}>Use SSL/TLS</Typography>}
              sx={{ mb: 3, ml: 0 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                background: '#1a73e8',
                borderRadius: 6,
                py: 1.5,
                fontSize: '0.95rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { background: '#1557b0' },
                '&.Mui-disabled': { background: '#1a3a5e', color: '#5a7a9a' },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#5a9fd4' }} /> : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Link
                component="button"
                type="button"
                onClick={() => navigate('/setup')}
                underline="hover"
                sx={{
                  color: '#6f6f6f',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  '&:hover': { color: '#9aa0a6' },
                }}
              >
                First time? Set up AeroMail
              </Link>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

const fieldSx = {
  mb: 1.5,
  '& .MuiOutlinedInput-root': {
    color: '#e8eaed',
    '& fieldset': { borderColor: '#3d3d3d' },
    '&:hover fieldset': { borderColor: '#5a5a5a' },
    '&.Mui-focused fieldset': { borderColor: '#1a73e8' },
    background: '#1f1f1f',
    borderRadius: 1.5,
  },
  '& .MuiInputLabel-root': { color: '#9aa0a6' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#1a73e8' },
}

const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: '#1a73e8' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#1a73e8' },
  '& .MuiSwitch-track': { backgroundColor: '#3d3d3d' },
}
