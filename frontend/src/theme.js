// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:  '#1a1a2e',
      light: '#16213e',
      dark:  '#0f0f1a',
    },
    secondary: {
      main:  '#e94560',
      light: '#ff6b81',
      dark:  '#c0392b',
    },
    background: {
      default: '#f8f7f4',
      paper:   '#ffffff',
    },
    text: {
      primary:   '#1a1a2e',
      secondary: '#6b7280',
    },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error:   { main: '#ef4444' },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    h1: { fontFamily: '"Lora", serif',           fontWeight: 600 },
    h2: { fontFamily: '"Lora", serif',           fontWeight: 600 },
    h3: { fontFamily: '"Lora", serif',           fontWeight: 600 },
    h4: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 },
    button: { fontWeight: 600, letterSpacing: '0.02em' },
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
    '0 10px 15px rgba(0,0,0,0.07), 0 4px 6px rgba(0,0,0,0.04)',
    '0 20px 25px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.03)',
    ...Array(20).fill('none'),
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 20px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #16213e 0%, #0f0f1a 100%)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 6px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&.Mui-focused fieldset': { borderColor: '#1a1a2e', borderWidth: 2 },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6, fontWeight: 500 } },
    },
  },
});

export default theme;
