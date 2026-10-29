import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, FormControlLabel, Switch, CircularProgress, Alert, Divider, Link, } from '@mui/material';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
export default function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    const [form, setForm] = useState({
        email: '',
        password: '',
        imapHost: 'mail.aeroverra.com',
        imapPort: '993',
        smtpHost: '',
        smtpPort: '587',
        imapSsl: true,
        smtpSsl: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
    const handleToggle = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.checked }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.post('/auth/login', {
                email: form.email,
                password: form.password,
                imapHost: form.imapHost,
                imapPort: parseInt(form.imapPort),
                smtpHost: form.smtpHost || form.imapHost,
                smtpPort: parseInt(form.smtpPort),
                imapSsl: form.imapSsl,
                smtpSsl: form.smtpSsl,
            });
            const { token } = res.data;
            setAuth(token, form.email);
            navigate('/inbox');
        }
        catch (err) {
            const axiosErr = err;
            setError(axiosErr?.response?.data?.message || 'Sign in failed. Check your credentials.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx(Box, { sx: {
            minHeight: '100vh',
            background: '#1f1f1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
        }, children: _jsx(Card, { sx: {
                width: '100%',
                maxWidth: 460,
                background: '#2d2d2d',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }, children: _jsxs(CardContent, { sx: { p: 4 }, children: [_jsxs(Box, { sx: { textAlign: 'center', mb: 4 }, children: [_jsx(Typography, { variant: "h4", sx: {
                                    fontWeight: 700,
                                    letterSpacing: '-0.5px',
                                    background: 'linear-gradient(135deg, #1a73e8 0%, #4fc3f7 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }, children: "AeroMail" }), _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mt: 0.5 }, children: "Sign in to your account" })] }), error && (_jsx(Alert, { severity: "error", sx: { mb: 2, background: '#3d1515', color: '#f28b82' }, children: error })), _jsxs(Box, { component: "form", onSubmit: handleSubmit, noValidate: true, children: [_jsx(TextField, { fullWidth: true, label: "Email", type: "email", value: form.email, onChange: handleChange('email'), required: true, autoComplete: "email", sx: fieldSx }), _jsx(TextField, { fullWidth: true, label: "Password", type: "password", value: form.password, onChange: handleChange('password'), required: true, autoComplete: "current-password", sx: fieldSx }), _jsx(Divider, { sx: { my: 2, borderColor: '#3d3d3d' }, children: _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f' }, children: "IMAP" }) }), _jsxs(Box, { sx: { display: 'flex', gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { fullWidth: true, label: "IMAP Host", value: form.imapHost, onChange: handleChange('imapHost'), sx: fieldSx }), _jsx(TextField, { label: "Port", value: form.imapPort, onChange: handleChange('imapPort'), sx: { ...fieldSx, width: 90, flexShrink: 0 } })] }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: form.imapSsl, onChange: handleToggle('imapSsl'), sx: switchSx }), label: _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6' }, children: "Use SSL/TLS" }), sx: { mb: 1.5, ml: 0 } }), _jsx(Divider, { sx: { my: 2, borderColor: '#3d3d3d' }, children: _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f' }, children: "SMTP" }) }), _jsxs(Box, { sx: { display: 'flex', gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { fullWidth: true, label: "SMTP Host", placeholder: form.imapHost, value: form.smtpHost, onChange: handleChange('smtpHost'), sx: fieldSx }), _jsx(TextField, { label: "Port", value: form.smtpPort, onChange: handleChange('smtpPort'), sx: { ...fieldSx, width: 90, flexShrink: 0 } })] }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: form.smtpSsl, onChange: handleToggle('smtpSsl'), sx: switchSx }), label: _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6' }, children: "Use SSL/TLS" }), sx: { mb: 3, ml: 0 } }), _jsx(Button, { type: "submit", fullWidth: true, variant: "contained", disabled: loading, sx: {
                                    background: '#1a73e8',
                                    borderRadius: 6,
                                    py: 1.5,
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    '&:hover': { background: '#1557b0' },
                                    '&.Mui-disabled': { background: '#1a3a5e', color: '#5a7a9a' },
                                }, children: loading ? _jsx(CircularProgress, { size: 22, sx: { color: '#5a9fd4' } }) : 'Sign In' }), _jsx(Box, { sx: { textAlign: 'center', mt: 2.5 }, children: _jsx(Link, { component: "button", type: "button", onClick: () => navigate('/setup'), underline: "hover", sx: {
                                        color: '#6f6f6f',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        '&:hover': { color: '#9aa0a6' },
                                    }, children: "First time? Set up AeroMail" }) })] })] }) }) }));
}
const fieldSx = {
    mb: 1.5,
    '& .MuiOutlinedInput-root': {
        color: '#e8eaed',
        '& fieldset': { borderColor: '#3d3d3d' },
        '&:hover fieldset': { borderColor: '#5a5a5a' },
        '&.Mui-focused fieldset': { borderColor: '#1a73e8' },
        background: '#1f1f1f',
        borderRadius: 1.5,
    },
    '& .MuiInputLabel-root': { color: '#9aa0a6' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#1a73e8' },
};
const switchSx = {
    '& .MuiSwitch-switchBase.Mui-checked': { color: '#1a73e8' },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#1a73e8' },
    '& .MuiSwitch-track': { backgroundColor: '#3d3d3d' },
};
