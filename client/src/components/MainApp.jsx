import React from 'react';
import { useAuth } from '../context/AuthContext';
import TerminalLogin from './TerminalLogin';
import GameDashboard from './GameDashboard';
import './MainApp.css';

const MainApp = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-text neon-glow cursor">
          &gt;&gt; INITIALIZING_SYSTEM
        </div>
      </div>
    );
  }

  return (
    <div className="main-app">
      {!isAuthenticated ? <TerminalLogin /> : <GameDashboard />}
    </div>
  );
};

export default MainApp;
