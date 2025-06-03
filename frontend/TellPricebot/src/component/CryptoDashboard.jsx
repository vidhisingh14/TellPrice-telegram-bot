import React, { useState, useEffect, useRef } from 'react';
import './CryptoDashboard.css'; // We'll create this CSS file

const CryptoDashboard = () => {
  const [prices, setPrices] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
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
        setConnectionStatus('Connected');
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
        setConnectionStatus('Disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
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

  const getChangeClass = (change) => {
    return change >= 0 ? 'positive' : 'negative';
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
        <h1>🚀 Crypto Price Tracker</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus.toLowerCase()}`}></span>
          <span>{connectionStatus}</span>
        </div>
      </header>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <div className="prices-container">
        {Object.keys(prices).length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading crypto prices...</p>
          </div>
        ) : (
          <div className="price-grid">
            {Object.entries(prices).map(([cryptoId, data]) => (
              <div key={cryptoId} className="price-card">
                <div className="crypto-header">
                  <div className="crypto-icon">{getCryptoIcon(cryptoId)}</div>
                  <div className="crypto-info">
                    <h3>{data.name}</h3>
                    <span className="symbol">{data.symbol}</span>
                  </div>
                </div>
                
                <div className="price-info">
                  <div className="current-price">
                    {formatPrice(data.price)}
                  </div>
                  
                  <div className={`price-change ${getChangeClass(data.change_24h)}`}>
                    <span className="change-arrow">
                      {data.change_24h >= 0 ? '↗' : '↘'}
                    </span>
                    {formatChange(data.change_24h)}
                  </div>
                </div>
                
                <div className="additional-info">
                  <small>24h Change</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lastUpdate && (
        <div className="last-update">
          <p>Last updated: {lastUpdate.toLocaleString()}</p>
          <p className="next-update">Next update in ~60 seconds</p>
        </div>
      )}
    </div>
  );
};

export default CryptoDashboard;