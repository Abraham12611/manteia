import React, { useState } from 'react';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { FiMinimize2, FiWifi, FiChevronUp } from 'react-icons/fi';

const AppKitStatus = () => {
  const { address, isConnected, status } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();
  const [isMinimized, setIsMinimized] = useState(false);

  // Don't show anything if not connected - let the header handle connection
  if (!isConnected) {
    return null;
  }

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  // Minimized state - small circle
  if (isMinimized) {
    return (
      <div
        onClick={toggleMinimized}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          background: 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0, 212, 255, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          animation: 'minimizedPulse 2s infinite'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = '0 12px 40px rgba(0, 212, 255, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 8px 32px rgba(0, 212, 255, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)';
        }}
      >
        <FiChevronUp
          size={20}
          color="white"
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
            animation: 'bounce 1s infinite alternate'
          }}
        />

        {/* Connection indicator dot */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          border: '2px solid white',
          animation: 'pulse 2s infinite'
        }} />

        {/* Inline styles for animations */}
        <style>
          {`
            @keyframes minimizedPulse {
              0%, 100% {
                box-shadow: 0 8px 32px rgba(0, 212, 255, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
              }
              50% {
                box-shadow: 0 8px 32px rgba(0, 212, 255, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2);
              }
            }
            @keyframes bounce {
              0% { transform: translateY(0px); }
              100% { transform: translateY(-2px); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}
        </style>
      </div>
    );
  }

  // Maximized state - full component
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      borderRadius: '12px',
      padding: '16px 20px',
      minWidth: '280px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(16px)',
      zIndex: 1000,
      fontFamily: 'Inter, sans-serif',
      animation: 'slideIn 0.3s ease-out'
    }}>
      {/* Header with minimize button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            marginRight: '8px',
            animation: 'pulse 2s infinite'
          }}></div>
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#00d4ff',
            letterSpacing: '0.5px'
          }}>
            WALLET CONNECTED
          </span>
        </div>

        {/* Minimize button */}
        <button
          onClick={toggleMinimized}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = '#00d4ff';
            e.target.style.background = 'rgba(0, 212, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#94a3b8';
            e.target.style.background = 'none';
          }}
          title="Minimize"
        >
          <FiMinimize2 size={16} />
        </button>
      </div>

      {/* Wallet Info */}
      <div>
        <div style={{
          fontSize: '14px',
          color: '#e2e8f0',
          marginBottom: '4px'
        }}>
          <span style={{ color: '#94a3b8' }}>Address:</span>{' '}
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            color: '#f8fafc'
          }}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>

        {caipNetwork && (
          <div style={{
            fontSize: '14px',
            color: '#e2e8f0'
          }}>
            <span style={{ color: '#94a3b8' }}>Network:</span>{' '}
            <span style={{
              color: '#00d4ff',
              fontWeight: '500'
            }}>
              {caipNetwork.name}
            </span>
            <span style={{
              color: '#64748b',
              fontSize: '12px',
              marginLeft: '8px'
            }}>
              (ID: {chainId})
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginTop: '16px'
      }}>
        <div style={{ flex: 1 }}>
          <w3m-button size="sm" />
        </div>
        {isConnected && (
          <div style={{ flex: 1 }}>
            <w3m-network-button />
          </div>
        )}
      </div>

      {/* Inline styles for animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

export default AppKitStatus;