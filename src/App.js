import SignIn from "./components/Auth/SignIn";
import Scanner from "./components/Scanner/Scanner";
import Gallery from "./components/Gallery/Gallery";
import { useAuth } from "./hooks/useAuth";
import { Link } from "react-router-dom";

export default function App({ page }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <header>
        <div className="pdx-light" />
        <strong>Pokédex Scanner</strong>
        <span className="badge">auto-crop & perspective fix</span>
        <div className="pdx-leds">
          <div className="pdx-led red"></div>
          <div className="pdx-led yellow"></div>
          <div className="pdx-led green"></div>
        </div>
      </header>

      <div className="container">
        {page==="signin" && <div className="card"><SignIn/></div>}
        {page==="scanner" && <Scanner/>}
        {page==="gallery" && <div className="card"><Gallery/></div>}
        {user && page!=="signin" && (
          <div className="nav">
            <Link className="badge" to="/">Scan</Link>
            <Link className="badge" to="/gallery">Gallery</Link>
            <button className="secondary" onClick={signOut}>Sign out</button>
          </div>
        )}
      </div>
    </>
  );
}
