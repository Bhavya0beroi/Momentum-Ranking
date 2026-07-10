import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  YOUTUBE_API_KEYS: [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
  ].filter(Boolean),
  PORT: process.env.PORT || 3000,
  
  // YouTube API endpoints
  YOUTUBE_BASE_URL: 'https://www.googleapis.com/youtube/v3',
  
  // Search parameters — YouTube allows max 50 per search.list call (same quota cost as 25)
  MAX_RESULTS_SHORT: 25,   // for ranges ≤28 days
  MAX_RESULTS_LONG: 50,    // for ranges >28 days (3mo, 6mo, 1yr) — YouTube API max
  DAYS_BACK_DEFAULT: 28,
  VALID_DAYS_OPTIONS: [7, 14, 28, 90, 180, 365],
  VALID_CONTENT_TYPES: ['all', 'short', 'long'],
  
  // Query expansion — keep at 2 to conserve quota (each search.list costs 100 units)
  QUERIES_PER_TOPIC: 2,
  
  // Scoring weights
  WEIGHTS: {
    RECENT_7D: 2,
    OUTLIER_VIDEO: 3,
    CROSS_CREATOR: 2,
    TREND_WEIGHT: 0.5,      // Weight for time/trend dimension
    OUTLIER_WEIGHT: 0.5     // Weight for outlier dimension
  },
  
  // Outlier detection thresholds
  OUTLIER_PERCENTILE: 75,
  OUTLIER_MIN_VIEWS: 20000    // Minimum views to be considered for outlier detection
};
