import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, TextField, Button, Switch, FormControlLabel, ToggleButtonGroup, ToggleButton, IconButton, Select, MenuItem, FormControl, InputLabel, Divider, CircularProgress, Tooltip, Skeleton, } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
// ─── Color Palette for Labels ─────────────────────────────────────────────────
const LABEL_COLORS = ['#ea4335', '#fbbc04', '#34a853', '#4285f4', '#ab47bc', '#ff7043'];
// ─── General Tab ──────────────────────────────────────────────────────────────
function GeneralTab() {
    const [displayName, setDisplayName] = useState(() => localStorage.getItem('aeromail_displayName') || '');
    const [signature, setSignature] = useState(() => localStorage.getItem('aeromail_signature') || '');
    const [replyMode, setReplyMode] = useState(() => localStorage.getItem('aeromail_replyMode') || 'reply');
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('aeromail_darkMode') !== 'false');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const handleSave = async () => {
        setSaving(true);
        try {
            // Attempt backend save — fall back to localStorage only
            try {
                await apiClient.post('/settings/general', { displayName, signature, replyMode, darkMode });
            }
            catch {
                // backend may not exist yet; localStorage is source of truth
            }
            localStorage.setItem('aeromail_displayName', displayName);
            localStorage.setItem('aeromail_signature', signature);
            localStorage.setItem('aeromail_replyMode', replyMode);
            localStorage.setItem('aeromail_darkMode', String(darkMode));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs(Box, { sx: { maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 3 }, children: [_jsx(TextField, { label: "Display Name", value: displayName, onChange: (e) => setDisplayName(e.target.value), fullWidth: true, size: "small", sx: darkInputSx }), _jsx(TextField, { label: "Email Signature", value: signature, onChange: (e) => setSignature(e.target.value), fullWidth: true, multiline: true, minRows: 4, sx: { ...darkInputSx, '& .MuiInputBase-root': { minHeight: 100 } } }), _jsxs(Box, { children: [_jsx(Typography, { sx: { color: '#9aa0a6', fontSize: '0.8rem', mb: 1 }, children: "Default Reply Mode" }), _jsxs(ToggleButtonGroup, { value: replyMode, exclusive: true, onChange: (_, v) => v && setReplyMode(v), size: "small", sx: {
                            '& .MuiToggleButton-root': {
                                color: '#9aa0a6',
                                borderColor: '#3d3d3d',
                                '&.Mui-selected': { color: '#1a73e8', borderColor: '#1a73e8', background: 'rgba(26,115,232,0.12)' },
                            },
                        }, children: [_jsx(ToggleButton, { value: "reply", children: "Reply" }), _jsx(ToggleButton, { value: "replyAll", children: "Reply All" })] })] }), _jsx(Box, { children: _jsx(FormControlLabel, { control: _jsx(Switch, { checked: darkMode, onChange: (e) => setDarkMode(e.target.checked), sx: {
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#1a73e8' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#1a73e8' },
                        } }), label: _jsx(Typography, { sx: { color: '#e8eaed', fontSize: '0.875rem' }, children: "Dark Mode" }) }) }), _jsx(Box, { children: _jsx(Button, { variant: "contained", onClick: handleSave, disabled: saving, sx: {
                        bgcolor: '#1a73e8',
                        '&:hover': { bgcolor: '#1557b0' },
                        textTransform: 'none',
                        fontWeight: 600,
                        minWidth: 100,
                    }, children: saving ? _jsx(CircularProgress, { size: 16, sx: { color: '#fff' } }) : saved ? 'Saved ✓' : 'Save' }) })] }));
}
// ─── Labels Tab ───────────────────────────────────────────────────────────────
function LabelsTab() {
    const [labels, setLabels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(LABEL_COLORS[3]);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        apiClient.get('/labels')
            .then((r) => setLabels(r.data.labels ?? r.data ?? []))
            .catch(() => setLabels([]))
            .finally(() => setLoading(false));
    }, []);
    const handleCreate = async () => {
        if (!newName.trim())
            return;
        setSaving(true);
        try {
            const r = await apiClient.post('/labels', { name: newName.trim(), color: newColor });
            setLabels((prev) => [...prev, r.data]);
            setNewName('');
            setNewColor(LABEL_COLORS[3]);
            setCreating(false);
        }
        catch {
            // ignore — backend may return 201 with different shape
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async (id) => {
        try {
            await apiClient.delete(`/labels/${id}`);
            setLabels((prev) => prev.filter((l) => l.id !== id));
        }
        catch {
            setLabels((prev) => prev.filter((l) => l.id !== id));
        }
    };
    return (_jsx(Box, { sx: { maxWidth: 600 }, children: loading ? (Array.from({ length: 4 }).map((_, i) => (_jsx(Skeleton, { variant: "rectangular", height: 48, sx: { bgcolor: '#2a2a2a', mb: 1, borderRadius: 1 } }, i)))) : (_jsxs(_Fragment, { children: [labels.length === 0 && !creating && (_jsx(Typography, { sx: { color: '#9aa0a6', mb: 2 }, children: "No labels yet." })), labels.map((label) => (_jsxs(Box, { sx: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1.25,
                        px: 1.5,
                        borderBottom: '1px solid #2d2d2d',
                        '&:last-of-type': { borderBottom: 'none' },
                    }, children: [_jsx(Box, { sx: {
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: label.color || '#9aa0a6',
                                flexShrink: 0,
                            } }), _jsx(Typography, { sx: { flex: 1, color: '#e8eaed', fontSize: '0.875rem' }, children: label.name }), _jsx(Tooltip, { title: "Edit", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(EditIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Delete", children: _jsx(IconButton, { size: "small", onClick: () => handleDelete(label.id), sx: { color: '#9aa0a6', '&:hover': { color: '#f28b82' } }, children: _jsx(DeleteIcon, { fontSize: "small" }) }) })] }, label.id))), creating ? (_jsxs(Box, { sx: { mt: 2, p: 2, border: '1px solid #3d3d3d', borderRadius: 1 }, children: [_jsx(TextField, { label: "Label Name", value: newName, onChange: (e) => setNewName(e.target.value), size: "small", fullWidth: true, sx: { ...darkInputSx, mb: 2 }, onKeyDown: (e) => e.key === 'Enter' && handleCreate(), autoFocus: true }), _jsxs(Box, { sx: { display: 'flex', gap: 1, mb: 2, alignItems: 'center' }, children: [_jsx(Typography, { sx: { color: '#9aa0a6', fontSize: '0.8rem', mr: 1 }, children: "Color:" }), LABEL_COLORS.map((c) => (_jsx(Box, { onClick: () => setNewColor(c), sx: {
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        bgcolor: c,
                                        cursor: 'pointer',
                                        border: newColor === c ? '2px solid #fff' : '2px solid transparent',
                                        transition: 'border-color 0.15s',
                                    } }, c)))] }), _jsxs(Box, { sx: { display: 'flex', gap: 1 }, children: [_jsx(Button, { size: "small", variant: "contained", onClick: handleCreate, disabled: saving || !newName.trim(), sx: { bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1557b0' }, textTransform: 'none' }, children: saving ? _jsx(CircularProgress, { size: 14, sx: { color: '#fff' } }) : 'Create' }), _jsx(Button, { size: "small", onClick: () => { setCreating(false); setNewName(''); }, sx: { color: '#9aa0a6', textTransform: 'none' }, children: "Cancel" })] })] })) : (_jsx(Button, { startIcon: _jsx(AddIcon, {}), onClick: () => setCreating(true), sx: { mt: 2, color: '#1a73e8', textTransform: 'none', '&:hover': { bgcolor: 'rgba(26,115,232,0.08)' } }, children: "Create Label" }))] })) }));
}
// ─── Filters Tab ──────────────────────────────────────────────────────────────
function FiltersTab() {
    const [filters, setFilters] = useState([]);
    const [labels, setLabels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ from: '', to: '', subject: '', hasWords: '', action: 'archive', labelId: '' });
    useEffect(() => {
        Promise.all([
            apiClient.get('/filters').then((r) => r.data.filters ?? r.data ?? []).catch(() => []),
            apiClient.get('/labels').then((r) => r.data.labels ?? r.data ?? []).catch(() => []),
        ]).then(([f, l]) => {
            setFilters(f);
            setLabels(l);
        }).finally(() => setLoading(false));
    }, []);
    const describeFilter = (f) => {
        const parts = [];
        if (f.from)
            parts.push(`From: ${f.from}`);
        if (f.to)
            parts.push(`To: ${f.to}`);
        if (f.subject)
            parts.push(`Subject: ${f.subject}`);
        if (f.hasWords)
            parts.push(`Has words: ${f.hasWords}`);
        const actionLabel = {
            archive: 'Archive',
            delete: 'Delete',
            markRead: 'Mark as Read',
            applyLabel: 'Apply Label',
        };
        return `${parts.join(', ')} → ${actionLabel[f.action] || f.action}`;
    };
    const handleCreate = async () => {
        setSaving(true);
        try {
            const payload = {
                from: form.from || undefined,
                to: form.to || undefined,
                subject: form.subject || undefined,
                hasWords: form.hasWords || undefined,
                action: form.action,
                labelId: form.action === 'applyLabel' ? form.labelId : undefined,
            };
            const r = await apiClient.post('/filters', payload);
            setFilters((prev) => [...prev, r.data]);
            setForm({ from: '', to: '', subject: '', hasWords: '', action: 'archive', labelId: '' });
            setCreating(false);
        }
        catch {
            // ignore
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async (id) => {
        try {
            await apiClient.delete(`/filters/${id}`);
        }
        catch {
            // ignore
        }
        setFilters((prev) => prev.filter((f) => f.id !== id));
    };
    return (_jsx(Box, { sx: { maxWidth: 700 }, children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { variant: "rectangular", height: 48, sx: { bgcolor: '#2a2a2a', mb: 1, borderRadius: 1 } }, i)))) : (_jsxs(_Fragment, { children: [filters.length === 0 && !creating && (_jsx(Typography, { sx: { color: '#9aa0a6', mb: 2 }, children: "No filters yet." })), filters.map((filter) => (_jsxs(Box, { sx: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1.25,
                        px: 1.5,
                        borderBottom: '1px solid #2d2d2d',
                    }, children: [_jsx(Typography, { sx: { flex: 1, color: '#e8eaed', fontSize: '0.875rem' }, children: describeFilter(filter) }), _jsx(Tooltip, { title: "Delete", children: _jsx(IconButton, { size: "small", onClick: () => handleDelete(filter.id), sx: { color: '#9aa0a6', '&:hover': { color: '#f28b82' } }, children: _jsx(DeleteIcon, { fontSize: "small" }) }) })] }, filter.id))), creating ? (_jsxs(Box, { sx: { mt: 2, p: 2, border: '1px solid #3d3d3d', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx(Typography, { sx: { color: '#e8eaed', fontWeight: 600, fontSize: '0.875rem' }, children: "Create Filter" }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }, children: [_jsx(TextField, { label: "From", value: form.from, onChange: (e) => setForm((p) => ({ ...p, from: e.target.value })), size: "small", sx: darkInputSx }), _jsx(TextField, { label: "To", value: form.to, onChange: (e) => setForm((p) => ({ ...p, to: e.target.value })), size: "small", sx: darkInputSx }), _jsx(TextField, { label: "Subject", value: form.subject, onChange: (e) => setForm((p) => ({ ...p, subject: e.target.value })), size: "small", sx: darkInputSx }), _jsx(TextField, { label: "Has Words", value: form.hasWords, onChange: (e) => setForm((p) => ({ ...p, hasWords: e.target.value })), size: "small", sx: darkInputSx })] }), _jsxs(FormControl, { size: "small", sx: { maxWidth: 260, ...darkSelectSx }, children: [_jsx(InputLabel, { sx: { color: '#9aa0a6' }, children: "Action" }), _jsxs(Select, { label: "Action", value: form.action, onChange: (e) => setForm((p) => ({ ...p, action: e.target.value })), sx: { color: '#e8eaed' }, children: [_jsx(MenuItem, { value: "archive", children: "Archive" }), _jsx(MenuItem, { value: "delete", children: "Delete" }), _jsx(MenuItem, { value: "markRead", children: "Mark as Read" }), _jsx(MenuItem, { value: "applyLabel", children: "Apply Label" })] })] }), form.action === 'applyLabel' && (_jsxs(FormControl, { size: "small", sx: { maxWidth: 260, ...darkSelectSx }, children: [_jsx(InputLabel, { sx: { color: '#9aa0a6' }, children: "Label" }), _jsx(Select, { label: "Label", value: form.labelId, onChange: (e) => setForm((p) => ({ ...p, labelId: e.target.value })), sx: { color: '#e8eaed' }, children: labels.map((l) => (_jsx(MenuItem, { value: l.id, children: l.name }, l.id))) })] })), _jsxs(Box, { sx: { display: 'flex', gap: 1 }, children: [_jsx(Button, { size: "small", variant: "contained", onClick: handleCreate, disabled: saving, sx: { bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1557b0' }, textTransform: 'none' }, children: saving ? _jsx(CircularProgress, { size: 14, sx: { color: '#fff' } }) : 'Create Filter' }), _jsx(Button, { size: "small", onClick: () => setCreating(false), sx: { color: '#9aa0a6', textTransform: 'none' }, children: "Cancel" })] })] })) : (_jsx(Button, { startIcon: _jsx(AddIcon, {}), onClick: () => setCreating(true), sx: { mt: 2, color: '#1a73e8', textTransform: 'none', '&:hover': { bgcolor: 'rgba(26,115,232,0.08)' } }, children: "Create Filter" }))] })) }));
}
// ─── Accounts Tab ─────────────────────────────────────────────────────────────
function AccountsTab() {
    const navigate = useNavigate();
    const { email, clearAuth } = useAuthStore();
    const handleSignOut = () => {
        clearAuth();
        navigate('/login');
    };
    return (_jsxs(Box, { sx: { maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 3 }, children: [_jsxs(Box, { sx: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    border: '1px solid #3d3d3d',
                    borderRadius: 1,
                    bgcolor: '#2a2a2a',
                }, children: [_jsx(AccountCircleIcon, { sx: { fontSize: 40, color: '#9aa0a6' } }), _jsxs(Box, { children: [_jsx(Typography, { sx: { color: '#e8eaed', fontWeight: 600, fontSize: '0.9rem' }, children: email || 'Unknown Account' }), _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: '0.8rem' }, children: "Connected" })] })] }), _jsx(Divider, { sx: { borderColor: '#3d3d3d' } }), _jsxs(Box, { sx: { display: 'flex', gap: 2 }, children: [_jsx(Button, { variant: "outlined", disabled: true, sx: {
                            borderColor: '#3d3d3d',
                            color: '#5f6368',
                            textTransform: 'none',
                            '&.Mui-disabled': { borderColor: '#3d3d3d', color: '#5f6368' },
                        }, children: "Add Account" }), _jsx(Button, { variant: "outlined", onClick: handleSignOut, sx: {
                            borderColor: '#f28b82',
                            color: '#f28b82',
                            textTransform: 'none',
                            '&:hover': { bgcolor: 'rgba(242,139,130,0.08)', borderColor: '#f28b82' },
                        }, children: "Sign Out" })] })] }));
}
// ─── Shared Styles ────────────────────────────────────────────────────────────
const darkInputSx = {
    '& .MuiOutlinedInput-root': {
        color: '#e8eaed',
        '& fieldset': { borderColor: '#3d3d3d' },
        '&:hover fieldset': { borderColor: '#5f6368' },
        '&.Mui-focused fieldset': { borderColor: '#1a73e8' },
    },
    '& .MuiInputLabel-root': { color: '#9aa0a6' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#1a73e8' },
};
const darkSelectSx = {
    '& .MuiOutlinedInput-root': {
        color: '#e8eaed',
        '& fieldset': { borderColor: '#3d3d3d' },
        '&:hover fieldset': { borderColor: '#5f6368' },
        '&.Mui-focused fieldset': { borderColor: '#1a73e8' },
    },
    '& .MuiSelect-icon': { color: '#9aa0a6' },
    '& .MuiInputLabel-root': { color: '#9aa0a6' },
};
// ─── Main Settings Page ───────────────────────────────────────────────────────
const TABS = ['General', 'Labels', 'Filters', 'Accounts'];
export default function SettingsPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(0);
    return (_jsxs(Box, { sx: { minHeight: '100vh', background: '#1f1f1f' }, children: [_jsxs(Box, { sx: {
                    px: 3,
                    py: 1.5,
                    borderBottom: '1px solid #2d2d2d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                }, children: [_jsx(Button, { onClick: () => navigate('/inbox'), sx: { color: '#9aa0a6', textTransform: 'none', minWidth: 'auto', '&:hover': { color: '#e8eaed' } }, children: "\u2190 Inbox" }), _jsx(Typography, { sx: { fontSize: '1.25rem', fontWeight: 600, color: '#e8eaed' }, children: "Settings" })] }), _jsx(Box, { sx: { borderBottom: '1px solid #2d2d2d', px: 3 }, children: _jsx(Tabs, { value: activeTab, onChange: (_, v) => setActiveTab(v), sx: {
                        '& .MuiTab-root': { color: '#9aa0a6', textTransform: 'none', fontWeight: 500 },
                        '& .MuiTab-root.Mui-selected': { color: '#1a73e8' },
                        '& .MuiTabs-indicator': { bgcolor: '#1a73e8' },
                    }, children: TABS.map((t) => _jsx(Tab, { label: t }, t)) }) }), _jsxs(Box, { sx: { px: 4, py: 4 }, children: [activeTab === 0 && _jsx(GeneralTab, {}), activeTab === 1 && _jsx(LabelsTab, {}), activeTab === 2 && _jsx(FiltersTab, {}), activeTab === 3 && _jsx(AccountsTab, {})] })] }));
}
