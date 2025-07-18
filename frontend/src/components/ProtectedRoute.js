import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import adminService from '../services/adminService';

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!adminService.isAuthenticated()) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        // Verify token with backend
        const isValid = await adminService.verifyToken();
        setIsAuthenticated(isValid);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="protected-route-loading">
        <div className="loading-spinner"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default ProtectedRoute;