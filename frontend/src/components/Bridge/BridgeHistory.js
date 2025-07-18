import React, { useState, useEffect } from 'react';
import bridgeService from '../../services/bridgeService';
import './BridgeHistory.css';

const BridgeHistory = ({ userAddress }) => {
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (userAddress) {
      loadBridgeHistory();
    }
  }, [userAddress]);

  const loadBridgeHistory = async () => {
    try {
      setLoading(true);
      const response = await bridgeService.getUserBridgeHistory(userAddress, 100); // Get more for filtering
      setBridges(response.data.bridges);
      setError(null);
    } catch (err) {
      console.error('Failed to load bridge history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBridges = () => {
    let filtered = bridges;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(bridge => bridge.status === filter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'amount_high':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'amount_low':
          return parseFloat(a.amount) - parseFloat(b.amount);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getPaginatedBridges = () => {
    const filtered = getFilteredBridges();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Update total pages
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (totalPages !== totalPages) {
      setTotalPages(totalPages);
    }

    return filtered.slice(startIndex, endIndex);
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startDate, endDate) => {
    if (!endDate) return 'In progress';

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end - start;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const renderBridgeCard = (bridge) => {
    const sourceChain = bridgeService.getChainName(bridge.sourceChain);
    const destinationChain = bridgeService.getChainName(bridge.destinationChain);
    const statusColor = bridgeService.getStatusColor(bridge.status);
    const statusText = bridgeService.getStatusText(bridge.status);

    return (
      <div key={bridge.id} className="bridge-card">
        <div className="bridge-card-header">
          <div className="bridge-route">
            <div className="chain-info">
              <img
                src={bridgeService.getChainIcon(bridge.sourceChain)}
                alt={sourceChain}
                className="chain-icon"
              />
              <span className="chain-name">{sourceChain}</span>
            </div>
            <div className="bridge-arrow">→</div>
            <div className="chain-info">
              <img
                src={bridgeService.getChainIcon(bridge.destinationChain)}
                alt={destinationChain}
                className="chain-icon"
              />
              <span className="chain-name">{destinationChain}</span>
            </div>
          </div>
          <div className="bridge-status">
            <span
              className="status-indicator"
              style={{ backgroundColor: statusColor }}
            ></span>
            <span className="status-text">{statusText}</span>
          </div>
        </div>

        <div className="bridge-card-body">
          <div className="bridge-amount">
            <span className="amount-label">Amount:</span>
            <span className="amount-value">{bridge.amount} ETH</span>
          </div>

          <div className="bridge-timing">
            <div className="timing-item">
              <span className="timing-label">Started:</span>
              <span className="timing-value">{formatDate(bridge.createdAt)}</span>
            </div>
            {bridge.completedAt && (
              <div className="timing-item">
                <span className="timing-label">Completed:</span>
                <span className="timing-value">{formatDate(bridge.completedAt)}</span>
              </div>
            )}
            <div className="timing-item">
              <span className="timing-label">Duration:</span>
              <span className="timing-value">{formatDuration(bridge.createdAt, bridge.completedAt)}</span>
            </div>
          </div>
        </div>

        <div className="bridge-card-footer">
          <div className="bridge-transactions">
            {bridge.sourceTxHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${bridge.sourceTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                📤 Source TX
              </a>
            )}
            {bridge.destinationTxHash && (
              <a
                href={`https://sepolia.mantlescan.xyz/tx/${bridge.destinationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                📥 Destination TX
              </a>
            )}
          </div>

          <div className="bridge-actions">
            <button
              className="action-button details"
              onClick={() => window.open(`/bridge/status/${bridge.id}`, '_blank')}
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`page-button ${currentPage === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="page-button"
        >
          First
        </button>
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="page-button"
        >
          Previous
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="page-button"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="page-button"
        >
          Last
        </button>
      </div>
    );
  };

  const getStatusCounts = () => {
    const counts = bridges.reduce((acc, bridge) => {
      acc[bridge.status] = (acc[bridge.status] || 0) + 1;
      return acc;
    }, {});

    return {
      all: bridges.length,
      completed: counts.completed || 0,
      processing: counts.processing || 0,
      challenge_period: counts.challenge_period || 0,
      failed: counts.failed || 0
    };
  };

  if (loading) {
    return (
      <div className="bridge-history-container">
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading bridge history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bridge-history-container">
        <div className="history-error">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Load History</h3>
          <p>{error}</p>
          <button onClick={loadBridgeHistory} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (bridges.length === 0) {
    return (
      <div className="bridge-history-container">
        <div className="history-empty">
          <div className="empty-icon">🌉</div>
          <h3>No Bridge History</h3>
          <p>You haven't made any bridge transactions yet.</p>
        </div>
      </div>
    );
  }

  const statusCounts = getStatusCounts();
  const filteredBridges = getPaginatedBridges();

  return (
    <div className="bridge-history-container">
      <div className="history-header">
        <h2>Bridge History</h2>
        <button onClick={loadBridgeHistory} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      <div className="history-filters">
        <div className="filter-group">
          <label>Filter by Status:</label>
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="filter-select"
          >
            <option value="all">All ({statusCounts.all})</option>
            <option value="completed">Completed ({statusCounts.completed})</option>
            <option value="processing">Processing ({statusCounts.processing})</option>
            <option value="challenge_period">Challenge Period ({statusCounts.challenge_period})</option>
            <option value="failed">Failed ({statusCounts.failed})</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="filter-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount_high">Highest Amount</option>
            <option value="amount_low">Lowest Amount</option>
          </select>
        </div>
      </div>

      <div className="history-content">
        <div className="bridge-cards">
          {filteredBridges.map(renderBridgeCard)}
        </div>

        {totalPages > 1 && renderPagination()}
      </div>

      <div className="history-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Bridges:</span>
            <span className="stat-value">{bridges.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Success Rate:</span>
            <span className="stat-value">
              {bridges.length > 0 ? Math.round((statusCounts.completed / bridges.length) * 100) : 0}%
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Volume:</span>
            <span className="stat-value">
              {bridges.reduce((sum, bridge) => sum + parseFloat(bridge.amount), 0).toFixed(4)} ETH
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BridgeHistory;