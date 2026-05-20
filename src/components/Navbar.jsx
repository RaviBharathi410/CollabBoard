import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '#resources' },
  { label: 'Enterprise', href: '#enterprise' },
];

export default function Navbar({ variant = 'landing' }) {
  return (
    <motion.nav
      className="navbar"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icon">
            <LayoutGrid size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="navbar-logo-text">CollabBoard</span>
        </Link>

        {/* Center links — only on landing */}
        {variant === 'landing' && (
          <div className="navbar-links">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="navbar-link">
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="navbar-right">
          {variant === 'landing' && (
            <>
              <Link to="/auth" className="navbar-signin">Sign in</Link>
              <Link to="/get-started">
                <motion.button
                  className="btn btn-primary navbar-cta"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started
                </motion.button>
              </Link>
            </>
          )}
          {variant === 'entry' && (
            <div className="navbar-entry-right">
              <span className="navbar-entry-text">Already have an account?</span>
              <Link to="/auth" className="navbar-entry-link">Sign in</Link>
            </div>
          )}
          {variant === 'auth' && (
            <div className="navbar-entry-right">
              <span className="navbar-entry-text">Already have an account?</span>
              <Link to="/auth" className="navbar-entry-link">Sign in</Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--color-bg-primary);
          border-bottom: 1px solid var(--color-border);
          height: var(--navbar-height);
          display: flex;
          align-items: center;
        }
        .navbar-inner {
          width: 100%;
          max-width: var(--page-max-width);
          margin: 0 auto;
          padding: 0 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
        }
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .navbar-logo-icon {
          width: 32px;
          height: 32px;
          background: var(--color-brand);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .navbar-logo-text {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .navbar-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .navbar-link {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          font-weight: 500;
          transition: color 0.2s ease;
        }
        .navbar-link:hover {
          color: var(--color-text-primary);
        }
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .navbar-signin {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          font-weight: 500;
          transition: color 0.2s ease;
        }
        .navbar-signin:hover {
          color: var(--color-text-primary);
        }
        .navbar-cta {
          padding: 10px 20px;
          font-size: 0.875rem;
        }
        .navbar-entry-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .navbar-entry-text {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
        }
        .navbar-entry-link {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-brand);
          transition: color 0.2s ease;
        }
        .navbar-entry-link:hover {
          color: var(--color-brand-dark);
        }

        @media (max-width: 768px) {
          .navbar-inner { padding: 0 24px; }
          .navbar-links { display: none; }
        }
      `}</style>
    </motion.nav>
  );
}
