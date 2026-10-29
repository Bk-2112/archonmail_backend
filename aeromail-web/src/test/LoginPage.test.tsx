import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'

// Mock axios client used by LoginPage
vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}))

// Mock zustand auth store
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: { setAuth: () => void }) => unknown) =>
    selector({ setAuth: vi.fn() }),
}))

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  it('renders the login form', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows an email input', () => {
    renderLoginPage()
    // MUI TextField uses label as accessible name
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('shows a password input', () => {
    renderLoginPage()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows the AeroMail wordmark', () => {
    renderLoginPage()
    expect(screen.getByText('AeroMail')).toBeInTheDocument()
  })

  it('shows Sign In button text when not loading', () => {
    renderLoginPage()
    const btn = screen.getByRole('button', { name: /sign in/i })
    expect(btn).toHaveTextContent('Sign In')
  })
})
