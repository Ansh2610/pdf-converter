// src/services/documentDetector.js

// Wait for OpenCV to be ready (with a timeout to avoid hanging forever)
const waitForOpenCV = (timeoutMs = 8000) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const checkCV = () => {
      if (window.cv && window.cv.Mat) return resolve(window.cv);
      if (Date.now() - start > timeoutMs) return reject(new Error("OpenCV failed to load"));
      setTimeout(checkCV, 100);
    };
    checkCV();
  });
};

export const detectDocument = async (imageElement) => {
  const cv = await waitForOpenCV();
  
  try {
    if (!imageElement || !imageElement.width || !imageElement.height) {
      throw new Error("Invalid image/canvas input");
    }

    const src = cv.imread(imageElement);
    
    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply blur to reduce noise
    const blurred = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, ksize, 0);
    
    // Edge detection
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);
    
    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
  let maxArea = 0;
  let documentCorners = null;
    
    // Find largest rectangular contour
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

      // Check if shape is quadrilateral and large enough
      if (approx.rows === 4 && area > maxArea && area > (src.rows * src.cols * 0.1)) {
        maxArea = area;
        // replace previous corners if any
        if (documentCorners) documentCorners.delete();
        documentCorners = approx;
      } else {
        approx.delete();
      }
      // delete temporary contour mat to avoid leaks
      cnt.delete();
    }
    
    let result;
    let detected = false;
    
  if (documentCorners) {
      // Apply perspective transform
      result = applyPerspectiveTransform(src, documentCorners, cv);
      detected = true;
      documentCorners.delete();
    } else {
      // Fallback - return slightly cropped original
      const margin = 20;
      const rect = new cv.Rect(
        margin, 
        margin, 
        Math.max(1, src.cols - 2 * margin), 
        Math.max(1, src.rows - 2 * margin)
      );
      result = src.roi(rect);
    }
    
    // Convert to canvas
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, result);
    
  // Cleanup
  src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    result.delete();
    
    return {
      canvas,
      detected,
      success: true
    };
  } catch (error) {
    console.error('Detection error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const applyPerspectiveTransform = (src, corners, cv) => {
  // Get corner points
  const points = [];
  for (let i = 0; i < 4; i++) {
    points.push({
      x: corners.data32S[i * 2],
      y: corners.data32S[i * 2 + 1]
    });
  }
  
  // Order points: top-left, top-right, bottom-right, bottom-left
  const orderedPoints = orderPoints(points);
  
  // Calculate output dimensions
  const widthF = Math.max(
    distance(orderedPoints[0], orderedPoints[1]),
    distance(orderedPoints[2], orderedPoints[3])
  );
  const heightF = Math.max(
    distance(orderedPoints[0], orderedPoints[3]),
    distance(orderedPoints[1], orderedPoints[2])
  );
  const width = Math.max(1, Math.round(widthF));
  const height = Math.max(1, Math.round(heightF));
  
  // Create transformation matrices
  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    orderedPoints[0].x, orderedPoints[0].y,
    orderedPoints[1].x, orderedPoints[1].y,
    orderedPoints[2].x, orderedPoints[2].y,
    orderedPoints[3].x, orderedPoints[3].y
  ]);
  
  const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    width - 1, 0,
    width - 1, height - 1,
    0, height - 1
  ]);
  
  // Get perspective transform matrix
  const M = cv.getPerspectiveTransform(srcPts, dstPts);
  
  // Apply transform
  const dst = new cv.Mat();
  const dsize = new cv.Size(width, height);
  cv.warpPerspective(src, dst, M, dsize);
  
  // Cleanup
  srcPts.delete();
  dstPts.delete();
  M.delete();
  
  return dst;
};

const orderPoints = (points) => {
  // Sort by y-coordinate
  points.sort((a, b) => a.y - b.y);
  
  // Top two points
  const top = points.slice(0, 2);
  // Bottom two points
  const bottom = points.slice(2, 4);
  
  // Sort by x-coordinate
  top.sort((a, b) => a.x - b.x);
  bottom.sort((a, b) => a.x - b.x);
  
  return [top[0], top[1], bottom[1], bottom[0]];
};

const distance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Provide a default export for compatibility with default imports
export default detectDocument;