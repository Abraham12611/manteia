import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import profileService from '../../services/profileService';
import './ProfileDropdown.css';

const ProfileDropdown = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isConnected && address) {
      loadProfile();
    }
  }, [isConnected, address]);

  useEffect(() => {
    // Check for dark mode preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(savedTheme === 'dark' || (!savedTheme && prefersDark));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProfile = async () => {
    try {
      const response = await profileService.getUserProfile(address);
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleProfileClick = () => {
    navigate(`/profile/${address}`);
    setIsOpen(false);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
    setIsOpen(false);
  };

  const handleWatchlistClick = () => {
    navigate('/watchlist');
    setIsOpen(false);
  };

  const handleRewardsClick = () => {
    navigate('/rewards');
    setIsOpen(false);
  };

  const handleDocumentationClick = () => {
    window.open('https://docs.manteia.io', '_blank');
    setIsOpen(false);
  };

  const handlePromoClick = () => {
    navigate('/claim-promo');
    setIsOpen(false);
  };

  const handleTermsClick = () => {
    navigate('/terms');
    setIsOpen(false);
  };

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  if (!isConnected || !address) {
    return null;
  }

  const displayName = profile?.username || profileService.formatWalletAddress(address);
  const avatarUrl = profile?.avatarUrl || profileService.generateAvatarUrl(address);

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button
        className="profile-trigger"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="profile-avatar">
          <img
            src={avatarUrl}
            alt={displayName}
            className="avatar-image"
          />
          {profile?.isVerified && (
            <div className="verified-badge">
              <span className="verified-icon">✓</span>
            </div>
          )}
        </div>
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="dropdown-header">
            <div className="profile-info">
              <img
                src={avatarUrl}
                alt={displayName}
                className="header-avatar"
              />
              <div className="profile-details">
                <div className="profile-name">{displayName}</div>
                <div className="profile-address">
                  {profileService.formatWalletAddress(address)}
                  <button
                    className="copy-button"
                    onClick={() => navigator.clipboard.writeText(address)}
                    title="Copy address"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="dropdown-content">
            <div className="dropdown-section">
              <button
                className="dropdown-item"
                onClick={handleProfileClick}
              >
                <span className="item-icon">👤</span>
                <span className="item-text">Profile</span>
              </button>

              <button
                className="dropdown-item"
                onClick={handleSettingsClick}
              >
                <span className="item-icon">⚙️</span>
                <span className="item-text">Settings</span>
              </button>

              <button
                className="dropdown-item"
                onClick={handleWatchlistClick}
              >
                <span className="item-icon">📌</span>
                <span className="item-text">Watchlist</span>
              </button>

              <button
                className="dropdown-item"
                onClick={handleRewardsClick}
              >
                <span className="item-icon">🎁</span>
                <span className="item-text">Rewards</span>
              </button>
            </div>

            <div className="dropdown-section">
              <button
                className="dropdown-item"
                onClick={handleDocumentationClick}
              >
                <span className="item-icon">📚</span>
                <span className="item-text">Documentation</span>
              </button>

              <button
                className="dropdown-item"
                onClick={handlePromoClick}
              >
                <span className="item-icon">🎯</span>
                <span className="item-text">Claim Promo</span>
              </button>

              <button
                className="dropdown-item"
                onClick={handleTermsClick}
              >
                <span className="item-icon">📜</span>
                <span className="item-text">Terms of Use</span>
              </button>
            </div>

            <div className="dropdown-section">
              <div className="dropdown-item toggle-item">
                <span className="item-icon">🌙</span>
                <span className="item-text">Dark mode</span>
                <button
                  className={`toggle-switch ${darkMode ? 'active' : ''}`}
                  onClick={handleDarkModeToggle}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
            </div>

            <div className="dropdown-section">
              <button
                className="dropdown-item logout-item"
                onClick={() => {
                  // Handle logout/disconnect
                  setIsOpen(false);
                }}
              >
                <span className="item-icon">🚪</span>
                <span className="item-text">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;