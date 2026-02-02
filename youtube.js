import axios from 'axios';
import { CONFIG } from './config.js';

const cache = new Map();

/**
 * YouTube API Client
 */
export class YouTubeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = CONFIG.YOUTUBE_BASE_URL;
  }

  /**
   * Search for videos matching a query
   */
  async searchVideos(query, maxResults = CONFIG.MAX_RESULTS) {
    const cacheKey = `search:${query}:${maxResults}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - CONFIG.DAYS_BACK);

    try {
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          key: this.apiKey,
          q: query,
          type: 'video',
          part: 'id',
          maxResults,
          order: 'date',
          publishedAfter: publishedAfter.toISOString()
        }
      });

      const videoIds = response.data.items.map(item => item.id.videoId);
      cache.set(cacheKey, videoIds);
      return videoIds;
    } catch (error) {
      console.error(`Error searching videos for query "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Get video details including statistics
   */
  async getVideoDetails(videoIds) {
    if (!videoIds || videoIds.length === 0) return [];

    const cacheKey = `videos:${videoIds.join(',')}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    try {
      const response = await axios.get(`${this.baseURL}/videos`, {
        params: {
          key: this.apiKey,
          id: videoIds.join(','),
          part: 'snippet,statistics'
        }
      });

      const videos = response.data.items.map(item => ({
        videoId: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        viewCount: parseInt(item.statistics.viewCount || 0),
        likeCount: parseInt(item.statistics.likeCount || 0),
        commentCount: parseInt(item.statistics.commentCount || 0)
      }));

      cache.set(cacheKey, videos);
      return videos;
    } catch (error) {
      console.error('Error fetching video details:', error.message);
      return [];
    }
  }

  /**
   * Get channel statistics
   */
  async getChannelDetails(channelIds) {
    if (!channelIds || channelIds.length === 0) return {};

    const uniqueChannelIds = [...new Set(channelIds)];
    const cacheKey = `channels:${uniqueChannelIds.join(',')}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    try {
      const response = await axios.get(`${this.baseURL}/channels`, {
        params: {
          key: this.apiKey,
          id: uniqueChannelIds.join(','),
          part: 'statistics'
        }
      });

      const channelMap = {};
      response.data.items.forEach(item => {
        channelMap[item.id] = {
          subscriberCount: parseInt(item.statistics.subscriberCount || 1)
        };
      });

      cache.set(cacheKey, channelMap);
      return channelMap;
    } catch (error) {
      console.error('Error fetching channel details:', error.message);
      return {};
    }
  }

  /**
   * Fetch all data for a query
   */
  async fetchQueryData(query) {
    // Step 1: Search for videos
    const videoIds = await this.searchVideos(query);
    if (videoIds.length === 0) return [];

    // Step 2: Get video details
    const videos = await this.getVideoDetails(videoIds);
    if (videos.length === 0) return [];

    // Step 3: Get channel details
    const channelIds = videos.map(v => v.channelId);
    const channels = await this.getChannelDetails(channelIds);

    // Step 4: Enrich videos with channel data
    return videos.map(video => ({
      ...video,
      subscriberCount: channels[video.channelId]?.subscriberCount || 1
    }));
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    cache.clear();
  }
}

/**
 * Create a singleton instance
 */
export function createYouTubeClient() {
  if (!CONFIG.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY is required in .env file');
  }
  return new YouTubeClient(CONFIG.YOUTUBE_API_KEY);
}
