import React from 'react';
import { AuthProvider } from './context/AuthContext';
import MainApp from './components/MainApp';

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
