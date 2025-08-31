// src/components/Layout/Container.js
//import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Header from './Header';

const PokedexContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  background: ${props => props.theme.colors.primary};
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 3px solid #8b0000;
  position: relative;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 15px;
    border-radius: 15px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 20px;
    width: 60px;
    height: 60px;
    background: radial-gradient(circle, #7df9ff 0%, #00bfff 50%, #0080ff 100%);
    border-radius: 50%;
    border: 4px solid white;
    box-shadow: 0 0 20px rgba(125, 249, 255, 0.5);
    
    @media (max-width: ${props => props.theme.breakpoints.mobile}) {
      width: 40px;
      height: 40px;
      top: 15px;
      left: 15px;
    }
  }
`;

const NavBar = styled.nav`
  display: flex;
  gap: 10px;
  margin: 80px 20px 20px;
  justify-content: center;
  flex-wrap: wrap;
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    margin-top: 60px;
  }
`;

const NavButton = styled.button`
  background: ${props => props.active ? props.theme.colors.gold : props.theme.colors.secondary};
  color: ${props => props.active ? props.theme.colors.secondary : props.theme.colors.gold};
  border: 2px solid ${props => props.theme.colors.gold};
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 18px;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.theme.colors.gold};
    color: ${props => props.theme.colors.secondary};
  }
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 8px 16px;
    font-size: 16px;
  }
`;

const Screen = styled.div`
  background: ${props => props.theme.colors.darkScreen};
  border-radius: 15px;
  padding: 20px;
  margin: 0 20px 20px;
  min-height: 400px;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 15px;
    margin: 0 10px 10px;
    min-height: 300px;
  }
`;

const GreenDisplay = styled.div`
  background: ${props => props.theme.colors.screen};
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.1) 2px,
    rgba(0,0,0,0.1) 4px
  );
  border-radius: 10px;
  padding: 20px;
  min-height: 350px;
  color: ${props => props.theme.colors.darkScreen};
  
  @media (max-width: ${props => props.theme.breakpoints.mobile}) {
    padding: 15px;
    min-height: 250px;
  }
`;

function Container({ user, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <PokedexContainer>
      <Header user={user} />
      
      <NavBar>
        <NavButton 
          active={location.pathname === '/'} 
          onClick={() => navigate('/')}
        >
          📸 SCAN
        </NavButton>
        <NavButton 
          active={location.pathname === '/gallery'} 
          onClick={() => navigate('/gallery')}
        >
          📚 GALLERY
        </NavButton>
      </NavBar>
      
      <Screen>
        <GreenDisplay>
          {children}
        </GreenDisplay>
      </Screen>
    </PokedexContainer>
  );
}

export default Container;

