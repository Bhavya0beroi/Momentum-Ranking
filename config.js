import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  PORT: process.env.PORT || 3000,
  
  // YouTube API endpoints
  YOUTUBE_BASE_URL: 'https://www.googleapis.com/youtube/v3',
  
  // Search parameters
  MAX_RESULTS: 25,
  DAYS_BACK: 28,
  
  // Query expansion
  QUERIES_PER_TOPIC: 4,
  
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
