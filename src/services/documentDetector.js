// src/services/documentDetector.js

// Simple document detection without OpenCV - using canvas-based image processing
const detectDocument = async (canvas) => {
  try {
    console.log('Starting simple document detection...');
    
    // Get canvas context and image data
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    
    // Apply basic image enhancement
    const enhancedCanvas = applyBasicEnhancement(canvas);
    
    console.log('Document processing completed');
    return {
      success: true,
      canvas: enhancedCanvas,
      detected: false // Simple method doesn't do actual detection
    };
    
  } catch (error) {
    console.error('Document detection error:', error);
    return createFallbackResult(canvas);
  }
};

// Apply basic image enhancement using canvas operations
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

// Fallback when OpenCV is not available
const createFallbackResult = (canvas) => {
  console.log('Using fallback processing (no OpenCV)');
  
  // Create a new canvas for basic enhancement
  const enhancedCanvas = document.createElement('canvas');
  const ctx = enhancedCanvas.getContext('2d');
  
  enhancedCanvas.width = canvas.width;
  enhancedCanvas.height = canvas.height;
  
  // Copy original
  ctx.drawImage(canvas, 0, 0);
  
  // Apply basic enhancement
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Increase contrast and brightness
  for (let i = 0; i < data.length; i += 4) {
    const contrast = 1.2;
    const brightness = 10;
    
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  return {
    success: true,
    canvas: enhancedCanvas,
    detected: false
  };
};

// Export both named and default for compatibility with different import styles
export { detectDocument };
export default detectDocument;