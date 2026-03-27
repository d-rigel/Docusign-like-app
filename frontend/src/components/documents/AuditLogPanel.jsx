// src/components/documents/AuditLogPanel.jsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Stack, Avatar, Chip, CircularProgress,
} from '@mui/material';
import {
  Create, Visibility, Edit, Draw, PersonAdd,
  Login, Download, Restore, SwapHoriz, Assignment,
} from '@mui/icons-material';
import useDocumentStore from '../../store/documentStore';

const ACTION_META = {
  created:        { icon: Create,      color: '#3b82f6', label: 'Created'     },
  viewed:         { icon: Visibility,  color: '#8b5cf6', label: 'Viewed'      },
  edited:         { icon: Edit,        color: '#f59e0b', label: 'Edited'      },
  signed:         { icon: Draw,        color: '#10b981', label: 'Signed'      },
  invited:        { icon: PersonAdd,   color: '#06b6d4', label: 'Invited'     },
  joined:         { icon: Login,       color: '#22c55e', label: 'Joined'      },
  exported:       { icon: Download,    color: '#6366f1', label: 'Exported'    },
  rolled_back:    { icon: Restore,     color: '#ef4444', label: 'Rolled back' },
  status_changed: { icon: SwapHoriz,   color: '#f97316', label: 'Status changed' },
};

export default function AuditLogPanel({ documentId }) {
  const { auditLogs, fetchAuditLogs } = useDocumentStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAuditLogs(documentId).finally(() => setLoading(false));
  }, [documentId]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
        Audit Trail ({auditLogs.length})
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : auditLogs.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Assignment sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No activity yet</Typography>
        </Box>
      ) : (
        <Stack spacing={0}>
          {auditLogs.map((log, i) => {
            const meta   = ACTION_META[log.action] || { icon: Assignment, color: '#6b7280', label: log.action };
            const Icon   = meta.icon;
            const isLast = i === auditLogs.length - 1;
            return (
              <Box key={log.id} sx={{ display: 'flex', gap: 1.5, pb: isLast ? 0 : 2, position: 'relative' }}>
                {/* Timeline line */}
                {!isLast && (
                  <Box sx={{
                    position: 'absolute', left: 15, top: 30, bottom: 0,
                    width: 1, bgcolor: '#e5e7eb',
                  }} />
                )}
                <Avatar sx={{
                  width: 30, height: 30, bgcolor: `${meta.color}20`,
                  flexShrink: 0, zIndex: 1,
                }}>
                  <Icon sx={{ fontSize: 15, color: meta.color }} />
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" fontWeight={700} noWrap>
                      {log.actorName || log.actorEmail || 'Unknown'}
                    </Typography>
                    <Chip label={meta.label} size="small"
                      sx={{ fontSize: 9, height: 16, bgcolor: `${meta.color}15`, color: meta.color }} />
                  </Box>
                  {log.metadata && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {log.action === 'invited' && `→ ${log.metadata.invitedEmail} as ${log.metadata.role}`}
                      {log.action === 'rolled_back' && `→ version ${log.metadata.rolledBackTo}`}
                      {log.action === 'edited' && `version ${log.metadata.version}`}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(log.createdAt).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
