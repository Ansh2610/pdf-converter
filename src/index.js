import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import App from "./App";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/signin" replace />;
}
function RedirectIfAuthed({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<RedirectIfAuthed><App page="signin" /></RedirectIfAuthed>} />
        <Route path="/" element={<Protected><App page="scanner" /></Protected>} />
        <Route path="/gallery" element={<Protected><App page="gallery" /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);
