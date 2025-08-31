// src/styles/GlobalStyles.js
import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: ${props => props.theme.fonts.main};
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    overflow-x: hidden;
  }

  #root {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    
    @media (max-width: ${props => props.theme.breakpoints.mobile}) {
      padding: 10px;
    }
  }

  button {
    font-family: ${props => props.theme.fonts.main};
    cursor: pointer;
    transition: all 0.2s;
    
    &:active {
      transform: scale(0.98);
    }
  }

  input, textarea, select {
    font-family: ${props => props.theme.fonts.main};
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.darkScreen};
  }

  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colors.screen};
    border-radius: 4px;
  }
`;