// src/components/documents/CollaboratorsPanel.jsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Stack, Avatar, Chip, IconButton,
  Select, MenuItem, Tooltip, Divider, CircularProgress, Button,
} from '@mui/material';
import { Delete, PersonAdd } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { collaboratorsAPI } from '../../services/api';
import useDocumentStore from '../../store/documentStore';

const ROLE_COLOR = {
  viewer: 'default',
  editor: 'primary',
  signer: 'secondary',
  admin:  'error',
};

export default function CollaboratorsPanel({ documentId, isOwner, currentUser }) {
  const { collaborators, fetchDocument } = useDocumentStore();
  const [loading, setLoading] = useState(false);

  const reload = () => fetchDocument(documentId).catch(() => {});

  const handleRoleChange = async (collabId, role) => {
    try {
      await collaboratorsAPI.update(collabId, { role });
      toast.success('Role updated');
      reload();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleRemove = async (collabId) => {
    if (!window.confirm('Remove this collaborator?')) return;
    try {
      await collaboratorsAPI.remove(collabId);
      toast.success('Collaborator removed');
      reload();
    } catch {
      toast.error('Failed to remove collaborator');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
        Team Members ({(collaborators?.length || 0) + 1})
      </Typography>

      <Stack spacing={1.5}>
        {/* Owner (always first) */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 1.5, borderRadius: 2, border: '1px solid #e5e7eb', bgcolor: '#f9fafb',
        }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
            {(currentUser?.username || currentUser?.email || '?')[0].toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" fontWeight={700} noWrap sx={{ display: 'block' }}>
              {currentUser?.username || currentUser?.email}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{currentUser?.email}</Typography>
          </Box>
          <Chip label="Owner" size="small" color="primary" sx={{ fontSize: 10, height: 20 }} />
        </Box>

        <Divider />

        {collaborators?.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <PersonAdd sx={{ fontSize: 36, color: '#d1d5db', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No collaborators yet</Typography>
            <Typography variant="caption" color="text.secondary">Use the Invite button to add team members</Typography>
          </Box>
        )}

        {collaborators?.map((collab) => (
          <Box key={collab.id} sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            p: 1.5, borderRadius: 2, border: '1px solid #e5e7eb',
          }}>
            <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: 'secondary.main', fontWeight: 700 }}>
              {(collab.user?.username || collab.email || '?')[0].toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="caption" fontWeight={700} noWrap sx={{ display: 'block' }}>
                {collab.user?.username || collab.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{collab.email}</Typography>
              {collab.status === 'pending' && (
                <Chip label="Pending" size="small" variant="outlined" color="warning"
                  sx={{ fontSize: 9, height: 16, mt: 0.3 }} />
              )}
            </Box>

            {isOwner ? (
              <>
                <Select
                  value={collab.role || 'viewer'} size="small"
                  onChange={(e) => handleRoleChange(collab.id, e.target.value)}
                  sx={{ fontSize: 11, height: 28, minWidth: 80 }}
                >
                  {['viewer','editor','signer','admin'].map((r) => (
                    <MenuItem key={r} value={r} sx={{ fontSize: 12 }}>{r}</MenuItem>
                  ))}
                </Select>
                <Tooltip title="Remove">
                  <IconButton size="small" color="error" onClick={() => handleRemove(collab.id)}>
                    <Delete sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <Chip
                label={collab.role || 'viewer'} size="small"
                color={ROLE_COLOR[collab.role] || 'default'}
                sx={{ fontSize: 10, height: 20, textTransform: 'capitalize' }}
              />
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
