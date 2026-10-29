import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Checkbox, Avatar, Typography, IconButton, Skeleton, Tooltip, } from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import DeleteIcon from '@mui/icons-material/Delete';
import SnoozeIcon from '@mui/icons-material/Snooze';
import InboxIcon from '@mui/icons-material/Inbox';
import apiClient from '../api/client';
import { getAvatarColor } from '../utils/avatarColor';
function formatTimestamp(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return dateStr;
    const now = new Date();
    const isToday = date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function getSenderInitial(fromName, from) {
    const name = fromName || from;
    return name.charAt(0).toUpperCase();
}
function getSenderDisplay(fromName, from) {
    return fromName || from.replace(/<.*>/, '').trim() || from;
}
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
function EmailRow({ message, onNavigate, onStar, onArchive, onDelete }) {
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
            background: message.isRead
                ? hovered
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent'
                : hovered
                    ? 'rgba(26,41,66,0.6)'
                    : 'rgba(26,41,66,0.4)',
            transition: 'background 0.15s',
            '&:last-child': { borderBottom: 'none' },
        }, children: [_jsx(Box, { sx: { width: 24, flexShrink: 0, visibility: hovered || checked ? 'visible' : 'hidden' }, onClick: (e) => e.stopPropagation(), children: _jsx(Checkbox, { size: "small", checked: checked, onChange: (e) => setChecked(e.target.checked), sx: {
                        p: 0,
                        color: '#9aa0a6',
                        '&.Mui-checked': { color: '#1a73e8' },
                    } }) }), _jsx(Box, { onClick: (e) => { e.stopPropagation(); onStar(message.uid); }, sx: { flexShrink: 0 }, children: message.isStarred ? (_jsx(StarIcon, { sx: { fontSize: 18, color: '#f6c142', cursor: 'pointer' } })) : (_jsx(StarBorderIcon, { sx: {
                        fontSize: 18,
                        color: hovered ? '#9aa0a6' : 'transparent',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                    } })) }), _jsx(Avatar, { sx: {
                    width: 36,
                    height: 36,
                    bgcolor: avatarBg,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    flexShrink: 0,
                }, children: initial }), _jsx(Typography, { sx: {
                    width: 160,
                    flexShrink: 0,
                    fontSize: '0.875rem',
                    fontWeight: message.isRead ? 400 : 700,
                    color: message.isRead ? '#9aa0a6' : '#e8eaed',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }, children: senderLabel }), _jsxs(Box, { sx: { flex: 1, minWidth: 0, display: 'flex', gap: 0.5, overflow: 'hidden' }, children: [_jsx(Typography, { sx: {
                            fontSize: '0.875rem',
                            fontWeight: message.isRead ? 400 : 700,
                            color: '#e8eaed',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            maxWidth: '40%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }, children: message.subject || '(no subject)' }), _jsxs(Typography, { sx: {
                            fontSize: '0.875rem',
                            color: '#9aa0a6',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }, children: ["\u00B7 ", message.snippet] })] }), hovered ? (_jsxs(Box, { sx: { display: 'flex', gap: 0.5, flexShrink: 0 }, onClick: (e) => e.stopPropagation(), children: [_jsx(Tooltip, { title: "Archive", children: _jsx(IconButton, { size: "small", onClick: () => onArchive(message.uid), sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(MoveToInboxIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Delete", children: _jsx(IconButton, { size: "small", onClick: () => onDelete(message.uid), sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(DeleteIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Snooze", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6', '&:hover': { color: '#e8eaed' } }, children: _jsx(SnoozeIcon, { fontSize: "small" }) }) })] })) : (_jsx(Typography, { sx: {
                    fontSize: '0.75rem',
                    color: message.isRead ? '#9aa0a6' : '#e8eaed',
                    fontWeight: message.isRead ? 400 : 600,
                    flexShrink: 0,
                    minWidth: 56,
                    textAlign: 'right',
                }, children: formatTimestamp(message.date) }))] }));
}
export default function InboxPage() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const res = await apiClient.get('/messages', {
                    params: { folder: 'INBOX', limit: 50 },
                });
                setMessages(res.data.messages ?? res.data);
            }
            catch (err) {
                const axiosErr = err;
                setError(axiosErr?.response?.data?.message || 'Failed to load messages.');
            }
            finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, []);
    const handleNavigate = (uid) => {
        navigate(`/thread/${uid}?folder=INBOX`);
    };
    const handleStar = (uid) => {
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, isStarred: !m.isStarred } : m)));
    };
    const handleArchive = (uid) => {
        setMessages((prev) => prev.filter((m) => m.uid !== uid));
    };
    const handleDelete = (uid) => {
        setMessages((prev) => prev.filter((m) => m.uid !== uid));
    };
    return (_jsxs(Box, { sx: { minHeight: '100vh', background: '#1f1f1f' }, children: [_jsx(Box, { sx: {
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid #2d2d2d',
                    display: 'flex',
                    alignItems: 'center',
                }, children: _jsx(Typography, { sx: {
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        color: '#e8eaed',
                        letterSpacing: '-0.25px',
                    }, children: "Inbox" }) }), _jsx(Box, { sx: { maxWidth: 1200, mx: 'auto' }, children: loading ? (
                // Skeleton loading state
                Array.from({ length: 5 }).map((_, i) => _jsx(EmailRowSkeleton, {}, i))) : error ? (_jsx(Box, { sx: { p: 4, textAlign: 'center' }, children: _jsx(Typography, { sx: { color: '#f28b82' }, children: error }) })) : messages.length === 0 ? (
                // Empty state
                _jsxs(Box, { sx: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 12,
                        gap: 2,
                    }, children: [_jsx(InboxIcon, { sx: { fontSize: 72, color: '#3d3d3d' } }), _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: '1rem' }, children: "Your inbox is empty" })] })) : (messages.map((message) => (_jsx(EmailRow, { message: message, onNavigate: handleNavigate, onStar: handleStar, onArchive: handleArchive, onDelete: handleDelete }, message.uid)))) })] }));
}
