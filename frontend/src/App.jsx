// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Pages
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import EditorPage       from './pages/EditorPage';
import InvitePage       from './pages/InvitePage';

// Protected route wrapper
function Protected({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/register"        element={<RegisterPage />} />
      <Route path="/invite/:token"   element={<InvitePage />} />
      <Route path="/"                element={<Protected><DashboardPage /></Protected>} />
      <Route path="/documents/:id"   element={<Protected><EditorPage /></Protected>} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  );
}
