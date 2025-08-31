// src/components/Gallery/Gallery.js
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../services/firebase';
import { saveAs } from 'file-saver';
import ScanCard from './ScanCard';
import ReactCompareImage from 'react-compare-image';

const Container = styled.div`
  width: 100%;
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 20px;
  font-size: 24px;
  color: ${props => props.theme.colors.darkScreen};
`;

const FilterBar = styled.div`
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const FilterButton = styled.button`
  background: ${props => props.active ? '#4CAF50' : '#333'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 15px;
  font-size: 16px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #5a7a5a;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: ${props => props.theme.colors.darkScreen};
  border: 3px solid ${props => props.theme.colors.primary};
  border-radius: 15px;
  padding: 20px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.screen};
`;

const ModalTitle = styled.h3`
  font-size: 20px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Button = styled.button`
  background: ${props => props.danger ? '#ff6b6b' : '#4CAF50'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 15px;
  font-size: 16px;
`;

const CompareContainer = styled.div`
  margin: 20px 0;
  border: 2px solid #5a7a5a;
  border-radius: 10px;
  overflow: hidden;
  max-height: 500px;
`;

const Info = styled.div`
  background: rgba(15, 56, 15, 0.3);
  padding: 10px;
  border-radius: 5px;
  margin-top: 20px;
  color: ${props => props.theme.colors.screen};
  font-size: 14px;
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

function Gallery() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedScan, setSelectedScan] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Real-time listener for user's scans
    const q = query(
      collection(db, 'scans'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = [];
      snapshot.forEach((doc) => {
        scanData.push({ id: doc.id, ...doc.data() });
      });
      setScans(scanData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching scans:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getFilteredScans = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'today':
        return scans.filter(scan => {
          const scanDate = scan.createdAt.toDate();
          return scanDate >= today;
        });
      case 'week':
        return scans.filter(scan => {
          const scanDate = scan.createdAt.toDate();
          return scanDate >= weekAgo;
        });
      default:
        return scans;
    }
  };

  const handleDownload = async (scan, type = 'processed') => {
    try {
      const url = type === 'original' ? scan.originalUrl : scan.processedUrl;
      const response = await fetch(url);
      const blob = await response.blob();
      saveAs(blob, `${scan.filename}_${type}.png`);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDelete = async (scan) => {
    if (!window.confirm('Delete this scan?')) return;

    try {
      // Delete from Storage
      const originalRef = ref(storage, `scans/${scan.userId}/${scan.scanId}/original.png`);
      const processedRef = ref(storage, `scans/${scan.userId}/${scan.scanId}/processed.png`);
      
      await Promise.all([
        deleteObject(originalRef).catch(() => {}),
        deleteObject(processedRef).catch(() => {})
      ]);

      // Delete from Firestore
      await deleteDoc(doc(db, 'scans', scan.id));
      
      setSelectedScan(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const filteredScans = getFilteredScans();

  return (
    <Container>
      <Title>📚 SCAN GALLERY</Title>
      
      <FilterBar>
        <FilterButton 
          active={filter === 'all'} 
          onClick={() => setFilter('all')}
        >
          ALL ({scans.length})
        </FilterButton>
        <FilterButton 
          active={filter === 'today'} 
          onClick={() => setFilter('today')}
        >
          TODAY
        </FilterButton>
        <FilterButton 
          active={filter === 'week'} 
          onClick={() => setFilter('week')}
        >
          THIS WEEK
        </FilterButton>
      </FilterBar>

      {loading ? (
        <LoadingSpinner />
      ) : filteredScans.length === 0 ? (
        <EmptyState>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📭</div>
          <p>NO SCANS FOUND</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            {filter !== 'all' ? 'Try changing the filter' : 'Upload your first document!'}
          </p>
        </EmptyState>
      ) : (
        <Grid>
          {filteredScans.map((scan) => (
            <ScanCard 
              key={scan.id} 
              scan={scan} 
              onClick={() => setSelectedScan(scan)}
            />
          ))}
        </Grid>
      )}

      {selectedScan && (
        <Modal onClick={() => setSelectedScan(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>📄 {selectedScan.filename}</ModalTitle>
              <Button onClick={() => setSelectedScan(null)}>✕</Button>
            </ModalHeader>
            
            <CompareContainer>
              <ReactCompareImage
                leftImage={selectedScan.originalUrl}
                rightImage={selectedScan.processedUrl}
                leftImageLabel="ORIGINAL"
                rightImageLabel="PROCESSED"
                sliderLineColor="#dc0a2d"
                sliderLineWidth={3}
              />
            </CompareContainer>
            
            <ButtonGroup>
              <Button onClick={() => handleDownload(selectedScan, 'processed')}>
                💾 DOWNLOAD PROCESSED
              </Button>
              <Button onClick={() => handleDownload(selectedScan, 'original')}>
                📥 DOWNLOAD ORIGINAL
              </Button>
              <Button danger onClick={() => handleDelete(selectedScan)}>
                🗑️ DELETE
              </Button>
            </ButtonGroup>
            
            <Info>
              <p>📅 Scanned: {formatDate(selectedScan.createdAt)}</p>
              <p>🆔 ID: {selectedScan.scanId}</p>
            </Info>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
}

export default Gallery;

