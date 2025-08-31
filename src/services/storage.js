// src/services/storage.js
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { storage, db, auth } from './firebase';

export const uploadScan = async (scanData) => {
  const { originalBlob, processedBlob, filename, metadata = {} } = scanData;
  
  if (!auth.currentUser) {
    throw new Error('User not authenticated');
  }

  const userId = auth.currentUser.uid;
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Create storage references
    const originalRef = ref(storage, `scans/${userId}/${scanId}/original.png`);
    const processedRef = ref(storage, `scans/${userId}/${scanId}/processed.png`);

    // Upload files
    const [originalSnapshot, processedSnapshot] = await Promise.all([
      uploadBytes(originalRef, originalBlob),
      uploadBytes(processedRef, processedBlob)
    ]);

    // Get download URLs
    const [originalUrl, processedUrl] = await Promise.all([
      getDownloadURL(originalSnapshot.ref),
      getDownloadURL(processedSnapshot.ref)
    ]);

    // Save metadata to Firestore
    const docRef = await addDoc(collection(db, 'scans'), {
      userId,
      scanId,
      filename,
      originalUrl,
      processedUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...metadata
    });

    return {
      id: docRef.id,
      scanId,
      originalUrl,
      processedUrl
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const deleteScan = async (scan) => {
  if (!auth.currentUser || auth.currentUser.uid !== scan.userId) {
    throw new Error('Unauthorized');
  }

  try {
    // Delete from Storage
    const originalRef = ref(storage, `scans/${scan.userId}/${scan.scanId}/original.png`);
    const processedRef = ref(storage, `scans/${scan.userId}/${scan.scanId}/processed.png`);
    
    // Try to delete files (may not exist)
    await Promise.allSettled([
      deleteObject(originalRef),
      deleteObject(processedRef)
    ]);

    // Delete from Firestore
    await deleteDoc(doc(db, 'scans', scan.id));
    
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};

export const updateScanMetadata = async (scanId, updates) => {
  if (!auth.currentUser) {
    throw new Error('User not authenticated');
  }

  try {
    const scanRef = doc(db, 'scans', scanId);
    await updateDoc(scanRef, {
      ...updates,
      updatedAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Update error:', error);
    throw error;
  }
};