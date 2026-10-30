import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, Users, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')

  const handleDiscordLogin = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1433140510125854740'
    const redirectUri = encodeURIComponent(
      import.meta.env.VITE_DISCORD_REDIRECT_URI || `${window.location.origin}/auth/callback`
    )
    const scope = encodeURIComponent('identify email guilds.members.read')
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`

    window.location.href = discordAuthUrl
  }

  const getErrorMessage = () => {
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
          description: 'Your login session has expired. Please authenticate with Discord to continue.'
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

  const errorInfo = getErrorMessage()

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
        padding: '44px 36px',
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
        <div style={{ marginBottom: '20px' }}>
          <img
            src="https://portal.teamarchon.in/favicon.png"
            alt="Team Archon"
            style={{ width: '64px', height: '64px', filter: 'drop-shadow(0 4px 12px rgba(211, 47, 47, 0.4))' }}
          />
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>
          Team Archon <span style={{ color: 'var(--accent-red)' }}>Mail</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
          Enterprise Secure Webmail &bull; teamarchon.in
        </p>

        {/* Error Alert Box if present */}
        {errorInfo && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.12)',
            border: '1px solid rgba(231, 76, 60, 0.35)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff5252', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
              <AlertTriangle size={18} />
              <span>{errorInfo.title}</span>
            </div>
            <p style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.4, margin: '0 0 10px 0' }}>
              {errorInfo.description}
            </p>
            {errorInfo.actionUrl && (
              <a
                href={errorInfo.actionUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ff8a80',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {errorInfo.actionText} <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        {/* Requirements Box */}
        <div style={{
          background: '#0e0e11',
          border: '1px solid #1e1e24',
          borderRadius: 'var(--border-radius-sm)',
          padding: '16px',
          marginBottom: '28px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 700, marginBottom: '10px' }}>
            Access Requirements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#e0e0e0' }}>
              <Users size={16} color="var(--accent-red)" />
              <span>Team Archon Discord Member</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#e0e0e0' }}>
              <ShieldCheck size={16} color="#4caf50" />
              <span>Verified Mail Access Role</span>
            </div>
          </div>
        </div>

        {/* Discord OAuth2 Button */}
        <button
          onClick={handleDiscordLogin}
          className="discord-btn"
          id="btn-discord-login"
        >
          {/* Discord SVG Logo */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          <span>Sign In with Discord</span>
        </button>

        {/* Footer info */}
        <div style={{ marginTop: '28px', color: '#555', fontSize: '11px', letterSpacing: '0.5px' }}>
          Protected by Discord Server Gate &bull; Stalwart IMAP/SMTP
        </div>
      </div>
    </div>
  )
}
