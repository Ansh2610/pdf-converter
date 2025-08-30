import { useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login, signup, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("login"); // or 'signup'
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    // already signed in
    setTimeout(() => nav("/scan"), 0);
  }

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, pw);
      else await signup(email, pw);
      nav("/scan");
    } catch (e) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Sign in" : "Create account"}</h2>
      <form onSubmit={submit} className="grid" style={{ gap: 10 }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        {err && <small className="mono" style={{ color: "#fca5a5" }}>{err}</small>}
        <button disabled={busy}>{busy ? "Please wait…" : (mode === "login" ? "Sign in" : "Sign up")}</button>
      </form>
      <div style={{ marginTop: 10 }}>
        <button className="secondary" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
