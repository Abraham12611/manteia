import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppKitNetwork } from '@reown/appkit/react';
import { FiShare2, FiBookmark, FiTrendingUp, FiUsers, FiClock, FiArrowRight, FiExternalLink } from 'react-icons/fi';
import useContract from '../hooks/useContract';
import './MarketDetail.css';

const MarketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { chainId } = useAppKitNetwork();
  const {
    address,
    isConnected,
    getUserBalances,
    placeOrder,
    redeemWinnings,
    resolveMarket,
    isMarketResolved,
    getMarketOutcome,
    error: contractError,
    isLoading: contractLoading,
    clearError
  } = useContract();

  // Market state
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [userBalances, setUserBalances] = useState({ yes: 0, no: 0 });
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Trading state
  const [activeTab, setActiveTab] = useState('buy');
  const [selectedOutcome, setSelectedOutcome] = useState('yes');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderType, setOrderType] = useState('market');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [claimableWinnings, setClaimableWinnings] = useState(0);
  const [transactionStatus, setTransactionStatus] = useState('');

  // Mock market data - replace with API call
  useEffect(() => {
    const fetchMarket = async () => {
      setLoading(true);

      // Mock data based on the market ID
      const mockMarket = {
        id: id,
        question: 'Will GPT-5 be released before the end of 2025?',
        description: 'This market will resolve to "Yes" if OpenAI officially releases GPT-5 before January 1, 2026, 00:00 UTC. The release must be publicly announced and accessible to users.',
        category: 'Tech',
        probability: 73,
        volume: 5234000,
        timePeriod: 'Monthly',
        endDate: '2025-12-31',
        creator: '0x1234...5678',
        resolutionSource: 'OpenAI official announcements',
        supportedChains: [
          { id: 'mantle', name: 'Mantle' },
          { id: 'base', name: 'Base' },
          { id: 'ethereum', name: 'Ethereum' }
        ],
        isResolved: false,
        outcome: null,
        totalValue: 8500000
      };

      // Mock order book
      const mockOrderBook = {
        bids: [
          { price: 0.72, amount: 1250, total: 900 },
          { price: 0.71, amount: 2100, total: 1491 },
          { price: 0.70, amount: 1800, total: 1260 },
          { price: 0.69, amount: 2400, total: 1656 },
          { price: 0.68, amount: 1900, total: 1292 }
        ],
        asks: [
          { price: 0.74, amount: 1100, total: 814 },
          { price: 0.75, amount: 1600, total: 1200 },
          { price: 0.76, amount: 2200, total: 1672 },
          { price: 0.77, amount: 1750, total: 1347.5 },
          { price: 0.78, amount: 1400, total: 1092 }
        ]
      };

      setMarket(mockMarket);
      setOrderBook(mockOrderBook);
      setOrderPrice((mockOrderBook.bids[0]?.price || 0.5).toString());
      setLoading(false);
    };

    fetchMarket();
  }, [id]);

  // Fetch user balances when connected
  useEffect(() => {
    const fetchUserBalances = async () => {
      if (!isConnected || !address || !market) return;

      try {
        const marketId = parseInt(id);
        const balances = await getUserBalances(marketId);

        setUserBalances({
          yes: balances.yes,
          no: balances.no
        });

        // Check if user has claimable winnings (if market is resolved)
        if (market.isResolved) {
          const winningBalance = market.outcome === 'yes' ? balances.yes : balances.no;
          setClaimableWinnings(winningBalance);
        }
      } catch (error) {
        console.error('Error fetching user balances:', error);
      }
    };

    fetchUserBalances();
  }, [isConnected, address, market, id, getUserBalances]);

    const handlePlaceOrder = async () => {
    if (!isConnected || !address || !market) {
      alert('Please connect your wallet first');
      return;
    }

    if (!orderAmount || !orderPrice) {
      alert('Please enter both amount and price');
      return;
    }

    setSubmittingOrder(true);
    setTransactionStatus('Preparing transaction...');
    clearError();

    try {
      const marketId = parseInt(id);
      const isBuy = activeTab === 'buy';

      console.log('Placing order:', {
        marketId,
        price: orderPrice,
        amount: orderAmount,
        isBuy,
        outcome: selectedOutcome
      });

      setTransactionStatus('Submitting transaction...');

      const result = await placeOrder(marketId, orderPrice, orderAmount, isBuy);

      console.log('Transaction submitted:', result.transactionHash);
      setTransactionStatus('Transaction confirmed!');

      // Clear form
      setOrderAmount('');
      setOrderPrice('');

      // Refresh balances after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error placing order:', error);
      setTransactionStatus('Transaction failed');

      // Error is handled by the contract hook
      // We can show it in the UI
    } finally {
      setSubmittingOrder(false);

      // Clear status after a delay
      setTimeout(() => {
        setTransactionStatus('');
      }, 5000);
    }
  };

  const handleResolveMarket = async (outcome) => {
    if (!isConnected || !address || !market) {
      alert('Cannot resolve market at this time');
      return;
    }

    try {
      setTransactionStatus('Resolving market...');
      clearError();

      const marketId = parseInt(id);

      console.log('Resolving market:', marketId, 'to outcome:', outcome);

      const result = await resolveMarket(marketId, outcome);

      console.log('Resolution result:', result);
      setTransactionStatus('Market resolved successfully!');

      // Update market state
      setMarket({
        ...market,
        isResolved: true,
        outcome: outcome
      });

      // Refresh balances after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error resolving market:', error);
      setTransactionStatus('Resolution failed');

      // Error is handled by the contract hook
    } finally {
      // Clear status after a delay
      setTimeout(() => {
        setTransactionStatus('');
      }, 5000);
    }
  };

  const handleClaimWinnings = async () => {
    if (!isConnected || !address || !market || !market.isResolved) {
      alert('Cannot claim winnings at this time');
      return;
    }

    try {
      setTransactionStatus('Preparing claim...');
      clearError();

      const marketId = parseInt(id);
      const winningBalance = market.outcome === 'yes' ? userBalances.yes : userBalances.no;

      if (parseFloat(winningBalance) === 0) {
        alert('No winnings to claim');
        return;
      }

      console.log('Claiming winnings for market:', marketId);
      console.log('Winning outcome:', market.outcome);
      console.log('Winning balance:', winningBalance);

      setTransactionStatus('Claiming winnings...');

      const result = await redeemWinnings(marketId, market.outcome);

      console.log('Claim result:', result);
      setTransactionStatus('Winnings claimed successfully!');

      // Refresh balances after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error claiming winnings:', error);
      setTransactionStatus('Claim failed');

      // Error is handled by the contract hook
    } finally {
      // Clear status after a delay
      setTimeout(() => {
        setTransactionStatus('');
      }, 5000);
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

  const formatPercentage = (value) => {
    return `${value}%`;
  };

  if (loading) {
    return (
      <div className="market-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading market details...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="market-detail-error">
        <h2>Market not found</h2>
        <button onClick={() => navigate('/markets')}>Back to Markets</button>
      </div>
    );
  }

  return (
    <div className="market-detail">
      {/* Market Header */}
      <div className="market-header">
        <div className="market-header-content">
          <div className="market-info">
            <div className="market-category">
              <span className="category-badge">{market.category}</span>
              <div className="chain-indicators">
                {market.supportedChains.map((chain) => (
                  <div key={chain.id} className="chain-indicator">
                    <span className="chain-name">{chain.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <h1 className="market-title">{market.question}</h1>
            <div className="market-meta">
              <div className="meta-item">
                <FiTrendingUp />
                <span>{formatCurrency(market.volume)} Vol.</span>
              </div>
              <div className="meta-item">
                <FiUsers />
                <span>{market.timePeriod}</span>
              </div>
              <div className="meta-item">
                <FiClock />
                <span>Ends {market.endDate}</span>
              </div>
            </div>
          </div>
          <div className="market-actions">
            <button
              className={`bookmark-btn ${isBookmarked ? 'active' : ''}`}
              onClick={() => setIsBookmarked(!isBookmarked)}
            >
              <FiBookmark />
            </button>
            <button className="share-btn">
              <FiShare2 />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="market-content">
        {/* Chart and Order Book Section */}
        <div className="chart-section">
          <div className="probability-display">
            <div className="probability-card yes-card">
              <h3>Yes</h3>
              <div className="probability-value">{formatPercentage(market.probability)}</div>
              <div className="probability-change">+2.3%</div>
            </div>
            <div className="probability-card no-card">
              <h3>No</h3>
              <div className="probability-value">{formatPercentage(100 - market.probability)}</div>
              <div className="probability-change">-2.3%</div>
            </div>
          </div>

          {/* Order Book */}
          <div className="order-book">
            <h3>Order Book</h3>
            <div className="order-book-content">
              <div className="order-book-side">
                <div className="side-header">
                  <span>Buy Orders (Bids)</span>
                </div>
                <div className="order-book-header">
                  <span>Price</span>
                  <span>Amount</span>
                  <span>Total</span>
                </div>
                {orderBook.bids.map((order, index) => (
                  <div key={index} className="order-row bid-row">
                    <span className="order-price">${order.price.toFixed(2)}</span>
                    <span className="order-amount">{order.amount}</span>
                    <span className="order-total">${order.total}</span>
                  </div>
                ))}
              </div>
              <div className="order-book-side">
                <div className="side-header">
                  <span>Sell Orders (Asks)</span>
                </div>
                <div className="order-book-header">
                  <span>Price</span>
                  <span>Amount</span>
                  <span>Total</span>
                </div>
                {orderBook.asks.map((order, index) => (
                  <div key={index} className="order-row ask-row">
                    <span className="order-price">${order.price.toFixed(2)}</span>
                    <span className="order-amount">{order.amount}</span>
                    <span className="order-total">${order.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trading Panel */}
        <div className="trading-panel">
          {/* User Balances */}
          {isConnected && (
            <div className="user-balances">
              <h3>Your Positions</h3>
              <div className="balance-item">
                <span>YES tokens:</span>
                <span>{parseFloat(userBalances.yes).toFixed(4)}</span>
              </div>
              <div className="balance-item">
                <span>NO tokens:</span>
                <span>{parseFloat(userBalances.no).toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* Resolve Market Section (for testing) */}
          {!market.isResolved && isConnected && (
            <div className="resolve-section">
              <h3>Resolve Market (Testing)</h3>
              <p>For MVP testing purposes only</p>
              <div className="resolve-buttons">
                <button
                  className="resolve-btn yes-resolve"
                  onClick={() => handleResolveMarket('yes')}
                  disabled={contractLoading}
                >
                  Resolve to YES
                </button>
                <button
                  className="resolve-btn no-resolve"
                  onClick={() => handleResolveMarket('no')}
                  disabled={contractLoading}
                >
                  Resolve to NO
                </button>
              </div>
            </div>
          )}

          {/* Claim Winnings Section */}
          {market.isResolved && claimableWinnings > 0 && (
            <div className="claim-section">
              <h3>Claim Winnings</h3>
              <p>Market resolved: {market.outcome === 'yes' ? 'YES' : 'NO'}</p>
              <p>Claimable: {claimableWinnings} tokens</p>
              <button className="claim-btn" onClick={handleClaimWinnings}>
                Claim Winnings
              </button>
            </div>
          )}

          {/* Trading Interface */}
          {!market.isResolved && (
            <div className="trading-interface">
              <div className="trading-tabs">
                <button
                  className={`tab-btn ${activeTab === 'buy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('buy')}
                >
                  Buy
                </button>
                <button
                  className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sell')}
                >
                  Sell
                </button>
              </div>

              <div className="outcome-selector">
                <button
                  className={`outcome-btn yes-btn ${selectedOutcome === 'yes' ? 'active' : ''}`}
                  onClick={() => setSelectedOutcome('yes')}
                >
                  YES ({formatPercentage(market.probability)})
                </button>
                <button
                  className={`outcome-btn no-btn ${selectedOutcome === 'no' ? 'active' : ''}`}
                  onClick={() => setSelectedOutcome('no')}
                >
                  NO ({formatPercentage(100 - market.probability)})
                </button>
              </div>

              <div className="order-form">
                <div className="order-type-selector">
                  <button
                    className={`order-type-btn ${orderType === 'market' ? 'active' : ''}`}
                    onClick={() => setOrderType('market')}
                  >
                    Market
                  </button>
                  <button
                    className={`order-type-btn ${orderType === 'limit' ? 'active' : ''}`}
                    onClick={() => setOrderType('limit')}
                  >
                    Limit
                  </button>
                </div>

                <div className="input-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="input-group">
                  <label>Price</label>
                  <input
                    type="number"
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>

                <div className="order-summary">
                  <div className="summary-row">
                    <span>Total Cost:</span>
                    <span>${(parseFloat(orderAmount || 0) * parseFloat(orderPrice || 0)).toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Potential Payout:</span>
                    <span>${(parseFloat(orderAmount || 0) * 1).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  className="place-order-btn"
                  onClick={handlePlaceOrder}
                  disabled={submittingOrder || contractLoading || !isConnected || !orderAmount || !orderPrice}
                >
                  {submittingOrder ? 'Placing Order...' : `${activeTab === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome.toUpperCase()}`}
                </button>

                {/* Transaction Status */}
                {transactionStatus && (
                  <div className={`transaction-status ${transactionStatus.includes('failed') ? 'error' : 'success'}`}>
                    {transactionStatus}
                  </div>
                )}

                {/* Contract Error */}
                {contractError && (
                  <div className="contract-error">
                    <p>{contractError}</p>
                    <button onClick={clearError} className="clear-error-btn">Dismiss</button>
                  </div>
                )}

                {!isConnected && (
                  <div className="connect-wallet-prompt">
                    <p>Connect your wallet to trade</p>
                    <w3m-button />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Market Details */}
      <div className="market-details">
        <div className="details-section">
          <h3>Market Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Description:</span>
              <span className="detail-value">{market.description}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Creator:</span>
              <span className="detail-value">{market.creator}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Resolution Source:</span>
              <span className="detail-value">{market.resolutionSource}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Total Value:</span>
              <span className="detail-value">{formatCurrency(market.totalValue)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">End Date:</span>
              <span className="detail-value">{market.endDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDetail;