import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, FileText, Users, Building2, Zap, MoreHorizontal, Plus, LogOut } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

/* ── Count-up hook ──────────────────────────────────────────────────── */
function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(id); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [inView, target, duration]);
  return { count, ref };
}

/* ── Stats data ─────────────────────────────────────────────────────── */
const stats = [
  { icon: FileText, label: 'Total Boards', value: 24, color: '#6C63FF' },
  { icon: Users, label: 'Collaborators', value: 18, color: '#60A5FA' },
  { icon: Building2, label: 'Teams', value: 6, color: '#34D399' },
  { icon: Zap, label: 'Recent Activity', value: 12, color: '#F87171' },
];

/* ── Board SVG thumbnails ───────────────────────────────────────────── */
function SysArchSVG() {
  return (<svg viewBox="0 0 200 100" fill="none" style={{width:'100%',height:'100%'}}>
    <rect x="70" y="5" width="60" height="20" rx="3" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <text x="100" y="18" textAnchor="middle" fontSize="7" fill="#1A1A2E" fontWeight="500">User</text>
    <line x1="100" y1="25" x2="100" y2="40" stroke="#9CA3AF" strokeWidth="1"/>
    <rect x="60" y="40" width="80" height="20" rx="3" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <text x="100" y="53" textAnchor="middle" fontSize="7" fill="#1A1A2E" fontWeight="500">Web App</text>
    <line x1="80" y1="60" x2="40" y2="75" stroke="#9CA3AF" strokeWidth="1"/>
    <line x1="100" y1="60" x2="100" y2="75" stroke="#9CA3AF" strokeWidth="1"/>
    <line x1="120" y1="60" x2="160" y2="75" stroke="#9CA3AF" strokeWidth="1"/>
    <rect x="10" y="75" width="55" height="18" rx="3" fill="#6C63FF"/>
    <text x="37" y="87" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="500">Auth</text>
    <rect x="72" y="75" width="55" height="18" rx="3" fill="#6C63FF"/>
    <text x="99" y="87" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="500">Payment</text>
    <rect x="134" y="75" width="55" height="18" rx="3" fill="#6C63FF"/>
    <text x="161" y="87" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="500">Notify</text>
  </svg>);
}
function UserFlowSVG() {
  return (<svg viewBox="0 0 200 100" fill="none" style={{width:'100%',height:'100%'}}>
    <rect x="10" y="35" width="50" height="22" rx="11" fill="#fff" stroke="#6C63FF" strokeWidth="1.2"/>
    <text x="35" y="50" textAnchor="middle" fontSize="7" fill="#1A1A2E" fontWeight="500">Login</text>
    <line x1="60" y1="46" x2="75" y2="46" stroke="#9CA3AF" strokeWidth="1"/>
    <rect x="75" y="35" width="55" height="22" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <text x="102" y="50" textAnchor="middle" fontSize="7" fill="#1A1A2E" fontWeight="500">Dashboard</text>
    <line x1="130" y1="46" x2="145" y2="46" stroke="#9CA3AF" strokeWidth="1"/>
    <rect x="145" y="35" width="45" height="22" rx="4" fill="#6C63FF"/>
    <text x="167" y="50" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="500">Board</text>
  </svg>);
}
function DbSchemaSVG() {
  return (<svg viewBox="0 0 200 100" fill="none" style={{width:'100%',height:'100%'}}>
    <rect x="15" y="10" width="70" height="80" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <rect x="15" y="10" width="70" height="18" rx="4" fill="#6C63FF"/>
    <text x="50" y="22" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="600">Users</text>
    <text x="22" y="38" fontSize="6" fill="#4B5563">id: UUID</text>
    <text x="22" y="50" fontSize="6" fill="#4B5563">name: VARCHAR</text>
    <text x="22" y="62" fontSize="6" fill="#4B5563">email: VARCHAR</text>
    <rect x="115" y="10" width="70" height="80" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <rect x="115" y="10" width="70" height="18" rx="4" fill="#8B85F0"/>
    <text x="150" y="22" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="600">Boards</text>
    <text x="122" y="38" fontSize="6" fill="#4B5563">id: UUID</text>
    <text x="122" y="50" fontSize="6" fill="#4B5563">title: VARCHAR</text>
    <text x="122" y="62" fontSize="6" fill="#4B5563">owner_id: FK</text>
    <line x1="85" y1="50" x2="115" y2="50" stroke="#6C63FF" strokeWidth="1" strokeDasharray="3 2"/>
  </svg>);
}
function MktStrategySVG() {
  return (<svg viewBox="0 0 200 100" fill="none" style={{width:'100%',height:'100%'}}>
    <rect x="65" y="5" width="70" height="20" rx="4" fill="#6C63FF"/>
    <text x="100" y="18" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="600">Strategy</text>
    <line x1="85" y1="25" x2="50" y2="42" stroke="#9CA3AF" strokeWidth="1"/>
    <line x1="115" y1="25" x2="150" y2="42" stroke="#9CA3AF" strokeWidth="1"/>
    <rect x="15" y="42" width="65" height="18" rx="3" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <text x="47" y="54" textAnchor="middle" fontSize="6.5" fill="#1A1A2E" fontWeight="500">Content</text>
    <rect x="120" y="42" width="65" height="18" rx="3" fill="#fff" stroke="#E5E7EB" strokeWidth="1"/>
    <text x="152" y="54" textAnchor="middle" fontSize="6.5" fill="#1A1A2E" fontWeight="500">Social</text>
    <line x1="35" y1="60" x2="35" y2="72" stroke="#9CA3AF" strokeWidth="1"/>
    <line x1="60" y1="60" x2="60" y2="72" stroke="#9CA3AF" strokeWidth="1"/>
    <rect x="10" y="72" width="50" height="16" rx="3" fill="#EEEDfe" stroke="#E5E7EB" strokeWidth=".8"/>
    <text x="35" y="83" textAnchor="middle" fontSize="5.5" fill="#4B5563">Blog</text>
    <rect x="35" y="72" width="50" height="16" rx="3" fill="#EEEDfe" stroke="#E5E7EB" strokeWidth=".8"/>
    <text x="60" y="83" textAnchor="middle" fontSize="5.5" fill="#4B5563">Video</text>
  </svg>);
}

