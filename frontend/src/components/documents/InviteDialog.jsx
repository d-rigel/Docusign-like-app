// src/components/documents/InviteDialog.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Select, MenuItem, FormControl,
  InputLabel, Typography, Box, Chip, Alert,
} from '@mui/material';
import { Share, ContentCopy } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { documentsAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';

export default function InviteDialog({ open, onClose, documentId }) {
  const { currentDoc } = useDocumentStore();
  const [email,   setEmail]   = useState('');
  const [role,    setRole]    = useState('editor');
  const [loading, setLoading] = useState(false);

  const inviteLink = currentDoc?.inviteToken
    ? `${window.location.origin}/invite/${currentDoc.inviteToken}`
    : '';

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied!');
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) { toast.error('Enter an email address'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { toast.error('Enter a valid email'); return; }

    setLoading(true);
    try {
      await documentsAPI.invite(documentId, { email: email.trim(), role });
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail('');
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontFamily: '"Lora", serif', fontWeight: 700, pb: 1 }}>
        Invite Collaborators
      </DialogTitle>
      <DialogContent>
        {/* Invite by email */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Invite by email
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
          <TextField
            fullWidth size="small" label="Email address" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            placeholder="colleague@example.com"
          />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Role</InputLabel>
            <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="signer">Signer</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleInvite} disabled={loading || !email.trim()}
            sx={{ whiteSpace: 'nowrap', height: 40 }}>
            {loading ? '…' : 'Invite'}
          </Button>
        </Box>

        {/* Role descriptions */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3 }}>
          {[
            { r: 'viewer', desc: 'Read only' },
            { r: 'editor', desc: 'Edit text' },
            { r: 'signer', desc: 'Can sign'  },
            { r: 'admin',  desc: 'Full control' },
          ].map(({ r, desc }) => (
            <Chip key={r} label={`${r}: ${desc}`} size="small" variant="outlined"
              sx={{ fontSize: 10, textTransform: 'capitalize' }} />
          ))}
        </Box>

        {/* Share link */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Share link
        </Typography>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Anyone with this link who accepts will be added as a viewer.
        </Alert>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          p: 1.5, bgcolor: '#f3f4f6', borderRadius: 2, border: '1px solid #e5e7eb',
        }}>
          <Typography variant="caption" sx={{ flexGrow: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {inviteLink}
          </Typography>
          <Button size="small" startIcon={<ContentCopy />} onClick={copyLink} variant="outlined">
            Copy
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
