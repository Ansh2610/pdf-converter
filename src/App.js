// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/GlobalStyles';
import Login from './components/Auth/Login';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Container from './components/Layout/Container';
import Upload from './components/Scanner/Upload';
import Gallery from './components/Gallery/Gallery';
import styled from 'styled-components';

const LoadingScreen = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const Pokeball = styled.div`
  width: 80px;
  height: 80px;
  background: linear-gradient(to bottom, #dc0a2d 50%, white 50%);
  border-radius: 50%;
  border: 3px solid #333;
  position: relative;
  animation: bounce 1s infinite;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background: white;
    border: 3px solid #333;
    border-radius: 50%;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
`;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <LoadingScreen>
          <Pokeball />
        </LoadingScreen>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Router>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/" element={
            <ProtectedRoute user={user}>
              <Container user={user}>
                <Upload />
              </Container>
            </ProtectedRoute>
          } />
          <Route path="/gallery" element={
            <ProtectedRoute user={user}>
              <Container user={user}>
                <Gallery />
              </Container>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;

