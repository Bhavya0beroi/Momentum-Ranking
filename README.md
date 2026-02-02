# YouTube Momentum Ranking Engine

A Node.js service that ranks content topics using real YouTube data to identify trending topics with high momentum and outlier signals.

## 🎯 Overview

This system analyzes topics by:
1. Generating multiple YouTube search queries per topic
2. Fetching recent video data from YouTube Data API
3. Computing momentum metrics based on views, engagement, and velocity
4. Identifying outlier videos and cross-creator adoption
5. Ranking topics by overall momentum score

## 📋 Features

- **Real-time YouTube Data Analysis** - Uses YouTube Data API v3
- **Multi-query Expansion** - Generates 3-5 queries per topic for comprehensive coverage
- **Advanced Metrics** - Calculates views per day, engagement rate, normalized velocity
- **Trend Velocity Analysis** - Detects if trends are accelerating, stable, or dying (zero API cost!)
- **Outlier Detection** - Identifies breakthrough content using percentile-based scoring
- **Cross-creator Analysis** - Tracks topic adoption across multiple channels
- **Caching** - In-memory caching to optimize API quota usage
- **Beautiful Web UI** - Clean, modern interface for easy topic analysis

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- YouTube Data API v3 key ([Get one here](https://console.cloud.google.com/apis/credentials))

### Installation

1. Clone or navigate to the project directory:
```bash
cd topicality-momentum
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Add your YouTube API key to `.env`:
```
YOUTUBE_API_KEY=your_actual_api_key_here
PORT=3000
```

### Running the Service

```bash
npm start
```

The server will start at `http://localhost:3000`

For development with auto-reload:
```bash
npm run dev
```

## 🌐 Usage

### Web Interface

1. Open `http://localhost:3000` in your browser
2. Enter topics (one per line, max 10)
3. Click "Analyze Momentum"
4. View ranked results with detailed metrics

### API Endpoint

**POST** `/api/rank`

Request body:
```json
{
  "topics": [
    "Union Budget 2026",
    "RBI Injection of 2 lakh crore",
    "Gold vs Silver vs Equity INR"
  ]
}
```

Response:
```json
{
  "success": true,
  "timestamp": "2026-01-30T...",
  "total_topics": 3,
  "results": [
    {
      "topic": "Union Budget 2026",
      "queries": ["Union Budget 2026", "Budget 2026 India", ...],
      "metrics": {
        "recent_7d_count": 15,
        "recent_28d_count": 42,
        "avg_views_per_day": 12500,
        "outlier_video_count": 8,
        "cross_creator_count": 12,
        "velocity_metrics": {
          "trend_signal": "accelerating",
          "freshness_score": 35,
          "velocity_ratio": 1.42,
          "is_accelerating": true,
          "is_dying": false,
          "is_stable": false
        }
      },
      "scores": {
        "trendScore": 72,
        "outlierScore": 45.5,
        "momentumScore": 95
      },
      "top_videos": [...]
    }
  ]
}
```

## 📊 Scoring Methodology

### Derived Metrics (per video)
- `age_days` = days since published
- `views_per_day` = viewCount / age_days
- `engagement_rate` = (likes + comments) / views
- `normalized_velocity` = views_per_day / subscriberCount

### Topic Metrics
- `recent_7d_count` - Videos published in last 7 days
- `recent_28d_count` - Videos published in last 28 days
- `avg_views_per_day` - Average across all videos
- `outlier_video_count` - Videos above 75th percentile velocity
- `cross_creator_count` - Unique channels covering topic

### Velocity Metrics (Zero API Cost!)
Analyzes trend direction using existing data - no additional API calls needed:

- **`trend_signal`** - Overall trend direction: `accelerating`, `stable`, or `dying`
- **`freshness_score`** - Percentage of videos from last 7 days (0-100%)
- **`velocity_ratio`** - Recent performance vs older content (>1 = growing, <1 = declining)
- **Age Distribution** - Video count breakdown: 0-7d, 8-14d, 15-28d
- **Performance Trend** - Views/day comparison: recent vs older videos

**Detection Logic:**
- 🚀 **Accelerating**: More recent videos + better performance (ratio ≥ 1.2x)
- ⚠️ **Dying**: 50%+ drop in recent activity or underperforming new content
- 📊 **Stable**: Consistent activity and performance over time

### Scores
- **Trend Score** = (recent_7d_count × 2) + recent_28d_count
- **Outlier Score** = (outlier_video_count × 3) + (cross_creator_count × 2) + (avg_views_per_day / 1000)
- **Momentum Score** = Normalized (0-100) combination of both

## 🏗️ Architecture

```
topicality-momentum/
├── index.js          # Express server & API endpoints
├── youtube.js        # YouTube API client
├── queries.js        # Query expansion logic
├── scoring.js        # Metrics & scoring algorithms
├── ranker.js         # Topic ranking orchestration
├── config.js         # Configuration & constants
├── public/
│   └── index.html    # Web UI
├── package.json
└── .env              # Environment variables
```

## 🔧 Configuration

Edit `config.js` to customize:

- `MAX_RESULTS` - Videos per query (default: 25)
- `DAYS_BACK` - Historical window (default: 28)
- `QUERIES_PER_TOPIC` - Query expansions (default: 4)
- `OUTLIER_PERCENTILE` - Threshold for outliers (default: 75)
- Scoring weights for different metrics

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rank` | POST | Analyze and rank topics |
| `/api/health` | GET | Health check |
| `/api/cache/clear` | POST | Clear in-memory cache |

## ⚠️ Important Notes

### API Quota Management
- YouTube Data API has daily quota limits (10,000 units by default)
- Each search costs 100 units, each video details call costs 1 unit
- The system uses caching to minimize repeated API calls
- For 5 topics with 4 queries each: ~2,500 units per analysis

### Rate Limiting
- Consider implementing rate limiting for production use
- Use cache clearing endpoint sparingly

### Data Freshness
- Videos are fetched from the last 28 days
- Metrics are calculated at request time
- Cache persists until server restart or manual clear

## 🎨 Customization

### Modify Query Expansion
Edit `queries.js` to change how topics are expanded into search queries.

### Adjust Scoring Weights
Edit `CONFIG.WEIGHTS` in `config.js` to tune the scoring algorithm.

### Customize UI
Edit `public/index.html` to modify the web interface styling and behavior.

## 🚀 Deployment

### Deploy to Railway (Recommended ⭐)

Railway is **perfect** for this app! It runs persistent Node.js servers, so your in-memory cache works flawlessly.

**Why Railway?**
- ✅ In-memory cache works (single persistent server)
- ✅ No cold starts or execution time limits
- ✅ Free tier: $5 credit/month (~500 hours)
- ✅ Simple: Push to GitHub → Auto-deploy

**Quick Deploy:**

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push
   ```

2. Go to [railway.app](https://railway.app) and sign in with GitHub

3. Click **"New Project"** → **"Deploy from GitHub repo"**

4. Select your repository

5. Add environment variable:
   - **Variable**: `YOUTUBE_API_KEY`
   - **Value**: Your API key

6. Done! Your app is live at `https://your-app.up.railway.app`

**Detailed instructions**: See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

### Alternative: Other Platforms

**Not recommended** for this app:
- ❌ Vercel/Netlify: Serverless = cache doesn't persist across requests
- ⚠️ Render: Works but free tier has cold starts
- ⚠️ Heroku: No free tier anymore

Railway is the best choice for maintaining cache efficiency!

## 🐛 Troubleshooting

**"YOUTUBE_API_KEY is required" error**
- Ensure `.env` file exists with valid API key

**"Quota exceeded" error**
- Wait for quota reset (midnight PT)
- Or request quota increase from Google Cloud Console

**No videos found**
- Check if topics are too niche or misspelled
- Try broader topic terms
- Verify API key has YouTube Data API v3 enabled

## 📄 License

MIT

## 🤝 Contributing

This is a production-ready system. To contribute:
1. Test with real YouTube API key
2. Verify quota usage is optimized
3. Maintain deterministic scoring behavior
4. Update README with any configuration changes
