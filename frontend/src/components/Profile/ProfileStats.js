import React from 'react';
import profileService from '../../services/profileService';
import './ProfileStats.css';

const ProfileStats = ({ statistics, isOwnProfile }) => {
  const {
    positionsValue,
    profitLoss,
    totalVolume,
    marketsTraded,
    winRate,
    totalBridges,
    bridgeSuccessRate,
    activePositions,
    tradingStreak
  } = statistics;

  const formatProfitLoss = (value) => {
    const formatted = profileService.formatCurrency(value);
    const isPositive = value > 0;
    const isNegative = value < 0;

    return {
      value: formatted,
      className: isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'
    };
  };

  const profitLossFormatted = formatProfitLoss(profitLoss);

  return (
    <div className="profile-stats">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <div className="icon-circle">
              <span className="icon">📈</span>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-label">Positions value</div>
            <div className="stat-value">
              {profileService.formatCurrency(positionsValue)}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <div className="icon-circle">
              <span className="icon">💹</span>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-label">Profit/loss</div>
            <div className={`stat-value ${profitLossFormatted.className}`}>
              {profitLossFormatted.value}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <div className="icon-circle">
              <span className="icon">📊</span>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-label">Volume traded</div>
            <div className="stat-value">
              {profileService.formatVolume(totalVolume)}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <div className="icon-circle">
              <span className="icon">🎯</span>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-label">Markets traded</div>
            <div className="stat-value">
              {marketsTraded}
            </div>
          </div>
        </div>
      </div>

      <div className="secondary-stats">
        <div className="secondary-stat">
          <span className="secondary-label">Win Rate:</span>
          <span className="secondary-value">{profileService.formatPercentage(winRate)}</span>
        </div>

        <div className="secondary-stat">
          <span className="secondary-label">Active Positions:</span>
          <span className="secondary-value">{activePositions}</span>
        </div>

        <div className="secondary-stat">
          <span className="secondary-label">Trading Streak:</span>
          <span className="secondary-value">{tradingStreak} days</span>
        </div>

        <div className="secondary-stat">
          <span className="secondary-label">Bridge Success:</span>
          <span className="secondary-value">{profileService.formatPercentage(bridgeSuccessRate)}</span>
        </div>
      </div>

      {isOwnProfile && (
        <div className="stats-brand">
          <span className="brand-logo">M</span>
          <span className="brand-text">Manteia</span>
        </div>
      )}
    </div>
  );
};

export default ProfileStats;