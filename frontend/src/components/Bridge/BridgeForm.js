import React, { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import bridgeService from '../../services/bridgeService';
import './BridgeForm.css';

const BridgeForm = ({ userAddress, supportedChains, userBalance, onBridgeInitiated, onError }) => {
  const chainId = useChainId();
  const [sourceChain, setSourceChain] = useState('ethereum-sepolia');
  const [destinationChain, setDestinationChain] = useState('mantle-sepolia');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('ETH');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minGasLimit, setMinGasLimit] = useState('200000');

  // Update chains when current chain changes
  useEffect(() => {
    if (chainId) {
      const chainMapping = {
        11155111: 'ethereum-sepolia',
        5003: 'mantle-sepolia'
      };

      const currentChainId = chainMapping[chainId];
      if (currentChainId) {
        setSourceChain(currentChainId);
        setDestinationChain(currentChainId === 'ethereum-sepolia' ? 'mantle-sepolia' : 'ethereum-sepolia');
      }
    }
  }, [chainId]);

  // Get quote when amount or chains change
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      getQuote();
    } else {
      setQuote(null);
    }
  }, [amount, sourceChain, destinationChain, token]);

  const getQuote = async () => {
    try {
      setQuoteLoading(true);
      const response = await bridgeService.getQuote(sourceChain, destinationChain, amount, token);
      setQuote(response.data);
    } catch (error) {
      console.error('Failed to get quote:', error);
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleChainSwap = () => {
    const temp = sourceChain;
    setSourceChain(destinationChain);
    setDestinationChain(temp);
  };

  const handleMaxClick = () => {
    if (userBalance) {
      // Reserve some ETH for gas fees
      const reservedGas = '0.01';
      const maxAmount = Math.max(0, parseFloat(userBalance.formatted) - parseFloat(reservedGas));
      setAmount(maxAmount.toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userAddress || !amount || parseFloat(amount) <= 0) {
      onError(new Error('Please enter a valid amount'));
      return;
    }

    try {
      setLoading(true);

      let result;
      if (destinationChain === 'mantle-sepolia') {
        result = await bridgeService.bridgeToMantle(
          userAddress,
          amount,
          token,
          parseInt(minGasLimit)
        );
      } else {
        result = await bridgeService.bridgeFromMantle(
          userAddress,
          amount,
          token,
          parseInt(minGasLimit)
        );
      }

      onBridgeInitiated(result.data);
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return amount && parseFloat(amount) > 0 && sourceChain !== destinationChain;
  };

  const getEstimatedTime = () => {
    if (destinationChain === 'mantle-sepolia') {
      return '10-15 minutes';
    } else {
      return '7 days (challenge period)';
    }
  };

  return (
    <div className="bridge-form-container">
      <form onSubmit={handleSubmit} className="bridge-form">
        <div className="form-section">
          <h3>From</h3>
          <div className="chain-selector">
            <select
              value={sourceChain}
              onChange={(e) => setSourceChain(e.target.value)}
              className="chain-select"
            >
              {supportedChains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
            <div className="chain-info">
              <img
                src={bridgeService.getChainIcon(
                  supportedChains.find(c => c.id === sourceChain)?.chainId
                )}
                alt="Source chain"
                className="chain-icon"
              />
              <span className="chain-name">
                {supportedChains.find(c => c.id === sourceChain)?.name}
              </span>
            </div>
          </div>
        </div>

        <div className="chain-swap">
          <button
            type="button"
            onClick={handleChainSwap}
            className="swap-button"
            title="Swap chains"
          >
            ↕️
          </button>
        </div>

        <div className="form-section">
          <h3>To</h3>
          <div className="chain-selector">
            <select
              value={destinationChain}
              onChange={(e) => setDestinationChain(e.target.value)}
              className="chain-select"
            >
              {supportedChains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
            <div className="chain-info">
              <img
                src={bridgeService.getChainIcon(
                  supportedChains.find(c => c.id === destinationChain)?.chainId
                )}
                alt="Destination chain"
                className="chain-icon"
              />
              <span className="chain-name">
                {supportedChains.find(c => c.id === destinationChain)?.name}
              </span>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Amount</h3>
          <div className="amount-input-container">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="amount-input"
              min="0"
              step="0.000001"
            />
            <div className="token-selector">
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="token-select"
              >
                <option value="ETH">ETH</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleMaxClick}
              className="max-button"
              disabled={!userBalance}
            >
              MAX
            </button>
          </div>

          {userBalance && (
            <div className="balance-info">
              <span>Balance: {parseFloat(userBalance.formatted).toFixed(6)} {userBalance.symbol}</span>
            </div>
          )}
        </div>

        {quote && (
          <div className="quote-section">
            <h3>Quote</h3>
            <div className="quote-details">
              <div className="quote-row">
                <span>You'll receive:</span>
                <span className="quote-amount">{amount} {token}</span>
              </div>
              <div className="quote-row">
                <span>Estimated fee:</span>
                <span className="quote-fee">{quote.estimatedFee} ETH</span>
              </div>
              <div className="quote-row">
                <span>Estimated time:</span>
                <span className="quote-time">{quote.estimatedTime}</span>
              </div>
              <div className="quote-row">
                <span>Route:</span>
                <span className="quote-route">{quote.route}</span>
              </div>
            </div>
          </div>
        )}

        {quoteLoading && (
          <div className="quote-loading">
            <div className="loading-spinner small"></div>
            <span>Getting quote...</span>
          </div>
        )}

        <div className="advanced-section">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="advanced-toggle"
          >
            Advanced Options {showAdvanced ? '▲' : '▼'}
          </button>

          {showAdvanced && (
            <div className="advanced-options">
              <div className="form-field">
                <label>Min Gas Limit</label>
                <input
                  type="number"
                  value={minGasLimit}
                  onChange={(e) => setMinGasLimit(e.target.value)}
                  className="gas-limit-input"
                  min="100000"
                  max="1000000"
                />
                <small>Minimum gas limit for the bridge transaction</small>
              </div>
            </div>
          )}
        </div>

        <div className="form-footer">
          <div className="estimated-time">
            <span>⏱️ Estimated time: {getEstimatedTime()}</span>
          </div>

          <button
            type="submit"
            disabled={!isFormValid() || loading}
            className={`submit-button ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <div className="loading-spinner small"></div>
                <span>Initiating Bridge...</span>
              </>
            ) : (
              <>
                <span>Bridge {amount || '0'} {token}</span>
                <span className="bridge-arrow">→</span>
              </>
            )}
          </button>
        </div>

        <div className="form-disclaimers">
          <p className="disclaimer">
            <strong>Important:</strong> Bridge transactions are irreversible. Please double-check all details before proceeding.
          </p>
          {destinationChain === 'ethereum-sepolia' && (
            <p className="disclaimer warning">
              <strong>Note:</strong> Withdrawals from Mantle have a 7-day challenge period for security.
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default BridgeForm;