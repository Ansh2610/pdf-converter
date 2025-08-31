// src/components/Scanner/ImageEditor.js
import { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { applyFilter, rotateImage, cropImage } from '../../services/imageProcessor';

const EditorContainer = styled.div`
  width: 100%;
`;

const Title = styled.h3`
  text-align: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.darkScreen};
`;

const CanvasContainer = styled.div`
  text-align: center;
  margin-bottom: 20px;
  position: relative;
  display: inline-block;
  left: 50%;
  transform: translateX(-50%);
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
`;

const Button = styled.button`
  background: ${props => props.active ? '#4CAF50' : '#333'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 15px;
  font-size: 16px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
  
  &:active {
    transform: translateY(1px);
    box-shadow: 0 1px 0 rgba(0,0,0,0.3);
  }
`;

const ActionButton = styled(Button)`
  background: ${props => props.primary ? '#4CAF50' : '#666'};
  padding: 10px 20px;
  font-size: 18px;
`;

function ImageEditor({ image, onComplete, onCancel }) {
  const [currentImage, setCurrentImage] = useState(image);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState('original');
  const [crop, setCrop] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

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
    };
    img.src = currentImage;
  }, [currentImage, filter]);

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

  const handleCropComplete = () => {
    if (!crop || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;
    
    const cropData = {
      x: crop.x * scaleX,
      y: crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY
    };
    
    const croppedCanvas = cropImage(canvas, cropData);
    setCurrentImage(croppedCanvas.toDataURL());
    setCrop(null);
    setIsCropping(false);
  };

  const handleComplete = () => {
    const canvas = canvasRef.current;
    onComplete(canvas.toDataURL());
  };

  return (
    <EditorContainer>
      <Title>✏️ EDIT IMAGE</Title>
      
      <CanvasContainer>
        {isCropping ? (
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            style={{ maxWidth: '100%', maxHeight: '400px' }}
          >
            <canvas 
              ref={canvasRef}
              style={{ maxWidth: '100%', maxHeight: '400px' }}
            />
          </ReactCrop>
        ) : (
          <canvas 
            ref={canvasRef}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '400px',
              border: '2px solid #0f380f',
              borderRadius: '5px'
            }}
          />
        )}
      </CanvasContainer>
      
      <Controls>
        <ControlGroup>
          <Button onClick={() => handleRotate(-90)}>↺ 90°</Button>
          <Button onClick={() => handleRotate(90)}>↻ 90°</Button>
          <Button onClick={() => handleRotate(180)}>↻ 180°</Button>
        </ControlGroup>
        
        <ControlGroup>
          <Button 
            active={filter === 'original'} 
            onClick={() => handleFilter('original')}
          >
            COLOR
          </Button>
          <Button 
            active={filter === 'grayscale'} 
            onClick={() => handleFilter('grayscale')}
          >
            GRAY
          </Button>
          <Button 
            active={filter === 'blackwhite'} 
            onClick={() => handleFilter('blackwhite')}
          >
            B&W
          </Button>
          <Button 
            active={filter === 'enhanced'} 
            onClick={() => handleFilter('enhanced')}
          >
            ENHANCE
          </Button>
        </ControlGroup>
        
        <ControlGroup>
          {!isCropping ? (
            <Button onClick={() => setIsCropping(true)}>
              ✂️ CROP
            </Button>
          ) : (
            <>
              <Button onClick={handleCropComplete}>✓ APPLY CROP</Button>
              <Button onClick={() => { setIsCropping(false); setCrop(null); }}>
                ✕ CANCEL
              </Button>
            </>
          )}
        </ControlGroup>
      </Controls>
      
      <ControlGroup>
        <ActionButton primary onClick={handleComplete}>
          ✓ DONE
        </ActionButton>
        <ActionButton onClick={onCancel}>
          ✕ CANCEL
        </ActionButton>
      </ControlGroup>
    </EditorContainer>
  );
}

export default ImageEditor;

