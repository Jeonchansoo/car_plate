import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus, AuthState } from './types';
import Login from './components/Auth';
import Navbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboard';
import SearchPortal from './components/SearchPortal';
import TechnicalGuide from './components/TechnicalGuide';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [view, setView] = useState<'home' | 'admin' | 'guide'>('home');

  useEffect(() => {
    const saved = localStorage.getItem('carplate_auth');
    if (saved) {
      try {
        setAuth(JSON.parse(saved));
      } catch {
        localStorage.removeItem('carplate_auth');
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    const newState = { user, isAuthenticated: true };
    setAuth(newState);
    localStorage.setItem('carplate_auth', JSON.stringify(newState));
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('carplate_auth');
    setView('home');
  };

  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar 
        user={auth.user!} 
        currentView={view} 
        setView={setView} 
        onLogout={handleLogout} 
      />
      {/* Added pb-24 for mobile toolbar space */}
      <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8 max-w-6xl">
        {view === 'home' && <SearchPortal user={auth.user!} />}
        {view === 'admin' && auth.user?.role === UserRole.ADMIN && <AdminDashboard />}
        {view === 'guide' && <TechnicalGuide />}
      </main>
      <footer className="hidden md:block bg-white border-t py-6 text-center text-slate-500 text-sm">
        © 2024 CarPlate Master MVP. Ready for Web & App Deployment.
      </footer>
    </div>
  );
};

export default App;
