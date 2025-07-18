import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter } from 'react-icons/fi';
import MarketCard from '../components/MarketCard';
import backendService from '../services/backendService';
import './Markets.css';

const filterOptions = [
  'All',
  'Breaking News',
  'Politics',
  'Sports',
  'Crypto',
  'Tech',
  'Culture',
  'World',
  'Economy',
  'Elections'
];

const Markets = () => {
  const [searchParams] = useSearchParams();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const category = searchParams.get('category');

  useEffect(() => {
    loadMarkets();
  }, [category, activeFilter]);

  const loadMarkets = async () => {
    setLoading(true);
    setError('');

    try {
      const filters = {};

      // Add category filter
      if (category && category !== 'all') {
        filters.category = category;
      }

      // Add active filter
      if (activeFilter !== 'All') {
        filters.category = activeFilter.toLowerCase();
      }

      // Add pagination
      filters.limit = 20;
      filters.offset = 0;

      const response = await backendService.getMarkets(filters);

      if (response.success) {
        setMarkets(response.data.markets || []);
      } else {
        setError(response.error || 'Failed to load markets');
        setMarkets([]);
      }
    } catch (err) {
      console.error('Error loading markets:', err);
      setError('Failed to load markets. Please try again.');
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async (marketId, isBookmarked) => {
    console.log(`Market ${marketId} bookmarked: ${isBookmarked}`);
    // TODO: Implement bookmark functionality with backend
  };

  const handleShare = (market) => {
    console.log(`Sharing market: ${market.title}`);

    // Create share URL
    const shareUrl = `${window.location.origin}/market/${market.id}`;

    // Use native sharing if available
    if (navigator.share) {
      navigator.share({
        title: market.title,
        text: market.description,
        url: shareUrl
      }).catch(err => {
        console.error('Error sharing:', err);
        fallbackShare(shareUrl);
      });
    } else {
      fallbackShare(shareUrl);
    }
  };

  const fallbackShare = (url) => {
    // Copy to clipboard as fallback
    navigator.clipboard.writeText(url).then(() => {
      alert('Market URL copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy URL:', err);
    });
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const formatMarketForCard = (market) => {
    return {
      id: market.id,
      question: market.title,
      category: market.category,
      probability: Math.round((market.currentPrice || 0.5) * 100),
      volume: market.totalVolume || 0,
      timePeriod: getTimePeriod(market.endDate),
      supportedChains: [
        { id: 'mantle', name: 'Mantle' }
      ],
      isBookmarked: false, // TODO: Get from user preferences
      featured: market.featured || false
    };
  };

  const getTimePeriod = (endDate) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Ended';
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return `${diffDays} days`;
    } else if (diffDays <= 30) {
      return `${Math.ceil(diffDays / 7)} weeks`;
    } else if (diffDays <= 365) {
      return `${Math.ceil(diffDays / 30)} months`;
    } else {
      return `${Math.ceil(diffDays / 365)} years`;
    }
  };

  return (
    <div className="markets-page">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-container">
          <div className="filter-pills">
            {filterOptions.map((filter) => (
              <button
                key={filter}
                className={`filter-pill ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => handleFilterChange(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <button
            className="filter-menu-btn"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          >
            <FiFilter />
          </button>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="markets-container">
        {loading ? (
          <div className="loading-grid">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="market-card-skeleton shimmer" />
            ))}
          </div>
        ) : error ? (
          <div className="error-state">
            <h3>Error Loading Markets</h3>
            <p>{error}</p>
            <button onClick={loadMarkets} className="retry-btn">
              Try Again
            </button>
          </div>
        ) : markets.length === 0 ? (
          <div className="empty-state">
            <h3>No markets found</h3>
            <p>Try adjusting your filters or check back later for new markets</p>
          </div>
        ) : (
          <div className="markets-grid">
            {markets.map((market) => (
              <MarketCard
                key={market.id}
                market={formatMarketForCard(market)}
                featured={market.featured}
                onBookmark={handleBookmark}
                onShare={handleShare}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load More */}
      {!loading && markets.length > 0 && (
        <div className="load-more-container">
          <button className="load-more-btn" onClick={loadMarkets}>
            Load More Markets
          </button>
        </div>
      )}
    </div>
  );
};

export default Markets;