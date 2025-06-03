import React, { useState, useEffect, useRef } from 'react';
import './CryptoDashboard.css';

const CryptoDashboard = () => {
  const [prices, setPrices] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  // Always connect to your deployed Render server
  const WS_URL = 'wss://tellprice-telegram-bot.onrender.com/ws/crypto-prices';

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            setError(data.error);
          } else {
            setPrices(data.prices || {});
            setLastUpdate(new Date(data.timestamp));
            setError(null);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
          setError('Error parsing price data');
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setError('WebSocket connection error');
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to server');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getCryptoIcon = (cryptoId) => {
    const icons = {
      bitcoin: '₿',
      ethereum: 'Ξ',
      solana: '◎'
    };
    return icons[cryptoId] || '₿';
  };

  return (
    <div className="crypto-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="rocket-icon">🚀</div>
            <div className="title-container">
              <h1 className="title">Crypto Price Tracker</h1>
            </div>
          </div>
          <div className={`status-badge ${connectionStatus}`}>
            <div className="status-dot"></div>
            <span className="status-text">{connectionStatus}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {Object.keys(prices).length === 0 ? (
        <div className="loading-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="loading-card">
              <div className="shimmer"></div>
              <div className="loading-header">
                <div className="loading-icon"></div>
                <div className="loading-info">
                  <div className="loading-name"></div>
                  <div className="loading-symbol"></div>
                </div>
              </div>
              <div className="loading-price"></div>
              <div className="loading-change"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid-container">
          {Object.entries(prices).map(([cryptoId, data]) => (
            <div key={cryptoId} className={`crypto-card ${cryptoId}`}>
              <div className="card-header">
                <div className={`crypto-icon-container ${cryptoId}`}>
                  <span className="crypto-icon">{getCryptoIcon(cryptoId)}</span>
                </div>
                <div className="crypto-info">
                  <h3 className="crypto-name">{data.name}</h3>
                  <span className="crypto-symbol">{data.symbol}</span>
                </div>
              </div>
              
              <div className="price-info">
                <p className="price">{formatPrice(data.price)}</p>
                
                <div className={`change-container ${data.change_24h >= 0 ? 'positive' : 'negative'}`}>
                  <span className="change-arrow">
                    {data.change_24h >= 0 ? '↗' : '↘'}
                  </span>
                  <span className="change-value">{formatChange(data.change_24h)}</span>
                </div>
                
                <div className="change-label">24h Change</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lastUpdate && (
        <div className="footer">
          <p className="last-update">Last updated: {lastUpdate.toLocaleString()}</p>
          <p className="next-update">Next update in ~60 seconds</p>
        </div>
      )}
    </div>
  );
};

export default CryptoDashboard;