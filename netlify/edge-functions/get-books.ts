/**
 * Edge function to fetch and process book club books from Sanity CMS
 * - Fetches current and upcoming book club selections
 * - Orders books by date
 * - Implements caching to reduce API calls
 * - Returns minimal data structure for display
 */

import { createClient, SanityClient } from 'https://esm.sh/@sanity/client';

/**
 * Cache configuration to reduce Sanity API calls
 * - Stores processed book data for 5 minutes
 * - Includes timestamp for TTL calculation
 */
const cache = {
  data: null as any | null,
  timestamp: 0,
  ttl: 300000, // 5 minutes in milliseconds
};

/**
 * Gets Sanity configuration from environment variables
 * @returns {Object} Sanity client configuration
 */
function getConfig() {
  const projectId = Deno.env.get('SANITY_PROJECT');
  const dataset = Deno.env.get('SANITY_DATASET');
  const apiVersion = Deno.env.get('SANITY_API_VERSION');
  const useCdn = Deno.env.get('SANITY_CDN') === 'true';

  return {
    projectId: projectId || '',
    dataset: dataset || '',
    apiVersion: apiVersion || '2021-03-25',
    useCdn,
  };
}

/**
 * Creates and configures Sanity client
 * @returns {SanityClient} Configured Sanity client
 * @throws {Error} If client initialization fails
 */
function createSanityClient(): SanityClient {
  try {
    const config = getConfig();
    return createClient(config);
  } catch (error) {
    console.error('Failed to create Sanity client:', error);
    throw new Error('Sanity client initialization failed');
  }
}

/**
 * Fetches books from Sanity and processes them
 * - Retrieves all non-draft book documents
 * - Orders books by date descending
 * - Returns minimal data structure (_id, title, link, date)
 *
 * @param {SanityClient} client - Initialized Sanity client
 * @returns {Promise<Array>} Array of book objects
 * @throws {Error} If fetch or processing fails
 */
async function fetchBooksFromSanity(client: SanityClient) {
  try {
    return await client.fetch(`
      *[_type == "book"] | order(date desc) {
        _id,
        title,
        link,
        date
      }
    `);
  } catch (error) {
    console.error('[fetchBooksFromSanity] Failed:', error);
    throw new Error('Failed to fetch books from Sanity');
  }
}

/**
 * Gets books with caching
 * Returns cached data if valid, otherwise fetches fresh data
 * - Implements 5-minute cache to reduce API calls
 * - Logs cache hits and misses for monitoring
 *
 * @returns {Promise<Array>} Array of processed book objects
 */
async function getBooks() {
  // Check cache
  if (cache.data && Date.now() - cache.timestamp < cache.ttl) {
    console.log('[getBooks] Returning cached data');
    return cache.data;
  }

  // Fetch from Sanity
  console.log('[getBooks] Fetching fresh data from Sanity');
  const client = createSanityClient();
  const books = await fetchBooksFromSanity(client);

  // Update cache
  cache.data = books;
  cache.timestamp = Date.now();

  return books;
}

/**
 * Edge function handler
 * - Fetches and returns book data
 * - Implements proper caching headers
 * - Handles errors gracefully
 *
 * @returns {Response} JSON response with books data
 */
export default async function handler(): Promise<Response> {
  try {
    const books = await getBooks();

    return new Response(JSON.stringify(books), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=60',
        Vary: 'Accept-Encoding',
      },
    });
  } catch (error) {
    console.error('[handler] Failed:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Edge function configuration
 * Defines API endpoint path for book data
 */
export const config = { path: '/api/get-books' };

export { getBooks };
