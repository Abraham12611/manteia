import React, { useState, useEffect } from 'react';
import profileService from '../../services/profileService';
import './ProfileActivity.css';

const ProfileActivity = ({ walletAddress, isOwnProfile }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    minAmount: 'None',
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  const minAmountOptions = [
    { value: 'None', label: 'None' },
    { value: '10', label: '$10' },
    { value: '100', label: '$100' },
    { value: '1000', label: '$1,000' },
    { value: '10000', label: '$10,000' },
    { value: '100000', label: '$100,000' }
  ];

  const typeOptions = [
    { value: 'all', label: 'All' },
    { value: 'buy', label: 'Buy' },
    { value: 'sell', label: 'Sell' },
    { value: 'redeem', label: 'Redeem' }
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  useEffect(() => {
    loadActivity();
  }, [walletAddress, filters]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiFilters = {
        type: filters.type !== 'all' ? filters.type : undefined,
        minAmount: filters.minAmount !== 'None' ? filters.minAmount : undefined,
        limit: 50
      };

      // Add date range filter
      if (filters.dateRange !== 'all') {
        const daysAgo = parseInt(filters.dateRange);
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - daysAgo);
        apiFilters.dateFrom = dateFrom.toISOString();
      }

      const response = await profileService.getUserActivity(walletAddress, apiFilters);
      setActivities(response.data.activity);

    } catch (err) {
      console.error('Failed to load activity:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const renderActivityRow = (activity) => {
    const {
      id,
      type,
      amount,
      marketTitle,
      category,
      currentPrice,
      createdAt,
      transactionHash,
      status
    } = activity;

    const typeColor = profileService.getPositionTypeColor(type);
    const typeIcon = profileService.getPositionTypeIcon(type);
    const categoryColor = profileService.getCategoryColor(category);
    const categoryIcon = profileService.getCategoryIcon(category);
    const formattedDate = profileService.formatRelativeTime(createdAt);

    return (
      <div key={id} className="activity-row">
        <div className="activity-type">
          <span className="type-icon">{typeIcon}</span>
          <span
            className="type-text"
            style={{ color: typeColor }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        </div>

        <div className="activity-market">
          <div className="market-category">
            <span className="category-icon">{categoryIcon}</span>
            <span
              className="category-text"
              style={{ color: categoryColor }}
            >
              {category}
            </span>
          </div>
          <div className="market-title">{marketTitle}</div>
          {currentPrice && (
            <div className="market-price">
              Current: {profileService.formatPercentage(currentPrice)}
            </div>
          )}
        </div>

        <div className="activity-amount">
          <span className="amount-value">
            {profileService.formatCurrency(amount)}
          </span>
          <span className="amount-date">{formattedDate}</span>
        </div>

        <div className="activity-actions">
          {transactionHash && (
            <a
              href={`https://sepolia.mantlescan.xyz/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
              title="View transaction"
            >
              🔗
            </a>
          )}
          <span className={`status-badge ${status}`}>
            {status}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="profile-activity">
        <div className="activity-loading">
          <div className="loading-spinner"></div>
          <p>Loading activity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-activity">
        <div className="activity-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={loadActivity} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-activity">
      <div className="activity-header">
        <div className="filter-section">
          <button
            className="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="filter-icon">🔍</span>
            <span>Filters</span>
            <span className={`filter-arrow ${showFilters ? 'open' : ''}`}>▼</span>
          </button>

          <div className="min-amount-filter">
            <label>Min amount</label>
            <select
              value={filters.minAmount}
              onChange={(e) => handleFilterChange('minAmount', e.target.value)}
              className="filter-select"
            >
              {minAmountOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showFilters && (
          <div className="expanded-filters">
            <div className="filter-group">
              <label>Type</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="filter-select"
              >
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Time Period</label>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="filter-select"
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="activity-content">
        {activities.length === 0 ? (
          <div className="activity-empty">
            <div className="empty-icon">📈</div>
            <h3>No activity found</h3>
            <p>
              {isOwnProfile
                ? "You haven't made any trades yet. Start by exploring markets and making your first prediction!"
                : "This user hasn't made any public trades yet."
              }
            </p>
          </div>
        ) : (
          <div className="activity-list">
            <div className="activity-table-header">
              <div className="header-row">
                <span className="header-cell">TYPE</span>
                <span className="header-cell">MARKET</span>
                <span className="header-cell">AMOUNT</span>
                <span className="header-cell">ACTIONS</span>
              </div>
            </div>

            <div className="activity-rows">
              {activities.map(renderActivityRow)}
            </div>
          </div>
        )}
      </div>

      <div className="activity-footer">
        <div className="activity-summary">
          <span className="summary-text">
            Showing {activities.length} activities
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileActivity;