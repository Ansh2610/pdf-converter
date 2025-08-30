import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRecords, removeRecord } from "../../services/storage";
import { useAuth } from "../../context/AuthProvider"; // <-- unconditionally call this hook
import "./gallery.css";

// Convert Blob | dataURL -> usable <img src>
async function toObjectURL(maybeBlobOrDataURL) {
  if (!maybeBlobOrDataURL) return "";
  if (maybeBlobOrDataURL instanceof Blob) return URL.createObjectURL(maybeBlobOrDataURL);
  return String(maybeBlobOrDataURL);
}

// For downloads: ensure we have a Blob
async function toBlob(maybeBlobOrDataURL) {
  if (!maybeBlobOrDataURL) return null;
  if (maybeBlobOrDataURL instanceof Blob) return maybeBlobOrDataURL;
  const resp = await fetch(maybeBlobOrDataURL);
  return await resp.blob();
}

function niceTime(ts) {
  try { return new Date(ts || Date.now()).toLocaleString(); } catch { return ""; }
}

export default function Gallery() {
  const auth = useAuth(); // <-- hook is always called (fixes ESLint)
  const userId = auth?.user?.uid || "demo";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const createdURLs = useRef([]);

  const fetchItems = async () => {
    setLoading(true);
    setError("");
    try {
      const recs = await getRecords(userId);
      setItems(recs || []);
    } catch (e) {
      setError(e?.message || "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    return () => {
      createdURLs.current.forEach((u) => URL.revokeObjectURL(u));
      createdURLs.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const viewItems = useMemo(() => {
    // revoke old
    createdURLs.current.forEach((u) => URL.revokeObjectURL(u));
    createdURLs.current = [];
    const map = async () => {
      const promises = (items || []).map(async (rec) => {
        const src = (await toObjectURL(rec.processed)) || (await toObjectURL(rec.original));
        if (src.startsWith("blob:")) createdURLs.current.push(src);
        return { ...rec, _thumb: src };
      });
      return Promise.all(promises);
    };
    return map();
  }, [items]);

  const [resolved, setResolved] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await viewItems;
        if (alive) setResolved(r);
      } catch {
        if (alive) setResolved([]);
      }
    })();
    return () => { alive = false; };
  }, [viewItems]);

  const handleDownload = async (rec) => {
    try {
      setBusyId(rec.id);
      const blob = await toBlob(rec.processed || rec.original);
      if (!blob) throw new Error("Nothing to download");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = (rec.filename || "scan").replace(/\s+/g, "_");
      a.download = `${base}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || "Download failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (rec) => {
    const ok = window.confirm("Delete this scan from your device?");
    if (!ok) return;
    try {
      setBusyId(rec.id);
      await removeRecord(userId, rec.id);
      await fetchItems();
    } catch (e) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="gallery-wrap">
      <div className="card-like">
        <div className="gallery-header">
          <h2>Gallery</h2>
          {loading && <span className="muted">Loading…</span>}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {!loading && resolved.length === 0 && (
          <div className="empty">
            No scans yet. Go to{" "}
            <button className="linkish" onClick={() => navigate("/scan")}>Scan</button>
            {" "}and create one!
          </div>
        )}

        <div className="gallery-grid">
          {resolved.map((rec) => (
            <div key={rec.id} className="g-card">
              <div className="g-thumb">
                {rec._thumb ? (
                  <img src={rec._thumb} alt={rec.filename || "scan"} />
                ) : (
                  <div className="g-thumb-placeholder">No preview</div>
                )}
              </div>

              <div className="g-meta">
                <div className="g-title" title={rec.filename || "scan"}>
                  {rec.filename || "scan"}
                </div>
                <div className="g-sub">{niceTime(rec.ts)}</div>
              </div>

              <div className="g-actions">
                <button
                  className="btn"
                  onClick={() => handleDownload(rec)}
                  disabled={busyId === rec.id}
                  title="Download processed image"
                >
                  Download
                </button>
                <button
                  className="btn danger"
                  onClick={() => handleDelete(rec)}
                  disabled={busyId === rec.id}
                  title="Delete from device"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="footer-actions">
          <button className="btn ghost" onClick={() => navigate("/scan")}>Scan</button>
          <button className="btn ghost" onClick={fetchItems}>Refresh</button>
        </div>
      </div>
    </div>
  );
}
