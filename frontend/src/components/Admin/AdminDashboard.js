import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiTrendingUp,
  FiUsers,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiDollarSign,
  FiActivity,
  FiAlertCircle
} from 'react-icons/fi';
import adminService from '../../services/adminService';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    markets: { total: 0, active: 0, resolved: 0 },
    users: { total: 0, active: 0 },
    trading: { totalVolume: 0, totalTrades: 0, totalFees: 0 },
    system: { uptime: 0, status: 'healthy' }
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load all dashboard data in parallel
      const [marketStats, userStats, tradingStats, systemStats] = await Promise.all([
        adminService.getMarketStats(),
        adminService.getUserStats(),
        adminService.getTradingStats(),
        adminService.getSystemStats()
      ]);

      setStats({
        markets: marketStats.data || { total: 0, active: 0, resolved: 0 },
        users: userStats.data || { total: 0, active: 0 },
        trading: tradingStats.data || { totalVolume: 0, totalTrades: 0, totalFees: 0 },
        system: systemStats.data || { uptime: 0, status: 'healthy' }
      });

      // Load recent activity (placeholder for now)
      setRecentActivity([
        { id: 1, type: 'market_created', description: 'New market created: "Will GPT-5 be released?"', timestamp: '2 hours ago' },
        { id: 2, type: 'large_trade', description: 'Large trade executed: 1,000 MNT', timestamp: '4 hours ago' },
        { id: 3, type: 'user_joined', description: '25 new users joined today', timestamp: '6 hours ago' }
      ]);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminService.logout();
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      navigate('/admin/login');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <p>Manage your Manteia prediction markets</p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <FiLogOut />
          Logout
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <FiAlertCircle />
          {error}
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/admin/markets/create" className="quick-action primary">
          <FiPlus />
          Create New Market
        </Link>
        <Link to="/admin/markets/manage" className="quick-action">
          <FiSettings />
          Manage Markets
        </Link>
        <Link to="/admin/users" className="quick-action">
          <FiUsers />
          User Management
        </Link>
        <Link to="/admin/analytics" className="quick-action">
          <FiBarChart2 />
          Analytics
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <h3>Markets</h3>
            <FiTrendingUp className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-main">
              <span className="stat-number">{formatNumber(stats.markets.total)}</span>
              <span className="stat-label">Total Markets</span>
            </div>
            <div className="stat-details">
              <div className="stat-detail">
                <span className="stat-detail-number">{formatNumber(stats.markets.active)}</span>
                <span className="stat-detail-label">Active</span>
              </div>
              <div className="stat-detail">
                <span className="stat-detail-number">{formatNumber(stats.markets.resolved)}</span>
                <span className="stat-detail-label">Resolved</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <h3>Users</h3>
            <FiUsers className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-main">
              <span className="stat-number">{formatNumber(stats.users.total)}</span>
              <span className="stat-label">Total Users</span>
            </div>
            <div className="stat-details">
              <div className="stat-detail">
                <span className="stat-detail-number">{formatNumber(stats.users.active)}</span>
                <span className="stat-detail-label">Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <h3>Trading Volume</h3>
            <FiDollarSign className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-main">
              <span className="stat-number">{formatCurrency(stats.trading.totalVolume)}</span>
              <span className="stat-label">Total Volume</span>
            </div>
            <div className="stat-details">
              <div className="stat-detail">
                <span className="stat-detail-number">{formatNumber(stats.trading.totalTrades)}</span>
                <span className="stat-detail-label">Trades</span>
              </div>
              <div className="stat-detail">
                <span className="stat-detail-number">{formatCurrency(stats.trading.totalFees)}</span>
                <span className="stat-detail-label">Fees</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <h3>System Status</h3>
            <FiActivity className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-main">
              <span className={`stat-status ${stats.system.status}`}>
                {stats.system.status.toUpperCase()}
              </span>
              <span className="stat-label">System Status</span>
            </div>
            <div className="stat-details">
              <div className="stat-detail">
                <span className="stat-detail-number">{stats.system.uptime}%</span>
                <span className="stat-detail-label">Uptime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          {recentActivity.map(activity => (
            <div key={activity.id} className="activity-item">
              <div className={`activity-icon ${activity.type}`}>
                {activity.type === 'market_created' && <FiPlus />}
                {activity.type === 'large_trade' && <FiDollarSign />}
                {activity.type === 'user_joined' && <FiUsers />}
              </div>
              <div className="activity-content">
                <p className="activity-description">{activity.description}</p>
                <span className="activity-timestamp">{activity.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;