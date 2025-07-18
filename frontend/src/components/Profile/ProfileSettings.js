import React, { useState } from 'react';
import profileService from '../../services/profileService';
import './ProfileSettings.css';

const ProfileSettings = ({ profile, onClose, onProfileUpdated }) => {
  const [formData, setFormData] = useState({
    username: profile.username || '',
    email: profile.email || '',
    bio: profile.bio || '',
    avatarUrl: profile.avatarUrl || ''
  });
  const [preferences, setPreferences] = useState(profile.preferences || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Update profile
      const profileResponse = await profileService.updateUserProfile(
        profile.walletAddress,
        formData
      );

      // Update preferences
      const preferencesResponse = await profileService.updateUserPreferences(
        profile.walletAddress,
        preferences
      );

      onProfileUpdated({
        ...profileResponse.data,
        preferences: preferencesResponse.data
      });

    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderProfileTab = () => (
    <div className="settings-tab-content">
      <div className="form-section">
        <h3>Basic Information</h3>

        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            placeholder="Enter your username"
            maxLength={50}
            className="form-input"
          />
          <small className="form-help">
            Your public display name (max 50 characters)
          </small>
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="Enter your email"
            className="form-input"
          />
          <small className="form-help">
            Used for notifications and account recovery
          </small>
        </div>

        <div className="form-group">
          <label>Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Tell us about yourself..."
            maxLength={500}
            rows={4}
            className="form-textarea"
          />
          <small className="form-help">
            {formData.bio.length}/500 characters
          </small>
        </div>

        <div className="form-group">
          <label>Avatar URL</label>
          <input
            type="url"
            value={formData.avatarUrl}
            onChange={(e) => handleInputChange('avatarUrl', e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="form-input"
          />
          <small className="form-help">
            URL to your profile picture
          </small>
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="settings-tab-content">
      <div className="form-section">
        <h3>Appearance</h3>

        <div className="form-group">
          <label>Theme</label>
          <select
            value={preferences.theme || 'dark'}
            onChange={(e) => handlePreferenceChange('theme', e.target.value)}
            className="form-select"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div className="form-group">
          <label>Language</label>
          <select
            value={preferences.language || 'en'}
            onChange={(e) => handlePreferenceChange('language', e.target.value)}
            className="form-select"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div className="form-group">
          <label>Currency</label>
          <select
            value={preferences.currency || 'USD'}
            onChange={(e) => handlePreferenceChange('currency', e.target.value)}
            className="form-select"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="JPY">JPY (¥)</option>
          </select>
        </div>
      </div>

      <div className="form-section">
        <h3>Notifications</h3>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.emailNotifications !== false}
              onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
              className="form-checkbox"
            />
            <span>Email notifications</span>
          </label>
          <small className="form-help">
            Receive email updates about your trades and markets
          </small>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.pushNotifications !== false}
              onChange={(e) => handlePreferenceChange('pushNotifications', e.target.checked)}
              className="form-checkbox"
            />
            <span>Push notifications</span>
          </label>
          <small className="form-help">
            Receive browser notifications for important updates
          </small>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.marketUpdates !== false}
              onChange={(e) => handlePreferenceChange('marketUpdates', e.target.checked)}
              className="form-checkbox"
            />
            <span>Market updates</span>
          </label>
          <small className="form-help">
            Get notified when markets you're interested in are updated
          </small>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.priceAlerts !== false}
              onChange={(e) => handlePreferenceChange('priceAlerts', e.target.checked)}
              className="form-checkbox"
            />
            <span>Price alerts</span>
          </label>
          <small className="form-help">
            Get notified when prices reach your target levels
          </small>
        </div>
      </div>

      <div className="form-section">
        <h3>Privacy</h3>

        <div className="form-group">
          <label>Profile visibility</label>
          <select
            value={preferences.profileVisibility || 'public'}
            onChange={(e) => handlePreferenceChange('profileVisibility', e.target.value)}
            className="form-select"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <small className="form-help">
            Control who can see your profile and trading activity
          </small>
        </div>
      </div>
    </div>
  );

  return (
    <div className="profile-settings-overlay">
      <div className="profile-settings-modal">
        <div className="settings-header">
          <h2>Edit Profile</h2>
          <button
            className="close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="settings-error">
            <div className="error-icon">⚠️</div>
            <p>{error}</p>
          </div>
        )}

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
        </div>

        <form onSubmit={handleSubmit} className="settings-form">
          {activeTab === 'profile' ? renderProfileTab() : renderPreferencesTab()}

          <div className="settings-footer">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`save-button ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <div className="loading-spinner small"></div>
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;