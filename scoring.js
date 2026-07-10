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
 * Calculate velocity metrics based on age distribution and performance trends.
 * Zero API quota — uses existing video data.
 *
 * For daysBack ≤ 28: fixed buckets 0-7d / 8-14d / 15-28d (unchanged behaviour).
 * For daysBack > 28: buckets scale to thirds of the window so that the trend
 *   signal (accelerating/dying/stable) and freshness_score reflect the full
 *   period rather than always pointing at the first 28 days.
 *   The age_distribution object always includes the literal 0-7d / 8-14d /
 *   15-28d counts so the UI doesn't need updating, plus bucket_labels showing
 *   the actual ranges used for analysis.
 */
export function calculateVelocityMetrics(enrichedVideos, daysBack = 28) {
  const empty = {
    freshness_score: 0,
    velocity_ratio: 0,
    is_accelerating: false,
    is_dying: false,
    is_stable: false,
    age_distribution: {
      videos_0_7d: 0,
      videos_8_14d: 0,
      videos_15_28d: 0,
      bucket_labels: { b1: '0-7d', b2: '8-14d', b3: '15-28d' }
    },
    performance_trend: { recent_vpd: 0, older_vpd: 0 },
    trend_signal: 'insufficient_data'
  };
  if (enrichedVideos.length === 0) return empty;

  // ── Fixed 0-7 / 8-14 / 15-28 counts (always present for UI) ──────────────
  const v_0_7   = enrichedVideos.filter(v => v.ageDays <= 7);
  const v_8_14  = enrichedVideos.filter(v => v.ageDays > 7  && v.ageDays <= 14);
  const v_15_28 = enrichedVideos.filter(v => v.ageDays > 14 && v.ageDays <= 28);

  // ── Analysis buckets (scale to thirds for long windows) ───────────────────
  let b1_max, b2_max, bucketLabels;
  if (daysBack <= 28) {
    b1_max = 7;
    b2_max = 14;
    bucketLabels = { b1: '0-7d', b2: '8-14d', b3: '15-28d' };
  } else {
    // Proportional thirds of the full window
    b1_max = Math.round(daysBack / 3);
    b2_max = Math.round((daysBack * 2) / 3);
    bucketLabels = { b1: `0-${b1_max}d`, b2: `${b1_max + 1}-${b2_max}d`, b3: `${b2_max + 1}-${daysBack}d` };
  }

  const recent  = enrichedVideos.filter(v => v.ageDays <= b1_max);
  const middle  = enrichedVideos.filter(v => v.ageDays > b1_max && v.ageDays <= b2_max);
  const oldest  = enrichedVideos.filter(v => v.ageDays > b2_max);

  const cnt_recent = recent.length;
  const cnt_middle = middle.length;
  const cnt_oldest = oldest.length;

  // Freshness: % of videos in the most-recent bucket
  const freshness_score = Math.round((cnt_recent / enrichedVideos.length) * 100);

  // Performance: views/day for recent bucket vs combined older buckets
  const avgVpd = arr => arr.length > 0
    ? arr.reduce((s, v) => s + v.viewsPerDay, 0) / arr.length
    : 0;

  const recent_vpd = avgVpd(recent);
  const older_vpd  = avgVpd([...middle, ...oldest]);

  const velocity_ratio = older_vpd > 0 ? recent_vpd / older_vpd : (recent_vpd > 0 ? 2 : 0);

  const is_accelerating =
    cnt_recent > cnt_middle &&
    cnt_middle >= cnt_oldest &&
    velocity_ratio >= 1.2;

  const is_dying =
    cnt_recent < cnt_middle * 0.5 ||
    (velocity_ratio < 0.7 && cnt_recent < cnt_oldest);

  const is_stable = !is_accelerating && !is_dying;

  let trend_signal = 'stable';
  if (is_accelerating) trend_signal = 'accelerating';
  else if (is_dying)   trend_signal = 'dying';

  return {
    freshness_score,
    velocity_ratio: Math.round(velocity_ratio * 100) / 100,
    is_accelerating,
    is_dying,
    is_stable,
    age_distribution: {
      // Literal 7d/14d/28d counts — always present so the UI works unchanged
      videos_0_7d:   v_0_7.length,
      videos_8_14d:  v_8_14.length,
      videos_15_28d: v_15_28.length,
      // Analysis bucket counts and their labels (scale with daysBack)
      bucket_1: cnt_recent,
      bucket_2: cnt_middle,
      bucket_3: cnt_oldest,
      bucket_labels: bucketLabels
    },
    performance_trend: {
      recent_vpd: Math.round(recent_vpd),
      older_vpd:  Math.round(older_vpd)
    },
    trend_signal
  };
}

