import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('summareye_token');
    const username = localStorage.getItem('summareye_username');
    if (token && username) {
      setUser({ username, token });
    } else {
      if (window.location.pathname !== '/' && window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        navigate('/login');
      }
    }
  }, [navigate]);

  const login = (token, username) => {
    localStorage.setItem('summareye_token', token);
    localStorage.setItem('summareye_username', username);
    setUser({ username, token });
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('summareye_token');
    localStorage.removeItem('summareye_username');
    setUser(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
