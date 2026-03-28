// src/components/signature/SignaturePanel.jsx
// FIX: Use native HTML5 Canvas API instead of Fabric.js to avoid v6/v7 import issues.
// The canvas-based signature drawing is simpler, more reliable, and has zero deps.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Button, Typography, Divider, Stack,
  Chip, Avatar, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import { Draw, Delete, CheckCircle, LockOutlined } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { signaturesAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';

export default function SignaturePanel({ documentId, socket, canSign, currentUser }) {
  const { signatures, addSignatureLocally } = useDocumentStore();

  const canvasRef    = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef   = useRef({ x: 0, y: 0 });
  const [hasDrawn,   setHasDrawn]  = useState(false);
  const [isSaving,   setIsSaving]  = useState(false);

  // ── Init native canvas drawing ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canSign) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top)  * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY,
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos(e);
      lastPosRef.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      lastPosRef.current = pos;
      setHasDrawn(true);
    }

    function stopDraw(e) {
      e.preventDefault();
      isDrawingRef.current = false;
    }

    // Mouse events
    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    // Touch events
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   stopDraw,  { passive: false });

    return () => {
      canvas.removeEventListener('mousedown',  startDraw);
      canvas.removeEventListener('mousemove',  draw);
      canvas.removeEventListener('mouseup',    stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove',  draw);
      canvas.removeEventListener('touchend',   stopDraw);
    };
  }, [canSign]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      toast.error('Please draw your signature first');
      return;
    }
    setIsSaving(true);
    try {
      const dataURL = canvas.toDataURL('image/png');

      const res = await signaturesAPI.create({
        documentId,
        signatureData: dataURL,
        positionX:  0,
        positionY:  0,
        pageNumber: 1,
      });

      const sig = res.data.data;
      addSignatureLocally(sig);

      socket?.emit('signature:added', { documentId, signature: sig });

      toast.success('Signature applied!');
      handleClear();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to save signature');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Remote signature events ────────────────────────────────────────────
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
      {canSign ? (
        <>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Draw your signature
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Click and drag (or use your finger) to draw your signature below.
          </Typography>

          <Box sx={{
            border: '2px dashed #d1d5db', borderRadius: 2, overflow: 'hidden',
            cursor: 'crosshair',
            '&:hover': { borderColor: '#1a1a2e' },
            transition: 'border-color 0.2s',
            bgcolor: '#fafafa',
          }}>
            <canvas
              ref={canvasRef}
              width={320}
              height={160}
              style={{ display: 'block', width: '100%', touchAction: 'none' }}
            />
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
              variant="contained" size="small"
              startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
              onClick={handleSave}
              disabled={!hasDrawn || isSaving}
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

      {/* Existing signatures list */}
      <Divider sx={{ my: 2.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          SIGNATURES ({signatures.length})
        </Typography>
      </Divider>

      {signatures.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Draw sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No signatures yet</Typography>
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
                  <Typography variant="caption" fontWeight={700} noWrap sx={{ display: 'block' }}>
                    {sig.signerName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
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
                  bgcolor: 'white', borderRadius: 1,
                  border: '1px solid #e5e7eb', p: 1, textAlign: 'center',
                }}>
                  <img
                    src={sig.signatureData}
                    alt={`Signature by ${sig.signerName}`}
                    style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain' }}
                  />
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Signed {new Date(sig.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}




