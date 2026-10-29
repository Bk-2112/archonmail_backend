import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import apiClient from '../api/client';
const MODAL_WIDTH = 560;
const ComposeModal = ({ open, onClose, replyTo }) => {
    const [minimized, setMinimized] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const [to, setTo] = useState(replyTo?.email ?? '');
    const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject}` : '');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (replyTo) {
            setTo(replyTo.email);
            setSubject(`Re: ${replyTo.subject}`);
            setBody('');
        }
    }, [replyTo?.email, replyTo?.subject]);
    if (!open)
        return null;
    const headerTitle = replyTo ? `Reply to: ${replyTo.name}` : 'New Message';
    const handleSend = async () => {
        if (!to.trim() || !subject.trim())
            return;
        setSending(true);
        setError(null);
        try {
            await apiClient.post('/messages/send', {
                to: [to.trim()],
                subject,
                body,
                ...(replyTo?.uid ? { replyToUid: replyTo.uid } : {}),
            });
            onClose();
        }
        catch (e) {
            setError(e?.response?.data?.error ?? 'Failed to send message');
        }
        finally {
            setSending(false);
        }
    };
    const handleClose = () => {
        setTo('');
        setSubject('');
        setBody('');
        setError(null);
        setMinimized(false);
        setMaximized(false);
        onClose();
    };
    return (_jsxs(Box, { sx: {
            position: 'fixed',
            ...(maximized
                ? { top: 0, left: 0, right: 0, bottom: 0, width: '100%' }
                : { bottom: 0, right: 16, width: MODAL_WIDTH, maxWidth: '100vw' }),
            display: 'flex',
            flexDirection: 'column',
            background: '#2d2d2f',
            borderRadius: maximized ? 0 : '8px 8px 0 0',
            zIndex: 1300,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }, children: [_jsxs(Box, { sx: {
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    background: '#3c4043',
                    borderRadius: maximized ? 0 : '8px 8px 0 0',
                    cursor: minimized ? 'pointer' : 'default',
                    userSelect: 'none',
                }, onClick: () => minimized && setMinimized(false), children: [_jsx(Typography, { sx: { flex: 1, color: '#e8eaed', fontSize: 14, fontWeight: 500 }, children: headerTitle }), _jsx(Tooltip, { title: "Minimize", children: _jsx(IconButton, { size: "small", onClick: (e) => { e.stopPropagation(); setMinimized((m) => !m); setMaximized(false); }, sx: { color: '#9aa0a6' }, children: _jsx(MinimizeIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: maximized ? 'Restore' : 'Maximize', children: _jsx(IconButton, { size: "small", onClick: (e) => { e.stopPropagation(); setMaximized((m) => !m); setMinimized(false); }, sx: { color: '#9aa0a6' }, children: maximized ? _jsx(CloseFullscreenIcon, { fontSize: "small" }) : _jsx(OpenInFullIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Close", children: _jsx(IconButton, { size: "small", onClick: (e) => { e.stopPropagation(); handleClose(); }, sx: { color: '#9aa0a6' }, children: _jsx(CloseIcon, { fontSize: "small" }) }) })] }), !minimized && (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { px: 2, pt: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsx(TextField, { variant: "standard", placeholder: "To", value: to, onChange: (e) => setTo(e.target.value), fullWidth: true, sx: {
                                    borderBottom: '1px solid #3c4043',
                                    mb: 1,
                                    '& .MuiInput-root': { color: '#e8eaed' },
                                    '& .MuiInput-root:before': { borderColor: '#3c4043' },
                                    '& .MuiInput-root:after': { borderColor: '#1a73e8' },
                                } }), _jsx(TextField, { variant: "standard", placeholder: "Subject", value: subject, onChange: (e) => setSubject(e.target.value), fullWidth: true, sx: {
                                    borderBottom: '1px solid #3c4043',
                                    mb: 1,
                                    '& .MuiInput-root': { color: '#e8eaed' },
                                    '& .MuiInput-root:before': { borderColor: '#3c4043' },
                                    '& .MuiInput-root:after': { borderColor: '#1a73e8' },
                                } }), _jsx(TextField, { variant: "standard", placeholder: "Write your message\u2026", value: body, onChange: (e) => setBody(e.target.value), multiline: true, minRows: maximized ? 14 : 6, fullWidth: true, InputProps: { disableUnderline: true }, sx: {
                                    flex: 1,
                                    '& .MuiInput-root': { color: '#e8eaed', alignItems: 'flex-start' },
                                    '& textarea': { resize: 'none', color: '#e8eaed', fontSize: 14 },
                                } }), error && (_jsx(Typography, { sx: { color: '#f28b82', fontSize: 12, mt: 0.5 }, children: error }))] }), _jsxs(Box, { sx: {
                            display: 'flex',
                            alignItems: 'center',
                            px: 2,
                            py: 1,
                            gap: 0.5,
                            borderTop: '1px solid #3c4043',
                        }, children: [_jsx(Button, { variant: "contained", size: "small", disabled: sending || !to.trim(), onClick: handleSend, endIcon: _jsx(SendIcon, {}), sx: {
                                    background: '#1a73e8',
                                    borderRadius: 20,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    px: 2,
                                    mr: 1,
                                    '&:hover': { background: '#1557b0' },
                                }, children: sending ? 'Sending…' : 'Send' }), _jsx(Tooltip, { title: "Bold", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6' }, children: _jsx(FormatBoldIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Italic", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6' }, children: _jsx(FormatItalicIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Underline", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6' }, children: _jsx(FormatUnderlinedIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: "Attach file", children: _jsx(IconButton, { size: "small", sx: { color: '#9aa0a6' }, children: _jsx(AttachFileIcon, { fontSize: "small" }) }) })] })] }))] }));
};
export default ComposeModal;
