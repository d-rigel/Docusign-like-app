// src/components/editor/CollaborativeEditor.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean'],
];

export default function CollaborativeEditor({
  documentId,
  initialContent,
  readOnly,
  socket,
  onContentChange,
  currentUser,
}) {
  const editorRef   = useRef(null);
  const quillRef    = useRef(null);
  const isRemoteRef = useRef(false); // prevent echo of remote changes

  // ── Init Quill ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current || quillRef.current) return;

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      readOnly,
      modules: {
        toolbar: readOnly ? false : TOOLBAR_OPTIONS,
        history: { delay: 1000, maxStack: 100, userOnly: true },
      },
      placeholder: readOnly ? '' : 'Start writing your document…',
    });

    // Load initial content
    if (initialContent) {
      try {
        // Try JSON delta first
        const delta = JSON.parse(initialContent);
        if (delta && delta.ops) {
          quill.setContents(delta, 'silent');
        } else {
          quill.clipboard.dangerouslyPasteHTML(initialContent);
        }
      } catch {
        quill.clipboard.dangerouslyPasteHTML(initialContent || '');
      }
    }

    quillRef.current = quill;

    return () => {
      quillRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Sync readOnly changes ──────────────────────────────────────────────
  useEffect(() => {
    if (quillRef.current) quillRef.current.enable(!readOnly);
  }, [readOnly]);

  // ── Text-change handler (local edits → socket + autosave) ─────────────
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const handleChange = (delta, _oldDelta, source) => {
      if (source !== 'user' || isRemoteRef.current) return;

      // Emit delta for real-time sync
      socket?.emit('doc:delta', {
        documentId,
        delta,
        version: Date.now(),
        source: 'user',
      });

      // Emit cursor
      const range = quill.getSelection();
      if (range) {
        socket?.emit('cursor:move', { documentId, range });
      }

      // Trigger typing indicator
      socket?.emit('typing:start', { documentId });

      // Autosave: pass JSON delta string
      const content = JSON.stringify(quill.getContents());
      onContentChange?.(content);
    };

    quill.on('text-change', handleChange);
    return () => quill.off('text-change', handleChange);
  }, [socket, documentId, onContentChange]);

  // ── Receive remote deltas from socket ─────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDelta = ({ delta, senderId }) => {
      if (!quillRef.current) return;
      isRemoteRef.current = true;
      quillRef.current.updateContents(delta, 'api');
      isRemoteRef.current = false;
    };

    // Full content sync (e.g. from snapshot on join)
    const handleSnapshot = ({ content }) => {
      if (!quillRef.current || !content) return;
      isRemoteRef.current = true;
      try {
        const delta = JSON.parse(content);
        if (delta?.ops) {
          quillRef.current.setContents(delta, 'api');
        } else {
          quillRef.current.clipboard.dangerouslyPasteHTML(content);
        }
      } catch {
        quillRef.current.clipboard.dangerouslyPasteHTML(content);
      }
      isRemoteRef.current = false;
    };

    socket.on('doc:delta',    handleRemoteDelta);
    socket.on('doc:snapshot', handleSnapshot);
    socket.on('doc:content',  handleSnapshot);

    return () => {
      socket.off('doc:delta',    handleRemoteDelta);
      socket.off('doc:snapshot', handleSnapshot);
      socket.off('doc:content',  handleSnapshot);
    };
  }, [socket]);

  // ── Typing stop after idle ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    let timer;
    const stopTyping = () => {
      clearTimeout(timer);
      timer = setTimeout(() => socket.emit('typing:stop', { documentId }), 1500);
    };
    const el = editorRef.current;
    el?.addEventListener('keyup', stopTyping);
    return () => {
      el?.removeEventListener('keyup', stopTyping);
      clearTimeout(timer);
    };
  }, [socket, documentId]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={editorRef} style={{ flexGrow: 1, fontFamily: '"Lora", serif' }} />
    </Box>
  );
}