const boards = [
  { name: 'System Architecture', time: 'Updated 2 hours ago', Thumb: SysArchSVG },
  { name: 'User Flow Diagram', time: 'Updated yesterday', Thumb: UserFlowSVG },
  { name: 'Database Schema', time: 'Updated 3 days ago', Thumb: DbSchemaSVG },
  { name: 'Marketing Strategy', time: 'Updated 5 days ago', Thumb: MktStrategySVG },
];

const templates = ['Flowchart','Wireframe','Mind Map','ER Diagram','System Architecture'];

/* small template thumb */
function TemplateMiniSVG({ name }) {
  const colors = { Flowchart:'#6C63FF', Wireframe:'#60A5FA', 'Mind Map':'#34D399', 'ER Diagram':'#F87171', 'System Architecture':'#8B85F0' };
  const c = colors[name] || '#6C63FF';
  return (<svg viewBox="0 0 80 50" fill="none" style={{width:'100%',height:'100%'}}>
    <rect x="10" y="5" width="25" height="14" rx="3" fill={c} opacity=".2" stroke={c} strokeWidth=".8"/>
    <rect x="45" y="5" width="25" height="14" rx="3" fill={c} opacity=".2" stroke={c} strokeWidth=".8"/>
    <line x1="35" y1="12" x2="45" y2="12" stroke={c} strokeWidth=".8"/>
    <rect x="25" y="30" width="30" height="14" rx="3" fill={c} opacity=".3"/>
    <line x1="40" y1="19" x2="40" y2="30" stroke={c} strokeWidth=".8"/>
  </svg>);
}

