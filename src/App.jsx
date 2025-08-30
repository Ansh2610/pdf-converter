import { Routes, Route, Navigate } from "react-router-dom";
import Scanner from "./components/Scanner/Scanner";
import Gallery from "./components/Gallery/Gallery";
import Login from "./pages/Login";
import { useAuth } from "./context/AuthProvider";

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/scan" element={<Scanner />} />
      <Route path="/gallery" element={user ? <Gallery /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/scan" />} />
    </Routes>
  );
}
