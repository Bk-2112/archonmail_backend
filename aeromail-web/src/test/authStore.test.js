import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
/**
 * Tests for the Zustand authStore.
 * Tests run against the real store (not mocked) to verify state transitions.
 */
describe('authStore', () => {
    beforeEach(() => {
        // Reset store state between tests
        useAuthStore.setState({ token: null, email: null });
    });
    it('starts with null token and email', () => {
        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.email).toBeNull();
    });
    it('setAuth stores token and email', () => {
        const { setAuth } = useAuthStore.getState();
        setAuth('test-jwt-token', 'user@example.com');
        const state = useAuthStore.getState();
        expect(state.token).toBe('test-jwt-token');
        expect(state.email).toBe('user@example.com');
    });
    it('isAuthenticated returns false initially', () => {
        const { isAuthenticated } = useAuthStore.getState();
        expect(isAuthenticated()).toBe(false);
    });
    it('isAuthenticated returns true after setAuth', () => {
        const { setAuth, isAuthenticated } = useAuthStore.getState();
        setAuth('my-token', 'test@test.com');
        expect(isAuthenticated()).toBe(true);
    });
    it('clearAuth resets token and email to null', () => {
        const { setAuth, clearAuth } = useAuthStore.getState();
        setAuth('some-token', 'user@test.com');
        clearAuth();
        const state = useAuthStore.getState();
        expect(state.token).toBeNull();
        expect(state.email).toBeNull();
    });
    it('isAuthenticated returns false after clearAuth', () => {
        const { setAuth, clearAuth, isAuthenticated } = useAuthStore.getState();
        setAuth('some-token', 'user@test.com');
        clearAuth();
        expect(isAuthenticated()).toBe(false);
    });
    it('setAuth with different values updates state correctly', () => {
        const { setAuth } = useAuthStore.getState();
        setAuth('token-1', 'alice@test.com');
        setAuth('token-2', 'bob@test.com');
        const state = useAuthStore.getState();
        expect(state.token).toBe('token-2');
        expect(state.email).toBe('bob@test.com');
    });
});