const stagger = { hidden:{}, show:{ transition:{ staggerChildren:0.1 } } };
const fadeUp = { hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0, transition:{ duration:0.5, ease:[0.22,1,0.36,1] } } };

/* ── Stat Card ──────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color }) {
  const { count, ref } = useCountUp(value);
  return (
    <motion.div ref={ref} className="stat-card" variants={fadeUp} whileHover={{ y:-3 }}>
      <div className="stat-icon" style={{ background: color + '18', color }}><Icon size={20}/></div>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{count}</span>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'there';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.35 }}>
      <Sidebar activePage="home" />
      <main className="dash-main">
        {/* Top bar */}
        <div className="dash-topbar">
          <div>
            <h1 className="dash-welcome">Welcome back, {displayName}! 👋</h1>
            <p className="dash-welcome-sub">Here's what's happening with your workspaces today.</p>
          </div>
          <div className="dash-topbar-right">
            <div className="dash-search">
              <Search size={16} color="var(--color-text-tertiary)"/>
              <input className="dash-search-input" placeholder="Search boards, teams..." />
            </div>
            <button className="dash-bell"><Bell size={20} color="var(--color-text-secondary)"/></button>
            <button className="dash-logout" onClick={handleLogout} title="Log out">
              <LogOut size={18} color="var(--color-text-secondary)"/>
            </button>
          </div>
        </div>

        {/* Stats */}
        <motion.div className="dash-stats" variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}>
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </motion.div>

        {/* Recent Boards */}
        <div className="dash-section-header">
          <h2 className="dash-section-title">Recent Boards</h2>
          <a className="dash-view-all" href="#">View all</a>
        </div>
        <motion.div className="dash-boards" variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}>
          {boards.map((b) => {
            const Thumb = b.Thumb;
            return (
              <motion.div key={b.name} variants={fadeUp} whileHover={{ y:-3, boxShadow:'0 8px 30px rgba(108,99,255,0.18)' }}>
                <Link to={`/board/${b.name.toLowerCase().replace(/ /g, '-')}`} style={{ textDecoration: 'none' }} className="board-card">
                  <div className="board-thumb"><Thumb /></div>
                  <div className="board-info">
                    <div className="board-info-left">
                      <span className="board-name">{b.name}</span>
                      <span className="board-time">{b.time}</span>
                    </div>
                    <button className="board-menu" onClick={(e) => e.preventDefault()}><MoreHorizontal size={16} color="var(--color-text-tertiary)"/></button>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Templates */}
        <div className="dash-section-header" style={{ marginTop:40 }}>
          <h2 className="dash-section-title">Templates</h2>
          <a className="dash-view-all" href="#">View all templates</a>
        </div>
        <motion.div className="dash-templates" variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}>
          <motion.div variants={fadeUp}>
            <Link to="/board/untitled" style={{ textDecoration: 'none' }} className="template-card template-blank">
              <Plus size={24} color="var(--color-text-tertiary)" />
              <span className="template-label">Blank Board</span>
            </Link>
          </motion.div>
          {templates.map(t => (
            <motion.div key={t} variants={fadeUp} whileHover={{ y:-2 }}>
              <Link to={`/board/${t.toLowerCase().replace(/ /g, '-')}`} style={{ textDecoration: 'none' }} className="template-card">
                <div className="template-thumb"><TemplateMiniSVG name={t} /></div>
                <span className="template-label">{t}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <style>{`
        .dash-main { margin-left: var(--sidebar-width); min-height:100vh; background: var(--color-bg-primary); }
        .dash-topbar { position:sticky; top:0; z-index:10; background:#fff; border-bottom:1px solid var(--color-border); height:var(--navbar-height); display:flex; align-items:center; justify-content:space-between; padding:0 32px; }
        .dash-welcome { font-size:1.25rem; font-weight:700; color:var(--color-text-primary); }
        .dash-welcome-sub { font-size:0.8125rem; color:var(--color-text-tertiary); }
        .dash-topbar-right { display:flex; align-items:center; gap:12px; }
        .dash-search { display:flex; align-items:center; gap:8px; border:1px solid var(--color-border); border-radius:8px; height:36px; padding:0 12px; width:240px; }
        .dash-search-input { border:none; background:none; font-size:0.8125rem; color:var(--color-text-primary); width:100%; font-family:inherit; }
        .dash-search-input::placeholder { color:var(--color-text-tertiary); }
        .dash-search-input:focus { outline:none; }
        .dash-bell { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:8px; border:1px solid var(--color-border); background:none; cursor:pointer; transition:background .15s; }
        .dash-bell:hover { background:var(--color-bg-secondary); }
        .dash-logout { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:8px; border:1px solid var(--color-border); background:none; cursor:pointer; transition:all .2s; }
        .dash-logout:hover { background:#FEF2F2; border-color:#FECACA; }
        .dash-logout:hover svg { color:#DC2626 !important; }

        .dash-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:24px 32px 0; }
        .stat-card { background:#fff; border:1px solid var(--color-border); border-radius:12px; padding:16px 20px; display:flex; flex-direction:column; gap:4px; transition:transform .25s,box-shadow .25s; }
        .stat-icon { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:4px; }
        .stat-label { font-size:0.75rem; color:var(--color-text-tertiary); font-weight:500; }
        .stat-value { font-size:1.75rem; font-weight:700; color:var(--color-text-primary); }

        .dash-section-header { display:flex; justify-content:space-between; align-items:center; padding:32px 32px 12px; }
        .dash-section-title { font-size:1.125rem; font-weight:600; color:var(--color-text-primary); }
        .dash-view-all { font-size:0.8125rem; font-weight:600; color:var(--color-brand); }

        .dash-boards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:0 32px; }
        .board-card { background:#fff; border:1px solid var(--color-border); border-radius:12px; overflow:hidden; cursor:pointer; transition:transform .25s,box-shadow .25s; }
        .board-thumb { height:100px; background:var(--color-brand-light); display:flex; align-items:center; justify-content:center; padding:8px;
          background-image:radial-gradient(circle,#d8d6f5 1px,transparent 1px); background-size:20px 20px; }
        .board-info { padding:12px 16px; display:flex; justify-content:space-between; align-items:flex-start; }
        .board-info-left { display:flex; flex-direction:column; }
        .board-name { font-size:0.875rem; font-weight:600; color:var(--color-text-primary); }
        .board-time { font-size:0.75rem; color:var(--color-text-tertiary); margin-top:2px; }
        .board-menu { background:none; border:none; cursor:pointer; padding:2px; }

        .dash-templates { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; padding:0 32px 40px; }
        .template-card { background:#fff; border:1px solid var(--color-border); border-radius:10px; padding:16px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; transition:transform .2s,box-shadow .2s; }
        .template-card:hover { box-shadow:0 4px 16px rgba(108,99,255,0.12); }
        .template-blank { border-style:dashed; border-width:2px; justify-content:center; min-height:100px; }
        .template-thumb { width:100%; height:60px; display:flex; align-items:center; justify-content:center; }
        .template-label { font-size:0.75rem; font-weight:600; color:var(--color-text-secondary); text-align:center; }

        @media (max-width:1100px) { .dash-boards { grid-template-columns:repeat(2,1fr); } .dash-templates { grid-template-columns:repeat(3,1fr); } .dash-stats { grid-template-columns:repeat(2,1fr); } }
        @media (max-width:768px) { .dash-main { margin-left:0; } .dash-boards { grid-template-columns:1fr; } .dash-templates { grid-template-columns:repeat(2,1fr); } .dash-stats { grid-template-columns:1fr; } }
      `}</style>
    </motion.div>
  );
}
