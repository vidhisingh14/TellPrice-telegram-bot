from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import aiohttp
import json
from datetime import datetime
from typing import List, Dict, Any
import logging
from telegram import Bot
from telegram.error import TelegramError
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Crypto Price WebSocket API")

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price"
CRYPTO_IDS = ["bitcoin", "ethereum", "solana"]
UPDATE_INTERVAL = 60  # Increased to 60 seconds to reduce rate limiting
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# Store active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        if self.active_connections:
            disconnected = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(json.dumps(data))
                except Exception as e:
                    logger.error(f"Error sending data to WebSocket: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn)

manager = ConnectionManager()

# Initialize Telegram bot
telegram_bot = None
if TELEGRAM_BOT_TOKEN:
    telegram_bot = Bot(token=TELEGRAM_BOT_TOKEN)

class CryptoPriceFetcher:
    def __init__(self):
        self.session = None
        self.last_prices = {}

    async def create_session(self):
        if not self.session:
            self.session = aiohttp.ClientSession()

    async def close_session(self):
        if self.session:
            await self.session.close()

    async def fetch_prices(self) -> Dict[str, Any]:
        """Fetch cryptocurrency prices from CoinGecko API"""
        await self.create_session()
        
        try:
            params = {
                "ids": ",".join(CRYPTO_IDS),
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_last_updated_at": "true"
            }
            
            # Add headers to avoid rate limiting
            headers = {
                "User-Agent": "CryptoPriceTracker/1.0",
                "Accept": "application/json"
            }
            
            async with self.session.get(COINGECKO_API_URL, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Format the data
                    formatted_data = {
                        "timestamp": datetime.now().isoformat(),
                        "prices": {}
                    }
                    
                    for crypto_id in CRYPTO_IDS:
                        if crypto_id in data:
                            crypto_data = data[crypto_id]
                            formatted_data["prices"][crypto_id] = {
                                "name": crypto_id.capitalize(),
                                "symbol": self.get_symbol(crypto_id),
                                "price": crypto_data.get("usd", 0),
                                "change_24h": crypto_data.get("usd_24h_change", 0),
                                "last_updated": crypto_data.get("last_updated_at", 0)
                            }
                    
                    self.last_prices = formatted_data
                    return formatted_data
                elif response.status == 429:
                    logger.warning("Rate limited by CoinGecko API, using cached data")
                    await asyncio.sleep(10)  # Wait 10 seconds before next attempt
                    return self.last_prices or {"error": "Rate limited, no cached data available"}
                else:
                    logger.error(f"CoinGecko API error: {response.status}")
                    return self.last_prices or {"error": "Failed to fetch prices"}
                    
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")
            return self.last_prices or {"error": str(e)}

    def get_symbol(self, crypto_id: str) -> str:
        """Get cryptocurrency symbol"""
        symbols = {
            "bitcoin": "BTC",
            "ethereum": "ETH", 
            "solana": "SOL"
        }
        return symbols.get(crypto_id, crypto_id.upper())

price_fetcher = CryptoPriceFetcher()

async def send_telegram_update(price_data: Dict[str, Any]):
    """Send price update to Telegram"""
    if not telegram_bot or not TELEGRAM_CHAT_ID:
        return
    
    try:
        message = "🚀 *Crypto Price Update* 🚀\n\n"
        
        for crypto_id, data in price_data["prices"].items():
            price = data["price"]
            change = data["change_24h"]
            symbol = data["symbol"]
            
            change_emoji = "📈" if change >= 0 else "📉"
            change_sign = "+" if change >= 0 else ""
            
            message += f"{change_emoji} *{symbol}*: ${price:,.2f}\n"
            message += f"   24h: {change_sign}{change:.2f}%\n\n"
        
        message += f"⏰ Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        await telegram_bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=message,
            parse_mode="Markdown"
        )
        logger.info("Telegram message sent successfully")
        
    except TelegramError as e:
        logger.error(f"Telegram error: {e}")
    except Exception as e:
        logger.error(f"Error sending Telegram message: {e}")

async def price_update_loop():
    """Background task to fetch prices and broadcast updates"""
    retry_count = 0
    max_retries = 3
    
    while True:
        try:
            # Fetch latest prices
            price_data = await price_fetcher.fetch_prices()
            
            # Check if we got valid data
            if "error" in price_data and "rate limited" in price_data["error"].lower():
                retry_count += 1
                if retry_count <= max_retries:
                    logger.warning(f"Rate limited, retry {retry_count}/{max_retries}")
                    await asyncio.sleep(30)  # Wait 30 seconds before retry
                    continue
                else:
                    logger.error("Max retries reached, using cached data")
                    retry_count = 0
            else:
                retry_count = 0  # Reset on successful fetch
            
            # Broadcast to WebSocket connections
            await manager.broadcast(price_data)
            
            # Send to Telegram only if we have valid data
            if "error" not in price_data and price_data.get("prices"):
                await send_telegram_update(price_data)
            
            logger.info(f"Price update sent at {datetime.now()}")
            
        except Exception as e:
            logger.error(f"Error in price update loop: {e}")
        
        # Wait for next update
        await asyncio.sleep(UPDATE_INTERVAL)

@app.on_event("startup")
async def startup_event():
    """Start the background price update loop"""
    asyncio.create_task(price_update_loop())
    logger.info("Crypto price server started")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources"""
    await price_fetcher.close_session()
    logger.info("Server shutdown complete")

@app.websocket("/ws/crypto-prices")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time price updates"""
    await manager.connect(websocket)
    
    try:
        # Send current prices immediately on connection
        if price_fetcher.last_prices:
            await websocket.send_text(json.dumps(price_fetcher.last_prices))
        
        # Keep connection alive
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/")
async def root():
    """Root endpoint for health checks"""
    return {
        "message": "Crypto Price Tracker API",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "websocket": "/ws/crypto-prices",
            "prices": "/api/prices", 
            "health": "/api/health"
        }
    }

@app.get("/api/prices")
async def get_current_prices():
    """REST endpoint to get current prices"""
    if price_fetcher.last_prices:
        return price_fetcher.last_prices
    else:
        return await price_fetcher.fetch_prices()

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_connections": len(manager.active_connections)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)