import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, Loader2, CheckCircle, KeyRound } from 'lucide-react';
import { useAuth, formatAuthError } from '../context/AuthContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const {
    login,
    signup,
    loginWithGoogle,
    currentUser,
    authError,
    setAuthError,
    resetPassword,
    sendVerification,
  } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  // Show redirect-flow errors from AuthProvider (e.g. returning from Google)
  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        const userCred = await signup(email, password);
        try {
          if (userCred?.user) {
            await sendVerification(userCred.user);
          }
        } catch (vErr) {
          console.warn('[AuthPage] Email verification send warning:', vErr);
        }
        navigate('/dashboard');
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSuccessMessage(`Password reset link sent to ${email}. Please check your inbox.`);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setAuthError(null);
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result?.user) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = formatAuthError(err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* LEFT SIDE - DECORATIVE */}
      <div className="auth-visuals">
        <motion.div 
          className="auth-shape shape-1"
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="auth-shape shape-2"
          animate={{ y: [0, 30, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <div className="auth-visuals-content">
          <Link to="/" className="auth-back-link">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <h2>
            {isForgotPassword
              ? 'Account Recovery'
              : isLogin
              ? 'Welcome back to CollabBoard'
              : 'Start your creative journey'}
          </h2>
          <p>
            {isForgotPassword
              ? 'Enter your registered email and we will send you secure instructions to reset your password.'
              : isLogin 
              ? 'Log in to access your workspaces, collaborate with your team, and pick up right where you left off.'
              : 'Join thousands of teams building the future on CollabBoard. Create an account to start diagramming instantly.'}
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="auth-form-section">
        <div className="auth-form-wrapper">
          
          {!isForgotPassword ? (
            <div className="auth-tabs">
              <button 
                type="button"
                className={`auth-tab ${isLogin ? 'active' : ''}`}
                onClick={() => { setIsLogin(true); setError(''); setSuccessMessage(''); }}
              >
                Log In
              </button>
              <button 
                type="button"
                className={`auth-tab ${!isLogin ? 'active' : ''}`}
                onClick={() => { setIsLogin(false); setError(''); setSuccessMessage(''); }}
              >
                Sign Up
              </button>
            </div>
          ) : null}

          <div className="auth-header">
            <h1>
              {isForgotPassword
                ? 'Reset Password'
                : isLogin
                ? 'Log In'
                : 'Create Account'}
            </h1>
            <p>
              {isForgotPassword
                ? 'Enter your email address and we will send a password reset link.'
                : isLogin
                ? 'Enter your credentials to continue.'
                : 'Enter your details to get started with email verification.'}
            </p>
          </div>

          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          {successMessage && (
            <div className="auth-success-banner" role="status">
              <CheckCircle size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {isForgotPassword ? (
            <form className="auth-form" onSubmit={handlePasswordReset}>
              <div className="input-group">
                <label htmlFor="reset-email">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input 
                    id="reset-email"
                    type="email" 
                    placeholder="you@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send Reset Link'}
              </button>

              <button
                type="button"
                className="btn btn-secondary auth-back-btn"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setSuccessMessage('');
                }}
              >
                Back to Log In
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="input-group">
                  <label htmlFor="full-name">Full Name</label>
                  <div className="input-wrapper">
                    <User size={18} className="input-icon" />
                    <input id="full-name" type="text" placeholder="John Doe" />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="auth-email">Email Address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input 
                    id="auth-email"
                    type="email" 
                    placeholder="you@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="auth-password">Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input 
                    id="auth-password"
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>

              {isLogin && (
                <div className="auth-options">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <button 
                    type="button" 
                    className="forgot-password-btn"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError('');
                      setSuccessMessage('');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isLogin ? (
                  'Log In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {!isForgotPassword && (
            <>
              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <div className="auth-socials">
                <button 
                  className="btn btn-secondary social-btn" 
                  onClick={handleGoogleAuth} 
                  disabled={loading} 
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      <style>{`
        .auth-container {
          display: flex;
          min-height: 100vh;
          background: #fff;
        }

        .auth-visuals {
          flex: 1;
          background: var(--color-bg-secondary);
          position: relative;
          display: none;
          overflow: hidden;
          padding: 40px;
        }
        @media (min-width: 1024px) {
          .auth-visuals { display: flex; flex-direction: column; }
        }

        .auth-visuals-content {
          position: relative;
          z-index: 10;
          max-width: 400px;
          margin-top: auto;
          margin-bottom: auto;
        }

        .auth-back-link {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-secondary);
          text-decoration: none;
          font-weight: 500;
          margin-bottom: 40px;
          transition: color 0.2s;
        }
        .auth-back-link:hover {
          color: var(--color-brand);
        }

        .auth-visuals h2 {
          font-size: 2.5rem;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
          color: var(--color-text-primary);
        }

        .auth-visuals p {
          color: var(--color-text-secondary);
          line-height: 1.6;
          font-size: 1.125rem;
        }

        .auth-shape {
          position: absolute;
          border-radius: 40px;
          background: linear-gradient(135deg, var(--color-brand-light) 0%, rgba(108, 99, 255, 0.1) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.4);
        }

        .shape-1 {
          width: 300px;
          height: 300px;
          top: -50px;
          right: -50px;
        }

        .shape-2 {
          width: 200px;
          height: 200px;
          bottom: 10%;
          right: 20%;
          border-radius: 50%;
        }

        .auth-form-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .auth-form-wrapper {
          width: 100%;
          max-width: 400px;
        }

        .auth-tabs {
          display: flex;
          background: var(--color-bg-secondary);
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 32px;
        }

        .auth-tab {
          flex: 1;
          padding: 10px;
          border: none;
          background: transparent;
          font-weight: 600;
          color: var(--color-text-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .auth-tab.active {
          background: #fff;
          color: var(--color-text-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .auth-header {
          margin-bottom: 32px;
        }

        .auth-header h1 {
          font-size: 2rem;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .auth-header p {
          color: var(--color-text-tertiary);
        }
        
        .auth-error-banner {
          background: #FEF2F2;
          color: #DC2626;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 24px;
        }

        .auth-success-banner {
          background: #ECFDF5;
          color: #059669;
          border: 1px solid #A7F3D0;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: var(--color-text-tertiary);
        }

        .input-wrapper input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          font-family: inherit;
          font-size: 0.9375rem;
          transition: all 0.2s;
          background: #fff;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: var(--color-brand);
          box-shadow: 0 0 0 4px var(--color-brand-light);
        }

        .auth-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .forgot-password-btn {
          background: none;
          border: none;
          padding: 0;
          color: var(--color-brand);
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          font-family: inherit;
        }
        .forgot-password-btn:hover {
          text-decoration: underline;
        }

        .auth-submit {
          width: 100%;
          padding: 14px;
          font-size: 1rem;
          margin-top: 8px;
          display: flex;
          justify-content: center;
        }

        .auth-back-btn {
          width: 100%;
          padding: 12px;
          font-size: 0.9375rem;
        }

        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 32px 0;
          color: var(--color-text-tertiary);
          font-size: 0.875rem;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--color-border);
        }

        .auth-divider span {
          padding: 0 16px;
        }

        .auth-socials {
          display: flex;
          gap: 16px;
        }

        .social-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          font-size: 0.9375rem;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
