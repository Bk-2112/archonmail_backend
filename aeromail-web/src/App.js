import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import InboxPage from './pages/InboxPage';
import SettingsPage from './pages/SettingsPage';
import SearchPage from './pages/SearchPage';
import SetupWizard from './pages/SetupWizard';
import ThreadPage from './pages/ThreadPage';
import Layout from './components/Layout';
import apiClient from './api/client';
import { CircularProgress, Box } from '@mui/material';
// App with setup-status check on load
function AppRouter() {
    const [checkingSetup, setCheckingSetup] = useState(true);
    const [setupRequired, setSetupRequired] = useState(false);
    useEffect(() => {
        apiClient.get('/setup/status')
            .then((res) => {
            if (!res.data.configured) {
                setSetupRequired(true);
            }
        })
            .catch(() => {
            // If endpoint unreachable, don't block app
        })
            .finally(() => setCheckingSetup(false));
    }, []);
    if (checkingSetup) {
        return (_jsx(Box, { sx: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx(CircularProgress, { sx: { color: '#1a73e8' } }) }));
    }
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/setup", element: _jsx(SetupWizard, {}) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/inbox", element: _jsx(Layout, { children: _jsx(InboxPage, {}) }) }), _jsx(Route, { path: "/thread/:id", element: _jsx(Layout, { children: _jsx(ThreadPage, {}) }) }), _jsx(Route, { path: "/search", element: _jsx(Layout, { children: _jsx(SearchPage, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(Layout, { children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "/", element: setupRequired
                    ? _jsx(Navigate, { to: "/setup", replace: true })
                    : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "*", element: setupRequired
                    ? _jsx(Navigate, { to: "/setup", replace: true })
                    : _jsx(Navigate, { to: "/login", replace: true }) })] }));
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsx(AppRouter, {}) }));
}
