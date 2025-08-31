// src/components/Scanner/CompareView.js
import React from 'react';
import styled from 'styled-components';
import ReactCompareImage from 'react-compare-image';

const Container = styled.div`
  width: 100%;
`;

const Title = styled.h3`
  text-align: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.darkScreen};
`;

const CompareContainer = styled.div`
  margin-bottom: 20px;
  border: 2px solid #0f380f;
  border-radius: 10px;
  overflow: hidden;
  max-height: 400px;
`;

const CloseButton = styled.button`
  background: #666;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 18px;
  display: block;
  margin: 0 auto;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  
  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  }
`;

function CompareView({ original, processed, onClose }) {
  return (
    <Container>
      <Title>🔍 BEFORE / AFTER</Title>
      
      <CompareContainer>
        <ReactCompareImage
          leftImage={original}
          rightImage={processed}
          leftImageLabel="ORIGINAL"
          rightImageLabel="PROCESSED"
          sliderLineColor="#dc0a2d"
          sliderLineWidth={3}
        />
      </CompareContainer>
      
      <CloseButton onClick={onClose}>
        ✕ CLOSE
      </CloseButton>
    </Container>
  );
}

export default CompareView;