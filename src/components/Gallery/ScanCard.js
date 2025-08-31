// src/components/Gallery/ScanCard.js
import React from 'react';
import styled from 'styled-components';

const Card = styled.div`
  background: #0f380f;
  border: 2px solid #5a7a5a;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #9bbc0f;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(155, 188, 15, 0.3);
  }
`;

const Thumbnail = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 5px;
  margin-bottom: 10px;
`;

const Filename = styled.p`
  color: #9bbc0f;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Date = styled.p`
  color: #5a7a5a;
  font-size: 12px;
  margin-top: 5px;
`;

function ScanCard({ scan, onClick }) {
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString();
  };

  return (
    <Card onClick={onClick}>
      <Thumbnail src={scan.processedUrl} alt={scan.filename} />
      <Filename>{scan.filename}</Filename>
      <Date>{formatDate(scan.createdAt)}</Date>
    </Card>
  );
}

export default ScanCard;