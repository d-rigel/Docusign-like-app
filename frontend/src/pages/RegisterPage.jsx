// src/pages/RegisterPage.jsx
import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Link, InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, AutoStories } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [form, setForm]         = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass]  = useState(false);
  const [loading, setLoading]    = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await authAPI.register(form.username, form.email, form.password);
      setAuth(res.data.user, res.data.jwt);
      toast.success('Account created! Welcome to DocuCollab 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      alignItems: 'center', justifyContent: 'center', p: 2,
    }}>
      <Box sx={{
        position: 'fixed', top: -100, left: -100, width: 350, height: 350,
        borderRadius: '50%', background: 'rgba(233,69,96,0.12)', filter: 'blur(60px)',
      }} />

      <Card sx={{
        width: '100%', maxWidth: 440,
        background: 'rgba(255,255,255,0.97)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)', zIndex: 1,
      }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 2,
              background: 'linear-gradient(135deg, #1a1a2e, #e94560)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AutoStories sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontFamily: '"Lora", serif', fontWeight: 700, lineHeight: 1 }}>
                DocuCollab
              </Typography>
              <Typography variant="caption" color="text.secondary">Create your account</Typography>
            </Box>
          </Box>

          <Typography variant="h5" sx={{ fontFamily: '"Lora", serif', fontWeight: 600, mb: 0.5 }}>
            Get started
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Free forever. No credit card needed.
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="Username" name="username"
              value={form.username} onChange={handleChange} required sx={{ mb: 2 }} />
            <TextField fullWidth label="Email address" name="email" type="email"
              value={form.email} onChange={handleChange} required sx={{ mb: 2 }} />
            <TextField
              fullWidth label="Password" name="password" type={showPass ? 'text' : 'password'}
              value={form.password} onChange={handleChange} required
              helperText="Minimum 6 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass(!showPass)} edge="end" size="small">
                      {showPass ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="Confirm password" name="confirm"
              type={showPass ? 'text' : 'password'}
              value={form.confirm} onChange={handleChange} required sx={{ mb: 3 }}
            />
            <Button type="submit" fullWidth variant="contained" size="large"
              disabled={loading} sx={{ py: 1.5, fontSize: 15 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" fontWeight={600} color="secondary.main">
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
