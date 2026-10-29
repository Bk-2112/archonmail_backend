import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, Checkbox, Avatar, IconButton, Skeleton, Tooltip, Button, Chip, } from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import DeleteIcon from '@mui/icons-material/Delete';
import SnoozeIcon from '@mui/icons-material/Snooze';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CloseIcon from '@mui/icons-material/Close';
import apiClient from '../api/client';
import { getAvatarColor } from '../utils/avatarColor';
// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTimestamp(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return dateStr;
    const now = new Date();
    const isToday = date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    if (isToday)
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays < 7)
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function getSenderInitial(fromName, from) {
    const name = fromName || from;
    return name.charAt(0).toUpperCase();
}
function getSenderDisplay(fromName, from) {
    return fromName || from.replace(/<.*>/, '').trim() || from;
}
function HighlightedText({ text, query }) {
    if (!query.trim() || !text) {
        return _jsx("span", { children: text });
    }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return (_jsx("span", { children: parts.map((part, i) => regex.test(part) ? (_jsx("mark", { style: {
                backgroundColor: 'rgba(138,180,248,0.3)',
                color: '#e8eaed',
                borderRadius: 2,
                padding: '0 1px',
            }, children: part }, i)) : (_jsx("span", { children: part }, i))) }));
}
// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function EmailRowSkeleton() {
    return (_jsxs(Box, { sx: {
            display: 'flex',
            alignItems: 'center',
            height: 56,
            px: 2,
            gap: 2,
            borderBottom: '1px solid #2d2d2d',
        }, children: [_jsx(Skeleton, { variant: "circular", width: 36, height: 36, sx: { bgcolor: '#333', flexShrink: 0 } }), _jsx(Skeleton, { variant: "text", width: 100, sx: { bgcolor: '#333' } }), _jsx(Skeleton, { variant: "text", sx: { bgcolor: '#333', flex: 1 } }), _jsx(Skeleton, { variant: "text", width: 50, sx: { bgcolor: '#333' } })] }));
}
function EmailRow({ message, query, onNavigate, onStar, onArchive, onDelete }) {
    const [hovered, setHovered] = useState(false);
    const [checked, setChecked] = useState(false);
    const senderLabel = getSenderDisplay(message.fromName, message.from);
    const initial = getSenderInitial(message.fromName, message.from);
    const avatarBg = getAvatarColor(senderLabel);
    return (_jsxs(Box, { onClick: () => onNavigate(message.uid), onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), sx: {
            display: 'flex',
            alignItems: 'center',
            height: 56,
            px: 2,
            gap: 1.5,
            cursor: 'pointer',
            borderBottom: '1px solid #2d2d2d',
            background: message.read
                ? hovered ? 'rgba(255,255,255,0.04)' : 'transparent'
                : hovered ? 'rgba(26,41,66,0.6)' : 'rgba(26,41,66,0.4)',
            transition: 'background 0.15s',
            '&:last-child': { borderBottom: 'none' },
        }, children: [_jsx(Box, { sx: { width: 24, flexShrink: 0, visibility: hovered || checked ? 'visible' : 'hidden' }, onClick: (e) => e.stopPropagation(), children: _jsx(Checkbox, { size: "small", checked: checked, onChange: (e) => setChecked(e.target.checked), sx: { p: 0, color: '#9aa0a6', '&.Mui-checked': { color: '#1a73e8' } } }) }), _jsx(Box, { onClick: (e) => { e.stopPropagation(); onStar(message.uid); }, sx: { flexShrink: 0 }, children: message.starred ? (_jsx(StarIcon, { sx: { fontSize: 18, color: '#f6c142', cursor: 'pointer' } })) : (_jsx(StarBorderIcon, { sx: { fontSize: 18, color: hovered ? '#9aa0a6' : 'transparent', cursor: 'pointer', transition: 'color 0.15s' } })) }), _jsx(Avatar, { sx: { width: 36, height: 36, bgcolor: avatarBg, fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }, children: initial }), _jsx(Typography, { sx: {
                    width: 160,
                    flexShrink: 0,
                    fontSize: '0.875rem',
                    fontWeight: message.read ? 400 : 700,
                    color: message.read ? '#9aa0a6' : '#e8eaed',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }, children: _jsx(HighlightedText, { text: senderLabel, query: query }) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0, display: 'flex', gap: 0.5, overflow: 'hidden' }, children: [_jsx(Typography, { component: "span", sx: {
                            fontSize: '0.875rem',
                            fontWeight: message.read ? 400 : 700,
                            color: '#e8eaed',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            maxWidth: '40%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'inline-block',
                        }, children: _jsx(HighlightedText, { text: message.subject || '(no subject)', query: query }) }), _jsxs(Typography, { component: "span", sx: {
                            fontSize: '0.875rem',
                            color: '#9aa0a6',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'inline-block',
                        }, children: ["\u00A0\u00B7\u00A0", _jsx(HighlightedText, { text: message.snippet, query: query })] })] }), hovered ? (_jsxs(Box, { sx: { display: 'flex', gap: 0.5, flexShrink: 0 }, onClick: (e) => e.stopPropagation(), children: [_jsx(Tooltip, { title: "Archive", children: _jsx(IconButton, { size: "small", onClick: () => onArchive(message.uid), sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(MoveToInboxIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Delete", children: _jsx(IconButton, { size: "small", onClick: () => onDelete(message.uid), sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(DeleteIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Snooze", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(SnoozeIcon, { fontSize: "small" }) }) })] })) : (_jsx(Typography, { sx: {
                    fontSize: '0.75rem',
                    color: message.read ? '#9aa0a6' : '#e8eaed',
                    fontWeight: message.read ? 400 : 600,
                    flexShrink: 0,
                    minWidth: 56,
                    textAlign: 'right',
                }, children: formatTimestamp(message.date) }))] }));
}
// ─── Search Page ──────────────────────────────────────────────────────────────
export default function SearchPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const q = searchParams.get('q') || '';
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const runSearch = useCallback((query) => {
        if (!query.trim()) {
            setMessages([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        setMessages([]);
        apiClient
            .get('/search', { params: { q: query, limit: 50 } })
            .then((r) => setMessages(r.data.messages ?? r.data ?? []))
            .catch((err) => {
            const axiosErr = err;
            setError(axiosErr?.response?.data?.message || 'Search failed.');
        })
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        runSearch(q);
    }, [q, runSearch]);
    const handleNavigate = (uid) => {
        // Pass current search query as 'from' so thread back button returns here
        navigate(`/thread/${uid}?from=${encodeURIComponent(`/search?q=${encodeURIComponent(q)}`)}`);
    };
    const handleClearSearch = () => {
        setSearchParams({});
        navigate('/inbox');
    };
    const handleStar = (uid) => {
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, starred: !m.starred } : m)));
    };
    const handleArchive = (uid) => {
        setMessages((prev) => prev.filter((m) => m.uid !== uid));
    };
    const handleDelete = (uid) => {
        setMessages((prev) => prev.filter((m) => m.uid !== uid));
    };
    return (_jsxs(Box, { sx: { minHeight: '100vh', background: '#1f1f1f' }, children: [_jsxs(Box, { sx: {
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid #2d2d2d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { sx: {
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    color: '#e8eaed',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }, children: ["Search results for", ' ', _jsxs(Box, { component: "span", sx: { color: '#8ab4f8' }, children: ["\"", q, "\""] })] }), !loading && !error && q && (_jsx(Chip, { label: `${messages.length} result${messages.length !== 1 ? 's' : ''}`, size: "small", sx: {
                                    bgcolor: 'rgba(138,180,248,0.12)',
                                    color: '#8ab4f8',
                                    fontSize: '0.75rem',
                                    height: 24,
                                    flexShrink: 0,
                                } }))] }), _jsx(Button, { variant: "outlined", size: "small", startIcon: _jsx(CloseIcon, { fontSize: "small" }), onClick: handleClearSearch, sx: {
                            color: '#9aa0a6',
                            borderColor: '#5f6368',
                            textTransform: 'none',
                            borderRadius: '20px',
                            fontSize: '0.8125rem',
                            flexShrink: 0,
                            '&:hover': {
                                borderColor: '#9aa0a6',
                                color: '#e8eaed',
                                background: 'rgba(255,255,255,0.06)',
                            },
                        }, children: "Clear search" })] }), _jsx(Box, { sx: { maxWidth: 1200, mx: 'auto' }, children: loading ? (Array.from({ length: 6 }).map((_, i) => _jsx(EmailRowSkeleton, {}, i))) : error ? (_jsx(Box, { sx: { p: 4, textAlign: 'center' }, children: _jsx(Typography, { sx: { color: '#f28b82' }, children: error }) })) : !q.trim() ? (_jsx(Box, { sx: { display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2 }, children: _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: '1rem' }, children: "Enter a search term in the search bar above" }) })) : messages.length === 0 ? (_jsxs(Box, { sx: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 12,
                        gap: 2,
                    }, children: [_jsx(SearchOffIcon, { sx: { fontSize: 72, color: '#3d3d3d' } }), _jsxs(Typography, { sx: { color: '#9aa0a6', fontSize: '1rem' }, children: ["No results for \"", q, "\""] }), _jsx(Button, { variant: "text", onClick: handleClearSearch, sx: { color: '#8ab4f8', textTransform: 'none' }, children: "Clear search" })] })) : (messages.map((message) => (_jsx(EmailRow, { message: message, query: q, onNavigate: handleNavigate, onStar: handleStar, onArchive: handleArchive, onDelete: handleDelete }, message.uid)))) })] }));
}
