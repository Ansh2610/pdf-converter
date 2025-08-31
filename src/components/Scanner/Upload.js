// src/components/Scanner/Upload.js
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { auth, storage, db } from '../../services/firebase';
import detectDocument from '../../services/documentDetector';
import { extractPDFPage, base64ToBlob, scaleToMax } from '../../services/imageProcessor';
import ImageEditor from './ImageEditor';
import CompareView from './CompareView';

const Container = styled.div`
  width: 100%;
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 20px;
  font-size: 24px;
  color: ${props => props.theme.colors.darkScreen};
`;

const DropZone = styled.div`
  border: 3px dashed ${props => props.isDragActive ? '#0f380f' : '#5a7a5a'};
  border-radius: 10px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: ${props => props.isDragActive ? 'rgba(15, 56, 15, 0.1)' : 'transparent'};
  
  &:hover {
    border-color: #0f380f;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 30px 20px;
  }
`;

const UploadIcon = styled.div`
  font-size: 48px;
  margin-bottom: 10px;
`;

const UploadText = styled.p`
  font-size: 18px;
  margin-bottom: 10px;
`;

const Button = styled.button`
  background: ${props => props.primary ? '#4CAF50' : '#666'};
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 18px;
  margin: 5px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  
  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
`;

const Status = styled.div`
  text-align: center;
  margin: 20px 0;
  padding: 10px;
  background: ${props => props.error ? 'rgba(255,107,107,0.2)' : 'rgba(76,175,80,0.2)'};
  border-radius: 5px;
  color: ${props => props.theme.colors.darkScreen};
`;

const LoadingSpinner = styled.div`
  border: 4px solid #0f380f;
  border-top: 4px solid transparent;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 20px auto;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

function Upload() {
  const [file, setFile] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [editedImage, setEditedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setError('');
    setStatus('Processing...');
    setLoading(true);

    try {
      let imageCanvas;
      
      // Handle PDF or image
      if (file.type === 'application/pdf') {
        setStatus('Extracting PDF page...');
        imageCanvas = await extractPDFPage(file);
      } else {
        // Load image
        const img = new Image();
        const url = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        
        // Convert to canvas
        imageCanvas = document.createElement('canvas');
        const ctx = imageCanvas.getContext('2d');
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

  // Downscale before heavy processing for speed
  const smallCanvas = scaleToMax(imageCanvas, 1600);
  setOriginalImage(smallCanvas.toDataURL());
      
      // Detect and process document
      setStatus('Detecting document...');
  const result = await detectDocument(smallCanvas);
      
      if (result.success) {
        const processedDataUrl = result.canvas.toDataURL();
        setProcessedImage(processedDataUrl);
        setEditedImage(processedDataUrl);
        
        if (!result.detected) {
          setStatus('No document detected - applied auto-crop');
        } else {
          setStatus('Document detected and processed!');
        }
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleSave = async () => {
    if (!editedImage) return;
    
    setLoading(true);
    setStatus('Saving to cloud...');
    
    try {
      const userId = auth.currentUser.uid;
      const scanId = uuidv4();
      
      // Convert to blobs
      const originalBlob = await base64ToBlob(originalImage);
      const processedBlob = await base64ToBlob(editedImage);
      
      // Upload to Firebase Storage
      const originalRef = ref(storage, `scans/${userId}/${scanId}/original.png`);
      const processedRef = ref(storage, `scans/${userId}/${scanId}/processed.png`);
      
      const [originalSnapshot, processedSnapshot] = await Promise.all([
        uploadBytes(originalRef, originalBlob),
        uploadBytes(processedRef, processedBlob)
      ]);
      
      const [originalUrl, processedUrl] = await Promise.all([
        getDownloadURL(originalSnapshot.ref),
        getDownloadURL(processedSnapshot.ref)
      ]);
      
      // Save metadata
      await addDoc(collection(db, 'scans'), {
        userId,
        scanId,
        filename: file.name,
        originalUrl,
        processedUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      setStatus('Saved successfully!');
      setTimeout(() => navigate('/gallery'), 1500);
      
    } catch (err) {
      setError(`Save error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setOriginalImage(null);
    setProcessedImage(null);
    setEditedImage(null);
    setStatus('');
    setError('');
    setShowEditor(false);
    setShowCompare(false);
  };

  const handleEditComplete = (newImage) => {
    setEditedImage(newImage);
    setShowEditor(false);
    setStatus('Image edited');
  };

  return (
    <Container>
      <Title>📸 DOCUMENT SCANNER</Title>
      
      {error && <Status error>{error}</Status>}
      {status && !error && <Status>{status}</Status>}
      
      {!file && !loading && (
        <DropZone {...getRootProps()} isDragActive={isDragActive}>
          <input {...getInputProps()} />
          <UploadIcon>📄</UploadIcon>
          {isDragActive ? (
            <UploadText>Drop the file here...</UploadText>
          ) : (
            <>
              <UploadText>Drag & drop a document here</UploadText>
              <UploadText style={{ fontSize: '14px' }}>
                or click to select (PNG, JPG, PDF)
              </UploadText>
            </>
          )}
        </DropZone>
      )}
      
      {loading && <LoadingSpinner />}
      
      {editedImage && !loading && !showEditor && !showCompare && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img 
              src={editedImage} 
              alt="Processed" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '300px',
                borderRadius: '10px',
                border: '2px solid #0f380f'
              }} 
            />
          </div>
          
          <ButtonGroup>
            <Button primary onClick={handleSave}>
              💾 SAVE
            </Button>
            <Button onClick={() => setShowEditor(true)}>
              ✏️ EDIT
            </Button>
            <Button onClick={() => setShowCompare(true)}>
              🔍 COMPARE
            </Button>
            <Button onClick={handleReset}>
              🔄 NEW
            </Button>
          </ButtonGroup>
        </>
      )}
      
      {showEditor && (
        <ImageEditor
          image={editedImage}
          onComplete={handleEditComplete}
          onCancel={() => setShowEditor(false)}
        />
      )}
      
      {showCompare && (
        <CompareView
          original={originalImage}
          processed={editedImage}
          onClose={() => setShowCompare(false)}
        />
      )}
    </Container>
  );
}

export default Upload;