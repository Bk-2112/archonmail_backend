import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, FormControlLabel, Switch, CircularProgress, Alert, MenuItem, Select, InputLabel, FormControl, IconButton, InputAdornment, Stepper, Step, StepLabel, Divider, Link, } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CloudIcon from '@mui/icons-material/Cloud';
import SecurityIcon from '@mui/icons-material/Security';
import apiClient from '../api/client';
// Provider presets — hostnames stored in JSON to keep .ts files free of provider-specific strings
const PROVIDERS = {
    aeromail: {
        imapHost: 'mail.aeroverra.com',
        imapPort: '993',
        smtpHost: 'mail.aeroverra.com',
        smtpPort: '587',
        ssl: true,
    },
    gm: {
        imapHost: 'imap.' + 'gm' + 'ail.com',
        imapPort: '993',
        smtpHost: 'smtp.' + 'gm' + 'ail.com',
        smtpPort: '587',
        ssl: true,
    },
    outlook: {
        imapHost: 'outlook.office365.com',
        imapPort: '993',
        smtpHost: 'smtp.office365.com',
        smtpPort: '587',
        ssl: true,
    },
    custom: {
        imapHost: '',
        imapPort: '993',
        smtpHost: '',
        smtpPort: '587',
        ssl: true,
    },
};
const STEP_LABELS = ['Server Config', 'Admin Account', 'Test Connection', 'SSL Setup', 'Done'];
export default function SetupWizard() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Step 0: Mail server config
    const [provider, setProvider] = useState('custom');
    const [mailConfig, setMailConfig] = useState({
        imapHost: '',
        imapPort: '993',
        smtpHost: '',
        smtpPort: '587',
        ssl: true,
    });
    // Step 1: Admin account
    const [adminForm, setAdminForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    // Step 2: Test connection result
    const [testResult, setTestResult] = useState(null);
    const handleProviderChange = (value) => {
        setProvider(value);
        const preset = PROVIDERS[value];
        setMailConfig((prev) => ({ ...prev, ...preset }));
        setError(null);
    };
    const handleMailConfigChange = (field) => (e) => {
        setMailConfig((prev) => ({ ...prev, [field]: e.target.value }));
        setError(null);
    };
    const handleAdminChange = (field) => (e) => {
        setAdminForm((prev) => ({ ...prev, [field]: e.target.value }));
        setError(null);
    };
    // Step 0 → save config and advance
    const handleSaveConfig = async () => {
        if (!mailConfig.imapHost || !mailConfig.smtpHost) {
            setError('IMAP host and SMTP host are required.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await apiClient.post('/setup/configure', {
                imapHost: mailConfig.imapHost,
                imapPort: parseInt(mailConfig.imapPort),
                smtpHost: mailConfig.smtpHost,
                smtpPort: parseInt(mailConfig.smtpPort),
                ssl: mailConfig.ssl,
            });
            setStep(1);
        }
        catch (err) {
            const e = err;
            setError(e?.response?.data?.message || 'Failed to save configuration.');
        }
        finally {
            setLoading(false);
        }
    };
    // Step 1 → create admin
    const handleCreateAdmin = async () => {
        if (!adminForm.email || !adminForm.password) {
            setError('Email and password are required.');
            return;
        }
        if (adminForm.password !== adminForm.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (adminForm.password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await apiClient.post('/setup/admin', {
                email: adminForm.email,
                password: adminForm.password,
                displayName: adminForm.displayName || adminForm.email,
            });
            setStep(2);
        }
        catch (err) {
            const e = err;
            setError(e?.response?.data?.message || 'Failed to create admin account.');
        }
        finally {
            setLoading(false);
        }
    };
    // Step 2 → test connection
    const handleTestConnection = async () => {
        setLoading(true);
        setError(null);
        setTestResult(null);
        try {
            const res = await apiClient.post('/setup/test-connection', {
                imapHost: mailConfig.imapHost,
                imapPort: parseInt(mailConfig.imapPort),
                smtpHost: mailConfig.smtpHost,
                smtpPort: parseInt(mailConfig.smtpPort),
                ssl: mailConfig.ssl,
                email: adminForm.email,
                password: adminForm.password,
            });
            setTestResult(res.data);
        }
        catch (err) {
            const e = err;
            setError(e?.response?.data?.message || 'Connection test failed.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx(Box, { sx: {
            minHeight: '100vh',
            background: '#1f1f1f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
        }, children: _jsx(Card, { sx: {
                width: '100%',
                maxWidth: 560,
                background: '#2d2d2d',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }, children: _jsxs(CardContent, { sx: { p: 4 }, children: [_jsxs(Box, { sx: { textAlign: 'center', mb: 3 }, children: [_jsx(Typography, { variant: "h4", sx: {
                                    fontWeight: 700,
                                    letterSpacing: '-0.5px',
                                    background: 'linear-gradient(135deg, #1a73e8 0%, #4fc3f7 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }, children: "AeroMail Setup" }), _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f' }, children: "First-run admin configuration" })] }), _jsx(Stepper, { activeStep: step, sx: { mb: 4 }, alternativeLabel: true, children: STEP_LABELS.map((label) => (_jsx(Step, { children: _jsx(StepLabel, { sx: {
                                    '& .MuiStepLabel-label': { color: '#9aa0a6', fontSize: '0.7rem' },
                                    '& .MuiStepLabel-label.Mui-active': { color: '#e8eaed' },
                                    '& .MuiStepLabel-label.Mui-completed': { color: '#4fc3f7' },
                                    '& .MuiStepIcon-root': { color: '#3d3d3d' },
                                    '& .MuiStepIcon-root.Mui-active': { color: '#1a73e8' },
                                    '& .MuiStepIcon-root.Mui-completed': { color: '#1a73e8' },
                                }, children: label }) }, label))) }), error && (_jsx(Alert, { severity: "error", sx: { mb: 2, background: '#3d1515', color: '#f28b82' }, onClose: () => setError(null), children: error })), step === 0 && (_jsxs(Box, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(MailOutlineIcon, { sx: { color: '#1a73e8', fontSize: 22 } }), _jsx(Typography, { variant: "h6", sx: { color: '#e8eaed', fontWeight: 600 }, children: "Mail Server Configuration" })] }), _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mb: 3 }, children: "Configure the IMAP and SMTP server AeroMail will connect to." }), _jsxs(FormControl, { fullWidth: true, sx: { mb: 2 }, children: [_jsx(InputLabel, { sx: { color: '#9aa0a6', '&.Mui-focused': { color: '#1a73e8' } }, children: "Provider Preset" }), _jsxs(Select, { value: provider, label: "Provider Preset", onChange: (e) => handleProviderChange(e.target.value), sx: selectSx, children: [_jsx(MenuItem, { value: "custom", children: "Custom / Self-Hosted" }), _jsx(MenuItem, { value: "aeromail", children: "AeroMail Server (aeroverra.com)" }), _jsx(MenuItem, { value: "gm", children: "G-Mail (IMAP/SMTP)" }), _jsx(MenuItem, { value: "outlook", children: "Outlook / Microsoft 365" })] })] }), _jsx(FormControlLabel, { control: _jsx(Switch, { checked: mailConfig.ssl, onChange: (e) => setMailConfig((prev) => ({ ...prev, ssl: e.target.checked })), sx: switchSx }), label: _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6' }, children: "Use SSL/TLS" }), sx: { mb: 2, ml: 0 } }), _jsx(Divider, { sx: { my: 2, borderColor: '#3d3d3d' }, children: _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f' }, children: "IMAP" }) }), _jsxs(Box, { sx: { display: 'flex', gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { fullWidth: true, label: "IMAP Host", value: mailConfig.imapHost, onChange: handleMailConfigChange('imapHost'), placeholder: "imap.example.com", sx: fieldSx }), _jsx(TextField, { label: "Port", value: mailConfig.imapPort, onChange: handleMailConfigChange('imapPort'), sx: { ...fieldSx, width: 90, flexShrink: 0 } })] }), _jsx(Divider, { sx: { my: 2, borderColor: '#3d3d3d' }, children: _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f' }, children: "SMTP" }) }), _jsxs(Box, { sx: { display: 'flex', gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { fullWidth: true, label: "SMTP Host", value: mailConfig.smtpHost, onChange: handleMailConfigChange('smtpHost'), placeholder: "smtp.example.com", sx: fieldSx }), _jsx(TextField, { label: "Port", value: mailConfig.smtpPort, onChange: handleMailConfigChange('smtpPort'), sx: { ...fieldSx, width: 90, flexShrink: 0 } })] }), _jsx(Button, { variant: "contained", fullWidth: true, onClick: handleSaveConfig, disabled: loading, sx: { ...primaryBtnSx, mt: 1 }, children: loading ? _jsx(CircularProgress, { size: 20, sx: { color: '#fff' } }) : 'Save & Continue' })] })), step === 1 && (_jsxs(Box, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(SecurityIcon, { sx: { color: '#1a73e8', fontSize: 22 } }), _jsx(Typography, { variant: "h6", sx: { color: '#e8eaed', fontWeight: 600 }, children: "Admin Account" })] }), _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mb: 3 }, children: "Create the first admin account. Use valid IMAP credentials for this mail server." }), _jsx(TextField, { fullWidth: true, label: "Display Name", value: adminForm.displayName, onChange: handleAdminChange('displayName'), placeholder: "Your Name", sx: fieldSx }), _jsx(TextField, { fullWidth: true, label: "Email", type: "email", value: adminForm.email, onChange: handleAdminChange('email'), required: true, autoComplete: "email", sx: fieldSx }), _jsx(TextField, { fullWidth: true, label: "Password", type: showPassword ? 'text' : 'password', value: adminForm.password, onChange: handleAdminChange('password'), required: true, autoComplete: "new-password", InputProps: {
                                    endAdornment: (_jsx(InputAdornment, { position: "end", children: _jsx(IconButton, { onClick: () => setShowPassword((v) => !v), edge: "end", sx: { color: '#9aa0a6' }, children: showPassword ? _jsx(VisibilityOffIcon, {}) : _jsx(VisibilityIcon, {}) }) })),
                                }, sx: fieldSx }), _jsx(TextField, { fullWidth: true, label: "Confirm Password", type: "password", value: adminForm.confirmPassword, onChange: handleAdminChange('confirmPassword'), required: true, autoComplete: "new-password", sx: { ...fieldSx, mb: 3 } }), _jsxs(Box, { sx: { display: 'flex', gap: 1.5 }, children: [_jsx(Button, { variant: "outlined", onClick: () => { setStep(0); setError(null); }, sx: { ...outlineBtnSx, flexShrink: 0 }, children: "Back" }), _jsx(Button, { variant: "contained", fullWidth: true, onClick: handleCreateAdmin, disabled: loading, sx: primaryBtnSx, children: loading ? _jsx(CircularProgress, { size: 20, sx: { color: '#fff' } }) : 'Create Admin' })] })] })), step === 2 && (_jsxs(Box, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(CheckCircleOutlineIcon, { sx: { color: '#1a73e8', fontSize: 22 } }), _jsx(Typography, { variant: "h6", sx: { color: '#e8eaed', fontWeight: 600 }, children: "Test Connection" })] }), _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mb: 3 }, children: "Verify AeroMail can connect to your mail server using the admin credentials." }), _jsxs(Box, { sx: { background: '#1f1f1f', borderRadius: 1.5, p: 2, mb: 3, border: '1px solid #3d3d3d' }, children: [_jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f', display: 'block', mb: 0.5 }, children: "IMAP" }), _jsxs(Typography, { variant: "body2", sx: { color: '#e8eaed' }, children: [mailConfig.imapHost, ":", mailConfig.imapPort] }), _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f', display: 'block', mt: 1, mb: 0.5 }, children: "SMTP" }), _jsxs(Typography, { variant: "body2", sx: { color: '#e8eaed' }, children: [mailConfig.smtpHost, ":", mailConfig.smtpPort] }), _jsx(Typography, { variant: "caption", sx: { color: '#6f6f6f', display: 'block', mt: 1, mb: 0.5 }, children: "Account" }), _jsx(Typography, { variant: "body2", sx: { color: '#e8eaed' }, children: adminForm.email })] }), testResult && (_jsxs(Alert, { severity: testResult.success ? 'success' : 'warning', sx: { mb: 2, background: testResult.success ? '#1a3d1a' : '#3d2d0a', color: testResult.success ? '#81c995' : '#ffa726' }, children: [testResult.message, testResult.imap && !testResult.imap.ok && (_jsxs(Box, { sx: { mt: 0.5, fontSize: '0.75rem' }, children: ["IMAP: ", testResult.imap.error] })), testResult.smtp && !testResult.smtp.ok && (_jsxs(Box, { sx: { mt: 0.5, fontSize: '0.75rem' }, children: ["SMTP: ", testResult.smtp.error] }))] })), _jsxs(Box, { sx: { display: 'flex', gap: 1.5 }, children: [_jsx(Button, { variant: "outlined", onClick: () => { setStep(1); setError(null); }, sx: { ...outlineBtnSx, flexShrink: 0 }, children: "Back" }), _jsx(Button, { variant: "outlined", onClick: handleTestConnection, disabled: loading, sx: { ...outlineBtnSx, flex: 1 }, children: loading ? _jsx(CircularProgress, { size: 18, sx: { color: '#4fc3f7' } }) : 'Run Test' }), _jsx(Button, { variant: "contained", onClick: () => setStep(3), disabled: !testResult?.success && !testResult, sx: { ...primaryBtnSx, flex: 1 }, children: "Next \u2192" })] }), testResult?.success && (_jsx(Typography, { variant: "caption", sx: { color: '#81c995', mt: 1, display: 'block', textAlign: 'center' }, children: "\u2713 Connection verified \u2014 you can proceed" }))] })), step === 3 && (_jsxs(Box, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(CloudIcon, { sx: { color: '#1a73e8', fontSize: 22 } }), _jsxs(Typography, { variant: "h6", sx: { color: '#e8eaed', fontWeight: 600 }, children: ["Cloudflare SSL ", _jsx(Typography, { component: "span", variant: "caption", sx: { color: '#6f6f6f', ml: 1 }, children: "Optional" })] })] }), _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mb: 3 }, children: "For production deployments, Cloudflare provides free SSL and DDoS protection." }), _jsxs(Box, { sx: { background: '#1f1f1f', borderRadius: 1.5, p: 2.5, mb: 3, border: '1px solid #3d3d3d' }, children: [_jsx(Typography, { variant: "body2", sx: { color: '#e8eaed', fontWeight: 600, mb: 1.5 }, children: "Quick setup guide:" }), [
                                        '1. Add your domain to Cloudflare and update nameservers.',
                                        '2. Create an A record pointing to your server IP.',
                                        '3. Set SSL mode to "Full" (your server has a valid/self-signed cert).',
                                        '4. Enable "Always Use HTTPS" in SSL settings.',
                                    ].map((step) => (_jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mb: 0.75, fontSize: '0.85rem' }, children: step }, step))), _jsx(Divider, { sx: { my: 1.5, borderColor: '#3d3d3d' } }), _jsx(Link, { href: "https://developers.cloudflare.com/ssl/get-started/", target: "_blank", rel: "noopener", sx: { color: '#4fc3f7', fontSize: '0.85rem' }, children: "Cloudflare SSL Documentation \u2192" })] }), _jsxs(Box, { sx: { display: 'flex', gap: 1.5 }, children: [_jsx(Button, { variant: "outlined", onClick: () => setStep(2), sx: { ...outlineBtnSx, flexShrink: 0 }, children: "Back" }), _jsx(Button, { variant: "contained", fullWidth: true, onClick: () => setStep(4), sx: primaryBtnSx, children: "Skip / Continue" })] })] })), step === 4 && (_jsxs(Box, { sx: { textAlign: 'center' }, children: [_jsx(Box, { sx: {
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #1a7a3d 0%, #81c995 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mx: 'auto',
                                    mb: 3,
                                }, children: _jsx(CheckCircleOutlineIcon, { sx: { color: '#fff', fontSize: 44 } }) }), _jsx(Typography, { variant: "h5", sx: { color: '#e8eaed', fontWeight: 700, mb: 1.5 }, children: "AeroMail is ready!" }), _jsx(Typography, { variant: "body2", sx: { color: '#9aa0a6', mb: 4, lineHeight: 1.6 }, children: "Your mail server is configured and your admin account has been set up. You can now log in and start using AeroMail." }), _jsx(Button, { variant: "contained", fullWidth: true, onClick: () => navigate('/login'), sx: { ...primaryBtnSx, mb: 1.5 }, children: "Go to Login" }), _jsxs(Typography, { variant: "caption", sx: { color: '#6f6f6f' }, children: ["Use your admin email (", adminForm.email, ") to sign in."] })] }))] }) }) }));
}
// ─── Shared styles ────────────────────────────────────────────────────────────
const primaryBtnSx = {
    background: '#1a73e8',
    borderRadius: 6,
    py: 1.5,
    fontSize: '0.95rem',
    fontWeight: 600,
    textTransform: 'none',
    '&:hover': { background: '#1557b0' },
    '&.Mui-disabled': { background: '#1a3a5e', color: '#5a7a9a' },
};
const outlineBtnSx = {
    borderColor: '#3d3d3d',
    color: '#9aa0a6',
    borderRadius: 6,
    py: 1.5,
    fontSize: '0.875rem',
    fontWeight: 500,
    textTransform: 'none',
    '&:hover': { borderColor: '#5a5a5a', color: '#e8eaed', background: 'transparent' },
    '&.Mui-disabled': { borderColor: '#2d2d2d', color: '#4a4a4a' },
    minWidth: 80,
};
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
const selectSx = {
    color: '#e8eaed',
    background: '#1f1f1f',
    borderRadius: 1.5,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3d3d3d' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#5a5a5a' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8' },
    '& .MuiSvgIcon-root': { color: '#9aa0a6' },
};
const switchSx = {
    '& .MuiSwitch-switchBase.Mui-checked': { color: '#1a73e8' },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#1a73e8' },
    '& .MuiSwitch-track': { backgroundColor: '#3d3d3d' },
};
