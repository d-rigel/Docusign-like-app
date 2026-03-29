// src/pages/EditorPage.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Button, Chip,
  Drawer, Tabs, Tab, Tooltip, CircularProgress, Alert, LinearProgress,
} from '@mui/material';
import {
  ArrowBack, Save, People, History, Assignment,
  Draw, Share, AutoStories, CheckCircle,
  Download, PictureAsPdf, Image as ImageIcon, InsertDriveFile,
  FileOpen, Scanner,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import useDocumentStore from '../store/documentStore';
import useAuthStore     from '../store/authStore';
import { connectSocket } from '../services/socket';
import { documentsAPI }  from '../services/api';

import CollaborativeEditor from '../components/editor/CollaborativeEditor';
import PresenceBar         from '../components/editor/PresenceBar';
import SignaturePanel      from '../components/signature/SignaturePanel';
import CollaboratorsPanel  from '../components/documents/CollaboratorsPanel';
import VersionsPanel       from '../components/documents/VersionsPanel';
import AuditLogPanel       from '../components/documents/AuditLogPanel';
import InviteDialog        from '../components/documents/InviteDialog';
import NotificationToast   from '../components/common/NotificationToast';

const DRAWER_WIDTH = 380;

function getFileType(file) {
  const mime = (file?.mime || file?.type || '').toLowerCase();
  const name = (file?.name || '').toLowerCase();
  if (mime.includes('pdf')    || name.endsWith('.pdf'))               return 'pdf';
  if (mime.startsWith('image')|| /\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'image';
  if (mime.includes('word')   || /\.(doc|docx)$/.test(name))         return 'word';
  if (mime.includes('text')   || name.endsWith('.txt'))               return 'text';
  return 'other';
}

function FileIcon({ type }) {
  const sx = { fontSize: 18 };
  if (type === 'pdf')   return <PictureAsPdf    sx={{ ...sx, color: '#e94560' }} />;
  if (type === 'image') return <ImageIcon       sx={{ ...sx, color: '#3b82f6' }} />;
  if (type === 'word')  return <InsertDriveFile sx={{ ...sx, color: '#2563eb' }} />;
  return <InsertDriveFile sx={{ ...sx, color: '#6b7280' }} />;
}

// Import step label shown while processing
const IMPORT_STEPS = {
  pdf:   ['Downloading from Cloudinary…', 'Extracting text from PDF…', 'Loading into editor…'],
  image: ['Downloading from Cloudinary…', 'Running OCR scan…',         'Loading into editor…'],
  word:  ['Downloading from Cloudinary…', 'Parsing Word document…',    'Loading into editor…'],
  text:  ['Downloading from Cloudinary…', 'Reading text file…',        'Loading into editor…'],
  other: ['Downloading from Cloudinary…', 'Processing file…',          'Loading into editor…'],
};

function AttachmentBar({ file, onImport, importing, importStep, canEdit, alreadyImported, wasScanned }) {
  const fileType  = getFileType(file);
  const fileUrl   = file?.url || '';
  const sizeKB    = file?.size ? `${(file.size / 1024).toFixed(1)} KB` : '';
  const canImport = ['pdf', 'image', 'word', 'text'].includes(fileType);
  const steps     = IMPORT_STEPS[fileType] || IMPORT_STEPS.other;
  const stepLabel = steps[importStep] || 'Processing…';

  const handleDownload = () => {
    if (!fileUrl) { toast.error('File URL not available'); return; }
    // Open the Cloudinary URL directly — works for authenticated downloads too
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: '#f8f7f4' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2.5, py: 1.2, flexWrap: 'wrap', rowGap: 1,
      }}>
        <FileIcon type={fileType} />

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>{file.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">
              {fileType.toUpperCase()} · {sizeKB}
            </Typography>
            {alreadyImported && (
              <Chip
                label={wasScanned ? '🔍 OCR extracted' : '✓ Content loaded'}
                size="small"
                sx={{ fontSize: 10, height: 18,
                  bgcolor: wasScanned ? '#fef3c7' : '#dcfce7',
                  color:   wasScanned ? '#92400e' : '#14532d',
                }}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          {canEdit && canImport && (
            <Tooltip title={
              alreadyImported
                ? 'Re-extract file content into the editor'
                : fileType === 'image'
                  ? 'Run OCR to extract text from this image, then load it into the editor'
                  : 'Extract content from this file and load it into the editor for editing'
            }>
              <Button
                size="small" variant="contained"
                startIcon={importing
                  ? <CircularProgress size={12} color="inherit" />
                  : fileType === 'image' ? <Scanner /> : <FileOpen />
                }
                onClick={onImport}
                disabled={importing}
                sx={{
                  fontSize: 11, py: 0.5,
                  bgcolor: alreadyImported ? 'primary.main' : 'secondary.main',
                  '&:hover': { bgcolor: alreadyImported ? 'primary.dark' : 'secondary.dark' },
                }}
              >
                {importing
                  ? stepLabel
                  : alreadyImported
                    ? 'Re-extract'
                    : fileType === 'image' ? 'OCR & Load' : 'Load into editor'
                }
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Open original file in new tab">
            <Button
              size="small" variant="outlined"
              startIcon={<Download sx={{ fontSize: 13 }} />}
              onClick={handleDownload}
              sx={{ fontSize: 11, py: 0.5 }}
            >
              View original
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Progress bar while importing */}
      {importing && (
        <Box sx={{ px: 2.5, pb: 1.5 }}>
          <LinearProgress
            variant="indeterminate"
            sx={{ height: 3, borderRadius: 2, mb: 0.5 }}
          />
          <Typography variant="caption" color="text.secondary">
            {stepLabel} This may take 10–30 seconds for large files.
          </Typography>
        </Box>
      )}

      {/* Scanned document notice */}
      {alreadyImported && wasScanned && !importing && (
        <Alert severity="warning" sx={{ mx: 2, mb: 1.5, py: 0.3, fontSize: 12 }}>
          This was a <strong>scanned document</strong> — OCR was used to extract text. 
          Some words may be inaccurate. Review and correct the content above.
        </Alert>
      )}
    </Box>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EditorPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { currentDoc, fetchDocument, updateDocument, clearCurrent, isLoading } = useDocumentStore();

  const [sideTab,         setSideTab]         = useState(0);
  const [drawerOpen,      setDrawerOpen]       = useState(false);
  const [inviteOpen,      setInviteOpen]       = useState(false);
  const [isSaving,        setIsSaving]         = useState(false);
  const [onlineUsers,     setOnlineUsers]      = useState([]);
  const [notification,    setNotification]     = useState(null);
  const [docReady,        setDocReady]         = useState(false);
  const [importing,       setImporting]        = useState(false);
  const [importStep,      setImportStep]       = useState(0);
  const [alreadyImported, setAlreadyImported]  = useState(false);
  const [wasScanned,      setWasScanned]       = useState(false);

  const socketRef    = useRef(null);
  const saveTimerRef = useRef(null);
  const contentRef   = useRef('');
  const editorRef    = useRef(null);

  const isOwner  = currentDoc?.owner?.id === user?.id;
  const myCollab = currentDoc?.collaborators?.find((c) => c.user?.id === user?.id);
  const canEdit  = isOwner || ['editor', 'admin'].includes(myCollab?.role);
  const canSign  = isOwner || ['signer', 'editor', 'admin'].includes(myCollab?.role);
  const originalFile = currentDoc?.originalFile || null;
  const fileType     = getFileType(originalFile);

  // ── Fetch doc ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setDocReady(false);
    setAlreadyImported(false);
    setWasScanned(false);
    fetchDocument(id)
      .then((doc) => {
        // If document already has content, mark as already imported
        if (doc?.content && doc.content.length > 10) {
          setAlreadyImported(true);
        }
        setDocReady(true);
      })
      .catch(() => { toast.error('Document not found or access denied'); navigate('/'); });
    return () => { clearCurrent(); setDocReady(false); };
  }, [id]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const socket = connectSocket();
    socketRef.current = socket;
    socket.emit('doc:join', {
      documentId: id,
      user: { userId: user.id, name: user.username || user.email, email: user.email },
    });
    socket.on('presence:update', ({ users }) =>
      setOnlineUsers(users.filter((u) => u.email !== user.email)));
    socket.on('notification', (notif) => {
      setNotification(notif);
      setTimeout(() => setNotification(null), 4000);
    });
    return () => { socket.off('presence:update'); socket.off('notification'); };
  }, [user, id]);

  // ── Autosave ───────────────────────────────────────────────────────────────
  const scheduleAutosave = useCallback((content) => {
    contentRef.current = content;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await updateDocument(id, { content });
      } catch {
        toast.error('Autosave failed');
      } finally {
        setIsSaving(false);
      }
    }, 3000);
  }, [id, updateDocument]);

  const handleManualSave = useCallback(async () => {
    clearTimeout(saveTimerRef.current);
    setIsSaving(true);
    try {
      await updateDocument(id, { content: contentRef.current });
      toast.success('Document saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [id, updateDocument]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (canEdit) handleManualSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canEdit, handleManualSave]);

  // ── Import file content into editor ───────────────────────────────────────
  const handleImportFile = useCallback(async () => {
    if (!originalFile) return;
    setImporting(true);
    setImportStep(0);

    // Simulate step progression for UX
    const stepTimer1 = setTimeout(() => setImportStep(1), 1500);
    const stepTimer2 = setTimeout(() => setImportStep(2), 4000);

    try {
      const res = await documentsAPI.parseFile(id);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const { html, wasScanned: scanned, filename } = res.data.data;
      if (!html) throw new Error('No content was extracted from the file');

      // Load into Quill editor
      if (editorRef.current?.setHtmlContent) {
        editorRef.current.setHtmlContent(html);
      }

      setAlreadyImported(true);
      setWasScanned(!!scanned);

      // Save the extracted content
      contentRef.current = html;
      await updateDocument(id, { content: html });

      if (scanned) {
        toast.success(`Scanned document processed with OCR ✓ Review for accuracy.`, { duration: 5000 });
      } else {
        toast.success(`${filename || 'File'} content loaded into editor ✓`);
      }
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      const msg = err.response?.data?.error?.message || err.message || 'Could not extract file content';
      toast.error(msg, { duration: 6000 });
      console.error('[import-file]', err);
    } finally {
      setImporting(false);
      setImportStep(0);
    }
  }, [id, originalFile, updateDocument]);

  if (isLoading && !currentDoc) {
    return (
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!currentDoc) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <AppBar position="static" elevation={0}
        sx={{ bgcolor: 'primary.main', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Toolbar sx={{ gap: 1, minHeight: '56px !important' }}>
          <Tooltip title="Back to dashboard">
            <IconButton color="inherit" size="small" onClick={() => navigate('/')}><ArrowBack /></IconButton>
          </Tooltip>
          <AutoStories sx={{ fontSize: 20, mx: 0.5 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ fontFamily: '"Lora", serif' }}>
              {currentDoc.title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {isSaving ? 'Saving…' : 'All changes saved'} · {canEdit ? 'Editor' : 'Viewer'}
            </Typography>
          </Box>
          <PresenceBar users={onlineUsers} />
          <Chip label={currentDoc.status || 'draft'} size="small" variant="outlined"
            sx={{ color:'white', borderColor:'rgba(255,255,255,0.4)', textTransform:'capitalize', fontSize:11 }} />
          {canEdit && (
            <Tooltip title="Save (Ctrl+S)">
              <IconButton color="inherit" size="small" onClick={handleManualSave} disabled={isSaving}>
                {isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
              </IconButton>
            </Tooltip>
          )}
          {isOwner && (
            <Tooltip title="Invite collaborators">
              <Button color="inherit" startIcon={<Share />} size="small"
                onClick={() => setInviteOpen(true)}
                sx={{ border: '1px solid rgba(255,255,255,0.4)' }}>
                Invite
              </Button>
            </Tooltip>
          )}
          {canSign && (
            <Tooltip title="Sign document">
              <IconButton color="inherit" size="small"
                onClick={() => { setSideTab(0); setDrawerOpen(true); }}>
                <Draw />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Panels">
            <IconButton color="inherit" size="small" onClick={() => setDrawerOpen(!drawerOpen)}>
              <People />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {!canEdit && (
        <Alert severity="info" icon={<CheckCircle />} sx={{ borderRadius: 0, py: 0.5 }}>
          You have <strong>view-only</strong> access to this document.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Box sx={{
          flexGrow: 1, overflow: 'auto', bgcolor: '#f0ede8',
          display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2,
        }}>
          <Box sx={{
            width: '100%', maxWidth: 860, my: 3, mb: 4,
            bgcolor: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            borderRadius: 2, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            minHeight: 'calc(100vh - 120px)',
          }}>
            {originalFile && (
              <AttachmentBar
                file={originalFile}
                onImport={handleImportFile}
                importing={importing}
                importStep={importStep}
                canEdit={canEdit}
                alreadyImported={alreadyImported}
                wasScanned={wasScanned}
              />
            )}

            {docReady ? (
              <CollaborativeEditor
                key={`editor-${id}`}
                ref={editorRef}
                documentId={id}
                initialContent={currentDoc.content || ''}
                readOnly={!canEdit}
                socket={socketRef.current}
                onContentChange={scheduleAutosave}
                currentUser={user}
              />
            ) : (
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', flexGrow:1, py:8 }}>
                <CircularProgress size={28} />
              </Box>
            )}
          </Box>
        </Box>

        <Drawer anchor="right" variant="persistent" open={drawerOpen}
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0, flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH, position: 'relative', height: '100%',
              border: 'none', borderLeft: '1px solid #e5e7eb',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            },
          }}>
          <Tabs value={sideTab} onChange={(_, v) => setSideTab(v)}
            variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 44 }}>
            <Tab icon={<Draw />}       iconPosition="start" label="Sign"     sx={{ minHeight:44, fontSize:12, py:0 }} />
            <Tab icon={<People />}     iconPosition="start" label="Team"     sx={{ minHeight:44, fontSize:12, py:0 }} />
            <Tab icon={<History />}    iconPosition="start" label="Versions" sx={{ minHeight:44, fontSize:12, py:0 }} />
            <Tab icon={<Assignment />} iconPosition="start" label="Audit"    sx={{ minHeight:44, fontSize:12, py:0 }} />
          </Tabs>
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {sideTab === 0 && <SignaturePanel documentId={id} socket={socketRef.current} canSign={canSign} currentUser={user} />}
            {sideTab === 1 && <CollaboratorsPanel documentId={id} isOwner={isOwner} currentUser={user} />}
            {sideTab === 2 && <VersionsPanel documentId={id} canEdit={canEdit} />}
            {sideTab === 3 && <AuditLogPanel documentId={id} />}
          </Box>
        </Drawer>
      </Box>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} documentId={id} />
      {notification && <NotificationToast notification={notification} />}
    </Box>
  );
}


