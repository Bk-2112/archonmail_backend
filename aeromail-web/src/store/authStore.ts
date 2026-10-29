import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MailboxSummary {
  id: string
  email: string
  displayName?: string
  role: string
  isApproved: boolean
  color?: string
}

export interface UserProfile {
  id: string
  email: string
  displayName?: string
  role: string
  isApproved: boolean
  mailboxes: MailboxSummary[]
}

interface AuthState {
  token: string | null
  email: string | null
  userId: string | null
  activeMailboxId: string | null
  isApproved: boolean
  mailboxes: MailboxSummary[]
  setAuth: (token: string, email: string, userId?: string) => void
  setActiveMailboxId: (id: string | null) => void
  setMailboxes: (mailboxes: MailboxSummary[]) => void
  setIsApproved: (approved: boolean) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      userId: null,
      activeMailboxId: null,
      isApproved: true,
      mailboxes: [],
      setAuth: (token, email, userId) => set({ token, email, userId: userId || null }),
      setActiveMailboxId: (id) => set({ activeMailboxId: id }),
      setMailboxes: (mailboxes) => {
        set({ mailboxes })
        // Default active mailbox to first approved mailbox if not yet set
        const currentActive = get().activeMailboxId
        if ((!currentActive || !mailboxes.some(m => m.id === currentActive)) && mailboxes.length > 0) {
          const firstApproved = mailboxes.find(m => m.isApproved) || mailboxes[0]
          set({ activeMailboxId: firstApproved.id })
        }
      },
      setIsApproved: (approved) => set({ isApproved: approved }),
      clearAuth: () => set({
        token: null,
        email: null,
        userId: null,
        activeMailboxId: null,
        mailboxes: [],
        isApproved: false
      }),
      isAuthenticated: () => get().token !== null,
    }),
    {
      name: 'teamarchon-mail-auth',
    }
  )
)
