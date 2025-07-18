import React from 'react';
import profileService from '../../services/profileService';
import './ProfileHeader.css';

const ProfileHeader = ({ profile, isOwnProfile, onEditProfile }) => {
  const {
    username,
    walletAddress,
    avatarUrl,
    joinedDate,
    bio,
    isVerified,
    reputationScore
  } = profile;

  const displayName = username || profileService.formatWalletAddress(walletAddress);
  const generatedAvatarUrl = avatarUrl || profileService.generateAvatarUrl(walletAddress);
  const reputationLevel = profileService.getReputationLevel(reputationScore);
  const reputationColor = profileService.getReputationColor(reputationScore);
  const formattedJoinDate = profileService.formatDate(joinedDate);

  return (
    <div className="profile-header">
      <div className="profile-header-content">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            <img
              src={generatedAvatarUrl}
              alt={displayName}
              className="avatar-image"
            />
            {isVerified && (
              <div className="verified-badge">
                <span className="verified-icon">✓</span>
              </div>
            )}
          </div>
        </div>

        <div className="profile-info-section">
          <div className="profile-basic-info">
            <h1 className="profile-name">{displayName}</h1>
            <div className="profile-address">
              <span className="address-text">
                {profileService.formatWalletAddress(walletAddress)}
              </span>
              <button
                className="copy-address-button"
                onClick={() => navigator.clipboard.writeText(walletAddress)}
                title="Copy wallet address"
              >
                📋
              </button>
            </div>
            <div className="profile-joined">
              <span className="joined-text">Joined {formattedJoinDate}</span>
            </div>
          </div>

          {bio && (
            <div className="profile-bio">
              <p>{bio}</p>
            </div>
          )}

          <div className="profile-badges">
            <div className="reputation-badge">
              <span
                className="reputation-level"
                style={{ color: reputationColor }}
              >
                {reputationLevel}
              </span>
              <span className="reputation-score">
                {reputationScore} pts
              </span>
            </div>

            {isVerified && (
              <div className="verified-text-badge">
                <span className="verified-icon">✓</span>
                <span>Verified</span>
              </div>
            )}
          </div>
        </div>

        <div className="profile-actions">
          {isOwnProfile && (
            <button
              className="edit-profile-button"
              onClick={onEditProfile}
            >
              Edit profile
            </button>
          )}

          <div className="profile-brand">
            <span className="brand-logo">M</span>
            <span className="brand-text">Manteia</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;