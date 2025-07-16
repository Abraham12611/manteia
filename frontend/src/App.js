import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import MarketHub from './abi/MarketHub.json';

const MARKET_HUB_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Replace with actual MarketHub address

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [marketHub, setMarketHub] = useState(null);
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    if (provider) {
      const hub = new ethers.Contract(MARKET_HUB_ADDRESS, MarketHub.abi, provider);
      setMarketHub(hub);
    }
  }, [provider]);

  useEffect(() => {
    if (marketHub) {
      // Fetch markets
      // This is a placeholder, as there is no function to get all markets yet
      // You would typically have a function like `marketHub.getAllMarkets()`
      // For now, we'll just create a dummy market
      setMarkets([
        {
          id: 1,
          question: 'Will GPT-5 be released by the end of 2025?',
          endDate: '2025-12-31',
        },
      ]);
    }
  }, [marketHub]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);
        const signer = await web3Provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
      } catch (error) {
        console.error('Error connecting to wallet:', error);
      }
    } else {
      console.error('MetaMask not detected');
    }
  };

  const createMarket = async () => {
    if (marketHub) {
      try {
        const signer = await provider.getSigner();
        const tx = await marketHub.connect(signer).createMarket(
          'Will AI replace software engineers?',
          Math.floor(new Date('2026-01-01').getTime() / 1000)
        );
        await tx.wait();
        console.log('Market created!');
      } catch (error) {
        console.error('Error creating market:', error);
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Manteia</h1>
        {account ? (
          <p>Connected: {account}</p>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
      <main>
        <div className="market-list">
          <h2>Markets</h2>
          <ul>
            {markets.map((market) => (
              <li key={market.id}>
                <p>{market.question}</p>
                <p>End Date: {market.endDate}</p>
              </li>
            ))}
          </ul>
          <button onClick={createMarket}>Create Market</button>
        </div>
        <div className="order-form">
          <h2>Place Order</h2>
          {/* Order form will be rendered here */}
        </div>
      </main>
    </div>
  );
}

export default App;