// src/components/documents/VersionsPanel.jsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Stack, Chip, Button, Divider,
  CircularProgress, Tooltip,
} from '@mui/material';
import { History, Restore } from '@mui/icons-material';
import toast from 'react-hot-toast';
import useDocumentStore from '../../store/documentStore';

export default function VersionsPanel({ documentId, canEdit }) {
  const { versions, fetchVersions, rollbackVersion, currentDoc } = useDocumentStore();
  const [loading,  setLoading]  = useState(false);
  const [rolling,  setRolling]  = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchVersions(documentId).finally(() => setLoading(false));
  }, [documentId]);

  const handleRollback = async (version) => {
    if (!window.confirm(`Roll back to version ${version}? Current changes will be saved as a new version.`)) return;
    setRolling(version);
    try {
      await rollbackVersion(documentId, version);
      toast.success(`Rolled back to version ${version}`);
      fetchVersions(documentId);
    } catch {
      toast.error('Rollback failed');
    } finally {
      setRolling(null);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
        Version History ({versions.length})
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : versions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <History sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No versions saved yet</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {versions.map((v, i) => {
            const isCurrent = v.version === currentDoc?.currentVersion;
            return (
              <Box key={v.version} sx={{
                p: 1.5, borderRadius: 2,
                border: isCurrent ? '2px solid #1a1a2e' : '1px solid #e5e7eb',
                bgcolor: isCurrent ? '#f8f7f4' : 'white',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" fontWeight={700}>
                        v{v.version}
                      </Typography>
                      {isCurrent && (
                        <Chip label="Current" size="small"
                          sx={{ fontSize: 9, height: 16, bgcolor: '#1a1a2e', color: 'white' }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {new Date(v.savedAt).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      by {v.savedBy}
                    </Typography>
                  </Box>
                  {canEdit && !isCurrent && (
                    <Tooltip title={`Restore version ${v.version}`}>
                      <Button
                        size="small" variant="outlined"
                        startIcon={rolling === v.version ? <CircularProgress size={10} /> : <Restore />}
                        onClick={() => handleRollback(v.version)}
                        disabled={rolling === v.version}
                        sx={{ fontSize: 10, py: 0.3, minWidth: 80 }}
                      >
                        Restore
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
