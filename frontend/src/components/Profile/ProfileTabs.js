import React from 'react';
import './ProfileTabs.css';

const ProfileTabs = ({ activeTab, onTabChange, isOwnProfile }) => {
  const tabs = [
    {
      id: 'positions',
      label: 'Positions',
      icon: '📊'
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: '📈'
    }
  ];

  return (
    <div className="profile-tabs">
      <div className="tabs-container">
        <div className="tabs-list">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="tabs-brand">
          <span className="brand-logo">M</span>
          <span className="brand-text">Manteia</span>
        </div>
      </div>
    </div>
  );
};

export default ProfileTabs;