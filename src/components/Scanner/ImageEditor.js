// src/components/Scanner/ImageEditor.js
import { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { applyFilter, rotateImage } from '../../services/imageProcessor';

const EditorContainer = styled.div`
  width: 100%;
`;

const Title = styled.h3`
  text-align: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.darkScreen};
`;

const ImageContainer = styled.div`
  text-align: center;
  margin-bottom: 20px;
  position: relative;
  display: inline-block;
  left: 50%;
  transform: translateX(-50%);
  border: 2px solid #5a7a5a;
  border-radius: 10px;
  overflow: hidden;
  max-height: 70vh;
`;

const ZoomContainer = styled.div`
  position: relative;
  overflow: auto;
  max-height: 500px;
  max-width: 100%;
  border-radius: 8px;
`;

const ZoomableCanvas = styled.canvas`
  display: block;
  cursor: ${props => props.isDragging ? 'grabbing' : 'grab'};
  transform: scale(${props => props.zoom});
  transform-origin: top left;
  transition: transform 0.1s ease;
`;

const ZoomableImage = styled.img`
  display: block;
  cursor: ${props => props.isDragging ? 'grabbing' : 'grab'};
  transform: scale(${props => props.zoom});
  transform-origin: top left;
  transition: transform 0.1s ease;
  max-width: none;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
`;

const ControlGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
`;

const ControlLabel = styled.label`
  color: ${props => props.theme.colors.darkScreen};
  font-weight: bold;
  margin-right: 10px;
`;

const ZoomSlider = styled.input`
  width: 200px;
  margin: 0 10px;
`;

const ZoomValue = styled.span`
  color: ${props => props.theme.colors.screen};
  font-weight: bold;
  min-width: 50px;
`;

const Button = styled.button`
  background: ${props => props.active ? '#4CAF50' : '#333'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 15px;
  font-size: 16px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
  cursor: pointer;
  
  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 0 rgba(0,0,0,0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ActionButton = styled(Button)`
  background: ${props => props.primary ? '#4CAF50' : props.danger ? '#ff6b6b' : '#666'};
  padding: 10px 20px;
  font-size: 18px;
`;

function ImageEditor({ image, onComplete, onCancel }) {
  const [currentImage, setCurrentImage] = useState(image);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState('original');
  const [crop, setCrop] = useState(null);
  const [cropMode, setCropMode] = useState('none'); // 'none', 'rect', 'free'
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [freeDrawPoints, setFreeDrawPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Load image to canvas
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Apply current filter
      if (filter !== 'original') {
        applyFilter(canvas, filter);
      }

      // Setup overlay canvas for free drawing
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = canvas.width;
        overlayCanvas.height = canvas.height;
      }
    };
    img.src = currentImage;
  }, [currentImage, filter]);

  // Handle mouse events for free drawing
  const handleMouseDown = (e) => {
    if (cropMode === 'free') {
      setIsDrawing(true);
      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setFreeDrawPoints([{x, y}]);
    }
  };

  const handleMouseMove = (e) => {
    if (cropMode === 'free' && isDrawing) {
      const rect = overlayCanvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      setFreeDrawPoints(prev => [...prev, {x, y}]);
      
      // Draw on overlay canvas
      const overlayCanvas = overlayCanvasRef.current;
      const ctx = overlayCanvas.getContext('2d');
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      if (freeDrawPoints.length > 0) {
        const lastPoint = freeDrawPoints[freeDrawPoints.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (cropMode === 'free' && isDrawing) {
      setIsDrawing(false);
      // Close the path if we have enough points
      if (freeDrawPoints.length > 3) {
        const overlayCanvas = overlayCanvasRef.current;
        const ctx = overlayCanvas.getContext('2d');
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        
        // Close the path
        ctx.beginPath();
        const lastPoint = freeDrawPoints[freeDrawPoints.length - 1];
        const firstPoint = freeDrawPoints[0];
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        ctx.stroke();
      }
    }
  };

  const startRectCrop = () => {
    setCropMode('rect');
    // Initialize crop with proper format for react-image-crop
    setCrop({ 
      unit: '%', 
      width: 50, 
      height: 50, 
      x: 25, 
      y: 25 
    });
  };

  const startFreeCrop = () => {
    setCropMode('free');
    setFreeDrawPoints([]);
    // Clear overlay canvas
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  };

  const cancelCrop = () => {
    setCropMode('none');
    setCrop(null);
    setFreeDrawPoints([]);
    // Clear overlay canvas
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  };

  const applyCrop = () => {
    try {
      let sourceCanvas = canvasRef.current;
      
      if (cropMode === 'rect' && crop) {
        // For ReactCrop, we need to work with the actual image dimensions
        // Create a canvas from the current image to ensure we have the right data
        if (!sourceCanvas || cropMode === 'rect') {
          const img = new Image();
          img.onload = () => {
            // Create a temporary canvas with the image
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);
            
            // Apply crop to the temporary canvas
            console.log('Applying rectangular crop:', crop);
            console.log('Image dimensions:', img.width, 'x', img.height);
            
            const croppedCanvas = applyRectCrop(tempCanvas, crop);
            if (croppedCanvas) {
              console.log('Rectangular crop successful, updating image');
              setCurrentImage(croppedCanvas.toDataURL());
              cancelCrop();
            } else {
              console.error('Failed to crop image');
            }
          };
          img.src = currentImage;
          return;
        }
      }
      
      if (!sourceCanvas) {
        console.error('Canvas not available for cropping');
        return;
      }

      let croppedCanvas = null;

      if (cropMode === 'rect' && crop) {
        // Apply rectangular crop with proper conversion from ReactCrop format
        console.log('Applying rectangular crop:', crop);
        croppedCanvas = applyRectCrop(sourceCanvas, crop);
        if (croppedCanvas) {
          console.log('Rectangular crop successful, updating image');
          setCurrentImage(croppedCanvas.toDataURL());
        } else {
          console.error('Failed to crop image');
        }
      } else if (cropMode === 'free' && freeDrawPoints.length > 3) {
        // Apply free-form crop
        console.log('Applying free-form crop with', freeDrawPoints.length, 'points');
        croppedCanvas = applyFreeCrop(sourceCanvas, freeDrawPoints);
        if (croppedCanvas) {
          console.log('Free-form crop successful, updating image');
          setCurrentImage(croppedCanvas.toDataURL());
        } else {
          console.error('Failed to apply free crop');
        }
      } else {
        console.log('No valid crop to apply. CropMode:', cropMode, 'Crop:', crop, 'FreeDrawPoints:', freeDrawPoints.length);
      }
      
      // Reset crop state
      cancelCrop();
    } catch (error) {
      console.error('Error applying crop:', error);
    }
  };

  // Apply rectangular crop with proper coordinate conversion
  const applyRectCrop = (canvas, cropData) => {
    try {
      console.log('applyRectCrop called with:', cropData);
      console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      const { width: canvasWidth, height: canvasHeight } = canvas;
      
      // Convert from percentage or pixel coordinates
      let x, y, width, height;
      
      if (cropData.unit === '%' || typeof cropData.x === 'string') {
        // Handle percentage values (either as numbers or strings like "10%")
        x = (parseFloat(cropData.x) / 100) * canvasWidth;
        y = (parseFloat(cropData.y) / 100) * canvasHeight;
        width = (parseFloat(cropData.width) / 100) * canvasWidth;
        height = (parseFloat(cropData.height) / 100) * canvasHeight;
      } else {
        // Handle pixel values
        x = cropData.x || 0;
        y = cropData.y || 0;
        width = cropData.width || canvasWidth;
        height = cropData.height || canvasHeight;
      }
      
      console.log('Calculated crop coordinates:', { x, y, width, height });
      
      // Ensure crop area is within canvas bounds
      x = Math.max(0, Math.min(x, canvasWidth - 1));
      y = Math.max(0, Math.min(y, canvasHeight - 1));
      width = Math.min(width, canvasWidth - x);
      height = Math.min(height, canvasHeight - y);
      
      console.log('Bounded crop coordinates:', { x, y, width, height });
      
      // Validate crop dimensions
      if (width <= 0 || height <= 0) {
        console.error('Invalid crop dimensions:', { width, height });
        return null;
      }
      
      // Create cropped canvas
      const croppedCanvas = document.createElement('canvas');
      const ctx = croppedCanvas.getContext('2d');
      
      croppedCanvas.width = width;
      croppedCanvas.height = height;
      
      // Draw the cropped area
      ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
      
      console.log('Cropped canvas created:', croppedCanvas.width, 'x', croppedCanvas.height);
      
      return croppedCanvas;
    } catch (error) {
      console.error('Error in applyRectCrop:', error);
      return null;
    }
  };

  const applyFreeCrop = (canvas, points) => {
    // Find bounding box of the drawn area
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    // Add some padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    // Create cropped canvas
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    
    // Draw the cropped area
    croppedCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
    
    return croppedCanvas;
  };

  const handleRotate = (degrees) => {
    const newRotation = (rotation + degrees) % 360;
    setRotation(newRotation);
    
    // Apply rotation
    const canvas = canvasRef.current;
    const rotatedCanvas = rotateImage(canvas, degrees);
    setCurrentImage(rotatedCanvas.toDataURL());
  };

  const handleFilter = (filterType) => {
    setFilter(filterType);
    
    // Reapply from original image with new filter
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      applyFilter(canvas, filterType);
      setCurrentImage(canvas.toDataURL());
    };
    img.src = image; // Use original image for filter
  };

  const handleZoomChange = (e) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleComplete = () => {
    // Use the current image state which should always be available
    if (currentImage) {
      onComplete(currentImage);
    } else {
      // Fallback to canvas if currentImage is not available
      const canvas = canvasRef.current;
      if (canvas) {
        onComplete(canvas.toDataURL());
      } else {
        console.error('No image available to complete');
      }
    }
  };

  return (
    <EditorContainer>
      <Title>✏️ EDIT IMAGE</Title>
      
      <Controls>
        {/* Zoom Controls */}
        <ControlGroup>
          <ControlLabel>🔍 Zoom:</ControlLabel>
          <ZoomSlider
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={handleZoomChange}
          />
          <ZoomValue>{Math.round(zoom * 100)}%</ZoomValue>
          <Button onClick={() => setZoom(1)}>Reset</Button>
        </ControlGroup>

        {/* Rotation Controls */}
        <ControlGroup>
          <ControlLabel>🔄 Rotate:</ControlLabel>
          <Button onClick={() => handleRotate(-90)}>↺ 90°</Button>
          <Button onClick={() => handleRotate(90)}>↻ 90°</Button>
          <Button onClick={() => handleRotate(180)}>180°</Button>
        </ControlGroup>

        {/* Filter Controls */}
        <ControlGroup>
          <ControlLabel>🎨 Filter:</ControlLabel>
          <Button active={filter === 'original'} onClick={() => handleFilter('original')}>
            Original
          </Button>
          <Button active={filter === 'grayscale'} onClick={() => handleFilter('grayscale')}>
            Grayscale
          </Button>
          <Button active={filter === 'blackwhite'} onClick={() => handleFilter('blackwhite')}>
            B&W
          </Button>
          <Button active={filter === 'enhanced'} onClick={() => handleFilter('enhanced')}>
            Enhanced
          </Button>
        </ControlGroup>

        {/* Manual Crop Controls */}
        <ControlGroup>
          <ControlLabel>✂️ Manual Crop:</ControlLabel>
          {cropMode === 'none' ? (
            <>
              <Button onClick={startRectCrop}>📦 Box Crop</Button>
              <Button onClick={startFreeCrop}>✏️ Free Crop</Button>
            </>
          ) : (
            <>
              <Button primary onClick={applyCrop}>Apply Crop</Button>
              <Button onClick={cancelCrop}>Cancel Crop</Button>
            </>
          )}
        </ControlGroup>
      </Controls>

      <ImageContainer ref={containerRef}>
        <ZoomContainer>
          {cropMode === 'rect' ? (
            <ReactCrop
              crop={crop}
              onChange={setCrop}
              aspect={undefined}
              keepSelection={true}
            >
              <ZoomableImage
                src={currentImage}
                alt="Edit"
                zoom={zoom}
                isDragging={isDragging}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              />
            </ReactCrop>
          ) : (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <ZoomableCanvas
                ref={canvasRef}
                zoom={zoom}
                isDragging={isDragging && cropMode !== 'free'}
                onMouseDown={cropMode === 'free' ? handleMouseDown : () => setIsDragging(true)}
                onMouseMove={cropMode === 'free' ? handleMouseMove : undefined}
                onMouseUp={cropMode === 'free' ? handleMouseUp : () => setIsDragging(false)}
                onMouseLeave={() => {
                  setIsDragging(false);
                  if (cropMode === 'free') handleMouseUp();
                }}
                style={{ 
                  cursor: cropMode === 'free' ? 'crosshair' : isDragging ? 'grabbing' : 'grab'
                }}
              />
              {cropMode === 'free' && (
                <canvas
                  ref={overlayCanvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left'
                  }}
                />
              )}
            </div>
          )}
        </ZoomContainer>
      </ImageContainer>

      {cropMode === 'free' && (
        <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>
          <small>🖊️ Draw around the area you want to crop</small>
        </div>
      )}

      <ControlGroup>
        <ActionButton primary onClick={handleComplete}>
          ✓ APPLY CHANGES
        </ActionButton>
        <ActionButton onClick={onCancel}>
          ✕ CANCEL
        </ActionButton>
      </ControlGroup>
    </EditorContainer>
  );
}

export default ImageEditor;

