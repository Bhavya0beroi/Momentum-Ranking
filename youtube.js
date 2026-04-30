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
  async searchVideos(query, maxResults, options = { daysBack: 28, contentType: 'all', channelIds: [] }) {
    const channelIds = options.channelIds || [];
    const resolvedMax = maxResults || (options.daysBack > 28 ? CONFIG.MAX_RESULTS_LONG : CONFIG.MAX_RESULTS_SHORT);
    const channelKey = channelIds.join(',');
    const cacheKey = `search:${query}:${resolvedMax}:${options.daysBack}d:${options.contentType}:${channelKey}`;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - options.daysBack);

    const baseParams = {
      key: this.apiKey,
      q: query,
      type: 'video',
      part: 'id',
      maxResults: resolvedMax,
      order: 'date',
      publishedAfter: publishedAfter.toISOString()
    };

    // Build list of param sets — one per channel (or just baseParams if no channel filter)
    const paramSets = channelIds.length > 0
      ? channelIds.map(id => ({ ...baseParams, channelId: id }))
      : [baseParams];

    try {
      const allVideoIds = [];

      for (const params of paramSets) {
        if (options.contentType === 'short') {
          const res = await axios.get(`${this.baseURL}/search`, { params: { ...params, videoDuration: 'short' } });
          allVideoIds.push(...res.data.items.map(i => i.id.videoId));

        } else if (options.contentType === 'long') {
          const [medRes, longRes] = await Promise.all([
            axios.get(`${this.baseURL}/search`, { params: { ...params, videoDuration: 'medium' } }),
            axios.get(`${this.baseURL}/search`, { params: { ...params, videoDuration: 'long' } })
          ]);
          allVideoIds.push(...medRes.data.items.map(i => i.id.videoId));
          allVideoIds.push(...longRes.data.items.map(i => i.id.videoId));

        } else {
          const res = await axios.get(`${this.baseURL}/search`, { params });
          allVideoIds.push(...res.data.items.map(i => i.id.videoId));
        }
      }

      const videoIds = [...new Set(allVideoIds)];
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
  async fetchQueryData(query, options = { daysBack: 28, contentType: 'all', channelIds: [] }) {
    // Step 1: Search for videos
    const videoIds = await this.searchVideos(query, null, options);
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
   * Resolve YouTube channel URLs to channel IDs and titles.
   * Supports /channel/UC..., /@handle, and /c/customname formats.
   */
  async resolveChannelUrls(urls) {
    const results = [];
    for (const url of urls) {
      try {
        let channelId = null;
        let channelTitle = url;

        // Format 1: /channel/UCxxxxxx — extract ID directly
        const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
        if (channelMatch) {
          channelId = channelMatch[1];
        }

        // Format 2: /@username — resolve via forHandle
        if (!channelId) {
          const handleMatch = url.match(/youtube\.com\/@([\w.-]+)/);
          if (handleMatch) {
            const res = await axios.get(`${this.baseURL}/channels`, {
              params: { key: this.apiKey, forHandle: handleMatch[1], part: 'id,snippet' }
            });
            if (res.data.items?.length > 0) {
              channelId = res.data.items[0].id;
              channelTitle = res.data.items[0].snippet.title;
            }
          }
        }

        // Format 3: /c/customname — resolve via forUsername
        if (!channelId) {
          const customMatch = url.match(/youtube\.com\/c\/([\w.-]+)/);
          if (customMatch) {
            const res = await axios.get(`${this.baseURL}/channels`, {
              params: { key: this.apiKey, forUsername: customMatch[1], part: 'id,snippet' }
            });
            if (res.data.items?.length > 0) {
              channelId = res.data.items[0].id;
              channelTitle = res.data.items[0].snippet.title;
            }
          }
        }

        // Fetch title for Format 1 (only had the ID)
        if (channelId && channelTitle === url) {
          const res = await axios.get(`${this.baseURL}/channels`, {
            params: { key: this.apiKey, id: channelId, part: 'snippet' }
          });
          if (res.data.items?.length > 0) {
            channelTitle = res.data.items[0].snippet.title;
          }
        }

        if (channelId) {
          results.push({ url, channelId, channelTitle, resolved: true });
        } else {
          results.push({ url, channelId: null, channelTitle: null, resolved: false });
        }
      } catch (error) {
        results.push({ url, channelId: null, channelTitle: null, resolved: false, error: error.message });
      }
    }
    return results;
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
