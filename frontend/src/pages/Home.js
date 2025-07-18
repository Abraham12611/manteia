import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiTrendingUp, FiGlobe, FiZap, FiShield } from 'react-icons/fi';
import MarketCard from '../components/MarketCard';
import './Home.css';

// Featured markets - in production, fetch from API
const featuredMarkets = [
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
    ],
    featured: true
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
  }
];

const features = [
  {
    icon: <FiGlobe />,
    title: 'Cross-Chain Trading',
    description: 'Trade on any supported chain without manual bridging. Our Hyperlane integration handles everything.'
  },
  {
    icon: <FiZap />,
    title: 'Lightning Fast Settlement',
    description: 'Powered by Mantle\'s high-performance L2, enjoy fast trades with minimal fees.'
  },
  {
    icon: <FiShield />,
    title: 'Secure & Transparent',
    description: 'All trades are secured by smart contracts with transparent on-chain resolution.'
  },
  {
    icon: <FiTrendingUp />,
    title: 'Real-Time Markets',
    description: 'Access live market data integrated from Polymarket with unified liquidity pools.'
  }
];

const Home = () => {
  const navigate = useNavigate();

  const handleBookmark = (marketId, isBookmarked) => {
    console.log(`Market ${marketId} bookmarked: ${isBookmarked}`);
  };

  const handleShare = (market) => {
    console.log(`Sharing market: ${market.question}`);
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Trade Predictions
            <span className="gradient-text"> Across Chains</span>
          </h1>
          <p className="hero-description">
            Manteia brings cross-chain prediction markets to life. Trade on events that matter,
            powered by Mantle's lightning-fast L2 and Hyperlane's seamless interoperability.
          </p>
          <div className="hero-actions">
            <button
              className="cta-button primary"
              onClick={() => navigate('/markets')}
            >
              Explore Markets <FiArrowRight />
            </button>
            <Link to="/markets?category=new" className="cta-button secondary">
              View New Markets
            </Link>
          </div>

          {/* Stats */}
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-value">$24M+</span>
              <span className="stat-label">Total Volume</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">5</span>
              <span className="stat-label">Supported Chains</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">1,234</span>
              <span className="stat-label">Active Markets</span>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="hero-visual">
          <div className="chain-network">
            <div className="chain-node mantle">Mantle</div>
            <div className="chain-node ethereum">Ethereum</div>
            <div className="chain-node base">Base</div>
            <div className="chain-node arbitrum">Arbitrum</div>
            <div className="connection-lines"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Manteia?</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Markets Section */}
      <section className="featured-markets-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Featured Markets</h2>
            <Link to="/markets" className="view-all-link">
              View All Markets <FiArrowRight />
            </Link>
          </div>
          <div className="featured-markets-grid">
            {featuredMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                featured={market.featured}
                onBookmark={handleBookmark}
                onShare={handleShare}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Start Trading?</h2>
            <p className="cta-description">
              Join thousands of traders making predictions on real-world events
            </p>
            <button
              className="cta-button large"
              onClick={() => navigate('/markets')}
            >
              Start Trading Now
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;