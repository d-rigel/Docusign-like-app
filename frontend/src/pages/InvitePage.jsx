// src/pages/InvitePage.jsx
import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, CircularProgress } from '@mui/material';
import { AutoStories, CheckCircle, Error } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { documentsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export default function InvitePage() {
  const { token }       = useParams();
  const navigate        = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [docInfo, setDocInfo] = useState(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      // Store token and redirect to login
      sessionStorage.setItem('pendingInvite', token);
      navigate('/login');
      return;
    }

    const accept = async () => {
      try {
        const res = await documentsAPI.acceptInvite(token);
        setDocInfo(res.data.data);
        setStatus('success');
        toast.success('You now have access to this document!');
      } catch (e) {
        setError(e.response?.data?.error?.message || 'Invalid or expired invite link');
        setStatus('error');
      }
    };
    accept();
  }, [token, isAuthenticated, navigate]);

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <Card sx={{ maxWidth: 420, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 4 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 2,
              background: 'linear-gradient(135deg, #1a1a2e, #e94560)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AutoStories sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" sx={{ fontFamily: '"Lora", serif', fontWeight: 700 }}>
              DocuCollab
            </Typography>
          </Box>

          {status === 'loading' && (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography color="text.secondary">Accepting your invitation…</Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} sx={{ fontFamily: '"Lora", serif', mb: 1 }}>
                You're in!
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                You now have access to <strong>{docInfo?.title}</strong>
              </Typography>
              <Button variant="contained" fullWidth size="large"
                onClick={() => navigate(`/documents/${docInfo?.documentId}`)}>
                Open document
              </Button>
              <Button variant="text" fullWidth sx={{ mt: 1 }} onClick={() => navigate('/')}>
                Go to dashboard
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Error sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} sx={{ fontFamily: '"Lora", serif', mb: 1 }}>
                Invite failed
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>{error}</Typography>
              <Button variant="contained" fullWidth onClick={() => navigate('/')}>
                Go to dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
