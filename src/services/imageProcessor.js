// src/services/imageProcessor.js

export const applyFilter = (canvas, filterType) => {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  switch (filterType) {
    case 'grayscale':
      // Convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      break;
      
    case 'blackwhite':
      // Convert to black and white
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const bw = gray > 128 ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }
      break;
      
    case 'enhanced':
      // Enhance contrast and brightness
      const contrast = 1.2;
      const brightness = 10;
      
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

// Downscale a canvas to a maximum dimension to speed up processing
export const scaleToMax = (canvas, maxDim = 1600) => {
  if (!canvas || !canvas.width || !canvas.height) return canvas;
  const { width, height } = canvas;
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDim) return canvas; // already small enough
  const k = maxDim / maxSide;
  const w = Math.max(1, Math.round(width * k));
  const h = Math.max(1, Math.round(height * k));
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  // use high quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, w, h);
  return out;
};

export const rotateImage = (canvas, degrees) => {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  // Calculate new dimensions after rotation
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  
  const newWidth = canvas.width * cos + canvas.height * sin;
  const newHeight = canvas.width * sin + canvas.height * cos;
  
  tempCanvas.width = newWidth;
  tempCanvas.height = newHeight;
  
  // Rotate around center
  tempCtx.translate(newWidth / 2, newHeight / 2);
  tempCtx.rotate(radians);
  tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return tempCanvas;
};

export const cropImage = (canvas, cropData) => {
  const { x, y, width, height } = cropData;
  const croppedCanvas = document.createElement('canvas');
  const ctx = croppedCanvas.getContext('2d');
  
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  
  ctx.drawImage(
    canvas,
    x, y, width, height,
    0, 0, width, height
  );
  
  return croppedCanvas;
};

export const extractPDFPage = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
  // Render at moderate scale; we'll clamp with scaleToMax afterwards
  const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

  // Clamp huge PDFs to a manageable size for faster processing
  return scaleToMax(canvas, 1600);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

export const imageToBase64 = (canvas) => {
  return canvas.toDataURL('image/png');
};

export const base64ToBlob = async (base64) => {
  const response = await fetch(base64);
  return response.blob();
};