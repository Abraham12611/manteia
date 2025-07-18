import React, { useState, useEffect } from 'react';
import profileService from '../../services/profileService';
import './ProfilePositions.css';

const ProfilePositions = ({ walletAddress, isOwnProfile }) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    category: '',
    minAmount: 'None'
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

  useEffect(() => {
    loadPositions();
  }, [walletAddress, filters]);

  const loadPositions = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiFilters = {
        status: filters.status !== 'all' ? filters.status : undefined,
        category: filters.category || undefined,
        minAmount: filters.minAmount !== 'None' ? filters.minAmount : undefined,
        limit: 50
      };

      const response = await profileService.getUserPositions(walletAddress, apiFilters);
      setPositions(response.data.positions);

    } catch (err) {
      console.error('Failed to load positions:', err);
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

  const renderPositionCard = (position) => {
    const {
      marketId,
      marketTitle,
      category,
      marketStatus,
      transactionType,
      amount,
      currentPrice,
      createdAt,
      totalPosition
    } = position;

    const typeColor = profileService.getPositionTypeColor(transactionType);
    const typeIcon = profileService.getPositionTypeIcon(transactionType);
    const statusColor = profileService.getMarketStatusColor(marketStatus);
    const statusText = profileService.getMarketStatusText(marketStatus);
    const categoryColor = profileService.getCategoryColor(category);
    const categoryIcon = profileService.getCategoryIcon(category);
    const formattedDate = profileService.formatRelativeTime(createdAt);

    return (
      <div key={`${marketId}-${position.transactionId}`} className="position-card">
        <div className="position-header">
          <div className="position-type">
            <span className="type-icon">{typeIcon}</span>
            <span
              className="type-text"
              style={{ color: typeColor }}
            >
              {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}
            </span>
          </div>
          <div className="position-status">
            <span
              className="status-indicator"
              style={{ backgroundColor: statusColor }}
            ></span>
            <span className="status-text">{statusText}</span>
          </div>
        </div>

        <div className="position-content">
          <div className="market-info">
            <div className="market-category">
              <span className="category-icon">{categoryIcon}</span>
              <span
                className="category-text"
                style={{ color: categoryColor }}
              >
                {category}
              </span>
            </div>
            <h3 className="market-title">{marketTitle}</h3>
          </div>

          <div className="position-details">
            <div className="position-amounts">
              <div className="amount-row">
                <span className="amount-label">Position:</span>
                <span className="amount-value">
                  {profileService.formatCurrency(amount)}
                </span>
              </div>
              <div className="amount-row">
                <span className="amount-label">Total:</span>
                <span className="amount-value">
                  {profileService.formatCurrency(totalPosition)}
                </span>
              </div>
              {currentPrice && (
                <div className="amount-row">
                  <span className="amount-label">Current:</span>
                  <span className="amount-value">
                    {profileService.formatPercentage(currentPrice)}
                  </span>
                </div>
              )}
            </div>

            <div className="position-meta">
              <span className="position-date">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="profile-positions">
        <div className="positions-loading">
          <div className="loading-spinner"></div>
          <p>Loading positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-positions">
        <div className="positions-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={loadPositions} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-positions">
      <div className="positions-header">
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
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="filter-select"
              >
                <option value="">All Categories</option>
                <option value="politics">Politics</option>
                <option value="sports">Sports</option>
                <option value="crypto">Crypto</option>
                <option value="tech">Tech</option>
                <option value="culture">Culture</option>
                <option value="world">World</option>
                <option value="economy">Economy</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="positions-content">
        {positions.length === 0 ? (
          <div className="positions-empty">
            <div className="empty-icon">📊</div>
            <h3>No positions found</h3>
            <p>
              {isOwnProfile
                ? "You haven't made any trades yet. Start by exploring markets and making your first prediction!"
                : "This user hasn't made any public trades yet."
              }
            </p>
          </div>
        ) : (
          <div className="positions-grid">
            {positions.map(renderPositionCard)}
          </div>
        )}
      </div>

      <div className="positions-footer">
        <div className="table-headers">
          <div className="header-row">
            <span className="header-cell">TYPE</span>
            <span className="header-cell">MARKET</span>
            <span className="header-cell">AMOUNT</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePositions;