// src/App.jsx
import { BrowserRouter, Link, Route, Routes, Navigate, useLocation } from "react-router-dom";
import Scanner from "./components/Scanner/Scanner";
import Gallery from "./components/Gallery/Gallery";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import "./App.css";

function Header() {
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const active = (path) => (loc.pathname === path ? { opacity: 1 } : { opacity: 0.7 });

  return (
    <header className="topbar">
      <div className="brand">Pokédex Scanner</div>
      <nav>
        <Link style={active("/scan")} to="/scan">Scan</Link>
        <Link style={active("/gallery")} to="/gallery">Gallery</Link>
        {user?.uid !== "guest" ? (
          <button className="secondary" onClick={signOut} style={{ marginLeft: 12 }}>Sign out</button>
        ) : (
          <span className="mono" style={{ marginLeft: 12, opacity: 0.7 }}>guest</span>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <main className="container">
          <Routes>
            <Route path="/" element={<Navigate to="/scan" replace />} />
            <Route path="/scan" element={<Scanner />} />
            <Route path="/gallery" element={<Gallery />} />
            {/* keep a /signin page later if you wire Firebase */}
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
