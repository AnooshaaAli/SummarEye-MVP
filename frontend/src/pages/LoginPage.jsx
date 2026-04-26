import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/tracker';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (response.ok) {
        const data = await response.json();
        login(data.token, data.user.username);
        trackEvent('user_logged_in');
      } else {
        const err = await response.json();
        setError(err.detail || 'Login failed');
      }
    } catch (err) {
      setError('Connection refused.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="bg-neon-panel border border-neon-border p-8 w-full max-w-sm">
        <h2 className="text-xl font-bold text-neon-green mb-4">LOG IN</h2>
        {error && <div className="text-hacker-red mb-4 text-sm">{error}</div>}
        <input className="w-full bg-black border border-neon-border p-2 text-neon-green mb-4" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full bg-black border border-neon-border p-2 text-neon-green mb-4" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="w-full border border-neon-green bg-neon-dark text-neon-green py-2 hover:bg-neon-green hover:text-black transition-colors">ACCESS_SYSTEM()</button>
        <div className="mt-4 text-xs text-center">
          <span className="text-neon-dim">No access? </span>
          <Link to="/signup" className="text-neon-green hover:underline">Request_Clearance()</Link>
        </div>
      </form>
    </div>
  );
}
