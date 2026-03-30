// src/components/signature/SignatureOverlay.jsx
// Draggable, resizable, deletable signature overlays on the document.
import React, { useRef, useState, useEffect } from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import { LockOutlined, OpenWith, DeleteOutline } from '@mui/icons-material';
import { signaturesAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';
import toast from 'react-hot-toast';

function DraggableSig({ sig, containerRef, canEdit, currentUser, socket, documentId }) {
  const { removeSignatureLocally } = useDocumentStore();

  const isOwn   = sig.signerEmail === currentUser?.email;
  const canMove = canEdit && isOwn;

  const [pos,        setPos]        = useState({ x: sig.positionX || 50,  y: sig.positionY || 80 });
  const [size,       setSize]       = useState({ w: sig.width     || 200, h: sig.height    || 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [active,     setActive]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const dragStart   = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });

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
      x: Math.max(0, Math.min(94, (pxX / w) * 100)),
      y: Math.max(0, Math.min(94, (pxY / h) * 100)),
    };
  }

  // ── Drag ────────────────────────────────────────────────────────────────
  function onDragStart(e) {
    if (!canMove || isResizing) return;
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
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos(pctFromPx(dragStart.current.px + dx, dragStart.current.py + dy));
    }
    function onUp() {
      setIsDragging(false);
      signaturesAPI.updatePosition(sig.id, { positionX: pos.x, positionY: pos.y }).catch(() => {});
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, pos.x, pos.y]);

  // ── Resize ───────────────────────────────────────────────────────────────
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
      setSize({
        w: Math.max(60,  Math.min(500, resizeStart.current.w + (e.clientX - resizeStart.current.mx))),
        h: Math.max(30,  Math.min(250, resizeStart.current.h + (e.clientY - resizeStart.current.my))),
      });
    }
    function onUp() {
      setIsResizing(false);
      signaturesAPI.updatePosition(sig.id, { width: size.w, height: size.h }).catch(() => {});
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isResizing, size.w, size.h]);

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(e) {
    e.stopPropagation();
    if (!window.confirm('Remove this signature from the document?')) return;
    setDeleting(true);
    try {
      await signaturesAPI.remove(sig.id);
      removeSignatureLocally(sig.id);
      socket?.emit('signature:removed', { documentId, signatureId: sig.id });
      toast.success('Signature removed');
    } catch {
      toast.error('Could not remove signature');
      setDeleting(false);
    }
  }

  // ── Dismiss active on outside click ─────────────────────────────────────
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
        opacity:     deleting ? 0.4 : 1,
      }}
    >
      {/* Signature image */}
      <Box sx={{
        width: '100%', height: '100%',
        border:         active ? '2px solid #1a1a2e' : '1px dashed #94a3b8',
        borderRadius:   1,
        bgcolor:        'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(2px)',
        overflow:       'hidden',
        position:       'relative',
        boxShadow:      active ? '0 4px 16px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.08)',
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
          bgcolor:  'rgba(26,26,46,0.78)',
          px: 0.8, py: 0.2,
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
          {canMove && <OpenWith sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />}
        </Box>
      </Box>

      {/* Delete button — shown on hover/active, only for own signature */}
      {canMove && active && (
        <Tooltip title="Remove signature">
          <IconButton
            size="small"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            disabled={deleting}
            sx={{
              position: 'absolute',
              top: -12, right: -12,
              width: 22, height: 22,
              bgcolor: '#ef4444',
              color: 'white',
              zIndex: 102,
              border: '2px solid white',
              '&:hover': { bgcolor: '#dc2626' },
              '& svg': { fontSize: 13 },
            }}
          >
            <DeleteOutline />
          </IconButton>
        </Tooltip>
      )}

      {/* Resize handle — bottom-right corner */}
      {canMove && (
        <Box
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
          sx={{
            position: 'absolute', bottom: -5, right: -5,
            width: 14, height: 14,
            bgcolor: active ? '#1a1a2e' : '#94a3b8',
            borderRadius: '2px',
            cursor: 'se-resize',
            zIndex: 101,
            border: '2px solid white',
            transition: 'bgcolor 0.15s',
            '&:hover': { bgcolor: 'secondary.main' },
          }}
        />
      )}

      {/* Hover hint — shown when inactive */}
      {canMove && !active && (
        <Box sx={{
          position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'rgba(0,0,0,0.65)', color: 'white',
          fontSize: 9, px: 0.8, py: 0.2, borderRadius: 1,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          opacity: 0,
          '.MuiBox-root:hover > &': { opacity: 1 },
        }}>
          Click to select · Drag to move · ↘ to resize
        </Box>
      )}
    </Box>
  );
}

export default function SignatureOverlay({ documentId, canEdit, currentUser, socket }) {
  const { signatures } = useDocumentStore();
  const containerRef   = useRef(null);

  // Listen for remote signature removals
  useEffect(() => {
    if (!socket) return;
    const { removeSignatureLocally } = useDocumentStore.getState();
    const handler = ({ signatureId }) => removeSignatureLocally(signatureId);
    socket.on('signature:removed', handler);
    return () => socket.off('signature:removed', handler);
  }, [socket]);

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
          socket={socket}
          documentId={documentId}
        />
      ))}
    </Box>
  );
}


