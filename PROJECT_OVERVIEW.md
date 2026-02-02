# Project Overview - YouTube Momentum Ranking Engine

## 🎯 What This System Does

This is a complete, production-ready Node.js service that ranks content topics by analyzing real YouTube data to identify trending momentum and outlier signals.

**Input**: List of topic strings
**Output**: Topics ranked by momentum score with detailed metrics and top videos

## 📁 Project Structure

```
topicality-momentum/
│
├── 📄 index.js                 # Main Express server & API endpoints
├── 📄 youtube.js               # YouTube Data API v3 client with caching
├── 📄 queries.js               # Query expansion & topic variation generator
├── 📄 scoring.js               # Metrics calculation & scoring algorithms
├── 📄 ranker.js                # Topic ranking orchestration
├── 📄 config.js                # Configuration, API keys, constants
│
├── 📁 public/
│   └── 📄 index.html           # Beautiful web UI for topic analysis
│
├── 📄 package.json             # Dependencies & scripts
├── 📄 .env.example             # Environment variables template
├── 📄 .gitignore               # Git ignore rules
│
├── 📖 README.md                # Complete documentation
├── 📖 SETUP.md                 # Quick setup guide
├── 📖 PROJECT_OVERVIEW.md      # This file
└── 🧪 test-example.js          # Test script
```

## 🔄 Data Pipeline Flow

```
1. INPUT
   └─> ["Union Budget 2026", "RBI Injection", ...]

2. QUERY EXPANSION (queries.js)
   └─> Each topic → 3-5 search queries

3. YOUTUBE API (youtube.js)
   ├─> search.list → video IDs
   ├─> videos.list → view counts, likes, published dates
   └─> channels.list → subscriber counts

4. METRICS CALCULATION (scoring.js)
   ├─> Per Video: age_days, views_per_day, engagement_rate, normalized_velocity
   └─> Per Topic: recent_7d_count, outlier_count, cross_creator_count, etc.

5. SCORING (scoring.js)
   ├─> Trend Score = (7d_count × 2) + 28d_count
   ├─> Outlier Score = (outliers × 3) + (creators × 2) + avg_views
   └─> Momentum Score = Normalized(Trend + Outlier)

6. RANKING (ranker.js)
   └─> Sort topics by momentum score DESC

7. OUTPUT
   └─> JSON with ranked topics, metrics, scores, top videos
```

## 🏗️ Component Details

### index.js - API Server
- Express server on port 3000
- POST `/api/rank` - Main ranking endpoint
- GET `/api/health` - Health check
- POST `/api/cache/clear` - Clear cache
- Serves static HTML from public/

### youtube.js - API Client
- YouTube Data API v3 wrapper
- Methods:
  - `searchVideos(query)` - Search for videos
  - `getVideoDetails(videoIds)` - Fetch video stats
  - `getChannelDetails(channelIds)` - Fetch channel stats
  - `fetchQueryData(query)` - Complete data pipeline
- In-memory caching for quota optimization
- Error handling & rate limiting

### queries.js - Query Expansion
- `expandTopic(topic)` - Generate 3-5 variations
- Strategies:
  - Keyword extraction
  - Context addition (India, explained, news)
  - Filler word removal
  - Important term combinations
- Ensures comprehensive coverage

### scoring.js - Metrics & Scoring
- `calculateVideoMetrics()` - Derived metrics per video
- `calculateTopicMetrics()` - Aggregate metrics per topic
- `calculateScores()` - Trend & Outlier scores
- `normalizeScores()` - 0-100 momentum score
- `getTopVideos()` - Extract top performers
- Uses percentile-based outlier detection

### ranker.js - Orchestration
- `processTopic()` - Complete pipeline for one topic
- `rankTopics()` - Process and rank multiple topics
- Video deduplication across queries
- Channel deduplication for unique creator count
- Progress logging
- Error handling per topic

### config.js - Configuration
- Environment variables (API keys, port)
- YouTube API endpoints
- Search parameters (days back, max results)
- Scoring weights
- Outlier percentile threshold

### public/index.html - Web UI
- Clean, modern gradient design
- Textarea for multi-line topic input
- Real-time analysis with loading states
- Ranked results with:
  - Rank badges
  - Momentum scores (0-100)
  - Detailed metrics grid
  - Top performing videos with links
- Error handling & validation
- Responsive layout

## 🎯 Key Features

### 1. Real YouTube Data
- Not heuristics or assumptions
- Live API data from last 28 days
- Recent activity weighting (7-day priority)

### 2. Multi-dimensional Scoring
- **Trend**: Recent activity volume
- **Outlier**: Breakthrough content detection
- **Cross-creator**: Topic adoption breadth
- **Velocity**: Normalized by channel size

