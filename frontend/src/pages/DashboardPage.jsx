// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, CardActionArea, Typography,
  Button, Chip, Avatar, Skeleton, InputBase, IconButton,
  Menu, MenuItem, Divider, Tooltip,
} from '@mui/material';
import {
  Add, Description, Search, MoreVert, Delete, Edit,
  People, Schedule, AutoStories, UploadFile, Logout, Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useDocumentStore from '../store/documentStore';
import useAuthStore from '../store/authStore';
import { documentsAPI } from '../services/api';
import UploadDocumentDialog from '../components/documents/UploadDocumentDialog';
import CreateDocumentDialog from '../components/documents/CreateDocumentDialog';

const STATUS_COLOR = {
  draft:     'default',
  review:    'warning',
  signed:    'success',
  completed: 'success',
  archived:  'default',
};

function DocumentCard({ doc, currentUser, onDelete }) {
  const navigate  = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const isOwner   = doc.owner?.id === currentUser?.id;
  const updatedAt = new Date(doc.updatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const handleDelete = async (e) => {
    e.stopPropagation();
    setAnchor(null);
    if (!window.confirm('Delete this document permanently?')) return;
    try {
      await documentsAPI.delete(doc.id);
      onDelete(doc.id);
      toast.success('Document deleted');
    } catch {
      toast.error('Could not delete document');
    }
  };

  return (
    <Card sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      transition: 'all 0.2s ease',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
    }}>
      <CardActionArea onClick={() => navigate(`/documents/${doc.id}`)} sx={{ flexGrow: 1, p: 0 }}>
        {/* Colour band */}
        <Box sx={{
          height: 6,
          background: isOwner
            ? 'linear-gradient(90deg, #1a1a2e, #e94560)'
            : 'linear-gradient(90deg, #10b981, #06b6d4)',
        }} />
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Description sx={{ color: isOwner ? 'secondary.main' : 'success.main', fontSize: 28, mb: 1 }} />
            <Chip
              label={doc.status || 'draft'}
              color={STATUS_COLOR[doc.status] || 'default'}
              size="small" variant="outlined"
              sx={{ fontSize: 10, height: 20, textTransform: 'capitalize' }}
            />
          </Box>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ mb: 0.5 }}>
            {doc.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Schedule sx={{ fontSize: 12 }} /> {updatedAt}
          </Typography>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <People sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {(doc.collaborators?.length || 0) + 1}
              </Typography>
            </Box>
            {isOwner
              ? <Chip label="Owner" size="small" sx={{ fontSize: 10, height: 18, bgcolor: '#f3f4f6' }} />
              : <Chip label="Collaborator" size="small" sx={{ fontSize: 10, height: 18, bgcolor: '#ecfdf5', color: 'success.main' }} />
            }
          </Box>
        </CardContent>
      </CardActionArea>

      {isOwner && (
        <Box sx={{ px: 1.5, pb: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title="Options">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
              <MoreVert fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem onClick={() => { setAnchor(null); navigate(`/documents/${doc.id}`); }}>
              <Edit fontSize="small" sx={{ mr: 1 }} /> Edit
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} /> Delete
            </MenuItem>
          </Menu>
        </Box>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const navigate      = useNavigate();
  const { user, logout } = useAuthStore();
  const { documents, fetchDocuments, isLoading } = useDocumentStore();
  const [search, setSearch]             = useState('');
  const [createOpen, setCreateOpen]     = useState(false);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [userMenu, setUserMenu]         = useState(null);
  const [localDocs, setLocalDocs]       = useState([]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);
  useEffect(() => { setLocalDocs(documents); }, [documents]);

  const handleDelete = useCallback((id) => {
    setLocalDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const filtered = localDocs.filter((d) =>
    d.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: 'primary.main', color: 'white', px: 3, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 3, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoStories sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontFamily: '"Lora", serif', fontWeight: 700 }}>
            DocuCollab
          </Typography>
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2, px: 2, py: 0.5,
          width: 260,
        }}>
          <Search sx={{ fontSize: 18, opacity: 0.7 }} />
          <InputBase
            placeholder="Search documents…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ color: 'white', fontSize: 14, flex: 1, '&::placeholder': { color: 'rgba(255,255,255,0.6)' } }}
            inputProps={{ style: { color: 'white' } }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<UploadFile />}
            onClick={() => setUploadOpen(true)}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
            Upload
          </Button>
          <Button variant="contained" size="small" startIcon={<Add />}
            onClick={() => setCreateOpen(true)}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}>
            New doc
          </Button>
          <Tooltip title={user?.username || user?.email}>
            <IconButton onClick={(e) => setUserMenu(e.currentTarget)} sx={{ ml: 1 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14 }}>
                {(user?.username || user?.email || '?')[0].toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={userMenu} open={Boolean(userMenu)} onClose={() => setUserMenu(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>{user?.username}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', gap: 1 }}>
              <Logout fontSize="small" /> Sign out
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <Box sx={{ maxWidth: 1280, mx: 'auto', px: 3, py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontFamily: '"Lora", serif', fontWeight: 700, mb: 0.5 }}>
            Your Documents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''} found
          </Typography>
        </Box>

        {isLoading ? (
          <Grid container spacing={2.5}>
            {[1,2,3,4,5,6].map((i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                <Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : filtered.length === 0 ? (
          <Box sx={{
            textAlign: 'center', py: 12,
            border: '2px dashed #e5e7eb', borderRadius: 4, bgcolor: 'white',
          }}>
            <Description sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
            <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
              {search ? 'No documents match your search' : 'No documents yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {search ? 'Try a different search term' : 'Create your first document or upload a file to get started'}
            </Typography>
            {!search && (
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
                  New document
                </Button>
                <Button variant="outlined" startIcon={<UploadFile />} onClick={() => setUploadOpen(true)}>
                  Upload file
                </Button>
              </Box>
            )}
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {filtered.map((doc) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={doc.id}>
                <DocumentCard doc={doc} currentUser={user} onDelete={handleDelete} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <CreateDocumentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <UploadDocumentDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </Box>
  );
}
