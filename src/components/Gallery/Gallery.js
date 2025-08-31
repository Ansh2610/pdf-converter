// src/components/Gallery/Gallery.js
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../../services/firebase';
import { saveAs } from 'file-saver';
import ScanCard from './ScanCard';

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

const ImageContainer = styled.div`
  margin: 20px 0;
  border: 2px solid #5a7a5a;
  border-radius: 10px;
  overflow: hidden;
  max-height: 500px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #0f380f;
`;

const ScanImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
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
  const [authUser, setAuthUser] = useState(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Gallery: Auth state changed:', user?.uid || 'No user');
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Firestore listener for user's scans subcollection
  useEffect(() => {
    if (!authUser) {
      console.log('Gallery: No authenticated user');
      setLoading(false);
      setScans([]);
      return;
    }

    console.log('Gallery: Setting up listener for user subcollection:', authUser.uid);

    // Query user's scans subcollection
    const userScansRef = collection(db, 'users', authUser.uid, 'scans');
    
    const unsubscribe = onSnapshot(userScansRef, (snapshot) => {
      console.log('Gallery: Received user subcollection snapshot with', snapshot.size, 'documents');
      const userScans = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Gallery: User scan document:', { id: doc.id, ...data });
        userScans.push({ id: doc.id, ...data });
      });
      
      console.log('Gallery: User documents found:', userScans.length);
      
      // Sort manually by createdAt if available, newest first
      userScans.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          try {
            return b.createdAt.toDate() - a.createdAt.toDate();
          } catch (e) {
            console.error('Error sorting by date:', e);
            return 0;
          }
        }
        return 0;
      });
      
      setScans(userScans);
      setLoading(false);
    }, (error) => {
      console.error('Gallery: Error fetching user scans:', error);
      // Try fallback to legacy collection
      console.log('Gallery: Trying legacy collection as fallback...');
      setupLegacyListener(authUser.uid);
    });

    return () => unsubscribe();
  }, [authUser]);

  // Fallback function for legacy scans collection
  const setupLegacyListener = (userId) => {
    const legacyQuery = query(
      collection(db, 'scans'),
      where('userId', '==', userId)
    );
    
    const unsubscribe = onSnapshot(legacyQuery, (snapshot) => {
      console.log('Gallery: Legacy collection snapshot with', snapshot.size, 'documents');
      const userScans = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Gallery: Legacy scan document:', { id: doc.id, ...data });
        userScans.push({ id: doc.id, ...data });
      });
      
      setScans(userScans);
      setLoading(false);
    }, (error) => {
      console.error('Gallery: Error with legacy collection too:', error);
      setLoading(false);
    });
    
    return unsubscribe;
  };

  const getFilteredScans = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'today':
        return scans.filter(scan => {
          if (!scan.createdAt) return false;
          try {
            const scanDate = scan.createdAt.toDate();
            return scanDate >= today;
          } catch (error) {
            console.error('Error parsing date:', error);
            return false;
          }
        });
      case 'week':
        return scans.filter(scan => {
          if (!scan.createdAt) return false;
          try {
            const scanDate = scan.createdAt.toDate();
            return scanDate >= weekAgo;
          } catch (error) {
            console.error('Error parsing date:', error);
            return false;
          }
        });
      default:
        return scans;
    }
  };

  const handleDownload = async (scan, type = 'processed') => {
    try {
      console.log('Gallery: Downloading scan:', type, scan);
      const url = type === 'original' ? scan.originalUrl : scan.processedUrl;
      
      if (!url) {
        console.error('Gallery: No URL available for download type:', type);
        alert(`No ${type} image available for download`);
        return;
      }
      
      console.log('Gallery: Fetching URL:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const filename = `${scan.filename || 'scan'}_${type}.png`;
      console.log('Gallery: Downloading as:', filename);
      saveAs(blob, filename);
    } catch (error) {
      console.error('Gallery: Download error:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  const handleDelete = async (scan) => {
    if (!window.confirm('Delete this scan?')) return;

    try {
      console.log('Gallery: Deleting scan:', scan);
      
      // Delete from Storage - use the userId from auth or scan data
      const userId = authUser?.uid || scan.userId;
      const originalRef = ref(storage, `scans/${userId}/${scan.scanId}/original.png`);
      const processedRef = ref(storage, `scans/${userId}/${scan.scanId}/processed.png`);
      
      await Promise.all([
        deleteObject(originalRef).catch((error) => {
          console.log('Error deleting original file (may not exist):', error);
        }),
        deleteObject(processedRef).catch((error) => {
          console.log('Error deleting processed file (may not exist):', error);
        })
      ]);

      // Delete from Firestore - use user subcollection
      await deleteDoc(doc(db, 'users', userId, 'scans', scan.id));
      
      console.log('Gallery: Successfully deleted scan');
      setSelectedScan(null);
    } catch (error) {
      console.error('Gallery: Delete error:', error);
      alert('Error deleting scan. Please try again.');
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
      
      {/* Debug info */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '10px', 
        fontSize: '12px', 
        color: '#5a7a5a' 
      }}>
        Debug: User: {authUser?.uid || 'None'} | Total scans: {scans.length} | Filtered: {filteredScans.length} | Loading: {loading.toString()}
      </div>
      
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
              onClick={() => {
                console.log('Gallery: Opening scan modal for:', scan);
                setSelectedScan(scan);
              }}
            />
          ))}
        </Grid>
      )}

      {selectedScan && (
        <Modal onClick={() => {
          console.log('Gallery: Closing modal');
          setSelectedScan(null);
        }}>
          <ModalContent onClick={(e) => {
            console.log('Gallery: Modal content clicked, preventing close');
            e.stopPropagation();
          }}>
            <ModalHeader>
              <ModalTitle>📄 {selectedScan.filename}</ModalTitle>
              <Button onClick={() => {
                console.log('Gallery: Close button clicked');
                setSelectedScan(null);
              }}>✕</Button>
            </ModalHeader>
            
            <ImageContainer>
              {selectedScan.processedUrl ? (
                <ScanImage 
                  src={selectedScan.processedUrl} 
                  alt={selectedScan.filename}
                  onError={(e) => {
                    console.error('Gallery: Error loading processed image');
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ 
                  padding: '40px', 
                  textAlign: 'center', 
                  color: '#5a7a5a' 
                }}>
                  <p>⚠️ No processed image available</p>
                </div>
              )}
            </ImageContainer>
            
            <ButtonGroup>
              <Button onClick={() => {
                console.log('Gallery: Download processed button clicked');
                handleDownload(selectedScan, 'processed');
              }}>
                💾 DOWNLOAD PROCESSED
              </Button>
              <Button onClick={() => {
                console.log('Gallery: Download original button clicked');
                handleDownload(selectedScan, 'original');
              }}>
                📥 DOWNLOAD ORIGINAL
              </Button>
              <Button danger onClick={() => {
                console.log('Gallery: Delete button clicked');
                handleDelete(selectedScan);
              }}>
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

