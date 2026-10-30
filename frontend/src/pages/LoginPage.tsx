import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, Users, AlertTriangle, ExternalLink, Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const errorParam = searchParams.get('error')

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDiscordLogin = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1433140510125854740'
    const redirectUri = encodeURIComponent(
      import.meta.env.VITE_DISCORD_REDIRECT_URI || `${window.location.origin}/auth/callback`
    )
    const scope = encodeURIComponent('identify email guilds.members.read')
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`

    window.location.href = discordAuthUrl
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      if (mode === 'login') {
        const res = await apiClient.post('/auth/login', {
          email: email.trim(),
          password
        })
        const { token, user, mailboxes } = res.data
        setAuth(token, user, mailboxes || [])
        navigate('/inbox', { replace: true })
      } else {
        const res = await apiClient.post('/auth/register', {
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined
        })
        const { token, user, mailboxes } = res.data
        setAuth(token, user, mailboxes || [])
        navigate('/inbox', { replace: true })
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Authentication failed. Please check your credentials.'
      )
    } finally {
      setLoading(false)
    }
  }

  const getDiscordErrorMessage = () => {
    switch (errorParam) {
      case 'not_in_guild':
        return {
          title: 'Server Membership Required',
          description: 'You must be a member of the official Team Archon Discord Server to access webmail.',
          actionUrl: 'https://discord.gg/teamarchon',
          actionText: 'Join Team Archon Discord'
        }
      case 'missing_role':
        return {
          title: 'Access Role Required',
          description: 'Your Discord account is in the server, but does not hold the required Team Archon mail access role.',
          actionUrl: 'https://discord.gg/teamarchon',
          actionText: 'Request Role in Discord'
        }
      case 'session_expired':
        return {
          title: 'Session Expired',
          description: 'Your login session has expired. Please authenticate to continue.'
        }
      case 'oauth_failed':
        return {
          title: 'Authentication Failed',
          description: 'Discord rejected the authorization request or the code expired. Please try again.'
        }
      default:
        return null
    }
  }

  const discordErrorInfo = getDiscordErrorMessage()

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dark)',
      backgroundImage: 'radial-gradient(circle at center, rgba(211, 47, 47, 0.14) 0%, #070707 55%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '38px 32px',
        textAlign: 'center',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
        border: '1px solid var(--border-color)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Top glowing red accent bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, transparent 0%, var(--accent-red) 50%, transparent 100%)'
        }} />

        {/* Archon Logo */}
        <div style={{ marginBottom: '16px' }}>
          <img
            src="https://portal.teamarchon.in/favicon.png"
            alt="Team Archon"
            style={{ width: '56px', height: '56px', filter: 'drop-shadow(0 4px 12px rgba(211, 47, 47, 0.4))' }}
          />
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '26px', marginBottom: '6px' }}>
          Team Archon <span style={{ color: 'var(--accent-red)' }}>Mail</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Enterprise Secure Webmail &bull; teamarchon.in
        </p>

        {/* Discord OAuth Error Alert Box */}
        {discordErrorInfo && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.12)',
            border: '1px solid rgba(231, 76, 60, 0.35)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '14px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff5252', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
              <AlertTriangle size={16} />
              <span>{discordErrorInfo.title}</span>
            </div>
            <p style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.4, margin: '0 0 8px 0' }}>
              {discordErrorInfo.description}
            </p>
            {discordErrorInfo.actionUrl && (
              <a
                href={discordErrorInfo.actionUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ff8a80',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                {discordErrorInfo.actionText} <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {/* Form Error Alert */}
        {errorMessage && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.12)',
            border: '1px solid rgba(231, 76, 60, 0.35)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '12px',
            marginBottom: '18px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#ff5252',
            fontSize: '13px'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Email / Password Form */}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left', marginBottom: '22px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Display Name (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    background: '#0d0d0f',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                type="email"
                required
                placeholder="name@teamarchon.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 38px',
                  background: '#0d0d0f',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 38px',
                  background: '#0d0d0f',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '4px',
              padding: '12px',
              background: 'linear-gradient(135deg, var(--accent-red) 0%, #b71c1c 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In with Password' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ marginBottom: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <span>
              Don't have a password yet?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMessage(null) }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Create Account
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMessage(null) }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign In
              </button>
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          color: '#444',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>

        {/* Discord OAuth2 Button */}
        <button
          onClick={handleDiscordLogin}
          className="discord-btn"
          id="btn-discord-login"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          <span>Continue with Discord</span>
        </button>

        {/* Footer info */}
        <div style={{ marginTop: '24px', color: '#555', fontSize: '11px', letterSpacing: '0.5px' }}>
          Team Archon Mail &bull; Hashed Credentials &bull; TLS Protected
        </div>
      </div>
    </div>
  )
}
