import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppKitNetwork } from '@reown/appkit/react';
import { FiShare2, FiBookmark, FiTrendingUp, FiUsers, FiClock, FiArrowRight, FiExternalLink } from 'react-icons/fi';
import useContract from '../hooks/useContract';
import backendService from '../services/backendService';
import tradingService from '../services/tradingService';
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
    getMarketOrderBook,
    getMarketPrice,
    getUserPositions,
    getMNTBalance,
    error: contractError,
    isLoading: contractLoading,
    clearError,
    calculateOrderCost,
    calculatePotentialPayout
  } = useContract();

  // Market state
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [userBalances, setUserBalances] = useState({ yes: 0, no: 0 });
  const [userPositions, setUserPositions] = useState([]);
  const [mntBalance, setMntBalance] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [marketPrice, setMarketPrice] = useState(0.5); // Default to 50/50 odds

  // Trading state
  const [activeTab, setActiveTab] = useState('buy');
  const [selectedOutcome, setSelectedOutcome] = useState('yes');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderType, setOrderType] = useState('market');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [claimableWinnings, setClaimableWinnings] = useState(0);
  const [transactionStatus, setTransactionStatus] = useState('');

  // Load market data
  useEffect(() => {
    const fetchMarket = async () => {
      setLoading(true);
      try {
        // Get market data from backend
        const marketResponse = await backendService.getMarketById(id);
        if (marketResponse.success) {
          setMarket(marketResponse.data);
        } else {
          console.error('Failed to load market:', marketResponse.error);
          setMarket(null);
        }
      } catch (error) {
        console.error('Error fetching market:', error);
        setMarket(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMarket();
    }
  }, [id]);

  // Load market price when contract is initialized
  useEffect(() => {
    const fetchMarketPrice = async () => {
      if (!market || !id) return;

      try {
        const price = await getMarketPrice(id);
        setMarketPrice(price);
      } catch (error) {
        console.error('Error fetching market price:', error);
        // Keep default price of 0.5 if fetch fails
      }
    };

    if (market && id) {
      fetchMarketPrice();
    }
  }, [market, id, getMarketPrice]);

  // Load order book
  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!market) return;

      try {
        const orderBookData = await getMarketOrderBook(market.id);
        setOrderBook(orderBookData);

        // Set default price to best bid/ask
        if (orderBookData.bids && orderBookData.bids.length > 0) {
          setOrderPrice(orderBookData.bids[0].price.toString());
        } else if (orderBookData.asks && orderBookData.asks.length > 0) {
          setOrderPrice(orderBookData.asks[0].price.toString());
        } else {
          setOrderPrice('0.5'); // Default to 50/50 odds
        }
      } catch (error) {
        console.error('Error fetching order book:', error);
        // Use empty order book
        setOrderBook({ bids: [], asks: [] });
      }
    };

    fetchOrderBook();

    // Set up real-time updates
    const interval = setInterval(fetchOrderBook, 5000);
    return () => clearInterval(interval);
  }, [market, getMarketOrderBook]);

  // Load user data when connected
  useEffect(() => {
    const fetchUserData = async () => {
      if (!isConnected || !address || !market) return;

      try {
        // Get user balances
        const balances = await getUserBalances(market.id);
        setUserBalances({
          yes: balances.yes,
          no: balances.no
        });

        // Get user positions
        const positions = await getUserPositions(market.id);
        setUserPositions(positions);

        // Get MNT balance
        const mntBal = await getMNTBalance();
        setMntBalance(parseFloat(mntBal));

        // Calculate claimable winnings if market is resolved
        if (market.isResolved) {
          const winningBalance = market.outcome === 'yes' ?
            parseFloat(balances.yes) : parseFloat(balances.no);
          setClaimableWinnings(winningBalance);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [isConnected, address, market, getUserBalances, getUserPositions, getMNTBalance]);

  const handlePlaceOrder = async () => {
    if (!isConnected || !address || !market) {
      alert('Please connect your wallet first');
      return;
    }

    if (!orderAmount || !orderPrice) {
      alert('Please enter both amount and price');
      return;
    }

    const amount = parseFloat(orderAmount);
    const price = parseFloat(orderPrice);

    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    if (price <= 0 || price > 1) {
      alert('Price must be between 0 and 1');
      return;
    }

    const orderCost = calculateOrderCost(price, amount);
    if (orderCost > mntBalance) {
      alert(`Insufficient MNT balance. Required: ${orderCost.toFixed(4)} MNT, Available: ${mntBalance.toFixed(4)} MNT`);
      return;
    }

    setSubmittingOrder(true);
    setTransactionStatus('Preparing transaction...');
    clearError();

    try {
      const outcome = selectedOutcome === 'yes';

      console.log('Placing order:', {
        marketId: market.id,
        outcome,
        price,
        amount,
        orderType
      });

      setTransactionStatus('Submitting transaction...');

      const result = await placeOrder(market.id, outcome, price, amount, orderType);

      console.log('Order submitted:', result);
      setTransactionStatus('Transaction confirmed!');

      // Clear form
      setOrderAmount('');
      setOrderPrice('');

      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error placing order:', error);
      setTransactionStatus('Transaction failed');
    } finally {
      setSubmittingOrder(false);

      // Clear status after delay
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

      const result = await resolveMarket(market.id, outcome === 'yes');

      console.log('Resolution result:', result);
      setTransactionStatus('Market resolved successfully!');

      // Update market state
      setMarket({
        ...market,
        isResolved: true,
        outcome: outcome
      });

      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error resolving market:', error);
      setTransactionStatus('Resolution failed');
    } finally {
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

      const winningBalance = market.outcome === 'yes' ?
        parseFloat(userBalances.yes) : parseFloat(userBalances.no);

      if (winningBalance === 0) {
        alert('No winnings to claim');
        return;
      }

      setTransactionStatus('Claiming winnings...');

      const result = await redeemWinnings(market.id, market.outcome === 'yes');

      console.log('Claim result:', result);
      setTransactionStatus('Winnings claimed successfully!');

      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error claiming winnings:', error);
      setTransactionStatus('Claim failed');
    } finally {
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

  const formatMNT = (amount) => {
    return `${parseFloat(amount).toFixed(4)} MNT`;
  };

  const formatPercentage = (value) => {
    return `${value}%`;
  };

  const calculateSpread = () => {
    if (!orderBook.asks.length || !orderBook.bids.length) {
      return '0.00';
    }

    const bestAsk = orderBook.asks[0].price;
    const bestBid = orderBook.bids[0].price;

    return (bestAsk - bestBid).toFixed(2);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading market details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="error-container">
        <p>Market not found</p>
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
                <div className="chain-indicator">
                  <span className="chain-name">Mantle</span>
                </div>
              </div>
            </div>
            <h1 className="market-title">{market.title}</h1>
            <div className="market-meta">
              <div className="meta-item">
                <FiTrendingUp />
                <span>{formatCurrency(market.totalVolume || 0)} Vol.</span>
              </div>
              <div className="meta-item">
                <FiUsers />
                <span>{market.totalOrders || 0} Orders</span>
              </div>
              <div className="meta-item">
                <FiClock />
                <span>Ends {new Date(market.endDate).toLocaleDateString()}</span>
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
              <div className="probability-value">{formatPercentage(Math.round(marketPrice * 100))}</div>
              <div className="probability-change">
                {formatMNT(marketPrice)}
              </div>
            </div>
            <div className="probability-card no-card">
              <h3>No</h3>
              <div className="probability-value">{formatPercentage(Math.round((1 - marketPrice) * 100))}</div>
              <div className="probability-change">
                {formatMNT(1 - marketPrice)}
              </div>
            </div>
          </div>

          {/* Order Book */}
          <div className="order-book">
            <h3>Order Book</h3>
            <div className="order-book-content">
              <div className="order-book-side">
                <div className="side-header">
                  <span>Sell Orders (Asks)</span>
                </div>
                <div className="order-book-header">
                  <span>Price</span>
                  <span>Size</span>
                  <span>Total</span>
                </div>
                {orderBook.asks.map((order, index) => (
                  <div key={index} className="order-row ask-row">
                    <span className="order-price">{formatMNT(order.price)}</span>
                    <span className="order-size">{order.size}</span>
                    <span className="order-total">{formatMNT(order.price * order.size)}</span>
                  </div>
                ))}
              </div>

              <div className="market-price-display">
                <span>Market Price: {formatMNT(marketPrice)}</span>
                <span>Spread: {formatMNT(calculateSpread())}</span>
              </div>

              <div className="order-book-side">
                <div className="side-header">
                  <span>Buy Orders (Bids)</span>
                </div>
                <div className="order-book-header">
                  <span>Price</span>
                  <span>Size</span>
                  <span>Total</span>
                </div>
                {orderBook.bids.map((order, index) => (
                  <div key={index} className="order-row bid-row">
                    <span className="order-price">{formatMNT(order.price)}</span>
                    <span className="order-size">{order.size}</span>
                    <span className="order-total">{formatMNT(order.price * order.size)}</span>
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
              <h3>Your Account</h3>
              <div className="balance-item">
                <span>MNT Balance:</span>
                <span>{formatMNT(mntBalance)}</span>
              </div>
              <div className="balance-item">
                <span>YES shares:</span>
                <span>{parseFloat(userBalances.yes).toFixed(4)}</span>
              </div>
              <div className="balance-item">
                <span>NO shares:</span>
                <span>{parseFloat(userBalances.no).toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* Resolve Market Section (for testing) */}
          {/* COMMENTED OUT - Resolve Market Testing UI
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
          */}

          {/* Claim Winnings Section */}
          {market.isResolved && claimableWinnings > 0 && (
            <div className="claim-section">
              <h3>Claim Winnings</h3>
              <p>Market resolved: {market.outcome === 'yes' ? 'YES' : 'NO'}</p>
              <p>Claimable: {claimableWinnings.toFixed(4)} shares</p>
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
                  YES ({formatPercentage(Math.round(marketPrice * 100))})
                </button>
                <button
                  className={`outcome-btn no-btn ${selectedOutcome === 'no' ? 'active' : ''}`}
                  onClick={() => setSelectedOutcome('no')}
                >
                  NO ({formatPercentage(Math.round((1 - marketPrice) * 100))})
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
                  <label>Size (Shares)</label>
                  <input
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="0"
                    step="1"
                    min="1"
                  />
                </div>

                <div className="input-group">
                  <label>Price (MNT per share)</label>
                  <input
                    type="number"
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    max="0.99"
                  />
                </div>

                <div className="order-summary">
                  <div className="summary-row">
                    <span>Total Cost:</span>
                    <span>{formatMNT(calculateOrderCost(orderPrice || 0, orderAmount || 0))}</span>
                  </div>
                  <div className="summary-row">
                    <span>Potential Payout:</span>
                    <span>{formatMNT(calculatePotentialPayout(orderAmount || 0, orderPrice || 0))}</span>
                  </div>
                  <div className="summary-row">
                    <span>Potential Profit:</span>
                    <span>{formatMNT(calculatePotentialPayout(orderAmount || 0, orderPrice || 0) - calculateOrderCost(orderPrice || 0, orderAmount || 0))}</span>
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
              <span className="detail-label">Category:</span>
              <span className="detail-value">{market.category}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Resolution Criteria:</span>
              <span className="detail-value">{market.resolutionCriteria}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Resolution Source:</span>
              <span className="detail-value">{market.resolutionSource}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">End Date:</span>
              <span className="detail-value">{new Date(market.endDate).toLocaleDateString()}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className="detail-value">{market.isResolved ? 'Resolved' : 'Active'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDetail;