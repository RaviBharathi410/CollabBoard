import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import LandingPage from './pages/LandingPage';
import GetStartedPage from './pages/GetStartedPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';
import AIStatsDashboardPage from './pages/AIStatsDashboardPage';
import UMLVisualVerificationPage from './pages/UMLVisualVerificationPage';
import SequenceVisualVerificationPage from './pages/SequenceVisualVerificationPage';
import UseCaseVisualVerificationPage from './pages/UseCaseVisualVerificationPage';
import ERDVisualVerificationPage from './pages/ERDVisualVerificationPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/globals.css';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AuthProvider>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/uml-preview" element={<UMLVisualVerificationPage />} />
          <Route path="/sequence-preview" element={<SequenceVisualVerificationPage />} />
          <Route path="/usecase-preview" element={<UseCaseVisualVerificationPage />} />
          <Route path="/erd-preview" element={<ERDVisualVerificationPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/board/:id" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
          <Route path="/admin/ai-stats" element={<ProtectedRoute><AIStatsDashboardPage /></ProtectedRoute>} />
        </Routes>
      </AnimatePresence>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
