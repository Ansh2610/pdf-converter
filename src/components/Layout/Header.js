// src/components/Layout/Header.js
import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 80px 10px 20px;
  color: white;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 10px 60px 10px 15px;
    flex-direction: column;
    gap: 10px;
  }
`;

const Title = styled.h1`
  font-size: 24px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 20px;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 14px;
    gap: 10px;
  }
`;

const StatusLight = styled.div`
  width: 10px;
  height: 10px;
  background: #00ff00;
  border-radius: 50%;
  box-shadow: 0 0 10px #00ff00;
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const Email = styled.span`
  color: ${props => props.theme.colors.gold};
  font-size: 16px;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    font-size: 14px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const LogoutButton = styled.button`
  background: ${props => props.theme.colors.secondary};
  color: ${props => props.theme.colors.gold};
  border: 2px solid ${props => props.theme.colors.gold};
  padding: 5px 15px;
  border-radius: 15px;
  font-size: 14px;
`;

function Header({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <HeaderContainer>
      <Title>ANSH POKEDEX</Title>
      {user && (
        <UserInfo>
          <StatusLight />
          <Email>{user.email}</Email>
          <LogoutButton onClick={handleLogout}>LOGOUT</LogoutButton>
        </UserInfo>
      )}
    </HeaderContainer>
  );
}

export default Header;