### 3. Smart Query Expansion
- Generates multiple search angles
- Contextual variations
- Maximizes coverage

### 4. Outlier Detection
- 75th percentile normalized velocity threshold
- Identifies videos punching above weight
- Weights outliers heavily in scoring

### 5. Quota Optimization
- In-memory caching
- Deduplication
- Efficient batch API calls
- ~2,500 units per 5-topic analysis

### 6. Production Ready
- Error handling
- Progress logging
- Deterministic scoring
- Clean architecture
- Comprehensive docs

## 🚀 Usage Modes

### 1. Web Interface (Primary)
```
npm start
→ Open http://localhost:3000
→ Enter topics
→ View beautiful ranked results
```

### 2. API Endpoint
```bash
curl -X POST http://localhost:3000/api/rank \
  -H "Content-Type: application/json" \
  -d '{"topics":["Topic 1","Topic 2"]}'
```

### 3. Programmatic (Module)
```javascript
import { createYouTubeClient } from './youtube.js';
import { rankTopics } from './ranker.js';

const client = createYouTubeClient();
const results = await rankTopics(topics, client);
```

### 4. Test Script
```bash
node test-example.js
```

## 📊 Output Format

```json
{
  "topic": "Union Budget 2026",
  "queries": ["Union Budget 2026", "Budget 2026 India", ...],
  "metrics": {
    "recent_7d_count": 15,
    "recent_28d_count": 42,
    "avg_views_per_day": 12500,
    "median_views_per_day": 8200,
    "outlier_video_count": 8,
    "cross_creator_count": 12,
    "total_video_count": 42
  },
  "scores": {
    "trendScore": 72,
    "outlierScore": 45.5,
    "momentumScore": 95
  },
  "top_videos": [
    {
      "title": "Union Budget 2026 Explained",
      "views": 125000,
      "views_per_day": 25000,
      "channel": "Finance Channel",
      "subs": 500000,
      "url": "https://youtube.com/watch?v=..."
    }
  ]
}
```

## ⚙️ Configuration Options

Edit `config.js` to tune:

```javascript
MAX_RESULTS: 25,              // Videos per query
DAYS_BACK: 28,                // Historical window
QUERIES_PER_TOPIC: 4,         // Query expansions
OUTLIER_PERCENTILE: 75,       // Outlier threshold

WEIGHTS: {
  RECENT_7D: 2,               // 7-day activity weight
  OUTLIER_VIDEO: 3,           // Outlier video weight
  CROSS_CREATOR: 2            // Unique creator weight
}
```

## 🎨 Customization Points

1. **Query Strategy** - Edit `queries.js` → `generateVariations()`
2. **Scoring Algorithm** - Edit `scoring.js` → `calculateScores()`
3. **UI Design** - Edit `public/index.html` → `<style>` section
4. **API Behavior** - Edit `index.js` → route handlers
5. **Cache Strategy** - Edit `youtube.js` → cache logic

## ✅ What Makes This Production-Ready

1. **Robust Error Handling** - API failures don't crash the system
2. **Quota Awareness** - Caching & deduplication minimize API usage
3. **Deterministic** - Same input → same output (within cache window)
4. **Scalable** - Can process up to 10 topics per request
5. **Observable** - Console logging for debugging
6. **Documented** - Comprehensive README & code comments
7. **Tested** - Test script included
8. **Configurable** - Easy to tune without code changes
9. **User-Friendly** - Beautiful UI for non-technical users
10. **Professional** - Clean code, proper architecture

## 📚 Documentation Files

- **README.md** - Complete documentation, API reference, troubleshooting
- **SETUP.md** - Quick start guide, step-by-step instructions
- **PROJECT_OVERVIEW.md** - This file, architecture & design
- **Code Comments** - Inline documentation in all modules

## 🔐 Security Notes

- API key in `.env` (never committed)
- `.gitignore` configured properly
- No sensitive data in responses
- Input validation on API endpoints
- No shell command injection vectors

## 🎓 Learning Resources

To understand the codebase:
1. Start with `index.js` - entry point
2. Follow request flow: index → ranker → youtube → scoring
3. Check `test-example.js` for usage patterns
4. Read inline comments in each module
5. Try modifying `queries.js` first (easiest)

## 🚦 Next Steps

1. **Setup**: Follow SETUP.md
2. **Test**: Run `node test-example.js`
3. **Use**: Open web UI, analyze topics
4. **Customize**: Modify query expansion or scoring
5. **Deploy**: Consider adding rate limiting for production

---

Built with ❤️ using Node.js, Express, YouTube Data API v3
