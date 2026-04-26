import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/tracker';

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      if (response.ok) {
        // Auto-login after signup
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          login(data.token, data.user.username);
          trackEvent('user_signed_up');
        }
      } else {
        const err = await response.json();
        setError(err.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Connection refused.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSignup} className="bg-neon-panel border border-neon-border p-8 w-full max-w-sm">
        <h2 className="text-xl font-bold text-neon-green mb-4">REGISTER</h2>
        {error && <div className="text-hacker-red mb-4 text-sm">{error}</div>}
        <input className="w-full bg-black border border-neon-border p-2 text-neon-green mb-4" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input className="w-full bg-black border border-neon-border p-2 text-neon-green mb-4" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full bg-black border border-neon-border p-2 text-neon-green mb-4" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="w-full border border-neon-green bg-neon-dark text-neon-green py-2 hover:bg-neon-green hover:text-black transition-colors">INITIALIZE_USER()</button>
        <div className="mt-4 text-xs text-center">
          <span className="text-neon-dim">Already cleared? </span>
          <Link to="/login" className="text-neon-green hover:underline">Log_In()</Link>
        </div>
      </form>
    </div>
  );
}
