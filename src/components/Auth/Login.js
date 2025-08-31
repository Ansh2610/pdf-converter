// src/components/Auth/Login.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import styled from 'styled-components';

const LoginContainer = styled.div`
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  background: ${props => props.theme.colors.primary};
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 3px solid #8b0000;
`;

const Screen = styled.div`
  background: ${props => props.theme.colors.darkScreen};
  border-radius: 10px;
  padding: 30px;
  margin-top: 20px;
`;

const Title = styled.h1`
  color: ${props => props.theme.colors.screen};
  text-align: center;
  font-size: 32px;
  margin-bottom: 30px;
  text-shadow: 0 0 10px rgba(155, 188, 15, 0.5);
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Input = styled.input`
  background: #000;
  border: 2px solid ${props => props.theme.colors.screen};
  color: ${props => props.theme.colors.screen};
  padding: 12px;
  font-size: 18px;
  border-radius: 5px;
  
  &::placeholder {
    color: #5a7a5a;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 10px rgba(155, 188, 15, 0.5);
  }
`;

const Button = styled.button`
  background: ${props => props.primary ? props.theme.colors.success : props.theme.colors.gray};
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 20px;
  border-radius: 20px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  
  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 rgba(0,0,0,0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Error = styled.div`
  background: ${props => props.theme.colors.error};
  color: white;
  padding: 10px;
  border-radius: 5px;
  text-align: center;
`;

const Toggle = styled.p`
  color: ${props => props.theme.colors.screen};
  text-align: center;
  margin-top: 20px;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      // Simple error messages
      if (err.code === 'auth/wrong-password') {
        setError('Wrong password');
      } else if (err.code === 'auth/user-not-found') {
        setError('User not found');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email already registered');
      } else if (err.code === 'auth/weak-password') {
        setError('Password too weak (min 6 chars)');
      } else {
        setError('Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <Screen>
        <Title>
          {isRegister ? '📝 NEW TRAINER' : '🎮 TRAINER LOGIN'}
        </Title>
        
        {error && <Error>{error}</Error>}
        
        <Form onSubmit={handleSubmit}>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <Input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <Button type="submit" primary disabled={loading}>
            {loading ? 'LOADING...' : (isRegister ? 'REGISTER' : 'LOGIN')}
          </Button>
        </Form>
        
        <Toggle onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Already a trainer? Login' : 'New trainer? Register'}
        </Toggle>
      </Screen>
    </LoginContainer>
  );
}

export default Login;

