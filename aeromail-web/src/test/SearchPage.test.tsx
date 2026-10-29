import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  default: { get: mockGet },
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: { token: string; email: string }) => unknown) =>
    selector({ token: 'mock-token', email: 'test@test.com' }),
}))

import SearchPage from '../pages/SearchPage'

const mockResults = [
  {
    uid: 10,
    from: 'alice@example.com',
    fromName: 'Alice Smith',
    subject: 'Invoice for services',
    snippet: 'Please find the invoice attached.',
    date: new Date().toISOString(),
    read: false,
    starred: false,
  },
  {
    uid: 11,
    from: 'bob@example.com',
    fromName: 'Bob Jones',
    subject: 'Re: Invoice discussion',
    snippet: 'Let me review the invoice...',
    date: new Date().toISOString(),
    read: true,
    starred: false,
  },
]

function renderSearchPage(query: string = 'invoice') {
  return render(
    <MemoryRouter initialEntries={[`/search?q=${encodeURIComponent(query)}`]}>
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SearchPage', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({ data: { messages: mockResults } })
  })

  it('calls the search API with the query param', async () => {
    renderSearchPage('invoice')
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/search', expect.objectContaining({
        params: expect.objectContaining({ q: 'invoice' }),
      }))
    })
  })

  it('renders search results when API returns messages', async () => {
    renderSearchPage('invoice')
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('shows empty state when API returns no results', async () => {
    mockGet.mockResolvedValue({ data: { messages: [] } })
    renderSearchPage('zzznothing')
    await waitFor(() => {
      // SearchPage renders: No results for "zzznothing"
      expect(screen.getByText(/no results/i)).toBeInTheDocument()
    })
  })

  it('shows result subjects (highlighted term search)', async () => {
    renderSearchPage('invoice')
    await waitFor(() => {
      // The SearchPage highlights matching terms so text may be split across elements
      // Use getAllByText with regex or check for partial text
      expect(screen.getAllByText(/invoice/i).length).toBeGreaterThan(0)
    })
  })
})
