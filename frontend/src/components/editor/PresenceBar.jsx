// src/components/editor/PresenceBar.jsx
import React from 'react';
import { Box, Avatar, Tooltip, Typography, Badge } from '@mui/material';

const COLOURS = [
  '#f44336','#e91e63','#9c27b0','#3f51b5',
  '#2196f3','#00bcd4','#009688','#4caf50',
  '#ff9800','#ff5722',
];

export default function PresenceBar({ users = [] }) {
  if (users.length === 0) return null;

  const visible = users.slice(0, 5);
  const extra   = users.length - visible.length;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {visible.map((u, i) => (
        <Tooltip
          key={u.socketId || i}
          title={
            <Box>
              <Typography variant="caption" fontWeight={700}>{u.name || u.email}</Typography>
              {u.typing && <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>typing…</Typography>}
            </Box>
          }
        >
          <Badge
            variant="dot"
            sx={{ '& .MuiBadge-dot': { bgcolor: u.typing ? '#10b981' : '#22c55e', width: 8, height: 8, border: '2px solid #1a1a2e' } }}
          >
            <Avatar
              sx={{
                width: 28, height: 28, fontSize: 11, fontWeight: 700,
                bgcolor: u.color || COLOURS[i % COLOURS.length],
                border: '2px solid rgba(255,255,255,0.3)',
                cursor: 'default',
              }}
            >
              {(u.name || u.email || '?')[0].toUpperCase()}
            </Avatar>
          </Badge>
        </Tooltip>
      ))}
      {extra > 0 && (
        <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>
          +{extra}
        </Avatar>
      )}
    </Box>
  );
}
