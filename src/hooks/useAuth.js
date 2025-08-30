// src/hooks/useAuth.js
import { createContext, useContext, useEffect, useState } from "react";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // load from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("auth_user");
    if (cached) setUser(JSON.parse(cached));
    else setUser({ uid: "guest", email: "guest@local" });
  }, []);

  const signIn = async (email) => {
    const u = { uid: `user-${btoa(email)}`, email };
    localStorage.setItem("auth_user", JSON.stringify(u));
    setUser(u);
  };

  const signOut = async () => {
    localStorage.removeItem("auth_user");
    setUser({ uid: "guest", email: "guest@local" });
  };

  return (
    <AuthCtx.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
