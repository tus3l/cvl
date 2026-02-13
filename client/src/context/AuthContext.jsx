import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { getBackendBase, getCachedBackendBase } from '../backend';

// Configure axios (will be overridden by dynamic backend discovery)
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [backendBase, setBackendBase] = useState(getCachedBackendBase());

  // Discover backend base and set axios defaults globally
  useEffect(() => {
    (async () => {
      const base = await getBackendBase();
      if (base) {
        setBackendBase(base);
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const url = backendBase ? `${backendBase}/api/auth/me` : '/api/auth/me';
          const res = await axios.get(url);
          setUser(res.data.user);
        } catch (error) {
          console.error('Auth check failed:', error);
          setToken(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token, backendBase]);

  const login = async (username, password) => {
    try {
      const url = backendBase ? `${backendBase}/api/auth/login` : '/api/auth/login';
      const res = await axios.post(url, { username, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true, message: res.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '>> ERROR: Login failed'
      };
    }
  };

  const register = async (username, password) => {
    try {
      const url = backendBase ? `${backendBase}/api/auth/register` : '/api/auth/register';
      const res = await axios.post(url, { username, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true, message: res.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '>> ERROR: Registration failed'
      };
    }
  };

  const logout = async () => {
    try {
      const url = backendBase ? `${backendBase}/api/auth/logout` : '/api/auth/logout';
      await axios.post(url);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = (userData) => {
    setUser(prev => {
      const updated = { ...prev, ...userData };
      // Deep merge wallet if it exists in userData
      if (userData.wallet) {
        updated.wallet = { ...prev.wallet, ...userData.wallet };
      }
      console.log('>> USER_UPDATE:', {
        before: prev,
        incoming: userData,
        after: updated
      });
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};
