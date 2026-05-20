import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, Zap, Users, Infinity, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';
import AnimatedSection from '../components/AnimatedSection';

/* ── Mini SVG Diagrams ───────────────────────────────────────────────── */
function HeroCanvasSVG() {
  return (
    <svg viewBox="0 0 500 340" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* Grid dots */}
      <defs>
        <pattern id="heroGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#E5E7EB" />
        </pattern>
        <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#9CA3AF" />
        </marker>
      </defs>
      <rect width="500" height="340" fill="url(#heroGrid)" />

      {/* User node */}
      <rect x="195" y="15" width="110" height="40" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5" />
      <text x="250" y="40" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1A1A2E" fontFamily="Plus Jakarta Sans, sans-serif">User</text>

      {/* Arrow down */}
      <line x1="250" y1="55" x2="250" y2="90" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />

      {/* Web App node */}
      <rect x="185" y="90" width="130" height="40" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5" />
      <text x="250" y="115" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1A1A2E" fontFamily="Plus Jakarta Sans, sans-serif">Web App</text>

      {/* Arrows to services */}
      <line x1="210" y1="130" x2="100" y2="175" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
      <line x1="250" y1="130" x2="250" y2="175" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
      <line x1="290" y1="130" x2="400" y2="175" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />

      {/* Auth Service */}
      <rect x="30" y="175" width="140" height="40" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5" />
      <text x="100" y="200" textAnchor="middle" fontSize="10" fontWeight="500" fill="#1A1A2E" fontFamily="Plus Jakarta Sans, sans-serif">Auth Service</text>

      {/* Payment Service */}
      <rect x="185" y="175" width="140" height="40" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5" />
      <text x="255" y="200" textAnchor="middle" fontSize="10" fontWeight="500" fill="#1A1A2E" fontFamily="Plus Jakarta Sans, sans-serif">Payment Service</text>

      {/* Notification Service */}
      <rect x="340" y="175" width="140" height="40" rx="6" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5" />
      <text x="410" y="200" textAnchor="middle" fontSize="9.5" fontWeight="500" fill="#1A1A2E" fontFamily="Plus Jakarta Sans, sans-serif">Notification Service</text>

      {/* Arrows down to DB */}
      <line x1="100" y1="215" x2="235" y2="260" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
      <line x1="255" y1="215" x2="255" y2="260" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />
      <line x1="410" y1="215" x2="275" y2="260" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowHead)" />

      {/* Database node */}
      <rect x="195" y="260" width="120" height="44" rx="8" fill="#6C63FF" stroke="none" />
      <text x="255" y="286" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff" fontFamily="Plus Jakarta Sans, sans-serif">Database</text>
    </svg>
  );
}

/* ── Left toolbar mini ────────────────────────────────────────────────── */
function CanvasToolbar() {
  const tools = ['cursor', 'rect', 'circle', 'arrow', 'text', 'pen'];
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 36,
      background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      paddingTop: 12, borderRadius: '16px 0 0 16px'
    }}>
      {tools.map((t, i) => (
        <div key={t} style={{
          width: 24, height: 24, borderRadius: 4,
          background: i === 0 ? 'var(--color-bg-tertiary)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: t === 'circle' ? 6 : 2,
            border: '1.5px solid', borderColor: i === 0 ? 'var(--color-brand)' : '#9CA3AF',
          }} />
        </div>
      ))}
    </div>
  );
}

/* ── AI Assistant float card ──────────────────────────────────────────── */
function AIAssistantCard() {
  return (
    <motion.div
      className="ai-assistant-card"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 1.2 }}
    >
      <div className="ai-header">
        <span className="ai-title">AI Assistant</span>
        <span className="ai-close">✕</span>
      </div>
      <div className="ai-body">
        <span className="ai-subtitle">Diagram Detected</span>
        <p className="ai-desc">Detected a system architecture with 6 nodes. I can enhance this.</p>
        <div className="ai-actions">
          <button className="ai-btn-primary">Enhance</button>
          <button className="ai-btn-secondary">Ask me</button>
        </div>
        <span className="ai-suggested-label">Suggested</span>
        <div className="ai-suggested-row">
          <div className="ai-suggested-thumb" />
          <div className="ai-suggested-thumb" />
          <div className="ai-suggested-thumb" />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Company logos mock ────────────────────────────────────────────────── */
