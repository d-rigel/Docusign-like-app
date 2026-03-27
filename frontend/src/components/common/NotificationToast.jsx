// src/components/common/NotificationToast.jsx
import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { Login, Logout, Draw, Edit } from '@mui/icons-material';

const TYPE_ICON = {
  join:   Login,
  leave:  Logout,
  signed: Draw,
  edit:   Edit,
};

const TYPE_COLOR = {
  join:   '#10b981',
  leave:  '#6b7280',
  signed: '#e94560',
  edit:   '#f59e0b',
};

export default function NotificationToast({ notification }) {
  if (!notification) return null;
  const Icon  = TYPE_ICON[notification.type] || Edit;
  const color = TYPE_COLOR[notification.type] || '#1a1a2e';

  return (
    <Box sx={{
      position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 1.5,
      p: '10px 16px', borderRadius: 2,
      bgcolor: 'white',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      border: `2px solid ${color}`,
      maxWidth: 320,
      animation: 'slideIn 0.3s ease',
      '@keyframes slideIn': {
        from: { transform: 'translateX(-100%)', opacity: 0 },
        to:   { transform: 'translateX(0)',      opacity: 1 },
      },
    }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: `${color}20` }}>
        <Icon sx={{ fontSize: 16, color }} />
      </Avatar>
      <Typography variant="caption" fontWeight={600} sx={{ color: '#1a1a2e' }}>
        {notification.message}
      </Typography>
    </Box>
  );
}
