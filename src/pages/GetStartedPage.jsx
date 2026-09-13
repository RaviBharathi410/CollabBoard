import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Sparkles, Maximize } from 'lucide-react';
import Navbar from '../components/Navbar';

const pills = [
  { icon: Users, title: 'Collaborate in real-time', desc: 'Work together seamlessly.' },
  { icon: Sparkles, title: 'AI that understands your ideas', desc: 'Turn sketches into polished diagrams.' },
  { icon: Maximize, title: 'Infinite canvas', desc: 'Think bigger. Create without limits.' },
];

/* ── Mini canvas illustration ─────────────────────────────────────────── */
function CanvasIllustration() {
  return (
    <div style={{
      background: 'var(--color-brand-light)', borderRadius: 12, padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160,
    }}>
      <svg width="200" height="120" viewBox="0 0 200 120" fill="none">
        <defs>
          <pattern id="gsDots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="#C4C1F0" />
          </pattern>
        </defs>
        <rect width="200" height="120" rx="6" fill="url(#gsDots)" />
        <rect x="20" y="15" width="60" height="30" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="1" />
        <text x="50" y="34" textAnchor="middle" fontSize="8" fill="#1A1A2E" fontWeight="500" fontFamily="Plus Jakarta Sans">Start</text>
        <rect x="110" y="15" width="70" height="30" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="1" />
        <text x="145" y="34" textAnchor="middle" fontSize="8" fill="#1A1A2E" fontWeight="500" fontFamily="Plus Jakarta Sans">Process</text>
        <line x1="80" y1="30" x2="110" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="50" y="65" width="90" height="30" rx="4" fill="#6C63FF" stroke="none" />
        <text x="95" y="84" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="600" fontFamily="Plus Jakarta Sans">Result</text>
        <line x1="95" y1="45" x2="95" y2="65" stroke="#9CA3AF" strokeWidth="1" />
        {/* Cursor */}
        <polygon points="160,70 165,82 168,78 172,86 174,85 170,77 174,75" fill="#6C63FF" />
      </svg>
    </div>
  );
}

/* ── Collab illustration ──────────────────────────────────────────────── */
function CollabIllustration() {
  return (
    <div style={{
      background: 'var(--color-brand-light)', borderRadius: 12, padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160,
    }}>
      <svg width="200" height="120" viewBox="0 0 200 120" fill="none">
        <circle cx="60" cy="50" r="22" fill="#8B85F0" opacity="0.2" />
        <circle cx="60" cy="50" r="14" fill="#6C63FF" />
        <text x="60" y="54" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700" fontFamily="Plus Jakarta Sans">A</text>
        <circle cx="140" cy="50" r="22" fill="#8B85F0" opacity="0.2" />
        <circle cx="140" cy="50" r="14" fill="#8B85F0" />
        <text x="140" y="54" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700" fontFamily="Plus Jakarta Sans">B</text>
        {/* Dotted line */}
        <line x1="74" y1="50" x2="126" y2="50" stroke="#6C63FF" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Third user */}
        <circle cx="100" cy="95" r="12" fill="#34D399" />
        <text x="100" y="99" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700" fontFamily="Plus Jakarta Sans">C</text>
        <line x1="72" y1="60" x2="94" y2="85" stroke="#6C63FF" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="128" y1="60" x2="106" y2="85" stroke="#6C63FF" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    </div>
  );
}

export default function GetStartedPage() {
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };
  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.15 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Navbar variant="entry" />

      <section className="gs-section">
        <div className="gs-container">
          {/* Header */}
          <motion.div className="gs-header" variants={stagger} initial="hidden" animate="show">
            <motion.h1 className="gs-title" variants={fadeUp}>
              Welcome to
            </motion.h1>
            <motion.h1 className="gs-title gs-title-brand" variants={fadeUp}>
              CollabBoard
            </motion.h1>
            <motion.p className="gs-subtitle" variants={fadeUp}>
              The AI-powered whiteboard for collaborative innovation.
            </motion.p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            className="gs-pills"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {pills.map((pill) => {
              const Icon = pill.icon;
              return (
                <motion.div key={pill.title} className="gs-pill" variants={fadeUp}>
                  <div className="gs-pill-icon">
                    <Icon size={20} color="var(--color-brand)" />
                  </div>
                  <div>
                    <span className="gs-pill-title">{pill.title}</span>
                    <span className="gs-pill-desc">{pill.desc}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Choice cards */}
          <div className="gs-cards">
            <motion.div
              className="gs-card"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, borderColor: 'var(--color-brand)' }}
            >
              <h3 className="gs-card-title">Create a new workspace</h3>
              <p className="gs-card-desc">Start with a blank canvas and invite your team.</p>
              <CanvasIllustration />
              <Link to="/auth?tab=signup" style={{ width: '100%' }}>
                <motion.button
                  className="btn btn-primary gs-card-btn"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Create Workspace
                </motion.button>
              </Link>
            </motion.div>

            <motion.div
              className="gs-card"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, borderColor: 'var(--color-brand)' }}
            >
              <h3 className="gs-card-title">Join a workspace</h3>
              <p className="gs-card-desc">Enter an invite link to collaborate on an existing board.</p>
              <CollabIllustration />
              <Link to="/auth?tab=login" style={{ width: '100%' }}>
                <motion.button
                  className="btn btn-secondary gs-card-btn"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Join Workspace
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <style>{`
        .gs-section {
          padding: 96px 0 80px;
        }
        .gs-container {
          max-width: 960px;
          margin: 0 auto;
          padding: 0 48px;
        }
        .gs-header {
          text-align: center;
          margin-bottom: 44px;
          padding-top: 16px;
        }
        .gs-title {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1.15;
          color: var(--color-text-primary);
        }
        .gs-title-brand {
          color: var(--color-brand);
        }
        .gs-subtitle {
          font-size: 1.0625rem;
          color: var(--color-text-secondary);
          margin-top: 12px;
        }

        /* Pills */
        .gs-pills {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-bottom: 48px;
          flex-wrap: wrap;
        }
        .gs-pill {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 260px;
        }
        .gs-pill-icon {
          width: 40px;
          height: 40px;
          background: var(--color-brand-light);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .gs-pill-title {
          display: block;
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 2px;
        }
        .gs-pill-desc {
          display: block;
          font-size: 0.8125rem;
          color: var(--color-text-tertiary);
        }

        /* Cards */
        .gs-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .gs-card {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: border-color 0.25s ease;
        }
        .gs-card-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .gs-card-desc {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }
        .gs-card-btn {
          width: 100%;
          height: 44px;
          font-size: 0.9375rem;
          margin-top: auto;
        }

        @media (max-width: 700px) {
          .gs-cards { grid-template-columns: 1fr; }
          .gs-pills { flex-direction: column; align-items: center; }
          .gs-container { padding: 0 24px; }
        }
      `}</style>
    </motion.div>
  );
}
