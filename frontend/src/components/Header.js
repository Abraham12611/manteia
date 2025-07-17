import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiSearch, FiChevronDown } from 'react-icons/fi';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import './Header.css';

const navigationItems = [
  { label: 'Trending', path: '/trending' },
  { label: 'New', path: '/new' },
  { label: 'Politics', path: '/politics' },
  { label: 'Sports', path: '/sports' },
  { label: 'Crypto', path: '/crypto' },
  { label: 'Tech', path: '/tech' },
  { label: 'Culture', path: '/culture' },
  { label: 'World', path: '/world' },
  { label: 'Economy', path: '/economy' },
  { label: 'Elections', path: '/elections' }
];

const Header = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Always call hooks at the top level
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatNetworkName = (network) => {
    if (!network) return 'Unknown';
    return network.name || 'Unknown Network';
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="logo">
          <span className="logo-text">Manteia</span>
        </Link>

        {/* Navigation */}
        <nav className="nav">
          <div
            ref={dropdownRef}
            className={`nav-dropdown ${isDropdownOpen ? 'open' : ''}`}
          >
            <button
              className="nav-dropdown-toggle"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              Markets <FiChevronDown />
            </button>
            {isDropdownOpen && (
              <div className="nav-dropdown-menu">
                {navigationItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-dropdown-item ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <span className="nav-dropdown-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Search */}
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </form>

        {/* Wallet Connection - Using AppKit components as per documentation */}
        <div className="wallet-section">
          {isConnected ? (
            <div className="wallet-info">
              <span className="wallet-address">{formatAddress(address)}</span>
              <span className="wallet-network">{formatNetworkName(caipNetwork)}</span>
              <w3m-network-button />
            </div>
          ) : (
            <w3m-button />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;