import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Web3ContextProvider from './context/Web3Context';
import reportWebVitals from './reportWebVitals';

// Get cookies for SSR support (in Next.js this would come from headers)
const cookies = typeof document !== 'undefined' ? document.cookie : null;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Web3ContextProvider cookies={cookies}>
      <App />
    </Web3ContextProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
