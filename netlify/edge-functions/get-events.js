import { createClient } from 'https://esm.sh/@sanity/client';
import dayjs from 'https://esm.sh/dayjs';
import utc from 'https://esm.sh/dayjs/plugin/utc';
import timezone from 'https://esm.sh/dayjs/plugin/timezone';
import localizedFormat from 'https://esm.sh/dayjs/plugin/localizedFormat';
import isBetween from 'https://esm.sh/dayjs/plugin/isBetween';
// import timezoneData from 'https://esm.sh/dayjs/plugin/timezone-data';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(isBetween);
// dayjs.extend(timezoneData);

// In-memory cache
let cache = {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutes in milliseconds
};

// Get Sanity config from environment variables
function getConfig() {
  const projectId = Deno.env.get('SANITY_PROJECT');
  const dataset = Deno.env.get('SANITY_DATASET');
  const apiVersion = Deno.env.get('SANITY_API_VERSION');
  const useCdn = Deno.env.get('SANITY_CDN');

  console.log('Environment Variables:', {
    SANITY_PROJECT: projectId,
    SANITY_DATASET: dataset,
    SANITY_API_VERSION: apiVersion,
    SANITY_CDN: useCdn,
  });

  return {
    projectId,
    dataset,
    apiVersion,
    useCdn: true
  };
}

// Initialize Sanity client
function createSanityClient() {
  try {
    const config = getConfig();
    return createClient(config);
  } catch (error) {
    console.error('Failed to create Sanity client:', error);
    throw new Error('Sanity client initialization failed');
  }
}

// Utility functions
function sortEventsByDate(events) {
  return events.sort((a, b) => 
    new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );
}

function localizeEventDates(event, userTimezone, userLocale) {
  return {
    ...event,
    dateStartLocalizedISO: dayjs(event.dateStart).tz(userTimezone).format(), // Use format() to get ISO string in the correct timezone
    dateEndLocalizedISO: event.dateEnd ? dayjs(event.dateEnd).tz(userTimezone).format() : null, // Use format() to get ISO string in the correct timezone
    dateStartLocalizedDisplay: dayjs(event.dateStart).tz(userTimezone).locale(userLocale).format('LLL'),
    dateEndLocalizedDisplay: event.dateEnd ? dayjs(event.dateEnd).tz(userTimezone).locale(userLocale).format('LLL') : null,
    timezoneName: userTimezone,
    children: event.children ? event.children.map(child => localizeEventDates(child, userTimezone, userLocale)) : undefined
  };
}

async function fetchEventsFromSanity(client, userTimezone, userLocale) {
  try {
    const events = await client.fetch(`
      *[_type == "event" && !(_id in path("drafts.**"))]
    `);

    // Fetch children for each event
    const eventsWithChildren = await Promise.all(events.map(async (event) => {
      const children = await client.fetch(`
        *[_type == "event" && parent._ref == $eventId] | order(dateStart asc)
      `, { eventId: event._id });

      return {
        ...event,
        children: children.length > 0 ? children : undefined
      };
    }));

    const localizedEvents = eventsWithChildren.map(event => localizeEventDates(event, userTimezone, userLocale));

    const now = dayjs().tz(userTimezone);
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');
    
    return {
      events: localizedEvents,
      future: sortEventsByDate(
        localizedEvents.filter(event => 
          dayjs(event.dateStartLocalizedISO).isAfter(now) && !event.parent
        )
      ),
      past: localizedEvents.filter(event => 
        event.dateEndLocalizedISO && dayjs(event.dateEndLocalizedISO).isBefore(now) && !event.parent
      ),
      today: sortEventsByDate(
        localizedEvents.filter(event => 
          dayjs(event.dateStartLocalizedISO).isBetween(todayStart, todayEnd, null, '[]') && !event.parent
        )
      ),
    };
  } catch (error) {
    console.error('[fetchEventsFromSanity] Failed:', error?.message || error);
    throw new Error('Failed to fetch events from Sanity');
  }
}

async function getEvents(userTimezone, userLocale) {
  const client = createSanityClient();

  // Check cache
  if (cache.data && (Date.now() - cache.timestamp < cache.ttl)) {
    console.log('Returning cached data');
    return cache.data;
  }

  // Fetch from Sanity
  const events = await fetchEventsFromSanity(client, userTimezone, userLocale);

  // Update cache
  cache.data = events;
  cache.timestamp = Date.now();

  return events;
}

export default async function handler(request, context) {
  try {
    // Hardcoded values for timezone and locale
    const userTimezone = 'America/New_York';
    const userLocale = 'en-us';
    
    // Log the hardcoded timezone and locale
    console.log('Hardcoded User Timezone:', userTimezone);
    console.log('Hardcoded User Locale:', userLocale);

    const events = await getEvents(userTimezone, userLocale);
    
    return new Response(JSON.stringify(events), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error) {
    console.error('[handler] Failed:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export const config = { path: '/api/get-events' };