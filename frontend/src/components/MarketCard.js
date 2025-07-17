import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookmark, FiShare2, FiMoreHorizontal, FiRefreshCw } from 'react-icons/fi';
import { BsArrowUpRight, BsArrowDownRight } from 'react-icons/bs';
import clsx from 'clsx';
import './MarketCard.css';

const MarketCard = ({
  market,
  featured = false,
  onBookmark,
  onShare
}) => {
  const [isBookmarked, setIsBookmarked] = useState(market.isBookmarked || false);
  const [isHovered, setIsHovered] = useState(false);

  const handleBookmark = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    onBookmark?.(market.id, !isBookmarked);
  };

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onShare?.(market);
  };

  const getCategoryColor = (category) => {
    const colors = {
      politics: '#dc2626',
      sports: '#059669',
      crypto: '#7c3aed',
      tech: '#0891b2',
      culture: '#ea580c',
      world: '#3b82f6',
      economy: '#84cc16',
      elections: '#ec4899'
    };
    return colors[category.toLowerCase()] || '#6366f1';
  };

  const formatVolume = (volume) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}m`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(0)}k`;
    }
    return `$${volume}`;
  };

  return (
    <Link
      to={`/market/${market.id}`}
      className={clsx('market-card', {
        'featured': featured,
        'hovered': isHovered
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Section */}
      <div className="card-header">
        {/* Category Badge */}
        <div
          className="category-badge"
          style={{
            backgroundColor: `${getCategoryColor(market.category)}20`,
            color: getCategoryColor(market.category)
          }}
        >
          {market.category}
        </div>

        {/* Chain Indicators */}
        <div className="chain-indicators">
          {market.supportedChains?.map((chain, index) => (
            <div
              key={chain.id}
              className="chain-icon-wrapper"
              style={{ zIndex: market.supportedChains.length - index }}
            >
              <img
                src={`/chains/${chain.id}.svg`}
                alt={chain.name}
                className="chain-icon-img"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          ))}
        </div>

        {/* Bookmark Icon */}
        <button
          className={clsx('bookmark-btn', { 'active': isBookmarked })}
          onClick={handleBookmark}
        >
          <FiBookmark />
        </button>
      </div>

      {/* Title Section */}
      <h3 className="card-title">
        {market.question}
      </h3>

      {/* Probability Display */}
      <div className="probability-container">
        <div className="probability-ring">
          <svg className="probability-svg" viewBox="0 0 80 80">
            <defs>
              <linearGradient id={`probability-gradient-${market.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#00d4ff', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <circle
              className="probability-bg"
              cx="40"
              cy="40"
              r="36"
              strokeWidth="4"
            />
            <circle
              className="probability-fill"
              cx="40"
              cy="40"
              r="36"
              strokeWidth="4"
              stroke={`url(#probability-gradient-${market.id})`}
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - market.probability / 100)}`}
            />
          </svg>
          <div className="probability-text">
            <span className="probability-value">{market.probability}%</span>
            <span className="probability-label">chance</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="buy-yes-btn">
          Buy Yes <BsArrowUpRight />
        </button>
        <button className="buy-no-btn">
          Buy No <BsArrowDownRight />
        </button>
      </div>

      {/* Footer Section */}
      <div className="card-footer">
        <div className="volume-display">
          <FiRefreshCw className="volume-icon" />
          <span>{formatVolume(market.volume)} Vol.</span>
        </div>
        <div className="time-period">
          {market.timePeriod}
        </div>
        <div className="action-icons">
          <button
            className="icon-btn"
            onClick={handleShare}
          >
            <FiShare2 />
          </button>
          <button className="icon-btn">
            <FiMoreHorizontal />
          </button>
        </div>
      </div>
    </Link>
  );
};

export default MarketCard;