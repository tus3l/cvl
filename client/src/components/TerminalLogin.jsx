import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import './TerminalLogin.css';

const TerminalLogin = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  useEffect(() => {
    const lines = [
      '>> SYSTEM_BOOT: Initializing...',
      '>> NETWORK_CHECK: Connected',
      '>> FIREWALL_STATUS: Active',
      '>> READY: Awaiting credentials...'
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        setMessage(prev => prev + lines[i] + '\n');
        i++;
      } else {
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('>> AUTHENTICATING: Verifying credentials...\n');

    const result = isLogin 
      ? await login(username, password)
      : await register(username, password);

    setMessage(result.message);
    setLoading(false);
  };

  return (
    <div className="terminal-login">
      <motion.div 
        className="terminal-container"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="terminal-header">
          <span className="neon-glow">CYBER_HACKER_TERMINAL v2.1.0</span>
          <div className="terminal-indicators">
            <span className="indicator active"></span>
            <span className="indicator"></span>
            <span className="indicator"></span>
          </div>
        </div>

        <div className="terminal-body">
          <pre className="boot-sequence">{message}</pre>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label>root@cyberspace:~$ enter_username:</label>
              <input
                type="text"
                className="cyber-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>root@cyberspace:~$ enter_password:</label>
              <input
                type="password"
                className="cyber-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <div className="button-group">
              <button 
                type="submit" 
                className="cyber-button"
                disabled={loading}
              >
                {loading ? 'PROCESSING' : (isLogin ? 'LOGIN' : 'REGISTER')}
              </button>
              
              <button
                type="button"
                className="cyber-button secondary"
                onClick={() => setIsLogin(!isLogin)}
                disabled={loading}
              >
                {isLogin ? 'NEW USER?' : 'HAVE ACCOUNT?'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default TerminalLogin;