/**
 * Calculate topic-level metrics.
 * @param {Array}  videos   - filtered video objects
 * @param {number} daysBack - search window (used to scale velocity buckets)
 */
export function calculateTopicMetrics(videos, daysBack = 28) {
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
  const recent_7d_count  = countRecentVideos(enrichedVideos, 7);
  const recent_28d_count = countRecentVideos(enrichedVideos, 28);

  // Views per day stats
  const viewsPerDayValues = enrichedVideos.map(v => v.viewsPerDay);
  const avg_views_per_day    = viewsPerDayValues.reduce((a, b) => a + b, 0) / viewsPerDayValues.length;
  const median_views_per_day = percentile(viewsPerDayValues, 50);

  // Outlier detection: videos >20K views, top 25% by normalised velocity
  const eligibleForOutlier   = enrichedVideos.filter(v => v.viewCount >= CONFIG.OUTLIER_MIN_VIEWS);
  const videos_above_20k_count = eligibleForOutlier.length;
  let outlier_video_count = 0;
  if (eligibleForOutlier.length > 0) {
    const velocities = eligibleForOutlier.map(v => v.normalizedVelocity);
    const velocityThreshold = percentile(velocities, CONFIG.OUTLIER_PERCENTILE);
    outlier_video_count = eligibleForOutlier.filter(v => v.normalizedVelocity >= velocityThreshold).length;
  }

  // Cross-creator count (unique channels)
  const uniqueChannels   = new Set(enrichedVideos.map(v => v.channelId));
  const cross_creator_count = uniqueChannels.size;

  // Velocity metrics — pass daysBack so buckets scale correctly for 90/180/365d
  const velocity_metrics = calculateVelocityMetrics(enrichedVideos, daysBack);

  return {
    recent_7d_count,
    recent_28d_count,
    avg_views_per_day:    Math.round(avg_views_per_day),
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
 * Calculate scores for a topic.
 * Each dimension is normalised to 0-50, combined = 0-100.
 *
 * Trend score formula:
 *  daysBack ≤ 28 (original): recent_7d×2 + recent_28d
 *  daysBack > 28 (long window): recent_7d×2 + total_video_count×LONG_WINDOW_TOTAL
 *    — videos from day 29–365 contribute via total_video_count so sustained
 *      long-term interest is reflected rather than being invisible to the score.
 *
 * @param {object} metrics          - output of calculateTopicMetrics
 * @param {Array}  allTopicsMetrics - unused, kept for interface compatibility
 * @param {number} daysBack         - the search window
 */
export function calculateScores(metrics, allTopicsMetrics = [], daysBack = 28) {
  const {
    recent_7d_count, recent_28d_count, total_video_count,
    avg_views_per_day, cross_creator_count
  } = metrics;

  let rawTrendScore;
  if (daysBack <= 28) {
    // Original formula — unchanged for 7/14/28d windows
    rawTrendScore = (recent_7d_count * CONFIG.WEIGHTS.RECENT_7D) + recent_28d_count;
  } else {
    // Long window: add full-period volume at a lower weight so sustained topics
    // score higher than flash-in-the-pan ones, while keeping 7d recency dominant.
    rawTrendScore =
      (recent_7d_count * CONFIG.WEIGHTS.RECENT_7D) +
      (total_video_count * (CONFIG.WEIGHTS.LONG_WINDOW_TOTAL || 0.3));
  }

  const videos_above_20k = metrics.videos_above_20k_count || 0;
  const rawOutlierScore =
    (videos_above_20k * CONFIG.WEIGHTS.OUTLIER_VIDEO) +
    (cross_creator_count * CONFIG.WEIGHTS.CROSS_CREATOR) +
    (avg_views_per_day / 1000);

  return {
    rawTrendScore:  Math.round(rawTrendScore  * 100) / 100,
    rawOutlierScore: Math.round(rawOutlierScore * 100) / 100,
    trendScore: 0,    // normalised to 0-50 in normalizeScores
    outlierScore: 0,  // normalised to 0-50
    momentumScore: 0  // sum of both (0-100)
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
