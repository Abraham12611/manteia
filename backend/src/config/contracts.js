// Deployed Contract Addresses Configuration

export const CONTRACTS = {
  // Ethereum Sepolia Testnet
  ethereum: {
    sepolia: {
      BridgeAdapter: '0x42A7AC30B8fbE1Ac32f47A62553468Cc2cc463EA',
      SwapCoordinator: '0x4E2cB550463D598CeD89443EC4d5d19861172aa5',
      WormholeTokenBridge: '0xDB5492265f6038831E89f495670FF909aDe94bd9',
      USDCToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      OneInchRouter: '0x1111111254fb6c44bAC0beD2854e76F90643097d'
    }
  },

  // Sui Testnet
  sui: {
    testnet: {
      PackageId: '0x468edb99a7d83ed2464eb25feb229e6d21d47b0f382c90ac5b57a393e26084fe',
      ResolverRegistry: '0x188bbce0f7109573fbba799a8e12e37b1aab6fb0c6fba476bbf83870ef1a62e0',
      WormholeTokenBridge: '0x6fb10cdb7aa299e9a4308752dadecb049ff55a892de92992a1edbd7912b3d6da',
      WormholeCore: '0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790'
    }
  }
};

// Environment-based configuration
export function getContractAddresses() {
  const network = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
  const ethNetwork = process.env.NODE_ENV === 'production' ? 'mainnet' : 'sepolia';

  return {
    ethereum: CONTRACTS.ethereum[ethNetwork],
    sui: CONTRACTS.sui[network]
  };
}

export default CONTRACTS;