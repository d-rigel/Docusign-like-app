// src/components/signature/SignaturePanel.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Button, Typography, Divider, Stack,
  Chip, Avatar, Tooltip, CircularProgress, Alert, Slider,
} from '@mui/material';
import { Draw, Delete, CheckCircle, LockOutlined, ZoomIn, ZoomOut } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { signaturesAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';

export default function SignaturePanel({ documentId, socket, canSign, currentUser }) {
  const { signatures, addSignatureLocally } = useDocumentStore();

  const canvasRef    = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn,  setHasDrawn]  = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [sigSize,   setSigSize]   = useState(200);

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
      const r  = canvas.getBoundingClientRect();
      const sx = canvas.width  / r.width;
      const sy = canvas.height / r.height;
      if (e.touches) return {
        x: (e.touches[0].clientX - r.left) * sx,
        y: (e.touches[0].clientY - r.top)  * sy,
      };
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    }

    function start(e) { e.preventDefault(); isDrawingRef.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e)  { e.preventDefault(); if (!isDrawingRef.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); setHasDrawn(true); }
    function stop(e)  { e.preventDefault(); isDrawingRef.current = false; }

    canvas.addEventListener('mousedown',  start);
    canvas.addEventListener('mousemove',  move);
    canvas.addEventListener('mouseup',    stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  move,  { passive: false });
    canvas.addEventListener('touchend',   stop,  { passive: false });
    return () => {
      canvas.removeEventListener('mousedown',  start);
      canvas.removeEventListener('mousemove',  move);
      canvas.removeEventListener('mouseup',    stop);
      canvas.removeEventListener('mouseleave', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove',  move);
      canvas.removeEventListener('touchend',   stop);
    };
  }, [canSign]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) { toast.error('Draw your signature first'); return; }
    setIsSaving(true);
    try {
      const dataURL = canvas.toDataURL('image/png');
      const res = await signaturesAPI.create({
        documentId,
        signatureData: dataURL,
        positionX: 50,
        positionY: 80,
        width:     sigSize,
        height:    Math.round(sigSize * 0.4),
        pageNumber: 1,
      });
      const sig = res.data.data;
      addSignatureLocally(sig);
      socket?.emit('signature:added', { documentId, signature: sig });
      toast.success('Signature placed! Drag it to reposition.');
      handleClear();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to save signature');
    } finally {
      setIsSaving(false);
    }
  };

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
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            1. Draw your signature
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Use your mouse or finger to sign below.
          </Typography>

          <Box sx={{
            border: '2px dashed #d1d5db', borderRadius: 2,
            overflow: 'hidden', cursor: 'crosshair',
            '&:hover': { borderColor: '#1a1a2e' },
            transition: 'border-color 0.2s',
          }}>
            <canvas ref={canvasRef} width={320} height={140}
              style={{ display: 'block', width: '100%', touchAction: 'none' }} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button variant="outlined" size="small" startIcon={<Delete />}
              onClick={handleClear} disabled={!hasDrawn} sx={{ flex: 1 }}>
              Clear
            </Button>
            <Button variant="contained" size="small"
              startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
              onClick={handleSave} disabled={!hasDrawn || isSaving}
              sx={{ flex: 2, bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}>
              {isSaving ? 'Placing…' : 'Place on document'}
            </Button>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
              2. Choose size before placing:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ZoomOut sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Slider
                value={sigSize}
                min={80}
                max={400}
                step={10}
                onChange={(_, v) => setSigSize(Number(v))}
                sx={{ flex: 1, '& .MuiSlider-thumb': { width: 14, height: 14 } }}
              />
              <ZoomIn sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ minWidth: 35, textAlign: 'right', color: 'text.secondary' }}>
                {sigSize}px
              </Typography>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mt: 2, py: 0.5, fontSize: 11 }}>
            After placing, drag &amp; resize signatures directly on the document.
          </Alert>
        </>
      ) : (
        <Alert severity="info">You don't have signing permission.</Alert>
      )}

      <Divider sx={{ my: 2.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          SIGNATURES ({signatures.length})
        </Typography>
      </Divider>

      {signatures.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Draw sx={{ fontSize: 36, color: '#d1d5db', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No signatures yet</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {signatures.map((sig) => (
            <Box key={sig.id} sx={{
              p: 1.5, border: '1px solid #e5e7eb', borderRadius: 2, bgcolor: '#fafafa',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: 'secondary.main' }}>
                  {(sig.signerName || '?')[0].toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="caption" fontWeight={700} noWrap sx={{ display: 'block' }}>
                    {sig.signerName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {sig.signerEmail}
                  </Typography>
                </Box>
                <Chip icon={<LockOutlined sx={{ fontSize: '11px !important' }} />}
                  label="Locked" size="small"
                  sx={{ fontSize: 10, height: 18, bgcolor: '#dcfce7', color: 'success.dark' }} />
              </Box>
              {sig.signatureData && (
                <Box sx={{ bgcolor: 'white', borderRadius: 1, border: '1px solid #e5e7eb', p: 0.5, textAlign: 'center' }}>
                  <img src={sig.signatureData} alt="Signature"
                    style={{ maxWidth: '100%', maxHeight: 50, objectFit: 'contain' }} />
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








