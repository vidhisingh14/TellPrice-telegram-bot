I made this **Telegram bot** which does **real-time cryptocurrency price tracking** and sends automated updates directly to your Telegram chat every 2 minutes. 

**What it does:**
- **Fetches live prices** of Bitcoin (BTC), Ethereum (ETH), and Solana (SOL) from CoinGecko API
- **Sends formatted messages** to your Telegram chat with current prices and 24-hour changes
- **Shows price trends** with green 📈 for gains and red 📉 for losses
- **Runs completely automatically** in the cloud without any manual intervention

**The system has two parts:**
1. **Backend Server** (FastAPI on Render) - Handles price fetching and Telegram messaging
2. **Frontend Dashboard** (React on Vercel) - Shows real-time prices with live WebSocket updates

**Key features:**
- ⏰ **Automated updates** every 2 minutes
- 🔄 **Real-time WebSocket** connection for instant frontend updates  
- 📱 **Telegram integration** with BotFather-created bot
- 🎨 **Beautiful dashboard** with animated price cards and connection status
- 🛡️ **Rate limiting protection** and error handling
- 📊 **24-hour change tracking** with percentage indicators

**Technical stack:**
- Python FastAPI + WebSockets for backend
- React with real-time updates for frontend
- Telegram Bot API for messaging
- CoinGecko API for crypto data
- Deployed on Render (backend) + Vercel (frontend)

**Live demo:** https://tell-price-telegram-bot.vercel.app

Perfect for crypto enthusiasts who want hands-free price monitoring! 🚀📈
