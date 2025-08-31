// src/components/Scanner/Upload.js
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { auth, storage, db } from '../../services/firebase';
import { extractPDFPage, base64ToBlob, scaleToMax } from '../../services/imageProcessor';
import ImageEditor from './ImageEditor';

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

const BeforeAfterGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: 15px;
  }
`;

const ImageContainer = styled.div`
  text-align: center;
`;

const ImageLabel = styled.h3`
  color: ${props => props.theme.colors.screen};
  margin-bottom: 10px;
  font-size: 16px;
  text-shadow: 0 0 5px rgba(155, 188, 15, 0.5);
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 14px;
  }
`;

const ProcessedImage = styled.img`
  width: 100%;
  max-height: 250px;
  object-fit: contain;
  border-radius: 10px;
  border: 2px solid ${props => props.isAfter ? props.theme.colors.primary : '#5a7a5a'};
  background-color: ${props => props.theme.colors.darkScreen};
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    max-height: 200px;
  }
`;

function Upload() {
  const [file, setFile] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [editedImage, setEditedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const navigate = useNavigate();

  // Advanced document detection and auto-cropping function
  const enhanceDocumentImage = (canvas) => {
    try {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try to detect document boundaries
      const documentBounds = detectDocumentBounds(imageData, canvas.width, canvas.height);
      
      if (documentBounds) {
        console.log('Document boundaries detected, applying auto-crop...');
        return cropToDocument(canvas, documentBounds);
      } else {
        console.log('No clear document boundaries found, applying enhancement...');
        return applyBasicEnhancement(canvas);
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      return applyBasicEnhancement(canvas);
    }
  };

  // Detect document boundaries using edge detection
  const detectDocumentBounds = (imageData, width, height) => {
    const data = imageData.data;
    const gray = new Array(width * height);
    
    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    
    // Apply Gaussian blur to reduce noise
    const blurred = gaussianBlur(gray, width, height, 2);
    
    // Edge detection using Sobel operator
    const edges = sobelEdgeDetection(blurred, width, height);
    
    // Find the largest rectangular contour
    const contours = findContours(edges, width, height);
    const documentContour = findLargestRectangularContour(contours, width, height);
    
    return documentContour;
  };

  // Gaussian blur implementation
  const gaussianBlur = (image, width, height, radius) => {
    const kernel = createGaussianKernel(radius);
    const result = new Array(width * height);
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const px = Math.max(0, Math.min(width - 1, x + kx));
            const py = Math.max(0, Math.min(height - 1, y + ky));
            const weight = kernel[ky + half][kx + half];
            
            sum += image[py * width + px] * weight;
            weightSum += weight;
          }
        }
        
        result[y * width + x] = sum / weightSum;
      }
    }
    
    return result;
  };

  // Create Gaussian kernel
  const createGaussianKernel = (radius) => {
    const size = radius * 2 + 1;
    const kernel = [];
    const sigma = radius / 3;
    const sigma2 = 2 * sigma * sigma;
    const center = radius;
    
    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        kernel[y][x] = Math.exp(-(dx * dx + dy * dy) / sigma2);
      }
    }
    
    return kernel;
  };

  // Sobel edge detection
  const sobelEdgeDetection = (image, width, height) => {
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    const result = new Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = image[(y + ky) * width + (x + kx)];
            gx += pixel * sobelX[ky + 1][kx + 1];
            gy += pixel * sobelY[ky + 1][kx + 1];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        result[y * width + x] = magnitude > 50 ? 255 : 0; // Threshold
      }
    }
    
    return result;
  };

  // Simple contour finding
  const findContours = (edges, width, height) => {
    const visited = new Array(width * height).fill(false);
    const contours = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255 && !visited[idx]) {
          const contour = traceContour(edges, width, height, x, y, visited);
          if (contour.length > 20) { // Filter small contours
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  };

  // Trace contour using flood fill
  const traceContour = (edges, width, height, startX, startY, visited) => {
    const contour = [];
    const stack = [{x: startX, y: startY}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] !== 255) {
        continue;
      }
      
      visited[idx] = true;
      contour.push({x, y});
      
      // Add 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            stack.push({x: x + dx, y: y + dy});
          }
        }
      }
    }
    
    return contour;
  };

  // Find the largest rectangular contour that could be a document
  const findLargestRectangularContour = (contours, width, height) => {
    let bestContour = null;
    let maxArea = 0;
    const minArea = (width * height) * 0.1; // At least 10% of image
    
    for (const contour of contours) {
      const bounds = getBoundingBox(contour);
      const area = bounds.width * bounds.height;
      
      // Check if it's large enough and roughly rectangular
      if (area > minArea && area > maxArea) {
        const aspectRatio = bounds.width / bounds.height;
        const rectangularity = calculateRectangularity(contour, bounds);
        
        // Document-like properties: reasonable aspect ratio and rectangularity
        if (aspectRatio > 0.5 && aspectRatio < 3 && rectangularity > 0.7) {
          maxArea = area;
          bestContour = bounds;
        }
      }
    }
    
    return bestContour;
  };

  // Get bounding box of contour
  const getBoundingBox = (contour) => {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Calculate how rectangular a contour is
  const calculateRectangularity = (contour, bounds) => {
    const boundingArea = bounds.width * bounds.height;
    const contourArea = contour.length; // Approximation
    return Math.min(contourArea / boundingArea, 1);
  };

  // Crop canvas to document bounds
  const cropToDocument = (canvas, bounds) => {
    const croppedCanvas = document.createElement('canvas');
    const ctx = croppedCanvas.getContext('2d');
    
    // Add some padding
    const padding = 10;
    const x = Math.max(0, bounds.x - padding);
    const y = Math.max(0, bounds.y - padding);
    const width = Math.min(canvas.width - x, bounds.width + padding * 2);
    const height = Math.min(canvas.height - y, bounds.height + padding * 2);
    
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    
    // Draw cropped region
    ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    
    // Apply enhancement to cropped image
    return applyBasicEnhancement(croppedCanvas);
  };

  // Basic image enhancement
  const applyBasicEnhancement = (canvas) => {
    const enhancedCanvas = document.createElement('canvas');
    const ctx = enhancedCanvas.getContext('2d');
    
    enhancedCanvas.width = canvas.width;
    enhancedCanvas.height = canvas.height;
    
    // Copy original image
    ctx.drawImage(canvas, 0, 0);
    
    // Apply image enhancement
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Enhance contrast and brightness for better document readability
    for (let i = 0; i < data.length; i += 4) {
      const contrast = 1.3; // Increase contrast
      const brightness = 15; // Slight brightness boost
      
      // Apply to RGB channels (skip alpha)
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
    }
    
    ctx.putImageData(imageData, 0, 0);
    return enhancedCanvas;
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setError('');
    setStatus('Processing...');
    setLoading(true);

    try {
      let originalCanvas;
      
      // Handle PDF or image
      if (file.type === 'application/pdf') {
        setStatus('Extracting PDF first page...');
        originalCanvas = await extractPDFPage(file);
      } else {
        setStatus('Loading image...');
        // Load image
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        URL.revokeObjectURL(url);
        
        // Convert to canvas
        originalCanvas = document.createElement('canvas');
        const ctx = originalCanvas.getContext('2d');
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      // Scale down if too large (for display and processing)
      const scaledOriginal = scaleToMax(originalCanvas, 1000);
      if (!scaledOriginal) {
        throw new Error('Failed to scale image');
      }
      setOriginalImage(scaledOriginal.toDataURL());
      
      // Apply document detection and auto-cropping
      setStatus('Detecting document boundaries and auto-cropping...');
      const enhancedCanvas = enhanceDocumentImage(scaledOriginal);
      if (!enhancedCanvas) {
        throw new Error('Failed to enhance image');
      }
      setEditedImage(enhancedCanvas.toDataURL());
      setStatus('Document processed and ready for editing!');
      
    } catch (err) {
      console.error('Processing error:', err);
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
      
      // Save metadata to Firestore in user's subcollection
      console.log('Saving scan for user:', userId, 'scanId:', scanId);
      
      const userScanRef = doc(db, 'users', userId, 'scans', scanId);
      await setDoc(userScanRef, {
        scanId,
        filename: file.name,
        originalUrl,
        processedUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('Scan saved successfully to user subcollection');
      
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
    setEditedImage(null);
    setStatus('');
    setError('');
    setShowEditor(false);
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
      
      {editedImage && originalImage && !loading && !showEditor && (
        <>
          <BeforeAfterGrid>
            <ImageContainer>
              <ImageLabel>📸 BEFORE</ImageLabel>
              <ProcessedImage 
                src={originalImage} 
                alt="Original"
                isAfter={false}
              />
            </ImageContainer>
            <ImageContainer>
              <ImageLabel>✨ AFTER</ImageLabel>
              <ProcessedImage 
                src={editedImage} 
                alt="Processed"
                isAfter={true}
              />
            </ImageContainer>
          </BeforeAfterGrid>
          
          <ButtonGroup>
            <Button primary onClick={handleSave}>
              💾 SAVE
            </Button>
            <Button onClick={() => setShowEditor(true)}>
              ✏️ EDIT
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
    </Container>
  );
}

export default Upload;