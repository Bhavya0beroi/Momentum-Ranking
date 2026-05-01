import { CONFIG } from './config.js';

/**
 * Calculate age in days from published date
 */
function getAgeDays(publishedAt) {
  const published = new Date(publishedAt);
  const now = new Date();
  const diffMs = now - published;
  return Math.max(1, diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate derived metrics for a video
 */
export function calculateVideoMetrics(video) {
  const ageDays = getAgeDays(video.publishedAt);
  const viewsPerDay = video.viewCount / ageDays;
  const engagementRate = video.viewCount > 0 
    ? (video.likeCount + video.commentCount) / video.viewCount 
    : 0;
  const normalizedVelocity = viewsPerDay / Math.max(1, video.subscriberCount);

  return {
    ...video,
    ageDays,
    viewsPerDay,
    engagementRate,
    normalizedVelocity
  };
}

/**
 * Calculate percentile value from array
 */
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Count videos published within recent N days
 */
function countRecentVideos(videos, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return videos.filter(v => new Date(v.publishedAt) >= cutoff).length;
}

/**
 * Calculate velocity metrics based on age distribution and performance trends
 * Zero API quota - uses existing video data
 */
export function calculateVelocityMetrics(enrichedVideos) {
  if (enrichedVideos.length === 0) {
    return {
      freshness_score: 0,
      velocity_ratio: 0,
      is_accelerating: false,
      is_dying: false,
      is_stable: false,
      age_distribution: {
        videos_0_7d: 0,
        videos_8_14d: 0,
        videos_15_28d: 0
      },
      performance_trend: {
        recent_vpd: 0,
        older_vpd: 0
      },
      trend_signal: 'insufficient_data'
    };
  }

  // Age distribution buckets
  const videos_0_7d = enrichedVideos.filter(v => v.ageDays <= 7);
  const videos_8_14d = enrichedVideos.filter(v => v.ageDays > 7 && v.ageDays <= 14);
  const videos_15_28d = enrichedVideos.filter(v => v.ageDays > 14 && v.ageDays <= 28);

  const count_0_7d = videos_0_7d.length;
  const count_8_14d = videos_8_14d.length;
  const count_15_28d = videos_15_28d.length;

  // Freshness score: % of videos from last 7 days
  const freshness_score = Math.round((count_0_7d / enrichedVideos.length) * 100);

  // Performance comparison: recent vs older videos
  const recent_vpd = count_0_7d > 0
    ? videos_0_7d.reduce((sum, v) => sum + v.viewsPerDay, 0) / count_0_7d
    : 0;
  
  const older_vpd = (count_8_14d + count_15_28d) > 0
    ? [...videos_8_14d, ...videos_15_28d].reduce((sum, v) => sum + v.viewsPerDay, 0) / (count_8_14d + count_15_28d)
    : 0;

  // Velocity ratio: >1 = newer content performing better (growing)
  const velocity_ratio = older_vpd > 0 ? recent_vpd / older_vpd : (recent_vpd > 0 ? 2 : 0);

  // Trend detection logic
  const is_accelerating = 
    count_0_7d > count_8_14d && 
    count_8_14d >= count_15_28d &&
    velocity_ratio >= 1.2; // Recent videos performing 20%+ better

  const is_dying = 
    count_0_7d < count_8_14d * 0.5 || // Activity dropped by 50%+
    (velocity_ratio < 0.7 && count_0_7d < count_15_28d); // Recent videos underperforming

  const is_stable = !is_accelerating && !is_dying;

  // Overall trend signal
  let trend_signal = 'stable';
  if (is_accelerating) trend_signal = 'accelerating';
  else if (is_dying) trend_signal = 'dying';

  return {
    freshness_score,
    velocity_ratio: Math.round(velocity_ratio * 100) / 100,
    is_accelerating,
    is_dying,
    is_stable,
    age_distribution: {
      videos_0_7d: count_0_7d,
      videos_8_14d: count_8_14d,
      videos_15_28d: count_15_28d
    },
    performance_trend: {
      recent_vpd: Math.round(recent_vpd),
      older_vpd: Math.round(older_vpd)
    },
    trend_signal
  };
}

/**
 * Calculate topic-level metrics
 */
export function calculateTopicMetrics(videos) {
  if (videos.length === 0) {
    return {
      recent_7d_count: 0,
      recent_28d_count: 0,
      avg_views_per_day: 0,
      median_views_per_day: 0,
      outlier_video_count: 0,
      cross_creator_count: 0,
      total_video_count: 0
    };
  }

  // Calculate derived metrics for all videos
  const enrichedVideos = videos.map(calculateVideoMetrics);

  // Recent counts
  const recent_7d_count = countRecentVideos(enrichedVideos, 7);
  const recent_28d_count = countRecentVideos(enrichedVideos, 28);

  // Views per day stats
  const viewsPerDayValues = enrichedVideos.map(v => v.viewsPerDay);
  const avg_views_per_day = viewsPerDayValues.reduce((a, b) => a + b, 0) / viewsPerDayValues.length;
  const median_views_per_day = percentile(viewsPerDayValues, 50);

  // Outlier detection based on normalized velocity
  // Step 1: Filter videos with more than 20,000 views (qualified for outlier consideration)
  const eligibleForOutlier = enrichedVideos.filter(v => v.viewCount >= CONFIG.OUTLIER_MIN_VIEWS);
  const videos_above_20k_count = eligibleForOutlier.length;
  
  // Step 2: Among qualified videos, find top 25% by normalized velocity (true outliers)
  let outlier_video_count = 0;
  if (eligibleForOutlier.length > 0) {
    const velocities = eligibleForOutlier.map(v => v.normalizedVelocity);
    const velocityThreshold = percentile(velocities, CONFIG.OUTLIER_PERCENTILE);
    outlier_video_count = eligibleForOutlier.filter(v => v.normalizedVelocity >= velocityThreshold).length;
  }

  // Cross-creator count (unique channels)
  const uniqueChannels = new Set(enrichedVideos.map(v => v.channelId));
  const cross_creator_count = uniqueChannels.size;

  // Calculate velocity metrics (Option 2 & 3: age distribution + performance trend)
  const velocity_metrics = calculateVelocityMetrics(enrichedVideos);

  return {
    recent_7d_count,
    recent_28d_count,
    avg_views_per_day: Math.round(avg_views_per_day),
    median_views_per_day: Math.round(median_views_per_day),
    videos_above_20k_count,
    outlier_video_count,
    cross_creator_count,
    total_video_count: enrichedVideos.length,
    velocity_metrics,
    enrichedVideos
  };
}

/**
 * Calculate scores for a topic
 * Each dimension is normalized to 0-50, combined = 0-100
 */
export function calculateScores(metrics, allTopicsMetrics = []) {
  const { recent_7d_count, recent_28d_count, avg_views_per_day, outlier_video_count, cross_creator_count } = metrics;

  // Raw calculations
  const rawTrendScore = (recent_7d_count * CONFIG.WEIGHTS.RECENT_7D) + recent_28d_count;
  
  // Viral score includes:
  // 1. Outlier videos (high-performing >20K videos)
  // 2. Creator diversity (more creators = more validation)
  // 3. Average engagement (views per day)
  const videos_above_20k = metrics.videos_above_20k_count || 0;
  const rawOutlierScore = 
    (videos_above_20k * CONFIG.WEIGHTS.OUTLIER_VIDEO) +
    (cross_creator_count * CONFIG.WEIGHTS.CROSS_CREATOR) +
    (avg_views_per_day / 1000);

  return {
    rawTrendScore: Math.round(rawTrendScore * 100) / 100,
    rawOutlierScore: Math.round(rawOutlierScore * 100) / 100,
    trendScore: 0,  // Will be normalized to 0-50
    outlierScore: 0,  // Will be normalized to 0-50
    momentumScore: 0  // Will be sum of both (0-100)
  };
}

/**
 * Normalize scores across all topics
 * Trend Score: 0-50 points
 * Outlier Score: 0-50 points
 * Total Momentum: 0-100 points
 */
export function normalizeScores(topicResults) {
  if (topicResults.length === 0) return [];

  // Find max values for normalization (default 0 guards errored topics with missing raws)
  const trendScores = topicResults.map(r => r.scores.rawTrendScore ?? 0);
  const outlierScores = topicResults.map(r => r.scores.rawOutlierScore ?? 0);
  
  const maxTrend = Math.max(...trendScores, 1);
  const maxOutlier = Math.max(...outlierScores, 1);

  return topicResults.map(result => {
    const rawTrend = result.scores.rawTrendScore ?? 0;
    const rawOutlier = result.scores.rawOutlierScore ?? 0;
    // Normalize each dimension to 0-50
    const trendScore = Math.round((rawTrend / maxTrend) * 50);
    const outlierScore = Math.round((rawOutlier / maxOutlier) * 50);
    const momentumScore = trendScore + outlierScore;

    return {
      ...result,
      scores: {
        ...result.scores,
        trendScore,
        outlierScore,
        momentumScore
      }
    };
  });
}

/**
 * Get top videos for a topic
 * Only shows RECENT videos (last 14 days) sorted by views
 * This helps content creators see what's currently working
 */
export function getTopVideos(enrichedVideos, limit = 20, daysBack = 14) {
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - daysBack);
  
  return enrichedVideos
    .filter(v => new Date(v.publishedAt) >= recentCutoff)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit)
    .map(v => ({
      title: v.title,
      views: v.viewCount,
      views_per_day: Math.round(v.viewsPerDay),
      channel: v.channelTitle,
      subs: v.subscriberCount,
      url: `https://youtube.com/watch?v=${v.videoId}`,
      videoId: v.videoId,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      ageDays: Math.round(v.ageDays)
    }));
}

/**
 * Get all outlier videos (>20K views) for display
 */
export function getOutlierVideos(enrichedVideos) {
  return enrichedVideos
    .filter(v => v.viewCount >= CONFIG.OUTLIER_MIN_VIEWS)
    .sort((a, b) => b.viewCount - a.viewCount)
    .map(v => ({
      title: v.title,
      views: v.viewCount,
      views_per_day: Math.round(v.viewsPerDay),
      channel: v.channelTitle,
      subs: v.subscriberCount,
      url: `https://youtube.com/watch?v=${v.videoId}`,
      videoId: v.videoId,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      ageDays: Math.round(v.ageDays)
    }));
}
