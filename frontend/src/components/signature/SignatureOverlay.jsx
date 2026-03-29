// src/components/signature/SignatureOverlay.jsx
// Pure JSX — no TypeScript annotations anywhere.
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { LockOutlined, OpenWith } from '@mui/icons-material';
import { signaturesAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';

function DraggableSig({ sig, containerRef, canEdit, currentUser }) {
  const isOwn   = sig.signerEmail === currentUser?.email;
  const canMove = canEdit && isOwn;

  const [pos,        setPos]        = useState({ x: sig.positionX || 50,  y: sig.positionY || 80 });
  const [size,       setSize]       = useState({ w: sig.width     || 200, h: sig.height    || 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [active,     setActive]     = useState(false);

  const dragStart   = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  // Convert % position → px within the container
  function getContainerSize() {
    const el = containerRef.current;
    if (!el) return { w: 800, h: 600 };
    return { w: el.offsetWidth, h: el.offsetHeight };
  }

  function pxFromPct() {
    const { w, h } = getContainerSize();
    return { x: (pos.x / 100) * w, y: (pos.y / 100) * h };
  }

  function pctFromPx(pxX, pxY) {
    const { w, h } = getContainerSize();
    return {
      x: Math.max(0, Math.min(95, (pxX / w) * 100)),
      y: Math.max(0, Math.min(95, (pxY / h) * 100)),
    };
  }

  // ── Drag ──────────────────────────────────────────────────────────────
  function onDragStart(e) {
    if (!canMove) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActive(true);
    const { x, y } = pxFromPct();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: x, py: y };
  }

  useEffect(() => {
    if (!isDragging) return;
    function onMove(e) {
      const dx   = e.clientX - dragStart.current.mx;
      const dy   = e.clientY - dragStart.current.my;
      const newX = dragStart.current.px + dx;
      const newY = dragStart.current.py + dy;
      setPos(pctFromPx(newX, newY));
    }
    function onUp() {
      setIsDragging(false);
      signaturesAPI.updatePosition(sig.id, { positionX: pos.x, positionY: pos.y })
        .catch(() => {});
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [isDragging, pos.x, pos.y]);

  // ── Resize ────────────────────────────────────────────────────────────
  function onResizeStart(e) {
    if (!canMove) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setActive(true);
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
  }

  useEffect(() => {
    if (!isResizing) return;
    function onMove(e) {
      const dw = e.clientX - resizeStart.current.mx;
      const dh = e.clientY - resizeStart.current.my;
      setSize({
        w: Math.max(60,  Math.min(500, resizeStart.current.w + dw)),
        h: Math.max(30,  Math.min(250, resizeStart.current.h + dh)),
      });
    }
    function onUp() {
      setIsResizing(false);
      signaturesAPI.updatePosition(sig.id, { width: size.w, height: size.h })
        .catch(() => {});
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [isResizing, size.w, size.h]);

  // Dismiss active highlight when clicking elsewhere
  useEffect(() => {
    if (!active) return;
    function onDocClick() { setActive(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [active]);

  const { x: px, y: py } = pxFromPct();

  return (
    <Box
      onMouseDown={(e) => { e.stopPropagation(); setActive(true); if (canMove) onDragStart(e); }}
      sx={{
        position:   'absolute',
        left:        px,
        top:         py,
        width:       size.w,
        height:      size.h,
        zIndex:      active ? 100 : 10,
        userSelect:  'none',
        cursor:      canMove ? (isDragging ? 'grabbing' : 'grab') : 'default',
        transition:  isDragging || isResizing ? 'none' : 'box-shadow 0.15s',
      }}
    >
      {/* Signature image box */}
      <Box sx={{
        width:          '100%',
        height:         '100%',
        border:          active ? '2px solid #1a1a2e' : '1px dashed #94a3b8',
        borderRadius:    1,
        bgcolor:         'rgba(255,255,255,0.88)',
        backdropFilter:  'blur(2px)',
        overflow:        'hidden',
        position:        'relative',
        boxShadow:       active ? '0 4px 16px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <img
          src={sig.signatureData}
          alt={`Signature by ${sig.signerName}`}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />

        {/* Bottom label bar */}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          bgcolor: 'rgba(26,26,46,0.78)',
          px: 0.8, py: 0.3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <LockOutlined sx={{ fontSize: 10, color: '#10b981', flexShrink: 0 }} />
            <Box component="span" sx={{
              fontSize: 9, color: 'white',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {sig.signerName}
            </Box>
          </Box>
          {canMove && <OpenWith sx={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />}
        </Box>
      </Box>

      {/* Resize handle — bottom-right corner */}
      {canMove && (
        <Box
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
          sx={{
            position: 'absolute', bottom: -5, right: -5,
            width: 14, height: 14,
            bgcolor: '#1a1a2e', borderRadius: '2px',
            cursor: 'se-resize',
            zIndex: 101,
            border: '2px solid white',
            '&:hover': { bgcolor: 'secondary.main' },
          }}
        />
      )}
    </Box>
  );
}

export default function SignatureOverlay({ documentId, canEdit, currentUser }) {
  const { signatures } = useDocumentStore();
  const containerRef   = useRef(null);

  if (signatures.length === 0) return null;

  return (
    <Box
      ref={containerRef}
      sx={{
        position:      'absolute',
        inset:          0,
        pointerEvents: 'none',
        zIndex:         50,
        '& > *':       { pointerEvents: 'auto' },
      }}
    >
      {signatures.map((sig) => (
        <DraggableSig
          key={sig.id}
          sig={sig}
          containerRef={containerRef}
          canEdit={canEdit}
          currentUser={currentUser}
        />
      ))}
    </Box>
  );
}