const companyLogos = ['Linear', 'Calendly', 'Notion', 'Vercel', 'Framer'];

/* ── Feature bar items ────────────────────────────────────────────────── */
const features = [
  { icon: Users, label: 'Real-time Collaboration' },
  { icon: Zap, label: 'AI Diagram Generation' },
  { icon: Infinity, label: 'Infinite Canvas' },
  { icon: Shield, label: 'Secure & Scalable' },
];

/* ── Main component ───────────────────────────────────────────────────── */
export default function LandingPage() {
  const { scrollY } = useScroll();
  const yCard = useTransform(scrollY, [0, 500], [0, -60]);
  const yText = useTransform(scrollY, [0, 500], [0, -30]);
  const yBg = useTransform(scrollY, [0, 500], [0, 80]);

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Navbar variant="landing" />

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className="hero-section">
        {/* Decorative background blob */}
        <motion.div className="hero-bg-blob" style={{ y: yBg }} />

        <div className="container hero-grid">
          {/* Left Column */}
          <motion.div className="hero-left" style={{ y: yText }}>
            <motion.div
              className="hero-tag"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              AI-Powered Collaborative Whiteboard
            </motion.div>

            <h1 className="hero-h1">
              <motion.span className="hero-line" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
                Think. Draw.
              </motion.span>
              <motion.span className="hero-line" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                Collaborate.
              </motion.span>
              <motion.span className="hero-line hero-brand" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                With AI.
              </motion.span>
            </h1>

            <motion.p
              className="hero-desc"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              The visual workspace for modern teams. Create diagrams, collaborate in real-time, and turn sketches into stunning visuals with AI.
            </motion.p>

            <motion.div
              className="hero-ctas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link to="/get-started">
                <motion.button className="btn btn-primary hero-btn" whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                  Get Started Free
                </motion.button>
              </Link>
              <button className="btn btn-text hero-watch">
                <Play size={16} fill="var(--color-text-secondary)" /> Watch Demo
              </button>
            </motion.div>

            {/* Trust bar */}
            <motion.div
              className="hero-trust"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <span className="hero-trust-label">Trusted by innovative teams</span>
              <motion.div className="hero-logos" variants={stagger} initial="hidden" animate="show">
                {companyLogos.map((logo, i) => (
                  <motion.span key={logo} className="hero-logo" variants={fadeUp}>
                    {logo}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Right Column — Canvas Preview Card */}
          <motion.div
            className="hero-right"
            style={{ y: yCard }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hero-canvas-card">
              {/* Top bar */}
              <div className="canvas-topbar">
                <div className="canvas-avatars">
                  <div className="canvas-avatar" style={{ background: '#6C63FF' }}>A</div>
                  <div className="canvas-avatar" style={{ background: '#8B85F0', marginLeft: -8 }}>B</div>
                  <div className="canvas-avatar" style={{ background: '#B4B0F0', marginLeft: -8 }}>C</div>
                  <span className="canvas-avatar-count">+3</span>
                </div>
                <div className="canvas-topbar-right">
                  <motion.button className="canvas-share-btn" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Share</motion.button>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
              </div>

              {/* Toolbar */}
              <CanvasToolbar />

              {/* SVG Diagram */}
              <div className="canvas-diagram-area">
                <HeroCanvasSVG />
              </div>

              {/* AI Assistant */}
              <AIAssistantCard />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Bar ──────────────────────────────────────────────── */}
      <AnimatedSection>
        <section className="feature-bar">
          <div className="container feature-bar-inner">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.label}
                  className="feature-bar-item"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <Icon size={18} color="var(--color-brand)" />
                  <span>{f.label}</span>
                </motion.div>
              );
            })}
          </div>
        </section>
      </AnimatedSection>

      <style>{`
        /* ── Hero ────────────────────────────────────────────────────── */
        .hero-section {
          position: relative;
          min-height: calc(100vh - var(--navbar-height));
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .hero-bg-blob {
          position: absolute;
          top: -120px;
          right: -200px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, var(--color-brand-light), transparent 70%);
          filter: blur(80px);
          z-index: 0;
          pointer-events: none;
        }
        .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          position: relative;
          z-index: 1;
          padding-top: 40px;
          padding-bottom: 40px;
        }
        .hero-left {
          display: flex;
          flex-direction: column;
        }
        .hero-tag {
          display: inline-flex;
          align-self: flex-start;
          background: var(--color-brand-light);
          color: var(--color-brand);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .hero-h1 {
          display: flex;
          flex-direction: column;
          font-size: clamp(2.5rem, 5vw, 3.75rem);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 20px;
        }
        .hero-line {
          display: block;
        }
        .hero-brand {
          color: var(--color-brand);
        }
        .hero-desc {
          color: var(--color-text-secondary);
          max-width: 440px;
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .hero-ctas {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 24px;
        }
        .hero-btn {
          padding: 12px 28px;
          font-size: 0.9375rem;
        }
        .hero-watch {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-trust {
          margin-top: 48px;
        }
        .hero-trust-label {
          font-size: 0.8125rem;
          color: var(--color-text-tertiary);
          display: block;
          margin-bottom: 16px;
        }
        .hero-logos {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .hero-logo {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-tertiary);
          opacity: 0.5;
          transition: opacity 0.2s;
          cursor: default;
        }
        .hero-logo:hover {
          opacity: 1;
        }

        /* ── Canvas Card ─────────────────────────────────────────────── */
        .hero-right {
          position: relative;
        }
        .hero-canvas-card {
          position: relative;
          background: var(--color-bg-primary);
          border-radius: 16px;
          overflow: visible;
          box-shadow: 0 8px 40px rgba(108,99,255,0.15), 0 2px 8px rgba(0,0,0,0.08);
          padding-left: 36px;
        }
        .canvas-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--color-border-light);
        }
        .canvas-avatars {
          display: flex;
          align-items: center;
        }
        .canvas-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: #fff;
          font-size: 0.6875rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #fff;
        }
        .canvas-avatar-count {
          margin-left: 6px;
          font-size: 0.75rem;
          color: var(--color-text-tertiary);
          font-weight: 500;
        }
        .canvas-topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .canvas-share-btn {
          background: var(--color-brand);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 5px 14px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .canvas-share-btn:hover {
          background: var(--color-brand-dark);
        }
        .canvas-diagram-area {
          padding: 8px 14px 14px;
        }

        /* ── AI Assistant ────────────────────────────────────────────── */
        .ai-assistant-card {
          position: absolute;
          bottom: -20px;
          right: -24px;
          width: 200px;
          background: #fff;
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          z-index: 10;
        }
        .ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .ai-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .ai-close {
          font-size: 0.75rem;
          color: var(--color-text-tertiary);
          cursor: pointer;
        }
        .ai-subtitle {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-primary);
          display: block;
          margin-bottom: 4px;
        }
        .ai-desc {
          font-size: 0.6875rem;
          color: var(--color-text-tertiary);
          line-height: 1.4;
          margin-bottom: 10px;
        }
        .ai-actions {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
        }
        .ai-btn-primary {
          background: var(--color-brand);
          color: #fff;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 6px;
          transition: background 0.2s;
        }
        .ai-btn-primary:hover { background: var(--color-brand-dark); }
        .ai-btn-secondary {
          background: #fff;
          color: var(--color-brand);
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          transition: background 0.2s;
        }
        .ai-btn-secondary:hover { background: var(--color-brand-light); }
        .ai-suggested-label {
          font-size: 0.625rem;
          font-weight: 600;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: block;
          margin-bottom: 6px;
        }
        .ai-suggested-row {
          display: flex;
          gap: 6px;
        }
        .ai-suggested-thumb {
          width: 48px;
          height: 34px;
          background: var(--color-brand-light);
          border-radius: 4px;
          border: 1px solid var(--color-border-light);
        }

        /* ── Feature Bar ──────────────────────────────────────────────── */
        .feature-bar {
          background: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
          padding: 20px 0;
        }
        .feature-bar-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 48px;
          flex-wrap: wrap;
        }
        .feature-bar-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        /* ── Responsive ───────────────────────────────────────────────── */
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .hero-right {
            max-width: 520px;
            margin: 0 auto;
          }
          .ai-assistant-card {
            right: 0;
            bottom: -10px;
          }
        }
        @media (max-width: 600px) {
          .feature-bar-inner {
            gap: 24px;
          }
          .hero-logos {
            gap: 20px;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </motion.div>
  );
}
