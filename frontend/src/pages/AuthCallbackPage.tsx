import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [statusText, setStatusText] = useState('Verifying Discord credentials...')
  const exchangedRef = useRef(false)

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      navigate('/login?error=oauth_failed', { replace: true })
      return
    }

    if (exchangedRef.current) return
    exchangedRef.current = true

    const redirectUri = window.location.origin + '/auth/callback'

    setStatusText('Checking Team Archon Discord Server & Role Gate...')

    apiClient.post('/auth/discord', { code, redirectUri })
      .then((res) => {
        const { token, user, mailboxes } = res.data
        setAuth(token, user, mailboxes || [])
        setStatusText('Access Granted. Entering mailbox...')
        setTimeout(() => {
          navigate('/inbox', { replace: true })
        }, 500)
      })
      .catch((err) => {
        const errorCode = err.response?.data?.code || 'oauth_failed'
        navigate(`/login?error=${errorCode}`, { replace: true })
      })
  }, [searchParams, navigate, setAuth])

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dark)',
      backgroundImage: 'radial-gradient(circle at center, rgba(211, 47, 47, 0.12) 0%, #070707 55%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        padding: '40px 32px',
        textAlign: 'center',
        maxWidth: '380px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <Loader2 size={36} color="var(--accent-red)" style={{ animation: 'spin 1s linear infinite' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Authenticating</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          {statusText}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
