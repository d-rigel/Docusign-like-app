// src/components/editor/CollaborativeEditor.jsx
// Exposes setHtmlContent(html) via forwardRef so parent can push file content into editor.
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
  ['link', 'image'],
  ['clean'],
];

const CollaborativeEditor = forwardRef(function CollaborativeEditor(
  { documentId, initialContent, readOnly, socket, onContentChange, currentUser },
  ref
) {
  const containerRef   = useRef(null);
  const quillRef       = useRef(null);
  const isRemoteRef    = useRef(false);
  const initializedRef = useRef(false);

  // Expose setHtmlContent to parent via ref
  useImperativeHandle(ref, () => ({
    setHtmlContent(html) {
      const quill = quillRef.current;
      if (!quill) return;
      isRemoteRef.current = true;
      quill.clipboard.dangerouslyPasteHTML(html);
      isRemoteRef.current = false;
      // Trigger onContentChange so it gets autosaved
      const content = JSON.stringify(quill.getContents());
      onContentChange?.(content);
    },
    getContent() {
      return quillRef.current ? JSON.stringify(quillRef.current.getContents()) : '';
    },
  }), [onContentChange]);

  // ── Mount Quill once ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

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
      initializedRef.current = false;
      quillRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []); // eslint-disable-line

  // ── readOnly toggle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (quillRef.current) quillRef.current.enable(!readOnly);
  }, [readOnly]);

  // ── Local edits → socket + autosave ───────────────────────────────────────
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    let typingTimer = null;

    const handleChange = (delta, _old, source) => {
      if (source !== 'user' || isRemoteRef.current) return;

      socket?.emit('doc:delta',    { documentId, delta, version: Date.now() });
      socket?.emit('typing:start', { documentId });

      const range = quill.getSelection();
      if (range) socket?.emit('cursor:move', { documentId, range });

      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => socket?.emit('typing:stop', { documentId }), 1500);

      onContentChange?.(JSON.stringify(quill.getContents()));
    };

    quill.on('text-change', handleChange);
    return () => { quill.off('text-change', handleChange); clearTimeout(typingTimer); };
  }, [socket, documentId, onContentChange]);

  // ── Receive remote deltas ─────────────────────────────────────────────────
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
        if (delta?.ops) quillRef.current.setContents(delta, 'api');
        else quillRef.current.clipboard.dangerouslyPasteHTML(content);
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
    <Box ref={containerRef} sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      '& .ql-toolbar': {
        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
        borderBottom: '1px solid #e5e7eb', bgcolor: '#fafafa',
        flexShrink: 0,
      },
      '& .ql-container': { border: 'none', flexGrow: 1, fontSize: '16px', fontFamily: '"Lora", serif' },
      '& .ql-editor':    { minHeight: '500px', padding: '40px 60px', lineHeight: 1.9, color: '#1a1a2e' },
    }} />
  );
});

export default CollaborativeEditor;



