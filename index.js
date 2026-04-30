import express from 'express';
import { CONFIG } from './config.js';
import { createYouTubeClient } from './youtube.js';
import { rankTopics } from './ranker.js';

const app = express();
const youtubeClient = createYouTubeClient();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main ranking endpoint
app.post('/api/rank', async (req, res) => {
  try {
    const { topics, daysBack = 28, contentType = 'all' } = req.body;
    const channelIds = Array.isArray(req.body.channelIds) ? req.body.channelIds : [];

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request. Provide an array of topics.' 
      });
    }

    if (topics.length > 10) {
      return res.status(400).json({ 
        error: 'Maximum 10 topics allowed per request' 
      });
    }

    if (![7, 14, 28, 90, 180, 365].includes(Number(daysBack))) {
      return res.status(400).json({ error: 'daysBack must be 7, 14, 28, 90, 180, or 365' });
    }

    if (!['all', 'short', 'long'].includes(contentType)) {
      return res.status(400).json({ error: 'contentType must be all, short, or long' });
    }

    if (!Array.isArray(channelIds) || channelIds.length > 10) {
      return res.status(400).json({ error: 'channelIds must be an array of max 10 channel IDs' });
    }

    console.log(`\n🎯 Ranking request received for ${topics.length} topics [${contentType}, ${daysBack}d, ${channelIds.length} channels]`);

    const results = await rankTopics(topics, youtubeClient, { daysBack: Number(daysBack), contentType, channelIds });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_topics: results.length,
      filters: { daysBack: Number(daysBack), contentType, channelIds },
      results
    });

  } catch (error) {
    console.error('Error in /api/rank:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Resolve YouTube channel URLs to channel IDs
app.post('/api/resolve-channels', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Provide an array of YouTube channel URLs' });
    }
    const channels = await youtubeClient.resolveChannelUrls(urls);
    res.json({ success: true, channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear cache endpoint
app.post('/api/cache/clear', (req, res) => {
  youtubeClient.clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

// Start server
app.listen(CONFIG.PORT, () => {
  console.log('\n🎬 YouTube Momentum Ranking Engine');
  console.log('━'.repeat(50));
  console.log(`🌐 Server: http://localhost:${CONFIG.PORT}`);
  console.log(`📊 API: http://localhost:${CONFIG.PORT}/api/rank`);
  console.log('━'.repeat(50));
  console.log('\n✅ Ready to rank topics!\n');
});
