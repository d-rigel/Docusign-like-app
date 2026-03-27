// src/components/documents/CreateDocumentDialog.jsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import useDocumentStore from '../../store/documentStore';

export default function CreateDocumentDialog({ open, onClose }) {
  const navigate        = useNavigate();
  const createDocument  = useDocumentStore((s) => s.createDocument);
  const [title, setTitle]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    setLoading(true);
    try {
      const doc = await createDocument({ title: title.trim(), content: '', plainContent: '' });
      toast.success('Document created!');
      onClose();
      setTitle('');
      navigate(`/documents/${doc.id}`);
    } catch {
      toast.error('Failed to create document');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleCreate(); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontFamily: '"Lora", serif', fontWeight: 700, pb: 1 }}>
        New Document
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Start with a blank document and collaborate in real time.
        </Typography>
        <TextField
          autoFocus fullWidth label="Document title"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Q4 Contract, NDA, Project Proposal"
          inputProps={{ maxLength: 255 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleCreate} variant="contained" disabled={loading || !title.trim()}
          startIcon={<Add />}
        >
          {loading ? 'Creating…' : 'Create document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
