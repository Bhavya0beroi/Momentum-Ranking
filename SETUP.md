# Quick Setup Guide

## Step-by-Step Setup

### 1. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **YouTube Data API v3**
4. Create credentials → API Key
5. Copy your API key

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your API key
YOUTUBE_API_KEY=AIza...your_key_here
PORT=3000
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Start the server
npm start
```

### 4. Open Browser

Navigate to: `http://localhost:3000`

## Example Topics to Test

```
Union Budget 2026
RBI Injection of 2 lakh crore
Gold vs Silver vs Equity INR
Liquidity vs Stability rent vs buy
Crorepati states jobs land business
India GDP Growth 2026
Stock Market Crash India
Real Estate Investment India
Cryptocurrency Regulation India
Digital Rupee CBDC India
```

## Verify Setup

Test the API directly:

```bash
curl -X POST http://localhost:3000/api/rank \
  -H "Content-Type: application/json" \
  -d '{"topics":["Union Budget 2026"]}'
```

## Troubleshooting

**Problem**: `YOUTUBE_API_KEY is required`
**Solution**: Check that `.env` file exists and has valid API key

**Problem**: `ECONNREFUSED`
**Solution**: Make sure server is running (`npm start`)

**Problem**: Quota exceeded
**Solution**: 
- Default quota: 10,000 units/day
- Each analysis uses ~2,500 units for 5 topics
- Wait for reset at midnight Pacific Time
- Or request quota increase

**Problem**: No results found
**Solution**:
- Try broader topic terms
- Check if topic is too niche
- Verify topics are in English or have English content

## Quick Commands

```bash
# Start server
npm start

# Start with auto-reload (development)
npm run dev

# Test health endpoint
curl http://localhost:3000/api/health

# Clear cache
curl -X POST http://localhost:3000/api/cache/clear
```

## Next Steps

- Modify `queries.js` to customize query expansion
- Adjust `config.js` to tune scoring weights
- Edit `public/index.html` to customize UI
- Check console logs for detailed analysis progress

## Support

For issues or questions:
1. Check the main README.md
2. Verify API key is valid and has quota
3. Check console logs for detailed error messages
