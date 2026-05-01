import axios from 'axios';
import { CONFIG } from './config.js';

const cache = new Map();

// ---------------------------------------------------------------------------
// API key rotation
// ---------------------------------------------------------------------------
// Fall back to single YOUTUBE_API_KEY if YOUTUBE_API_KEYS isn't present (e.g. partial deploy)
const apiKeys = (CONFIG.YOUTUBE_API_KEYS && CONFIG.YOUTUBE_API_KEYS.length > 0)
  ? CONFIG.YOUTUBE_API_KEYS
  : CONFIG.YOUTUBE_API_KEY ? [CONFIG.YOUTUBE_API_KEY] : [];
let currentKeyIndex = 0;
const exhaustedKeys = new Set();

function getCurrentKey() {
  return apiKeys[currentKeyIndex];
}

function isQuotaError(error) {
  if (error.response?.status !== 403) return false;
  const reason = error.response?.data?.error?.errors?.[0]?.reason;
  return reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded';
}

/**
 * Rotate away from fromIndex when its quota is exceeded.
 * Returns true if a fresh key is available, false if all keys are exhausted.
 */
function rotateKey(fromIndex) {
  if (currentKeyIndex !== fromIndex) return true; // already rotated by a concurrent call
  exhaustedKeys.add(fromIndex);
  for (let i = 0; i < apiKeys.length; i++) {
    if (!exhaustedKeys.has(i)) {
      currentKeyIndex = i;
      console.warn(`[YouTube] Key ${fromIndex + 1} quota exceeded — switched to key ${i + 1}`);
      return true;
    }
  }
  return false;
}

/**
 * YouTube API Client
 */
export class YouTubeClient {
  constructor() {
    this.baseURL = CONFIG.YOUTUBE_BASE_URL;
  }

  /**
   * Axios GET with automatic key rotation on quota errors.
   * Tries every available key before giving up.
   */
  async apiGet(url, params) {
    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const keyIndex = currentKeyIndex;
      try {
        return await axios.get(url, { params: { ...params, key: apiKeys[keyIndex] } });
      } catch (error) {
        if (isQuotaError(error)) {
          const hasMore = rotateKey(keyIndex);
          if (!hasMore) {
            throw new Error('All YouTube API keys have reached their daily quota limit.');
          }
        } else {
          throw error;
        }
      }
    }
    throw new Error('All YouTube API keys have reached their daily quota limit.');
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

    const allVideoIds = [];

    for (const params of paramSets) {
      try {
        if (options.contentType === 'short') {
          const res = await this.apiGet(`${this.baseURL}/search`, { ...params, videoDuration: 'short' });
          allVideoIds.push(...(res.data.items || []).map(i => i.id.videoId));

        } else if (options.contentType === 'long') {
          // Fetch medium (4–20 min) and long (>20 min) independently
          // so a failure in one bucket doesn't lose the other's results
          try {
            const medRes = await this.apiGet(`${this.baseURL}/search`, { ...params, videoDuration: 'medium' });
            allVideoIds.push(...(medRes.data.items || []).map(i => i.id.videoId));
          } catch (e) {
            console.error(`Error fetching medium-duration videos for "${query}":`, e.message);
          }
          try {
            const longRes = await this.apiGet(`${this.baseURL}/search`, { ...params, videoDuration: 'long' });
            allVideoIds.push(...(longRes.data.items || []).map(i => i.id.videoId));
          } catch (e) {
            console.error(`Error fetching long-duration videos for "${query}":`, e.message);
          }

        } else {
          const res = await this.apiGet(`${this.baseURL}/search`, params);
          allVideoIds.push(...(res.data.items || []).map(i => i.id.videoId));
        }
      } catch (error) {
        console.error(`Error on search for query "${query}" (params: ${JSON.stringify(params)}):`, error.message);
        // Continue to next param set — don't abort the whole query
      }
    }

    const videoIds = [...new Set(allVideoIds)];
    cache.set(cacheKey, videoIds);
    return videoIds;
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
      const response = await this.apiGet(`${this.baseURL}/videos`, {
        id: videoIds.join(','),
        part: 'snippet,statistics'
      });

      const videos = (response.data.items || []).map(item => ({
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
      const response = await this.apiGet(`${this.baseURL}/channels`, {
        id: uniqueChannelIds.join(','),
        part: 'statistics'
      });

      const channelMap = {};
      (response.data.items || []).forEach(item => {
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
            const res = await this.apiGet(`${this.baseURL}/channels`, { forHandle: handleMatch[1], part: 'id,snippet' });
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
            const res = await this.apiGet(`${this.baseURL}/channels`, { forUsername: customMatch[1], part: 'id,snippet' });
            if (res.data.items?.length > 0) {
              channelId = res.data.items[0].id;
              channelTitle = res.data.items[0].snippet.title;
            }
          }
        }

        // Fetch title for Format 1 (only had the ID)
        if (channelId && channelTitle === url) {
          const res = await this.apiGet(`${this.baseURL}/channels`, { id: channelId, part: 'snippet' });
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
  if (apiKeys.length === 0) {
    throw new Error('At least one YOUTUBE_API_KEY is required in environment variables.');
  }
  console.log(`[YouTube] Initialized with ${apiKeys.length} API key(s).`);
  return new YouTubeClient();
}
