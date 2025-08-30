import { storage, db } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Upload original + processed to Storage; create Firestore doc with URLs.
export async function persistScan({ uid, originalFile, processedBlob, baseName, status = "done", mode = "original", autoCrop = true }) {
  if (!uid) throw new Error("persistScan: uid required");
  if (!processedBlob) throw new Error("persistScan: processedBlob required");

  const ts = Date.now();
  const safeBase = (baseName || "scan").replace(/\s+/g, "_");
  const origExt = (originalFile?.name || "").split(".").pop() || "bin";

  const origRef = ref(storage, `users/${uid}/scans/${ts}_${safeBase}.${origExt}`);
  const procRef = ref(storage, `users/${uid}/scans/${ts}_${safeBase}_processed.png`);

  if (originalFile) await uploadBytes(origRef, originalFile);
  await uploadBytes(procRef, processedBlob);

  const originalUrl = originalFile ? await getDownloadURL(origRef) : "";
  const processedUrl = await getDownloadURL(procRef);

  const docRef = await addDoc(collection(db, "scans"), {
    uid,
    filename: baseName || "scan",
    originalUrl,
    processedUrl,
    createdAt: serverTimestamp(),
    status,
    mode,
    autoCrop: !!autoCrop,
  });

  return { id: docRef.id, originalUrl, processedUrl };
}
