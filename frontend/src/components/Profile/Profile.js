import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useParams } from 'react-router-dom';
import profileService from '../../services/profileService';
import ProfileHeader from './ProfileHeader';
import ProfileStats from './ProfileStats';
import ProfileTabs from './ProfileTabs';
import ProfilePositions from './ProfilePositions';
import ProfileActivity from './ProfileActivity';
import ProfileSettings from './ProfileSettings';
import './Profile.css';

const Profile = () => {
  const { address: connectedAddress } = useAccount();
  const { walletAddress } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('positions');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Use connected address if no wallet address in params
  const targetAddress = walletAddress || connectedAddress;

  useEffect(() => {
    if (targetAddress) {
      setIsOwnProfile(targetAddress.toLowerCase() === connectedAddress?.toLowerCase());
      loadProfile();
    }
  }, [targetAddress, connectedAddress]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await profileService.getUserProfile(targetAddress);
      setProfile(response.data);

      // Subscribe to real-time updates
      profileService.subscribeToProfileUpdates(targetAddress, handleProfileUpdate);

    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updateData) => {
    if (updateData.walletAddress === targetAddress) {
      setProfile(prevProfile => ({
        ...prevProfile,
        ...updateData
      }));
    }
  };

  const handleEditProfile = () => {
    setShowSettings(true);
  };

  const handleProfileUpdated = (updatedProfile) => {
    setProfile(prevProfile => ({
      ...prevProfile,
      ...updatedProfile
    }));
    setShowSettings(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const renderTabContent = () => {
    if (!profile) return null;

    switch (activeTab) {
      case 'positions':
        return (
          <ProfilePositions
            walletAddress={targetAddress}
            isOwnProfile={isOwnProfile}
          />
        );
      case 'activity':
        return (
          <ProfileActivity
            walletAddress={targetAddress}
            isOwnProfile={isOwnProfile}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="loading-spinner large"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <div className="error-icon">⚠️</div>
          <h3>Failed to Load Profile</h3>
          <p>{error}</p>
          <button onClick={loadProfile} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="profile-not-found">
          <div className="not-found-icon">👤</div>
          <h3>Profile Not Found</h3>
          <p>The user profile you're looking for doesn't exist or hasn't been created yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {showSettings && isOwnProfile && (
        <ProfileSettings
          profile={profile}
          onClose={() => setShowSettings(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        onEditProfile={handleEditProfile}
      />

      <ProfileStats
        statistics={profile.statistics}
        isOwnProfile={isOwnProfile}
      />

      <div className="profile-content">
        <ProfileTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isOwnProfile={isOwnProfile}
        />

        <div className="profile-tab-content">
          {renderTabContent()}
        </div>
      </div>

      {profile.statistics && (
        <div className="profile-insights">
          <h3>Profile Insights</h3>
          <div className="insights-grid">
            <div className="insight-card">
              <div className="insight-icon">📊</div>
              <div className="insight-content">
                <h4>Trading Performance</h4>
                <p>
                  {profile.statistics.winRate > 60 ? 'Excellent' :
                   profile.statistics.winRate > 45 ? 'Good' : 'Improving'} win rate
                </p>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon">🎯</div>
              <div className="insight-content">
                <h4>Market Expertise</h4>
                <p>
                  Most active in {profile.statistics.categoryPerformance?.[0]?.category || 'Various'} markets
                </p>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon">⚡</div>
              <div className="insight-content">
                <h4>Trading Activity</h4>
                <p>
                  {profile.statistics.tradingStreak > 7 ? 'Very active' :
                   profile.statistics.tradingStreak > 3 ? 'Active' : 'Occasional'} trader
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;