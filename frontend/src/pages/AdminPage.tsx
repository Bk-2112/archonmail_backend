import React, { useEffect, useState } from 'react'
import {
  Shield,
  Mail,
  Users,
  Plus,
  Trash2,
  Key,
  CheckCircle,
  AlertTriangle,
  Loader2,
  UserCheck,
  Server
} from 'lucide-react'
import apiClient from '../api/client'
import { Mailbox, User as UserType } from '../types'

export default function AdminPage() {
  const [tab, setTab] = useState<'mailboxes' | 'users'>('mailboxes')
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Add mailbox modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedMailboxId, setSelectedMailboxId] = useState('')
  const [selectedRole, setSelectedRole] = useState('owner')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [boxRes, userRes] = await Promise.all([
        apiClient.get('/admin/mailboxes'),
        apiClient.get('/admin/users')
      ])
      setMailboxes(boxRes.data || [])
      setUsers(userRes.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim() || !newPassword.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/admin/mailboxes', {
        email: newEmail.trim(),
        displayName: newDisplayName.trim() || undefined,
        encryptedPassword: newPassword,
        imapHost: '127.0.0.1',
        imapPort: 993,
        imapSsl: true,
        smtpHost: '127.0.0.1',
        smtpPort: 465,
        smtpSsl: true,
        isActive: true
      })
      setSuccessMsg(`Mailbox ${newEmail} created successfully.`)
      setAddModalOpen(false)
      setNewEmail('')
      setNewDisplayName('')
      setNewPassword('')
      fetchData()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create mailbox.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMailbox = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete mailbox ${email}?`)) return

    try {
      await apiClient.delete(`/admin/mailboxes/${id}`)
      setSuccessMsg(`Mailbox ${email} removed.`)
      fetchData()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete mailbox.')
    }
  }

  const handleAssignMailbox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !selectedMailboxId) return

    setSubmitting(true)
    try {
      await apiClient.post('/admin/assign', {
        userId: selectedUserId,
        mailboxId: selectedMailboxId,
        role: selectedRole
      })
      setSuccessMsg('Mailbox access granted.')
      setAssignModalOpen(false)
      fetchData()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign mailbox.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ background: 'rgba(211, 47, 47, 0.15)', padding: '8px', borderRadius: '8px', color: 'var(--accent-red)' }}>
              <Shield size={24} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
              Administration <span style={{ color: 'var(--accent-red)' }}>Control</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Manage organization inboxes, Stalwart loopback routing, and user permissions.
          </p>
        </div>

        {/* Action Button */}
        {tab === 'mailboxes' && (
          <button
            onClick={() => setAddModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'var(--accent-red)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            <span>Add New Mailbox</span>
          </button>
        )}
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid rgba(46, 204, 113, 0.3)', padding: '12px 16px', borderRadius: '8px', color: '#2ecc71', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(231, 76, 60, 0.12)', border: '1px solid rgba(231, 76, 60, 0.3)', padding: '12px 16px', borderRadius: '8px', color: '#ff5252', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(211, 47, 47, 0.1)', padding: '12px', borderRadius: '10px', color: 'var(--accent-red)' }}>
            <Mail size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{mailboxes.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Managed Inboxes</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(52, 152, 219, 0.1)', padding: '12px', borderRadius: '10px', color: '#3498db' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{users.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Registered Accounts</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '12px', borderRadius: '10px', color: '#2ecc71' }}>
            <Server size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>Stalwart</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>IMAP:993 &bull; SMTP:465</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button
          onClick={() => setTab('mailboxes')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'mailboxes' ? '2px solid var(--accent-red)' : '2px solid transparent',
            color: tab === 'mailboxes' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Inboxes & Mailboxes ({mailboxes.length})
        </button>
        <button
          onClick={() => setTab('users')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: tab === 'users' ? '2px solid var(--accent-red)' : '2px solid transparent',
            color: tab === 'users' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Users & Access Control ({users.length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : tab === 'mailboxes' ? (
        /* Mailboxes List */
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0d0d10', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>Email Address</th>
                <th style={{ padding: '14px 20px' }}>Display Name</th>
                <th style={{ padding: '14px 20px' }}>Loopback Routing</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.map((box) => (
                <tr key={box.id} style={{ borderBottom: '1px solid #16161a' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={16} color="var(--accent-red)" />
                      <span>{box.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#ccc' }}>
                    {box.displayName || 'Primary Mailbox'}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    IMAP :{box.imapPort || 993} &bull; SMTP :{box.smtpPort || 465}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                      Active
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteMailbox(box.id, box.email)}
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '6px' }}
                      title="Delete Mailbox"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Users List */
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0d0d10', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>User</th>
                <th style={{ padding: '14px 20px' }}>Email</th>
                <th style={{ padding: '14px 20px' }}>Roles</th>
                <th style={{ padding: '14px 20px' }}>Joined</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.roles?.includes('admin')
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #16161a' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={u.discordAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                          alt={u.discordUsername}
                          style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                        />
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                          {u.discordUsername || u.email.split('@')[0]}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#ccc' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: isAdmin ? 'rgba(211, 47, 47, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: isAdmin ? '#ff5252' : '#aaa',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {isAdmin ? 'ADMINISTRATOR' : 'MEMBER'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedUserId(u.id)
                          setSelectedMailboxId(mailboxes[0]?.id || '')
                          setAssignModalOpen(true)
                        }}
                        style={{
                          background: '#16161a',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <UserCheck size={14} />
                        <span>Assign Mailbox</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Mailbox */}
      {addModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Add New Organization Mailbox</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Provisions a new email address managed by Stalwart and accessible in webmail.
            </p>

            <form onSubmit={handleCreateMailbox} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="support@teamarchon.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d0d0f', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Team Archon Support"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d0d0f', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Mailbox Password (Stalwart)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d0d0f', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  style={{ flex: 1, padding: '10px', background: '#16161a', border: '1px solid var(--border-color)', color: '#ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, padding: '10px', background: 'var(--accent-red)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'Creating...' : 'Create Mailbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Mailbox to User */}
      {assignModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Assign Mailbox Access</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Grant an authorized user permission to read and send from this inbox.
            </p>

            <form onSubmit={handleAssignMailbox} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Select Mailbox
                </label>
                <select
                  value={selectedMailboxId}
                  onChange={(e) => setSelectedMailboxId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d0d0f', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                >
                  {mailboxes.map((b) => (
                    <option key={b.id} value={b.id}>{b.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                  Permission Level
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d0d0f', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="owner">Owner (Read & Send)</option>
                  <option value="member">Member (Read & Send)</option>
                  <option value="read_only">Read Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  style={{ flex: 1, padding: '10px', background: '#16161a', border: '1px solid var(--border-color)', color: '#ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, padding: '10px', background: 'var(--accent-red)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? 'Assigning...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
