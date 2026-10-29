import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// Use vi.hoisted so the mock fn is available when vi.mock factory runs
const mockGet = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({
    default: {
        get: mockGet,
    },
}));
// Mock zustand auth store
vi.mock('../store/authStore', () => ({
    useAuthStore: (selector) => selector({ token: 'mock-token', email: 'test@test.com' }),
}));
import InboxPage from '../pages/InboxPage';
const mockMessages = [
    {
        uid: 1,
        from: 'alice@example.com',
        fromName: 'Alice Smith',
        subject: 'Hello from Alice',
        snippet: 'Hey there, just checking in...',
        date: new Date().toISOString(),
        isRead: false,
        isStarred: false,
    },
    {
        uid: 2,
        from: 'bob@example.com',
        fromName: 'Bob Jones',
        subject: 'Meeting tomorrow',
        snippet: 'Can we reschedule?',
        date: new Date().toISOString(),
        isRead: true,
        isStarred: false,
    },
    {
        uid: 3,
        from: 'carol@example.com',
        fromName: 'Carol White',
        subject: 'Invoice attached',
        snippet: 'Please find attached...',
        date: new Date().toISOString(),
        isRead: false,
        isStarred: true,
    },
];
function renderInboxPage() {
    return render(_jsx(MemoryRouter, { children: _jsx(InboxPage, {}) }));
}
describe('InboxPage', () => {
    beforeEach(() => {
        mockGet.mockResolvedValue({ data: { messages: mockMessages } });
    });
    it('renders 3 email rows after loading', async () => {
        renderInboxPage();
        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });
        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
        expect(screen.getByText('Carol White')).toBeInTheDocument();
    });
    it('shows each sender name', async () => {
        renderInboxPage();
        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });
        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
        expect(screen.getByText('Carol White')).toBeInTheDocument();
    });
    it('unread rows have bold font weight on sender name', async () => {
        renderInboxPage();
        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });
        // Alice (uid=1, isRead=false) and Carol (uid=3, isRead=false) are unread → fontWeight 700
        // Bob (uid=2, isRead=true) is read → fontWeight 400
        const aliceName = screen.getByText('Alice Smith');
        const carolName = screen.getByText('Carol White');
        const bobName = screen.getByText('Bob Jones');
        expect(aliceName).toHaveStyle({ fontWeight: '700' });
        expect(carolName).toHaveStyle({ fontWeight: '700' });
        expect(bobName).toHaveStyle({ fontWeight: '400' });
    });
    it('calls apiClient.get with /messages endpoint', async () => {
        renderInboxPage();
        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith('/messages', expect.objectContaining({
                params: expect.objectContaining({ folder: 'INBOX' }),
            }));
        });
    });
});
