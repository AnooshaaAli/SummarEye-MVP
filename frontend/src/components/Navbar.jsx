import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Helper to check if current path matches
  const isActive = (path) => location.pathname === path;

  const navLinkClass = (path) =>
    `px-3 py-1.5 rounded text-xs font-medium tracking-wider uppercase transition-all duration-200 border ${
      isActive(path)
        ? 'border-neon-green text-neon-green glow-green'
        : 'border-transparent text-neon-dim hover:text-neon-green hover:border-neon-border'
    }`;

  return (
    <nav className="bg-black border-b border-neon-border sticky top-0 z-40">
      <div className="max-w-full mx-auto px-6">
        <div className="flex justify-between h-14 items-center">
          {/* Left — Logo */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              {/* Terminal prompt icon */}
              <span className="text-neon-green text-lg font-bold">{'>'}_</span>
              <span className="text-lg font-bold text-neon-green text-glow-green tracking-tight">
                SummarEye<span className="text-neon-dim font-normal">.ai</span>
              </span>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-2 ml-4">
              <Link to="/upload" className={navLinkClass('/upload')}>
                Upload
              </Link>
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                Dashboard
              </Link>
              <Link to="/analytics" className={navLinkClass('/analytics')}>
                Analytics
              </Link>
            </div>
          </div>

          {/* Right — Metrics/Icons */}
          <div className="flex items-center gap-4">
            {user && (
              <>
                <NotificationBell />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neon-green font-bold">@{user.username}</span>
                  <button 
                    onClick={logout}
                    className="text-[10px] uppercase tracking-widest text-neon-dim hover:text-hacker-red transition-colors border border-transparent hover:border-hacker-red px-2 py-1 rounded"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
            {!user && (
              <Link to="/login" className="text-xs text-neon-green hover:text-white transition-colors border border-neon-green px-3 py-1 rounded">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
