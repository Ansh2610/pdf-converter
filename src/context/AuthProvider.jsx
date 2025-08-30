import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../services/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const api = useMemo(() => ({
      user,
      authReady,
      error: err,
      async login(email, password) {
        setErr("");
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signup(email, password) {
        setErr("");
        await createUserWithEmailAndPassword(auth, email, password);
      },
      async logout() {
        await signOut(auth);
      },
    }),
    [user, authReady, err] // <- include authReady to satisfy eslint
  );

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}
