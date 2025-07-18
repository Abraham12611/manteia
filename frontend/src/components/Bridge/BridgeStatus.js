import React, { useState, useEffect } from 'react';
import bridgeService from '../../services/bridgeService';
import './BridgeStatus.css';

const BridgeStatus = ({ bridgeData, onBack }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    if (bridgeData?.bridgeId) {
      loadBridgeStatus();

      // Set up polling for status updates
      const interval = setInterval(loadBridgeStatus, 10000); // Poll every 10 seconds
      setRefreshInterval(interval);

      // Set up WebSocket subscription
      bridgeService.subscribeToBridgeUpdates(bridgeData.bridgeId, handleBridgeUpdate);

      return () => {
        clearInterval(interval);
        bridgeService.unsubscribeFromBridgeUpdates(handleBridgeUpdate);
      };
    }
  }, [bridgeData]);

  const loadBridgeStatus = async () => {
    try {
      if (bridgeData?.bridgeId) {
        const response = await bridgeService.getBridgeStatus(bridgeData.bridgeId);
        setStatus(response.data);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load bridge status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBridgeUpdate = (updateData) => {
    if (updateData.bridgeId === bridgeData?.bridgeId) {
      setStatus(prevStatus => ({
        ...prevStatus,
        ...updateData
      }));
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    loadBridgeStatus();
  };

  const getStatusSteps = () => {
    const steps = [
      {
        key: 'initiated',
        label: 'Bridge Initiated',
        description: 'Transaction submitted to source chain'
      },
      {
        key: 'processing',
        label: 'Processing',
        description: 'Validating transaction and preparing bridge'
      }
    ];

    if (status?.destinationChain === 'ethereum-sepolia') {
      steps.push({
        key: 'challenge_period',
        label: 'Challenge Period',
        description: '7-day security challenge period'
      });
    }

    steps.push({
      key: 'completed',
      label: 'Completed',
      description: 'Funds delivered to destination chain'
    });

    return steps;
  };

  const getCurrentStepIndex = () => {
    const steps = getStatusSteps();
    const currentStatus = status?.status || 'initiated';
    return steps.findIndex(step => step.key === currentStatus);
  };

  const renderProgressBar = () => {
    const steps = getStatusSteps();
    const currentStepIndex = getCurrentStepIndex();
    const progress = status?.progress || 0;

    return (
      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="progress-steps">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`step ${index <= currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'current' : ''}`}
            >
              <div className="step-indicator">
                {index < currentStepIndex ? '✓' : index + 1}
              </div>
              <div className="step-info">
                <div className="step-label">{step.label}</div>
                <div className="step-description">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStatusDetails = () => {
    if (!status) return null;

    return (
      <div className="status-details">
        <div className="detail-section">
          <h3>Transaction Details</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Bridge ID:</span>
              <span className="detail-value">{status.bridgeId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Amount:</span>
              <span className="detail-value">{status.amount} ETH</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">From:</span>
              <span className="detail-value">{bridgeService.getChainName(status.sourceChain)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">To:</span>
              <span className="detail-value">{bridgeService.getChainName(status.destinationChain)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className={`detail-value status-${status.status}`}>
                {bridgeService.getStatusText(status.status)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Estimated Time:</span>
              <span className="detail-value">{status.estimatedTimeRemaining}</span>
            </div>
          </div>
        </div>

        {status.sourceTxHash && (
          <div className="detail-section">
            <h3>Source Transaction</h3>
            <div className="transaction-info">
              <div className="tx-hash">
                <span>Hash: </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${status.sourceTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  {status.sourceTxHash}
                </a>
              </div>
              <div className="tx-status">
                <span className="status-indicator confirmed">✓</span>
                <span>Confirmed</span>
              </div>
            </div>
          </div>
        )}

        {status.destinationTxHash && (
          <div className="detail-section">
            <h3>Destination Transaction</h3>
            <div className="transaction-info">
              <div className="tx-hash">
                <span>Hash: </span>
                <a
                  href={`https://sepolia.mantlescan.xyz/tx/${status.destinationTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  {status.destinationTxHash}
                </a>
              </div>
              <div className="tx-status">
                <span className="status-indicator confirmed">✓</span>
                <span>Confirmed</span>
              </div>
            </div>
          </div>
        )}

        {status.bridgeData && (
          <div className="detail-section">
            <h3>Bridge Data</h3>
            <div className="bridge-metadata">
              <div className="detail-item">
                <span className="detail-label">Created:</span>
                <span className="detail-value">
                  {new Date(status.createdAt).toLocaleString()}
                </span>
              </div>
              {status.completedAt && (
                <div className="detail-item">
                  <span className="detail-label">Completed:</span>
                  <span className="detail-value">
                    {new Date(status.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStatusActions = () => {
    if (!status) return null;

    return (
      <div className="status-actions">
        <button
          onClick={handleRefresh}
          className="refresh-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="loading-spinner small"></div>
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>Refresh</span>
            </>
          )}
        </button>

        {status.status === 'completed' && (
          <button
            onClick={onBack}
            className="new-bridge-button"
          >
            <span>Start New Bridge</span>
          </button>
        )}

        {status.status === 'failed' && (
          <button
            onClick={onBack}
            className="retry-button"
          >
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  };

  if (loading && !status) {
    return (
      <div className="bridge-status-container">
        <div className="status-loading">
          <div className="loading-spinner"></div>
          <p>Loading bridge status...</p>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="bridge-status-container">
        <div className="status-error">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Load Status</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Try Again
          </button>
          <button onClick={onBack} className="back-button">
            Back to Bridge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bridge-status-container">
      <div className="status-header">
        <button onClick={onBack} className="back-button">
          ← Back to Bridge
        </button>
        <h2>Bridge Status</h2>
        <div className="status-badge">
          <span
            className={`status-indicator ${status?.status}`}
            style={{ backgroundColor: bridgeService.getStatusColor(status?.status) }}
          ></span>
          <span>{bridgeService.getStatusText(status?.status)}</span>
        </div>
      </div>

      {renderProgressBar()}
      {renderStatusDetails()}
      {renderStatusActions()}

      <div className="status-footer">
        <div className="help-text">
          <h4>What's happening?</h4>
          <p>
            {status?.status === 'initiated' &&
              'Your bridge transaction has been submitted and is being processed.'}
            {status?.status === 'processing' &&
              'The bridge is validating your transaction and preparing to transfer funds.'}
            {status?.status === 'challenge_period' &&
              'Your withdrawal is in the 7-day challenge period for security. You can claim your funds after this period.'}
            {status?.status === 'completed' &&
              'Your bridge transaction is complete! Funds have been delivered to the destination chain.'}
            {status?.status === 'failed' &&
              'The bridge transaction failed. Please try again or contact support.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BridgeStatus;