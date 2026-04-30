import { CONFIG } from './config.js';

/**
 * Generates multiple search queries from a single topic
 * Uses keyword extraction and variation strategies
 */
export function expandTopic(topic) {
  const queries = new Set();
  
  // Original topic
  queries.add(topic);
  
  // Extract key terms
  const words = topic.split(/\s+/).filter(w => w.length > 3);
  
  // Strategy 1: Important keywords combination
  if (words.length >= 3) {
    const firstTwo = words.slice(0, 2).join(' ');
    const lastTwo = words.slice(-2).join(' ');
    queries.add(firstTwo);
    queries.add(lastTwo);
  }
  
  // Strategy 2: Remove common filler words
  const fillers = ['vs', 'and', 'or', 'of', 'the', 'in', 'to', 'for'];
  const cleanedWords = words.filter(w => !fillers.includes(w.toLowerCase()));
  if (cleanedWords.length >= 2 && cleanedWords.length < words.length) {
    queries.add(cleanedWords.join(' '));
  }
  
  // Strategy 3: Topic variations with context
  const variations = generateVariations(topic);
  variations.forEach(v => queries.add(v));
  
  // Return limited number of queries
  // contentType is passed optionally to reduce quota for Long Form (2 API calls per query)
  return Array.from(queries).slice(0, CONFIG.QUERIES_PER_TOPIC);
}

/**
 * Generate contextual variations of the topic
 */
function generateVariations(topic) {
  const variations = [];
  const lowerTopic = topic.toLowerCase();
  
  // Add India context if not present
  if (!lowerTopic.includes('india') && !lowerTopic.includes('indian')) {
    variations.push(`${topic} India`);
  }
  
  // Add explanatory terms
  if (!lowerTopic.includes('explained') && !lowerTopic.includes('analysis')) {
    variations.push(`${topic} explained`);
  }
  
  // Add news/update context
  if (!lowerTopic.includes('news') && !lowerTopic.includes('update')) {
    variations.push(`${topic} news`);
  }
  
  return variations.slice(0, 2); // Limit variations
}

/**
 * Expand all topics in a list
 */
export function expandTopics(topics) {
  return topics.map(topic => ({
    topic,
    queries: expandTopic(topic)
  }));
}
