import { expandTopic } from './queries.js';
import { calculateTopicMetrics, calculateScores, normalizeScores, getTopVideos, getOutlierVideos } from './scoring.js';

/**
 * Deduplicate videos by videoId
 */
function deduplicateVideos(videos) {
  const seen = new Set();
  return videos.filter(video => {
    if (seen.has(video.videoId)) {
      return false;
    }
    seen.add(video.videoId);
    return true;
  });
}

/**
 * Process a single topic
 */
export async function processTopic(topic, youtubeClient) {
  console.log(`\n📊 Processing topic: "${topic}"`);
  
  // Step 1: Expand topic into queries
  const queries = expandTopic(topic);
  console.log(`  └─ Generated ${queries.length} queries`);

  // Step 2: Fetch data for all queries
  const allVideos = [];
  for (const query of queries) {
    console.log(`  └─ Fetching: "${query}"`);
    const videos = await youtubeClient.fetchQueryData(query);
    allVideos.push(...videos);
    console.log(`     ✓ Found ${videos.length} videos`);
  }

  // Step 3: Deduplicate videos
  const uniqueVideos = deduplicateVideos(allVideos);
  console.log(`  └─ Total unique videos: ${uniqueVideos.length}`);

  // Step 4: Calculate metrics
  const metrics = calculateTopicMetrics(uniqueVideos);
  
  // Log velocity metrics
  if (metrics.velocity_metrics) {
    const vm = metrics.velocity_metrics;
    console.log(`  └─ Velocity: ${vm.trend_signal.toUpperCase()} (freshness: ${vm.freshness_score}%, ratio: ${vm.velocity_ratio}x)`);
  }
  
  // Step 5: Calculate scores
  const scores = calculateScores(metrics);

  // Step 6: Get top videos (recent only - last 14 days)
  const topVideos = getTopVideos(metrics.enrichedVideos || []);
  
  // Step 7: Get all outlier videos (>20K views)
  const outlierVideos = getOutlierVideos(metrics.enrichedVideos || []);

  return {
    topic,
    queries,
    metrics: {
      recent_7d_count: metrics.recent_7d_count,
      recent_28d_count: metrics.recent_28d_count,
      avg_views_per_day: metrics.avg_views_per_day,
      median_views_per_day: metrics.median_views_per_day,
      videos_above_20k_count: metrics.videos_above_20k_count,
      outlier_video_count: metrics.outlier_video_count,
      cross_creator_count: metrics.cross_creator_count,
      total_video_count: metrics.total_video_count,
      velocity_metrics: metrics.velocity_metrics
    },
    scores,
    top_videos: topVideos,
    outlier_videos: outlierVideos
  };
}

/**
 * Rank multiple topics by momentum
 */
export async function rankTopics(topics, youtubeClient) {
  console.log(`\n🚀 Starting momentum analysis for ${topics.length} topics...\n`);
  console.log('━'.repeat(60));

  // Process all topics
  const results = [];
  for (const topic of topics) {
    try {
      const result = await processTopic(topic, youtubeClient);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error processing topic "${topic}":`, error.message);
      results.push({
        topic,
        queries: [],
        metrics: {
          recent_7d_count: 0,
          recent_28d_count: 0,
          avg_views_per_day: 0,
          median_views_per_day: 0,
          outlier_video_count: 0,
          cross_creator_count: 0,
          total_video_count: 0,
          velocity_metrics: {
            freshness_score: 0,
            velocity_ratio: 0,
            is_accelerating: false,
            is_dying: false,
            is_stable: false,
            trend_signal: 'error'
          }
        },
        scores: {
          trendScore: 0,
          outlierScore: 0,
          rawMomentumScore: 0
        },
        top_videos: [],
        error: error.message
      });
    }
  }

  console.log('\n' + '━'.repeat(60));

  // Normalize scores
  const normalizedResults = normalizeScores(results);

  // Sort by momentum score
  const ranked = normalizedResults.sort((a, b) => 
    b.scores.momentumScore - a.scores.momentumScore
  );

  console.log('\n✅ Analysis complete!\n');

  return ranked;
}
