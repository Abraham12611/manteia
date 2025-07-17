import React from 'react';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';

const AppKitStatus = () => {
  const { address, isConnected, status } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();

  // Don't show anything if not connected - let the header handle connection
  if (!isConnected) {
    return null;
  }

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
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.2)'
      }}>
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

      {/* Wallet Info */}
      <div style={{ marginBottom: '12px' }}>
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
        alignItems: 'center'
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

      {/* Inline styles for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default AppKitStatus;