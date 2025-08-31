// src/services/imageProcessor.js

// Simple image scaling function
export const scaleToMax = (canvas, maxDim = 800) => {
  if (!canvas || !canvas.width || !canvas.height) return canvas;
  
  const { width, height } = canvas;
  const maxSide = Math.max(width, height);
  
  if (maxSide <= maxDim) return canvas; // already small enough
  
  const scale = maxDim / maxSide;
  const newWidth = Math.max(1, Math.round(width * scale));
  const newHeight = Math.max(1, Math.round(height * scale));
  
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = newWidth;
  scaledCanvas.height = newHeight;
  
  const ctx = scaledCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
  
  return scaledCanvas;
};

// Extract first page from PDF
export const extractPDFPage = async (file) => {
  try {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // First page
    
    // Render at reasonable scale
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    return canvas;
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract PDF page: ' + error.message);
  }
};

// Simple document processing - just enhance and clean up the image
export const processDocument = async (canvas) => {
  try {
    // Create a new canvas for processing
    const processedCanvas = document.createElement('canvas');
    const ctx = processedCanvas.getContext('2d');
    
    processedCanvas.width = canvas.width;
    processedCanvas.height = canvas.height;
    
    // Draw original image
    ctx.drawImage(canvas, 0, 0);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple enhancement: increase contrast and brightness
    for (let i = 0; i < data.length; i += 4) {
      // Increase contrast
      const contrast = 1.2;
      const brightness = 10;
      
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));     // Red
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness)); // Green
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness)); // Blue
    }
    
    // Apply the enhanced image data
    ctx.putImageData(imageData, 0, 0);
    
    return {
      success: true,
      canvas: processedCanvas,
      detected: true
    };
    
  } catch (error) {
    console.error('Document processing error:', error);
    return {
      success: false,
      error: error.message,
      canvas: canvas // Return original on error
    };
  }
};

// Apply filters to image
export const applyFilter = (canvas, filterType) => {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  switch (filterType) {
    case 'grayscale':
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      break;
      
    case 'blackwhite':
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const bw = gray > 128 ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }
      break;
      
    case 'enhanced':
      const contrast = 1.3;
      const brightness = 15;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
      }
      break;
      
    case 'original':
    default:
      // No filter
      break;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

// Rotate image
export const rotateImage = (canvas, degrees) => {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  
  const newWidth = canvas.width * cos + canvas.height * sin;
  const newHeight = canvas.width * sin + canvas.height * cos;
  
  tempCanvas.width = newWidth;
  tempCanvas.height = newHeight;
  
  tempCtx.translate(newWidth / 2, newHeight / 2);
  tempCtx.rotate(radians);
  tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return tempCanvas;
};

// Crop image
export const cropImage = (canvas, cropData) => {
  const { x, y, width, height } = cropData;
  const croppedCanvas = document.createElement('canvas');
  const ctx = croppedCanvas.getContext('2d');
  
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  
  ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
  
  return croppedCanvas;
};

// Helper functions
export const canvasToBlob = (canvas, quality = 0.9) => {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
};

export const base64ToBlob = (base64, mimeType = 'image/jpeg') => {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};
