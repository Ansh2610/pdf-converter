// src/components/Scanner/CropTool.js
import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const Container = styled.div`
  width: 100%;
`;

const Title = styled.h3`
  text-align: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.darkScreen};
`;

const CropContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  
  .ReactCrop {
    max-width: 100%;
    max-height: 400px;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 10px;
`;

const Button = styled.button`
  background: ${props => props.primary ? '#4CAF50' : '#666'};
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 18px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  
  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  }
`;

const PresetButtons = styled.div`
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
`;

const PresetButton = styled.button`
  background: #333;
  color: #9bbc0f;
  border: 1px solid #9bbc0f;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 14px;
  
  &:hover {
    background: #444;
  }
`;

function CropTool({ image, onComplete, onCancel }) {
  const [crop, setCrop] = useState({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // Preset crop ratios
  const applyPreset = (preset) => {
    switch (preset) {
      case 'a4':
        setCrop({
          unit: '%',
          aspect: 210 / 297, // A4 ratio
          width: 80,
          x: 10,
          y: 10
        });
        break;
      case 'letter':
        setCrop({
          unit: '%',
          aspect: 8.5 / 11, // Letter ratio
          width: 80,
          x: 10,
          y: 10
        });
        break;
      case 'square':
        setCrop({
          unit: '%',
          aspect: 1,
          width: 70,
          x: 15,
          y: 15
        });
        break;
      case 'free':
        setCrop({
          unit: '%',
          width: 90,
          height: 90,
          x: 5,
          y: 5
        });
        break;
      default:
        break;
    }
  };

  const getCroppedImg = () => {
    if (!completedCrop || !imgRef.current) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas.toDataURL('image/png');
  };

  const handleComplete = () => {
    const croppedImage = getCroppedImg();
    if (croppedImage) {
      onComplete(croppedImage);
    }
  };

  return (
    <Container>
      <Title>✂️ CROP DOCUMENT</Title>
      
      <PresetButtons>
        <PresetButton onClick={() => applyPreset('a4')}>A4</PresetButton>
        <PresetButton onClick={() => applyPreset('letter')}>LETTER</PresetButton>
        <PresetButton onClick={() => applyPreset('square')}>SQUARE</PresetButton>
        <PresetButton onClick={() => applyPreset('free')}>FREE</PresetButton>
      </PresetButtons>
      
      <CropContainer>
        <ReactCrop
          crop={crop}
          onChange={c => setCrop(c)}
          onComplete={c => setCompletedCrop(c)}
        >
          <img 
            ref={imgRef}
            src={image} 
            alt="Crop preview"
            style={{ maxWidth: '100%', maxHeight: '400px' }}
          />
        </ReactCrop>
      </CropContainer>
      
      <ButtonGroup>
        <Button primary onClick={handleComplete}>
          ✓ APPLY CROP
        </Button>
        <Button onClick={onCancel}>
          ✕ CANCEL
        </Button>
      </ButtonGroup>
    </Container>
  );
}

export default CropTool;