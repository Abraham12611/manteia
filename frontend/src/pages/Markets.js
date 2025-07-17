import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter } from 'react-icons/fi';
import MarketCard from '../components/MarketCard';
import './Markets.css';

// Mock data - replace with API calls
const mockMarkets = [
  {
    id: '1',
    question: 'Will GPT-5 be released before the end of 2025?',
    category: 'Tech',
    probability: 73,
    volume: 5234000,
    timePeriod: 'Monthly',
    supportedChains: [
      { id: 'mantle', name: 'Mantle' },
      { id: 'base', name: 'Base' },
      { id: 'ethereum', name: 'Ethereum' }
    ]
  },
  {
    id: '2',
    question: 'Will the Lakers win the NBA Championship in 2025?',
    category: 'Sports',
    probability: 28,
    volume: 1250000,
    timePeriod: 'Annual',
    supportedChains: [
      { id: 'mantle', name: 'Mantle' },
      { id: 'polygon', name: 'Polygon' }
    ]
  },
  {
    id: '3',
    question: 'Will Bitcoin reach $100,000 by March 2025?',
    category: 'Crypto',
    probability: 61,
    volume: 8750000,
    timePeriod: 'Daily',
    supportedChains: [
      { id: 'mantle', name: 'Mantle' },
      { id: 'arbitrum', name: 'Arbitrum' },
      { id: 'optimism', name: 'Optimism' }
    ]
  },
  {
    id: '4',
    question: 'Will there be a major AI breakthrough announced at the next tech conference?',
    category: 'Tech',
    probability: 42,
    volume: 890000,
    timePeriod: 'Weekly',
    supportedChains: [
      { id: 'mantle', name: 'Mantle' }
    ]
  },
  {
    id: '5',
    question: 'Will the Federal Reserve cut interest rates in Q1 2025?',
    category: 'Economy',
    probability: 55,
    volume: 3200000,
    timePeriod: 'Quarterly',
    supportedChains: [
      { id: 'mantle', name: 'Mantle' },
      { id: 'ethereum', name: 'Ethereum' }
    ]
  },
  {
    id: '6',
    question: 'Will SpaceX successfully land humans on Mars by 2030?',
    category: 'Tech',
    probability: 35,
    volume: 2100000,
    timePeriod: 'Annual',
    supportedChains: [
      { id: 'mantle', name: 'Mantle' },
      { id: 'base', name: 'Base' }
    ],
    featured: true
  }
];

const filterOptions = [
  'All',
  'Breaking News',
  'Trump Presidency',
  'Jerome Powell',
  'Syria',
  'Epstein',
  'Israel',
  'AI',
  'Trade War',
  'NYC Mayor',
  'Geopolitics'
];

const Markets = () => {
  const [searchParams] = useSearchParams();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const category = searchParams.get('category');

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      let filteredMarkets = [...mockMarkets];

      // Filter by category if provided
      if (category) {
        filteredMarkets = filteredMarkets.filter(
          market => market.category.toLowerCase() === category.toLowerCase()
        );
      }

      setMarkets(filteredMarkets);
      setLoading(false);
    }, 800);
  }, [category, activeFilter]);

  const handleBookmark = (marketId, isBookmarked) => {
    console.log(`Market ${marketId} bookmarked: ${isBookmarked}`);
    // Implement bookmark functionality
  };

  const handleShare = (market) => {
    console.log(`Sharing market: ${market.question}`);
    // Implement share functionality
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
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
          <button className="filter-menu-btn" onClick={() => setShowFilterMenu(!showFilterMenu)}>
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
        ) : markets.length === 0 ? (
          <div className="empty-state">
            <h3>No markets found</h3>
            <p>Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="markets-grid">
            {markets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
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
          <button className="load-more-btn">
            Load More Markets
          </button>
        </div>
      )}
    </div>
  );
};

export default Markets;