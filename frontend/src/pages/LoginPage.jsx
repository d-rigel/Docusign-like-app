// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Link, InputAdornment, IconButton, Divider,
} from '@mui/material';
import { Visibility, VisibilityOff, AutoStories } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const navigate    = useNavigate();
  const setAuth     = useAuthStore((s) => s.setAuth);
  const [form, setForm]       = useState({ identifier: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login(form.identifier, form.password);
      setAuth(res.data.user, res.data.jwt);
      toast.success(`Welcome back, ${res.data.user.username}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
    }}>
      {/* Decorative blobs */}
      <Box sx={{
        position: 'fixed', top: -120, right: -120, width: 400, height: 400,
        borderRadius: '50%', background: 'rgba(233,69,96,0.15)', filter: 'blur(60px)',
      }} />
      <Box sx={{
        position: 'fixed', bottom: -80, left: -80, width: 300, height: 300,
        borderRadius: '50%', background: 'rgba(26,26,46,0.4)', filter: 'blur(40px)',
      }} />

      <Card sx={{
        width: '100%', maxWidth: 420,
        backdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        zIndex: 1,
      }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
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
              <Typography variant="caption" color="text.secondary">Sign in to continue</Typography>
            </Box>
          </Box>

          <Typography variant="h5" sx={{ fontFamily: '"Lora", serif', fontWeight: 600, mb: 0.5 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to your workspace
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email or username" name="identifier"
              value={form.identifier} onChange={handleChange}
              required autoComplete="username" sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="Password" name="password" type={showPass ? 'text' : 'password'}
              value={form.password} onChange={handleChange} required autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass(!showPass)} edge="end" size="small">
                      {showPass ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading}
              sx={{ py: 1.5, fontSize: 15 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" align="center" color="text.secondary">
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register" fontWeight={600} color="secondary.main">
              Create one
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
