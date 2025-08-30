// src/components/Scanner/Scanner.jsx
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { v4 as uuid } from "uuid";
import { useAuth } from "../../hooks/useAuth";
import { saveRecord } from "../../services/storage";

// Safer image -> canvas (mobile friendly, avoids const conflicts)
async function canvasFromImage(file) {
  const MAX_DIM = 1600; // local constant to avoid re-declare issues

  // Try fast path
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file);
      return scaleToCanvas(bmp);
    } catch {
      /* fall through to fallback */
    }
  }
  // Fallback for older Safari / odd files
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
    c.width = w;
    c.height = h;
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
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [origURL, setOrigURL] = useState("");
  const [procURL, setProcURL] = useState("");
  const [dlName, setDlName] = useState("");
  const [fallback, setFallback] = useState(false);

  // processing/export settings
  const [mode, setMode] = useState("original");     // "original" | "gray" | "bw" | "auto"
  const [autoCrop, setAutoCrop] = useState(true);   // toggle perspective fix
  const [exportType, setExportType] = useState("image/png");
  const [quality, setQuality] = useState(0.92);     // for jpeg/webp

  const workerRef = useRef(null);
  const lastFileRef = useRef(null);

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
        {
          id,
          width: imageData.width,
          height: imageData.height,
          buffer: imageData.data.buffer,
          mode,
          doCrop: !!autoCrop,
        },
        [imageData.data.buffer]
      );
    });

  const processImage = async (file) => {
    setError("");
    setBusy(true);
    setProcURL("");
    setFallback(false);
    try {
      const f = file || lastFileRef.current;
      if (!f) {
        setError("Choose an image first, then Reprocess.");
        return;
      }
      if (!f.type.startsWith("image/")) {
        setError("Only image files are supported right now.");
        return;
      }
      lastFileRef.current = f;

      // show "Before"
      const srcCanvas = await canvasFromImage(f);
      setOrigURL(srcCanvas.toDataURL("image/png"));

      // run worker
      const ctx = srcCanvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const { width, height, buffer, fallback } = await runWorker(imgData);
      setFallback(!!fallback);

      // compose "After"
      const out = new Uint8ClampedArray(buffer);
      const outImage = new ImageData(out, width, height);
      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      outCanvas.getContext("2d").putImageData(outImage, 0, 0);

      const q = exportType === "image/png" ? undefined : quality;
      const dataURL = outCanvas.toDataURL(exportType, q);
      setProcURL(dataURL);
      setDlName((f.name?.replace(/\.[^.]+$/, "") || "scan") + `_processed.${extFor(exportType)}`);

      // persist (local IndexedDB; no-op if saveRecord is stubbed)
      const processedBlob = await new Promise((res) => outCanvas.toBlob((b) => res(b), exportType, q));
      if (user?.uid) {
        await saveRecord(
          user.uid,
          { id: uuid(), filename: f.name, ts: Date.now(), status: fallback ? "fallback" : "ok", mode, autoCrop },
          { original: f, processed: processedBlob }
        );
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Processing failed. Try another image.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = async (files) => files?.[0] && (await processImage(files[0]));
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "image/*": [] },
    maxSize: 12 * 1024 * 1024,
  });

  const lossy = exportType !== "image/png";

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Upload</h2>

        <div
          {...getRootProps({
            className: "preview",
            style: { borderColor: isDragActive ? "#1e90ff" : "#334155" },
          })}
        >
          {/* capture="environment" hints the rear camera on phones */}
          <input {...getInputProps({ capture: "environment" })} />
          <span className="mono">
            {isDragActive
              ? "Drop image…"
              : "Tap to take a photo / choose from gallery (drag & drop on desktop)"}
          </span>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="badge">Output</span>
          <label>
            <input
              type="radio"
              name="mode"
              value="original"
              checked={mode === "original"}
              onChange={(e) => setMode(e.target.value)}
            />{" "}
            Original
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="gray"
              checked={mode === "gray"}
              onChange={(e) => setMode(e.target.value)}
            />{" "}
            Grayscale
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="bw"
              checked={mode === "bw"}
              onChange={(e) => setMode(e.target.value)}
            />{" "}
            B&amp;W
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="auto"
              checked={mode === "auto"}
              onChange={(e) => setMode(e.target.value)}
            />{" "}
            Auto (enhanced)
          </label>

          <label style={{ marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={autoCrop}
              onChange={(e) => setAutoCrop(e.target.checked)}
            />{" "}
            Auto-crop & perspective fix
          </label>

          <button className="secondary" onClick={() => processImage()}>
            Reprocess
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="badge">Export</span>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "#0b1220",
              color: "white",
              border: "1px solid #334155",
            }}
          >
            <option value="image/png">PNG (sharp text)</option>
            <option value="image/jpeg">JPEG (smaller)</option>
            <option value="image/webp">WebP (modern)</option>
          </select>
          {lossy && (
            <>
              <span className="mono">Quality</span>
              <input
                type="range"
                min="0.4"
                max="1"
                step="0.02"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
              />
              <span className="mono">{Math.round(quality * 100)}%</span>
            </>
          )}
        </div>

        {busy && <small className="mono">Processing…</small>}
        {error && <small className="mono" style={{ color: "#fca5a5" }}>{error}</small>}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Before</h3>
          <div className="preview">
            {origURL ? (
              <TransformWrapper>
                <TransformComponent>
                  <img className="thumb" alt="" src={origURL} />
                </TransformComponent>
              </TransformWrapper>
            ) : (
              <small className="mono">No image</small>
            )}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>After</h3>
          <div className="preview">
            {procURL ? (
              <TransformWrapper>
                <TransformComponent>
                  <img className="thumb" alt="" src={procURL} />
                </TransformComponent>
              </TransformWrapper>
            ) : (
              <small className="mono">—</small>
            )}
          </div>

          {autoCrop && fallback && (
            <small className="mono" style={{ color: "#fbbf24" }}>
              Couldn’t confidently detect a document — processed full frame. You can also turn Auto-crop off.
            </small>
          )}
          {!autoCrop && (
            <small className="mono" style={{ color: "#a7f3d0" }}>
              Auto-crop is off — processing full frame.
            </small>
          )}

          {procURL && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={procURL} download={dlName}>
                <button>Download</button>
              </a>
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
                  } catch {
                    // user canceled or not supported
                  }
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
