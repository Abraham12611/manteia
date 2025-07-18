import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import AppKitStatus from './components/AppKitStatus';
import Home from './pages/Home';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
import './theme.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <AppKitStatus />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/market/:id" element={<MarketDetail />} />
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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;