import React, { useEffect, useRef } from 'react';
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
  const containerRef = useRef(null);  // The div Quill mounts into
  const quillRef     = useRef(null);  // The Quill instance
  const isRemoteRef  = useRef(false);
  const initializedRef = useRef(false); // Guard against StrictMode double-init

  // ── Mount Quill ONCE ───────────────────────────────────────────────────
  useEffect(() => {
    // StrictMode runs effects twice in dev — this guard prevents double init
    if (initializedRef.current) return;
    if (!containerRef.current) return;

    initializedRef.current = true;

    // Create a fresh inner div for Quill to own — avoids React conflicts
    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme:    'snow',
      readOnly: readOnly,
      modules: {
        toolbar: readOnly ? false : TOOLBAR_OPTIONS,
        history: { delay: 1000, maxStack: 100, userOnly: true },
      },
      placeholder: readOnly ? '' : 'Start writing your document…',
    });

    // Load initial content
    if (initialContent) {
      try {
        const delta = JSON.parse(initialContent);
        if (delta && Array.isArray(delta.ops)) {
          quill.setContents(delta, 'silent');
        } else {
          quill.clipboard.dangerouslyPasteHTML(initialContent);
        }
      } catch {
        if (initialContent.trim()) {
          quill.clipboard.dangerouslyPasteHTML(initialContent);
        }
      }
    }

    quillRef.current = quill;

    return () => {
      // Cleanup on unmount
      initializedRef.current = false;
      quillRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle readOnly when prop changes ─────────────────────────────────
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!readOnly);
    }
  }, [readOnly]);

  // ── Local edits → socket + autosave ───────────────────────────────────
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    let typingTimer = null;

    const handleChange = (delta, _old, source) => {
      if (source !== 'user' || isRemoteRef.current) return;

      // Broadcast delta to other collaborators
      socket?.emit('doc:delta', {
        documentId,
        delta,
        version: Date.now(),
      });

      // Broadcast cursor position
      const range = quill.getSelection();
      if (range) {
        socket?.emit('cursor:move', { documentId, range });
      }

      // Typing indicator
      socket?.emit('typing:start', { documentId });
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        socket?.emit('typing:stop', { documentId });
      }, 1500);

      // Autosave — pass the Quill delta as JSON string
      const content = JSON.stringify(quill.getContents());
      onContentChange?.(content);
    };

    quill.on('text-change', handleChange);
    return () => {
      quill.off('text-change', handleChange);
      clearTimeout(typingTimer);
    };
  }, [socket, documentId, onContentChange]);

  // ── Receive remote deltas ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleDelta = ({ delta }) => {
      if (!quillRef.current) return;
      isRemoteRef.current = true;
      quillRef.current.updateContents(delta, 'api');
      isRemoteRef.current = false;
    };

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

    socket.on('doc:delta',    handleDelta);
    socket.on('doc:snapshot', handleSnapshot);
    socket.on('doc:content',  handleSnapshot);

    return () => {
      socket.off('doc:delta',    handleDelta);
      socket.off('doc:snapshot', handleSnapshot);
      socket.off('doc:content',  handleSnapshot);
    };
  }, [socket]);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '& .ql-toolbar': {
          borderTop:    'none',
          borderLeft:   'none',
          borderRight:  'none',
          borderBottom: '1px solid #e5e7eb',
          bgcolor:      '#fafafa',
        },
        '& .ql-container': {
          border:     'none',
          flexGrow:    1,
          fontSize:   '16px',
          fontFamily: '"Lora", serif',
        },
        '& .ql-editor': {
          minHeight:  '500px',
          padding:    '40px 60px',
          lineHeight: 1.9,
          color:      '#1a1a2e',
        },
      }}
    />
  );
}
