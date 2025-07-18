import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import AppKitStatus from './components/AppKitStatus';
import Home from './pages/Home';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
import Profile from './components/Profile/Profile';
import Bridge from './components/Bridge/Bridge';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import MarketCreation from './components/Admin/MarketCreation';
import ProtectedRoute from './components/ProtectedRoute';
import './theme.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <AppKitStatus />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:walletAddress" element={<Profile />} />
          <Route path="/bridge" element={<Bridge />} />

          {/* Category Routes */}
          <Route path="/trending" element={<Navigate to="/markets?category=trending" />} />
          <Route path="/new" element={<Navigate to="/markets?category=new" />} />
          <Route path="/politics" element={<Navigate to="/markets?category=politics" />} />
          <Route path="/sports" element={<Navigate to="/markets?category=sports" />} />
          <Route path="/crypto" element={<Navigate to="/markets?category=crypto" />} />
          <Route path="/tech" element={<Navigate to="/markets?category=tech" />} />
          <Route path="/culture" element={<Navigate to="/markets?category=culture" />} />
          <Route path="/world" element={<Navigate to="/markets?category=world" />} />
          <Route path="/economy" element={<Navigate to="/markets?category=economy" />} />
          <Route path="/elections" element={<Navigate to="/markets?category=elections" />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/markets/create" element={
            <ProtectedRoute>
              <MarketCreation />
            </ProtectedRoute>
          } />
          <Route path="/admin/markets/manage" element={
            <ProtectedRoute>
              <div>Market Management (Coming Soon)</div>
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute>
              <div>User Management (Coming Soon)</div>
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute>
              <div>Analytics Dashboard (Coming Soon)</div>
            </ProtectedRoute>
          } />

          {/* Redirect /admin to /admin/dashboard */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;