'use client';

import { useState } from 'react';
import { X, LogIn, ChefHat, TriangleAlert, Loader2 } from 'lucide-react';
import styles from '@/app/page.module.css';
import { useAuth } from '@/lib/authContext';

export default function AuthModal({ onClose }) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className={styles.parseHeader}>
          <div className={styles.stickerBadge}>MEMBER CARD</div>
          <h2 id="auth-title" className={styles.parseTitle}>
            {mode === 'signin' ? 'Welcome Back, Chef!' : 'Join the Kitchen'}
          </h2>
          <p className={styles.parseSubtitle}>
            {mode === 'signin'
              ? 'Sign in to sync your recipes across all devices.'
              : 'Create an account to save your recipes forever.'}
          </p>
        </div>

        <form onSubmit={handleEmail} className={styles.authForm}>
          {mode === 'signup' && (
            <input
              type="text"
              className={styles.authInput}
              placeholder="Your name"
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className={styles.authInput}
            placeholder="Email address"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className={styles.authInput}
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <div className={styles.errorAlert} role="alert">
              <TriangleAlert size={16} /> {error}
            </div>
          )}
          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className={styles.spin} /> Loading...
              </>
            ) : mode === 'signin' ? (
              <>
                <LogIn size={18} /> Sign In
              </>
            ) : (
              <>
                <ChefHat size={18} /> Create Account
              </>
            )}
          </button>
        </form>

        <p className={styles.authToggle}>
          {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
