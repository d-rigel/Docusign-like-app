// src/components/documents/UploadDocumentDialog.jsx
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, LinearProgress, Chip,
} from '@mui/material';
import { UploadFile, InsertDriveFile, Close } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { documentsAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';

const ACCEPTED = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp';
const MAX_SIZE  = 20 * 1024 * 1024; // 20 MB

export default function UploadDocumentDialog({ open, onClose }) {
  const navigate       = useNavigate();
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);
  const [file,     setFile]     = useState(null);
  const [title,    setTitle]    = useState('');
  const [progress, setProgress] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > MAX_SIZE) { toast.error('File too large (max 20 MB)'); return; }
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file'); return; }
    setLoading(true);
    setProgress(10);
    try {
      // 1. Create Strapi upload
      const formData = new FormData();
      formData.append('files', file);

      const uploadRes = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:1337'}/api/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` },
          body: formData,
        }
      );
      setProgress(60);
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed');

      const fileId = uploadData[0]?.id;
      setProgress(80);

      // 2. Create document linked to file
      const docRes = await documentsAPI.create({
        title: title || file.name,
        content: '',
        plainContent: '',
        originalFile: fileId,
      });
      setProgress(100);

      toast.success('File uploaded and document created!');
      await fetchDocuments();
      onClose();
      setFile(null);
      setTitle('');
      setProgress(0);
      navigate(`/documents/${docRes.data.data.id}`);
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) { setFile(null); setTitle(''); setProgress(0); onClose(); }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontFamily: '"Lora", serif', fontWeight: 700, pb: 1 }}>
        Upload Document
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Supported: PDF, Word (.doc/.docx), TXT, Images (PNG, JPG, WebP) · Max 20 MB
        </Typography>

        {/* Drop zone */}
        <Box
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => !loading && document.getElementById('file-input').click()}
          sx={{
            border: `2px dashed ${dragging ? '#e94560' : '#d1d5db'}`,
            borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
            bgcolor: dragging ? '#fff0f3' : '#fafafa',
            transition: 'all 0.2s ease',
            '&:hover': { borderColor: '#1a1a2e', bgcolor: '#f5f5f5' },
            mb: 2,
          }}
        >
          <input
            id="file-input" type="file" hidden accept={ACCEPTED}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {file ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <InsertDriveFile sx={{ color: 'secondary.main', fontSize: 28 }} />
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={700}>{file.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(file.size / 1024).toFixed(1)} KB
                </Typography>
              </Box>
              <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <Close />
              </Button>
            </Box>
          ) : (
            <>
              <UploadFile sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Drag & drop or click to browse
              </Typography>
            </>
          )}
        </Box>

        {loading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 6 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {progress < 60 ? 'Uploading file…' : progress < 90 ? 'Creating document…' : 'Done!'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleUpload} variant="contained" disabled={!file || loading}
          startIcon={<UploadFile />}
        >
          {loading ? 'Uploading…' : 'Upload & Open'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
