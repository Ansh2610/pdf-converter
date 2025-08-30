import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function SignIn(){
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  const onSubmit=async(e)=>{
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await signIn(email, password);
      nav("/", { replace:true });
    } catch {
      setError("Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid" onSubmit={onSubmit}>
      <h2 style={{margin:0}}>Trainer Login</h2>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button type="submit" disabled={busy}>{busy ? "Entering..." : "Enter Lab"}</button>
      {error && <small className="mono">{error}</small>}
    </form>
  );
}
