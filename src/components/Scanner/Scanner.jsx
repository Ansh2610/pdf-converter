import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { v4 as uuid } from "uuid";
import { useAuth } from "../../context/AuthProvider"; // <— from step 2
import { saveRecord } from "../../services/storage";
import { persistScan } from "../../services/persist";  // <— NEW
import { pdfFirstPageToCanvas, canvasToPngBlob } from "../../utils/pdf";

// scale image → canvas (mobile-safe)
async function canvasFromImage(file) {
  const MAX_DIM = 1600;
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file);
      return scaleToCanvas(bmp);
    } catch {}
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = scaleToCanvas(img);
  URL.revokeObjectURL(url);
  return c;

  function scaleToCanvas(src) {
    const k = Math.min(1, MAX_DIM / Math.max(src.width, src.height));
    const w = Math.round(src.width * k);
    const h = Math.round(src.height * k);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0, w, h);
    return c;
  }
}
function extFor(mime) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export default function Scanner() {
  const { user, logout } = useAuth();

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false); // <— NEW
  const [savedId, setSavedId] = useState("");        // <— NEW

  const [error, setError] = useState("");
  const [origURL, setOrigURL] = useState("");
  const [procURL, setProcURL] = useState("");
  const [dlName, setDlName] = useState("");
  const [fallback, setFallback] = useState(false);

  const [mode, setMode] = useState("original");
  const [autoCrop, setAutoCrop] = useState(true);
  const [exportType, setExportType] = useState("image/png");
  const [quality, setQuality] = useState(0.92);

  const workerRef = useRef(null);
  const lastImageFileRef = useRef(null);
  const originalForSaveRef = useRef(null); // PDF or image

  useEffect(() => {
    workerRef.current = new Worker("/scan-worker.js");
    return () => workerRef.current?.terminate();
  }, []);

  const runWorker = (imageData) =>
    new Promise((resolve, reject) => {
      const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : uuid();
      const onMsg = (e) => {
        if (e.data.id !== id) return;
        workerRef.current.removeEventListener("message", onMsg);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data);
      };
      workerRef.current.addEventListener("message", onMsg);
      workerRef.current.postMessage(
        { id, width: imageData.width, height: imageData.height, buffer: imageData.data.buffer, mode, doCrop: !!autoCrop },
        [imageData.data.buffer]
      );
    });

  const processImage = async (imageFile) => {
    setError(""); setBusy(true); setProcURL(""); setFallback(false); setSavedId("");
    try {
      const f = imageFile || lastImageFileRef.current;
      if (!f) { setError("Choose a file first, then Reprocess."); return; }
      if (!f.type.startsWith("image/")) { setError("Only images are processed (PDFs are converted first)."); return; }
      lastImageFileRef.current = f;

      // Before
      const srcCanvas = await canvasFromImage(f);
      setOrigURL(srcCanvas.toDataURL("image/png"));

      // Worker
      const ctx = srcCanvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const { width, height, buffer, fallback } = await runWorker(imgData);
      setFallback(!!fallback);

      // After
      const out = new Uint8ClampedArray(buffer);
      const outImage = new ImageData(out, width, height);
      const outCanvas = document.createElement("canvas");
      outCanvas.width = width; outCanvas.height = height;
      outCanvas.getContext("2d").putImageData(outImage, 0, 0);

      const q = exportType === "image/png" ? undefined : quality;
      const dataURL = outCanvas.toDataURL(exportType, q);
      setProcURL(dataURL);
      setDlName((f.name?.replace(/\.[^.]+$/, "") || "scan") + `_processed.${extFor(exportType)}`);

      const processedBlob = await new Promise((res) =>
        outCanvas.toBlob((b) => res(b), exportType, q)
      );

      const originalToSave = originalForSaveRef.current || f;

      // Local cache (IndexedDB or localStorage)
      if (user?.uid) {
        await saveRecord(
          user.uid,
          { id: uuid(), filename: originalToSave.name || f.name, ts: Date.now(), status: fallback ? "fallback" : "done", mode, autoCrop },
          { original: originalToSave, processed: processedBlob }
        );
      }

      // Cloud save (if signed in)
      if (user?.uid) {
        setUploading(true);
        try {
          const { id } = await persistScan({
            uid: user.uid,
            originalFile: originalToSave,
            processedBlob,
            baseName: originalToSave.name || f.name,
            status: fallback ? "fallback" : "done",
            mode,
            autoCrop,
          });
          setSavedId(id || "");
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Processing failed. Try another file.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = async (files) => {
    const file = files?.[0];
    if (!file) return;

    setError("");
    originalForSaveRef.current = file;

    try {
      let imageFile = file;
      if (file.type === "application/pdf") {
        const pageCanvas = await pdfFirstPageToCanvas(file);
        const pngBlob = await canvasToPngBlob(pageCanvas);
        const base = (file.name?.replace(/\.[^.]+$/, "") || "document");
        imageFile = new File([pngBlob], `${base}_page1.png`, { type: "image/png" });
      }
      lastImageFileRef.current = imageFile;
      await processImage(imageFile);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to read file.");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "image/*": [], "application/pdf": [] },
    maxSize: 20 * 1024 * 1024,
  });

  const lossy = exportType !== "image/png";

  return (
    <div className="grid">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginTop: 0 }}>Upload</h2>
          <div className="mono" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {user ? (
              <>
                <span>Signed in</span>
                <button className="secondary" onClick={() => logout()}>Logout</button>
              </>
            ) : (
              <a href="/login"><button className="secondary">Login</button></a>
            )}
          </div>
        </div>

        <div
          {...getRootProps({ className: "preview", style: { borderColor: isDragActive ? "#1e90ff" : "#334155" } })}
        >
          <input {...getInputProps({ capture: "environment" })} />
          <span className="mono">
            {isDragActive ? "Drop file…" : "Tap to take a photo / pick an image or PDF"}
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span className="badge">Output</span>
          <label><input type="radio" name="mode" value="original" checked={mode === "original"} onChange={(e) => setMode(e.target.value)} /> Original</label>
          <label><input type="radio" name="mode" value="gray" checked={mode === "gray"} onChange={(e) => setMode(e.target.value)} /> Grayscale</label>
          <label><input type="radio" name="mode" value="bw" checked={mode === "bw"} onChange={(e) => setMode(e.target.value)} /> B&amp;W</label>
          <label><input type="radio" name="mode" value="auto" checked={mode === "auto"} onChange={(e) => setMode(e.target.value)} /> Auto</label>

          <label style={{ marginLeft: 12 }}>
            <input type="checkbox" checked={autoCrop} onChange={(e) => setAutoCrop(e.target.checked)} /> Auto-crop
          </label>

          <button className="secondary" onClick={() => processImage()}>Reprocess</button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span className="badge">Export</span>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, background: "#0b1220", color: "white", border: "1px solid #334155" }}
          >
            <option value="image/png">PNG (sharp)</option>
            <option value="image/jpeg">JPEG (smaller)</option>
            <option value="image/webp">WebP</option>
          </select>
          {lossy && (
            <>
              <span className="mono">Quality</span>
              <input type="range" min="0.4" max="1" step="0.02" value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))} />
              <span className="mono">{Math.round(quality * 100)}%</span>
            </>
          )}
        </div>

        {busy && <small className="mono">Processing…</small>}
        {uploading && <small className="mono">Uploading to cloud…</small>}
        {savedId && <small className="mono" style={{ color: "#a7f3d0" }}>Saved to cloud ✓</small>}
        {error && <small className="mono" style={{ color: "#fca5a5" }}>{error}</small>}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Before</h3>
          <div className="preview">
            {origURL ? (
              <TransformWrapper><TransformComponent><img className="thumb" alt="" src={origURL} /></TransformComponent></TransformWrapper>
            ) : (<small className="mono">No file</small>)}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>After</h3>
          <div className="preview">
            {procURL ? (
              <TransformWrapper><TransformComponent><img className="thumb" alt="" src={procURL} /></TransformComponent></TransformWrapper>
            ) : (<small className="mono">—</small>)}
          </div>

          {autoCrop && fallback && (
            <small className="mono" style={{ color: "#fbbf24" }}>
              Couldn’t detect a clean document — processed full frame.
            </small>
          )}
          {!autoCrop && (
            <small className="mono" style={{ color: "#a7f3d0" }}>
              Auto-crop is off — processing full frame.
            </small>
          )}

          {procURL && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={procURL} download={dlName}><button>Download</button></a>
              <button
                className="secondary"
                onClick={async () => {
                  if (!navigator.share || !fetch) return;
                  try {
                    const resp = await fetch(procURL);
                    const blob = await resp.blob();
                    const file = new File([blob], dlName, { type: blob.type || "image/png" });
                    if (navigator.canShare && !navigator.canShare({ files: [file] })) return;
                    await navigator.share({ files: [file], title: "Scan" });
                  } catch {}
                }}
                disabled={!navigator.share}
              >
                Share
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
