// src/components/signature/SignaturePanel.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Button, Typography, Divider, Stack, Chip,
  Avatar, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import { Draw, Delete, CheckCircle, LockOutlined } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { signaturesAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';
import { fabric } from 'fabric';

export default function SignaturePanel({ documentId, socket, canSign, currentUser }) {
  const { signatures, addSignatureLocally } = useDocumentStore();
  const canvasRef   = useRef(null);
  const fabricRef   = useRef(null);
  const [isSaving,  setIsSaving]  = useState(false);
  const [hasDrawn,  setHasDrawn]  = useState(false);

  // ── Init Fabric canvas ─────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: canSign,
      width:  320,
      height: 160,
      backgroundColor: '#fafafa',
    });

    canvas.freeDrawingBrush.width = 2.5;
    canvas.freeDrawingBrush.color = '#1a1a2e';

    canvas.on('path:created', () => setHasDrawn(true));

    fabricRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [canSign]);

  const handleClear = () => {
    fabricRef.current?.clear();
    fabricRef.current?.setBackgroundColor('#fafafa', () => fabricRef.current?.renderAll());
    setHasDrawn(false);
  };

  const handleSave = async () => {
    if (!fabricRef.current || !hasDrawn) {
      toast.error('Please draw your signature first');
      return;
    }
    setIsSaving(true);
    try {
      // Export as base64 PNG
      const dataURL = fabricRef.current.toDataURL({ format: 'png', quality: 1, multiplier: 2 });

      const res = await signaturesAPI.create({
        documentId,
        signatureData: dataURL,
        positionX:  0,
        positionY:  0,
        pageNumber: 1,
      });

      const sig = res.data.data;
      addSignatureLocally(sig);

      // Broadcast to other collaborators
      socket?.emit('signature:added', { documentId, signature: sig });

      toast.success('Signature saved!');
      handleClear();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to save signature');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Listen for remote signatures ───────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = ({ signature }) => {
      addSignatureLocally(signature);
      toast.success(`${signature.signerName} signed the document`);
    };
    socket.on('signature:added', handler);
    return () => socket.off('signature:added', handler);
  }, [socket, addSignatureLocally]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Canvas */}
      {canSign ? (
        <>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Draw your signature
          </Typography>
          <Box sx={{
            border: '2px dashed #d1d5db', borderRadius: 2, overflow: 'hidden',
            '&:hover': { borderColor: '#1a1a2e' }, transition: 'border-color 0.2s',
          }}>
            <canvas ref={canvasRef} className="signature-canvas" />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              variant="outlined" size="small" startIcon={<Delete />}
              onClick={handleClear} disabled={!hasDrawn}
              sx={{ flex: 1 }}
            >
              Clear
            </Button>
            <Button
              variant="contained" size="small" startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
              onClick={handleSave} disabled={!hasDrawn || isSaving}
              sx={{ flex: 2, bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
            >
              {isSaving ? 'Saving…' : 'Apply signature'}
            </Button>
          </Stack>
        </>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          You don't have signing permission for this document.
        </Alert>
      )}

      {/* Existing signatures */}
      <Divider sx={{ my: 2.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          SIGNATURES ({signatures.length})
        </Typography>
      </Divider>

      {signatures.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Draw sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No signatures yet
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {signatures.map((sig) => (
            <Box key={sig.id} sx={{
              p: 1.5, border: '1px solid #e5e7eb', borderRadius: 2, bgcolor: '#fafafa',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'secondary.main' }}>
                  {(sig.signerName || sig.signerEmail || '?')[0].toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="caption" fontWeight={700} noWrap>
                    {sig.signerName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                    {sig.signerEmail}
                  </Typography>
                </Box>
                <Tooltip title="Signature is locked and tamper-proof">
                  <Chip
                    icon={<LockOutlined sx={{ fontSize: '12px !important' }} />}
                    label="Locked" size="small"
                    sx={{ fontSize: 10, height: 20, bgcolor: '#dcfce7', color: 'success.dark' }}
                  />
                </Tooltip>
              </Box>

              {sig.signatureData && (
                <Box sx={{
                  bgcolor: 'white', borderRadius: 1, border: '1px solid #e5e7eb',
                  p: 1, textAlign: 'center',
                }}>
                  <img
                    src={sig.signatureData} alt="Signature"
                    style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain' }}
                  />
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {new Date(sig.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
