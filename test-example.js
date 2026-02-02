/**
 * Simple test script to verify the system works
 * Run with: node test-example.js
 */

import { createYouTubeClient } from './youtube.js';
import { rankTopics } from './ranker.js';

const testTopics = [
  "Union Budget 2026",
  "RBI Injection of 2 lakh crore",
  "Gold vs Silver vs Equity INR"
];

async function runTest() {
  console.log('\n🧪 Testing YouTube Momentum Ranking Engine\n');
  console.log('Test Topics:', testTopics);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    const youtubeClient = createYouTubeClient();
    const results = await rankTopics(testTopics, youtubeClient);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ TEST PASSED - Results Summary:\n');

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.topic}`);
      console.log(`   Momentum Score: ${result.scores.momentumScore}/100`);
      console.log(`   7-day videos: ${result.metrics.recent_7d_count}`);
      console.log(`   28-day videos: ${result.metrics.recent_28d_count}`);
      console.log(`   Unique creators: ${result.metrics.cross_creator_count}`);
      console.log(`   Avg views/day: ${result.metrics.avg_views_per_day.toLocaleString()}`);
      console.log('');
    });

    console.log('Test completed successfully! ✨\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nPossible issues:');
    console.error('  1. Missing or invalid YOUTUBE_API_KEY in .env');
    console.error('  2. YouTube API quota exceeded');
    console.error('  3. Network connectivity issues\n');
    process.exit(1);
  }
}

runTest();
