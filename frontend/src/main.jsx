// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import App from './App';
import theme from './theme';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              borderRadius: '10px',
              background: '#1a1a2e',
              color: '#fff',
              fontSize: '14px',
            },
          }}
        />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
