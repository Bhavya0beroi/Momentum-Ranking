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
    const { topics } = req.body;

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

    console.log(`\n🎯 Ranking request received for ${topics.length} topics`);

    const results = await rankTopics(topics, youtubeClient);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_topics: results.length,
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
