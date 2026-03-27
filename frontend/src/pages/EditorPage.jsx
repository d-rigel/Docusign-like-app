// src/pages/EditorPage.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Button, Chip,
  Drawer, Tabs, Tab, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import {
  ArrowBack, Save, People, History, Assignment,
  Draw, Share, AutoStories, CheckCircle,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import useDocumentStore from '../store/documentStore';
import useAuthStore from '../store/authStore';
import { connectSocket, disconnectSocket } from '../services/socket';
import { documentsAPI } from '../services/api';

import CollaborativeEditor from '../components/editor/CollaborativeEditor';
import PresenceBar         from '../components/editor/PresenceBar';
import SignaturePanel      from '../components/signature/SignaturePanel';
import CollaboratorsPanel  from '../components/documents/CollaboratorsPanel';
import VersionsPanel       from '../components/documents/VersionsPanel';
import AuditLogPanel       from '../components/documents/AuditLogPanel';
import InviteDialog        from '../components/documents/InviteDialog';
import NotificationToast   from '../components/common/NotificationToast';

const DRAWER_WIDTH = 380;

export default function EditorPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const { currentDoc, fetchDocument, updateDocument, clearCurrent, isLoading } = useDocumentStore();

  const [sideTab,      setSideTab]      = useState(0);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [inviteOpen,   setInviteOpen]   = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [notification, setNotification] = useState(null);

  const socketRef    = useRef(null);
  const saveTimerRef = useRef(null);
  const contentRef   = useRef('');

  // ── Permission helpers ────────────────────────────────────────────────────
  const isOwner = currentDoc?.owner?.id === user?.id;
  const myCollab = currentDoc?.collaborators?.find((c) => c.user?.id === user?.id);
  const canEdit  = isOwner || ['editor', 'admin'].includes(myCollab?.role);
  const canSign  = isOwner || ['signer', 'editor', 'admin'].includes(myCollab?.role);

  // ── Fetch document on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetchDocument(id).catch(() => {
      toast.error('Document not found or access denied');
      navigate('/');
    });
    return () => clearCurrent();
  }, [id]);

  // ── Socket connection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;

    const socket = connectSocket();
    socketRef.current = socket;

    socket.emit('doc:join', {
      documentId: id,
      user: {
        userId:  user.id,
        name:    user.username || `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email,
        email:   user.email,
      },
    });

    socket.on('presence:update', ({ users }) => {
      setOnlineUsers(users.filter((u) => u.email !== user.email));
    });

    socket.on('notification', (notif) => {
      setNotification(notif);
      setTimeout(() => setNotification(null), 4000);
    });

    return () => {
      socket.off('presence:update');
      socket.off('notification');
    };
  }, [user, id]);

  // ── Autosave (debounced 3 s) ──────────────────────────────────────────────
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

  // ── Manual save ───────────────────────────────────────────────────────────
  const handleManualSave = async () => {
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
  };

  // Ctrl/Cmd + S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (canEdit) handleManualSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canEdit]);

  if (isLoading && !currentDoc) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentDoc) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── AppBar ─────────────────────────────────────────────────────── */}
      <AppBar position="static" elevation={0} sx={{
        bgcolor: 'primary.main', borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Toolbar sx={{ gap: 1, minHeight: '56px !important' }}>
          <Tooltip title="Back to dashboard">
            <IconButton color="inherit" size="small" onClick={() => navigate('/')}>
              <ArrowBack />
            </IconButton>
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

          <Chip
            label={currentDoc.status || 'draft'}
            size="small" variant="outlined"
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', textTransform: 'capitalize', fontSize: 11 }}
          />

          {canEdit && (
            <Tooltip title="Save (Ctrl+S)">
              <IconButton color="inherit" size="small" onClick={handleManualSave} disabled={isSaving}>
                {isSaving ? <CircularProgress size={18} color="inherit" /> : <Save />}
              </IconButton>
            </Tooltip>
          )}

          {isOwner && (
            <Tooltip title="Invite collaborators">
              <Button
                color="inherit" startIcon={<Share />} size="small"
                onClick={() => setInviteOpen(true)}
                sx={{ borderColor: 'rgba(255,255,255,0.4)', border: '1px solid' }}
              >
                Invite
              </Button>
            </Tooltip>
          )}

          {canSign && (
            <Tooltip title="Sign document">
              <IconButton color="inherit" size="small" onClick={() => { setSideTab(0); setDrawerOpen(true); }}>
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

      {/* ── Read-only warning ────────────────────────────────────────────── */}
      {!canEdit && (
        <Alert severity="info" icon={<CheckCircle />} sx={{ borderRadius: 0, py: 0.5 }}>
          You have <strong>view-only</strong> access to this document.
        </Alert>
      )}

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Editor */}
        <Box sx={{
          flexGrow: 1, overflow: 'auto', bgcolor: '#f0ede8',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <Box sx={{
            width: '100%', maxWidth: 860, my: 3, mx: 'auto',
            bgcolor: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            borderRadius: 2,
            minHeight: 'calc(100vh - 120px)',
          }}>
            <CollaborativeEditor
              documentId={id}
              initialContent={currentDoc.content || ''}
              readOnly={!canEdit}
              socket={socketRef.current}
              onContentChange={scheduleAutosave}
              currentUser={user}
            />
          </Box>
        </Box>

        {/* Side Drawer */}
        <Drawer
          anchor="right" variant="persistent" open={drawerOpen}
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH, position: 'relative', height: '100%',
              border: 'none', borderLeft: '1px solid #e5e7eb',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            },
          }}
        >
          <Tabs
            value={sideTab} onChange={(_, v) => setSideTab(v)}
            variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 44 }}
          >
            <Tab icon={<Draw />} iconPosition="start" label="Sign"        sx={{ minHeight: 44, fontSize: 12, py: 0 }} />
            <Tab icon={<People />} iconPosition="start" label="Team"      sx={{ minHeight: 44, fontSize: 12, py: 0 }} />
            <Tab icon={<History />} iconPosition="start" label="Versions" sx={{ minHeight: 44, fontSize: 12, py: 0 }} />
            <Tab icon={<Assignment />} iconPosition="start" label="Audit" sx={{ minHeight: 44, fontSize: 12, py: 0 }} />
          </Tabs>

          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {sideTab === 0 && (
              <SignaturePanel
                documentId={id} socket={socketRef.current}
                canSign={canSign} currentUser={user}
              />
            )}
            {sideTab === 1 && (
              <CollaboratorsPanel
                documentId={id} isOwner={isOwner}
                currentUser={user}
              />
            )}
            {sideTab === 2 && (
              <VersionsPanel documentId={id} canEdit={canEdit} />
            )}
            {sideTab === 3 && (
              <AuditLogPanel documentId={id} />
            )}
          </Box>
        </Drawer>
      </Box>

      {/* ── Dialogs & Toasts ─────────────────────────────────────────────── */}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} documentId={id} />
      {notification && <NotificationToast notification={notification} />}
    </Box>
  );
}
