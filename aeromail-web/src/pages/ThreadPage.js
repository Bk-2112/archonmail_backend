import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Box, Typography, IconButton, CircularProgress, Avatar, Collapse, Button, TextField, Tooltip, Menu, MenuItem, } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReplyIcon from '@mui/icons-material/Reply';
import ReplyAllIcon from '@mui/icons-material/ReplyAll';
import ForwardIcon from '@mui/icons-material/Forward';
import SendIcon from '@mui/icons-material/Send';
import apiClient from '../api/client';
import ComposeModal from '../components/ComposeModal';
import { getAvatarColor } from '../utils/avatarColor';
function parseFrom(from) {
    // "Display Name <email@example.com>" or just "email@example.com"
    const match = from.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
        return { name: match[1].replace(/^"|"$/g, '').trim() || match[2], email: match[2] };
    }
    return { name: from, email: from };
}
function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const sameDay = d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
        if (sameDay) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
            ', ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    catch {
        return dateStr;
    }
}
function getInitial(name) {
    return (name.trim()[0] ?? '?').toUpperCase();
}
const ThreadPage = () => {
    const { uid } = useParams();
    const [searchParams] = useSearchParams();
    const folder = searchParams.get('folder') ?? 'INBOX';
    // 'from' param stores the URL to navigate back to (e.g. /search?q=xxx)
    const fromUrl = searchParams.get('from') ?? '/inbox';
    const navigate = useNavigate();
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Expand/collapse state (always expanded for single message)
    const [expanded, setExpanded] = useState(true);
    // More menu
    const [menuAnchor, setMenuAnchor] = useState(null);
    // Reply state
    const [replyOpen, setReplyOpen] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [replySending, setReplySending] = useState(false);
    const [replyError, setReplyError] = useState(null);
    const [replySent, setReplySent] = useState(false);
    // ComposeModal (for Reply All / Forward)
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeReplyTo, setComposeReplyTo] = useState();
    useEffect(() => {
        if (!uid)
            return;
        setLoading(true);
        setError(null);
        apiClient
            .get(`/messages/${uid}`, { params: { folder } })
            .then((res) => {
            const data = res.data;
            // Normalise field names from the API
            const from = data.from ?? data.fromEmail ?? '';
            const parsed = parseFrom(from);
            setMessage({
                uid: data.uid ?? Number(uid),
                subject: data.subject ?? '(no subject)',
                from: parsed.name,
                fromEmail: parsed.email,
                to: Array.isArray(data.to) ? data.to : [data.to ?? ''],
                date: data.date ?? '',
                body: data.body ?? data.textBody ?? '',
                bodyHtml: data.bodyHtml ?? data.htmlBody ?? '',
                snippet: data.snippet ?? '',
            });
        })
            .catch((e) => {
            setError(e?.response?.data?.error ?? 'Failed to load message');
        })
            .finally(() => setLoading(false));
    }, [uid, folder]);
    const handleReply = () => {
        setReplyOpen(true);
        setReplySent(false);
        setReplyError(null);
        setReplyBody('');
    };
    const handleSendReply = async () => {
        if (!message || !replyBody.trim())
            return;
        setReplySending(true);
        setReplyError(null);
        try {
            await apiClient.post('/messages/send', {
                to: [message.fromEmail],
                subject: `Re: ${message.subject}`,
                body: replyBody,
                replyToUid: message.uid,
            });
            setReplySent(true);
            setReplyOpen(false);
            setReplyBody('');
        }
        catch (e) {
            setReplyError(e?.response?.data?.error ?? 'Failed to send reply');
        }
        finally {
            setReplySending(false);
        }
    };
    const openComposeReplyAll = () => {
        if (!message)
            return;
        setComposeReplyTo({
            name: message.from,
            email: message.fromEmail,
            subject: message.subject,
            uid: message.uid,
        });
        setComposeOpen(true);
    };
    const openComposeForward = () => {
        if (!message)
            return;
        setComposeReplyTo(undefined); // forward: blank To, keep subject
        setComposeOpen(true);
    };
    const safeHtml = message?.bodyHtml
        ? DOMPurify.sanitize(message.bodyHtml, { USE_PROFILES: { html: true } })
        : null;
    return (_jsxs(Box, { sx: {
            minHeight: '100vh',
            background: '#1f1f1f',
            color: '#e8eaed',
            display: 'flex',
            flexDirection: 'column',
        }, children: [_jsxs(Box, { sx: {
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    borderBottom: '1px solid #3c4043',
                    background: '#1f1f1f',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                }, children: [_jsx(Tooltip, { title: "Back", children: _jsx(IconButton, { onClick: () => navigate(fromUrl), sx: { color: '#9aa0a6', mr: 1 }, children: _jsx(ArrowBackIcon, {}) }) }), message && (_jsx(Typography, { variant: "h5", sx: { flex: 1, color: '#e8eaed', fontWeight: 400, fontSize: { xs: 18, sm: 22 }, mr: 2 }, noWrap: true, children: message.subject })), _jsx(Tooltip, { title: "Archive", children: _jsx(IconButton, { sx: { color: '#9aa0a6' }, children: _jsx(ArchiveIcon, {}) }) }), _jsx(Tooltip, { title: "Delete", children: _jsx(IconButton, { sx: { color: '#9aa0a6' }, children: _jsx(DeleteIcon, {}) }) })] }), _jsxs(Box, { sx: { flex: 1, p: { xs: 1, sm: 3 }, maxWidth: 900, mx: 'auto', width: '100%' }, children: [loading && (_jsx(Box, { sx: { display: 'flex', justifyContent: 'center', mt: 8 }, children: _jsx(CircularProgress, { sx: { color: '#1a73e8' } }) })), error && !loading && (_jsxs(Box, { sx: { mt: 4, textAlign: 'center' }, children: [_jsx(Typography, { sx: { color: '#f28b82' }, children: error }), _jsx(Button, { variant: "outlined", sx: { mt: 2, color: '#1a73e8', borderColor: '#1a73e8' }, onClick: () => navigate(fromUrl), children: "Go Back" })] })), message && !loading && (_jsxs(_Fragment, { children: [_jsx(Box, { sx: {
                                    background: '#2d2d2f',
                                    borderRadius: 2,
                                    mb: 2,
                                    overflow: 'hidden',
                                }, children: !expanded ? (_jsxs(Box, { onClick: () => setExpanded(true), sx: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 2,
                                        py: 1.5,
                                        cursor: 'pointer',
                                        gap: 1.5,
                                        '&:hover': { background: '#35363a' },
                                    }, children: [_jsx(Avatar, { sx: {
                                                width: 32,
                                                height: 32,
                                                fontSize: 14,
                                                background: getAvatarColor(message.from),
                                                flexShrink: 0,
                                            }, children: getInitial(message.from) }), _jsx(Typography, { sx: { color: '#e8eaed', fontWeight: 600, fontSize: 14, minWidth: 120 }, noWrap: true, children: message.from }), _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: 13, flex: 1 }, noWrap: true, children: message.snippet || message.body.slice(0, 100) }), _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: 12, flexShrink: 0 }, children: formatDate(message.date) })] })) : (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'flex-start', px: 2, pt: 2, pb: 1, gap: 1.5 }, children: [_jsx(Avatar, { sx: {
                                                        width: 40,
                                                        height: 40,
                                                        fontSize: 18,
                                                        background: getAvatarColor(message.from),
                                                        flexShrink: 0,
                                                        cursor: 'pointer',
                                                    }, onClick: () => setExpanded(false), children: getInitial(message.from) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Typography, { sx: { color: '#e8eaed', fontWeight: 600, fontSize: 14 }, children: message.from }), _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: 13 }, children: "to me \u25BE" })] }), _jsx(Typography, { sx: { color: '#9aa0a6', fontSize: 12 }, children: formatDate(message.date) })] }), _jsx(Tooltip, { title: "More options", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6' }, onClick: (e) => setMenuAnchor(e.currentTarget), children: _jsx(MoreVertIcon, { fontSize: "small" }) }) }), _jsxs(Menu, { anchorEl: menuAnchor, open: Boolean(menuAnchor), onClose: () => setMenuAnchor(null), PaperProps: { sx: { background: '#2d2d2f', color: '#e8eaed' } }, children: [_jsx(MenuItem, { onClick: () => { setMenuAnchor(null); }, sx: { '&:hover': { background: '#35363a' } }, children: "Print" }), _jsx(MenuItem, { onClick: () => { setMenuAnchor(null); }, sx: { '&:hover': { background: '#35363a' } }, children: "Show original" }), _jsx(MenuItem, { onClick: () => { setMenuAnchor(null); }, sx: { '&:hover': { background: '#35363a' } }, children: "Report spam" })] })] }), _jsx(Box, { sx: { px: 2, py: 1 }, children: safeHtml ? (_jsx(Box, { component: "div", dangerouslySetInnerHTML: { __html: safeHtml }, sx: {
                                                    color: '#e8eaed',
                                                    fontSize: 14,
                                                    lineHeight: 1.6,
                                                    '& a': { color: '#8ab4f8' },
                                                    '& img': { maxWidth: '100%' },
                                                    '& *': { maxWidth: '100%' },
                                                } })) : (_jsx(Typography, { component: "pre", sx: {
                                                    color: '#e8eaed',
                                                    fontSize: 14,
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    fontFamily: 'inherit',
                                                    m: 0,
                                                }, children: message.body })) }), _jsxs(Box, { sx: { display: 'flex', gap: 1, px: 2, py: 2 }, children: [_jsx(Button, { variant: "outlined", size: "small", startIcon: _jsx(ReplyIcon, {}), onClick: handleReply, sx: {
                                                        color: '#e8eaed',
                                                        borderColor: '#5f6368',
                                                        textTransform: 'none',
                                                        borderRadius: 20,
                                                        '&:hover': { borderColor: '#9aa0a6', background: '#35363a' },
                                                    }, children: "Reply" }), _jsx(Button, { variant: "outlined", size: "small", startIcon: _jsx(ReplyAllIcon, {}), onClick: openComposeReplyAll, sx: {
                                                        color: '#e8eaed',
                                                        borderColor: '#5f6368',
                                                        textTransform: 'none',
                                                        borderRadius: 20,
                                                        '&:hover': { borderColor: '#9aa0a6', background: '#35363a' },
                                                    }, children: "Reply All" }), _jsx(Button, { variant: "outlined", size: "small", startIcon: _jsx(ForwardIcon, {}), onClick: openComposeForward, sx: {
                                                        color: '#e8eaed',
                                                        borderColor: '#5f6368',
                                                        textTransform: 'none',
                                                        borderRadius: 20,
                                                        '&:hover': { borderColor: '#9aa0a6', background: '#35363a' },
                                                    }, children: "Forward" })] })] })) }), _jsx(Collapse, { in: replyOpen, children: _jsxs(Box, { sx: {
                                        background: '#2d2d2f',
                                        borderRadius: 2,
                                        p: 2,
                                        mb: 2,
                                        border: '1px solid #3c4043',
                                    }, children: [_jsxs(Typography, { sx: { color: '#9aa0a6', fontSize: 13, mb: 1 }, children: ["Reply to ", message.from] }), _jsx(TextField, { multiline: true, minRows: 4, fullWidth: true, placeholder: "Write your reply\u2026", value: replyBody, onChange: (e) => setReplyBody(e.target.value), variant: "outlined", sx: {
                                                '& .MuiOutlinedInput-root': {
                                                    color: '#e8eaed',
                                                    background: '#1f1f1f',
                                                    borderRadius: 1,
                                                    '& fieldset': { borderColor: '#3c4043' },
                                                    '&:hover fieldset': { borderColor: '#5f6368' },
                                                    '&.Mui-focused fieldset': { borderColor: '#1a73e8' },
                                                },
                                                '& textarea': { color: '#e8eaed', fontSize: 14 },
                                            } }), replyError && (_jsx(Typography, { sx: { color: '#f28b82', fontSize: 12, mt: 0.5 }, children: replyError })), replySent && (_jsx(Typography, { sx: { color: '#81c995', fontSize: 12, mt: 0.5 }, children: "Reply sent!" })), _jsxs(Box, { sx: { display: 'flex', gap: 1, mt: 1.5 }, children: [_jsx(Button, { variant: "contained", size: "small", disabled: replySending || !replyBody.trim(), onClick: handleSendReply, endIcon: _jsx(SendIcon, {}), sx: {
                                                        background: '#1a73e8',
                                                        borderRadius: 20,
                                                        textTransform: 'none',
                                                        fontWeight: 600,
                                                        px: 2,
                                                        '&:hover': { background: '#1557b0' },
                                                    }, children: replySending ? 'Sending…' : 'Send' }), _jsx(Button, { variant: "text", size: "small", onClick: () => { setReplyOpen(false); setReplyBody(''); }, sx: { color: '#9aa0a6', textTransform: 'none', borderRadius: 20 }, children: "Cancel" })] })] }) })] }))] }), _jsx(ComposeModal, { open: composeOpen, onClose: () => setComposeOpen(false), replyTo: composeReplyTo })] }));
};
export default ThreadPage;
