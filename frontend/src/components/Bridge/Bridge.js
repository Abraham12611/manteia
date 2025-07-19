import React, { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import bridgeService from '../../services/bridgeService';
import BridgeForm from './BridgeForm';
import BridgeStatus from './BridgeStatus';
import BridgeHistory from './BridgeHistory';
import './Bridge.css';

const Bridge = () => {
  const { address: userAddress, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('bridge');
  const [bridgeData, setBridgeData] = useState(null);
  const [supportedChains, setSupportedChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bridgeStats, setBridgeStats] = useState(null);

  // Get user's ETH balance
  const { data: ethBalance } = useBalance({
    address: userAddress,
    enabled: isConnected,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load supported chains
      const chainsResponse = await bridgeService.getSupportedChains();
      setSupportedChains(chainsResponse.data.chains);

      // Load bridge statistics
      const statsResponse = await bridgeService.getBridgeStats();
      setBridgeStats(statsResponse.data);

    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBridgeInitiated = (bridgeResult) => {
    setBridgeData(bridgeResult);
    setActiveTab('status');
  };

  const handleBridgeError = (error) => {
    setError(error.message);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bridge':
        return (
          <BridgeForm
            userAddress={userAddress}
            supportedChains={supportedChains}
            userBalance={ethBalance}
            onBridgeInitiated={handleBridgeInitiated}
            onError={handleBridgeError}
          />
        );
      case 'status':
        return (
          <BridgeStatus
            bridgeData={bridgeData}
            onBack={() => setActiveTab('bridge')}
          />
        );
      case 'history':
        return (
          <BridgeHistory
            userAddress={userAddress}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bridge-container">
        <div className="bridge-loading">
          <div className="loading-spinner"></div>
          <p>Loading bridge data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bridge-container">
      <div className="bridge-header">
        <h1>Cross-Chain Bridge</h1>
        <p>Bridge assets between Ethereum Sepolia and Mantle Sepolia</p>

        {bridgeStats && (
          <div className="bridge-stats">
            <div className="stat-item">
              <span className="stat-label">Total Bridges</span>
              <span className="stat-value">{bridgeStats.totalBridges}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Success Rate</span>
              <span className="stat-value">{bridgeStats.successRate}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Volume</span>
              <span className="stat-value">{bridgeService.formatAmount(bridgeStats.totalVolume)} ETH</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bridge-error">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="error-dismiss">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="bridge-connect-wallet">
          <div className="connect-wallet-content">
            <h3>Connect Your Wallet</h3>
            <p>Please connect your wallet to use the bridge</p>
          </div>
        </div>
      )}

      {isConnected && (
        <>
          <div className="bridge-tabs">
            <button
              className={`tab-button ${activeTab === 'bridge' ? 'active' : ''}`}
              onClick={() => setActiveTab('bridge')}
            >
              Bridge
            </button>
            <button
              className={`tab-button ${activeTab === 'status' ? 'active' : ''}`}
              onClick={() => setActiveTab('status')}
              disabled={!bridgeData}
            >
              Status
            </button>
            <button
              className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>

          <div className="bridge-content">
            {renderTabContent()}
          </div>
        </>
      )}

      <div className="bridge-footer">
        <div className="supported-chains">
          <h3>Supported Chains</h3>
          <div className="chain-list">
            {supportedChains.map((chain) => (
              <div key={chain.id} className="chain-item">
                <img
                  src={bridgeService.getChainIcon(chain.chainId)}
                  alt={chain.name}
                  className="chain-icon"
                />
                <span className="chain-name">{chain.name}</span>
                <span className="chain-id">({chain.chainId})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bridge-info">
          <h3>How It Works</h3>
          <ol>
            <li>Select source and destination chains</li>
            <li>Enter the amount you want to bridge</li>
            <li>Review the quote and confirm the transaction</li>
            <li>Wait for the bridge to complete (10-15 minutes to Mantle, 7 days from Mantle)</li>
            <li>Receive your funds on the destination chain</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Bridge;