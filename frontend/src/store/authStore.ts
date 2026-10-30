import { create } from 'zustand'
import { UserRecord, MailboxRecord } from '../types'

interface AuthState {
  token: string | null
  user: UserRecord | null
  mailboxes: MailboxRecord[]
  activeMailboxId: string | null
  setAuth: (token: string, user: UserRecord, mailboxes: MailboxRecord[]) => void
  setMailboxes: (mailboxes: MailboxRecord[]) => void
  setActiveMailbox: (mailboxId: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('archon_mail_token'),
  user: localStorage.getItem('archon_mail_user')
    ? JSON.parse(localStorage.getItem('archon_mail_user')!)
    : null,
  mailboxes: [],
  activeMailboxId: null,

  setAuth: (token, user, mailboxes) => {
    localStorage.setItem('archon_mail_token', token)
    localStorage.setItem('archon_mail_user', JSON.stringify(user))
    const firstMailboxId = mailboxes.length > 0 ? mailboxes[0].id : null
    set({
      token,
      user,
      mailboxes,
      activeMailboxId: firstMailboxId
    })
  },

  setMailboxes: (mailboxes) => {
    set((state) => ({
      mailboxes,
      activeMailboxId: state.activeMailboxId || (mailboxes.length > 0 ? mailboxes[0].id : null)
    }))
  },

  setActiveMailbox: (mailboxId) => {
    set({ activeMailboxId: mailboxId })
  },

  logout: () => {
    localStorage.removeItem('archon_mail_token')
    localStorage.removeItem('archon_mail_user')
    set({ token: null, user: null, mailboxes: [], activeMailboxId: null })
  }
}))
