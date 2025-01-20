/**
 * Edge function to fetch and process events from Sanity CMS
 * - Handles timezone conversion for international/local events
 * - Manages event classification (today/future/past)
 * - Includes debug info for timezone and event processing
 * - Implements caching to reduce API calls
 */

import { createClient, SanityClient } from 'https://esm.sh/@sanity/client';
import dayjs from 'https://esm.sh/dayjs';
import utc from 'https://esm.sh/dayjs/plugin/utc';
import timezone from 'https://esm.sh/dayjs/plugin/timezone';
import isBetween from 'https://esm.sh/dayjs/plugin/isBetween';
import isSameOrBefore from 'https://esm.sh/dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'https://esm.sh/dayjs/plugin/isSameOrAfter';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

interface Event {
  _id: string;
  _type: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  parent?: { _ref: string };
  children?: Event[];
  callForSpeakersClosingDate?: string;
  timezone?: string;
  website?: string;
  attendanceMode?: string;
  callForSpeakers?: boolean;
  type?: string;
  speakers?: Array<{
    _id: string;
    name: string;
  }>;
}

/**
 * Response structure for the events API
 * Includes processed event lists and optional debug information
 */
interface EventsResponse {
  events: Event[];
  future: Event[];
  past: Event[];
  today: Event[];
  debug?: {
    timezone?: {
      userInfoTimezone: string;
      resolvedTimezone: string;
      geo: any;
      headers: Record<string, string>;
    };
    events?: Array<{
      eventId: string;
      eventTitle: string;
      eventStart: string;
      eventEnd: string;
      userToday: string;
      isToday: boolean;
      isInternational: boolean;
    }>;
  };
}

/**
 * Cache configuration to reduce Sanity API calls
 * - Stores processed event data for 5 minutes
 * - Includes timestamp for TTL calculation
 */
const cache = {
  data: null as EventsResponse | null,
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
 * Sorts events array by start date
 * @param {Event[]} events - Array of event objects
 * @returns {Event[]} Sorted events array
 */
function sortEventsByDate(events: Event[]): Event[] {
  return events.sort(
    (a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
  );
}

/**
 * Processes events from Sanity and categorizes them
 * - Fetches events and their child events
 * - Creates CFS deadline events from parent events
 * - Converts dates to user's timezone
 * - Categorizes events as today/future/past
 */
async function fetchEventsFromSanity(
  client: SanityClient,
  userTimezone: string
): Promise<EventsResponse> {
  const debugLogs: Array<Record<string, any>> = [];

  try {
    // Fetch all non-draft events
    const events: Event[] = await client.fetch(`
      *[_type == "event" && !(_id in path("drafts.**"))] {
        ...,
        "speakers": speakers[]->{ _id, name }
      }
    `);

    // Fetch children for each event and add CFS deadline events
    const eventsWithChildrenAndDeadlines = await Promise.all(
      events.map(async (event) => {
        // Fetch child events for each parent event
        const children: Event[] = await client.fetch(
          `
        *[_type == "event" && parent._ref == $eventId] {
          ...,
          "speakers": speakers[]->{ _id, name }
        } | order(dateStart asc)
      `,
          { eventId: event._id }
        );

        // Add children to the event if any
        const eventWithChildren = {
          ...event,
          children: children.length > 0 ? children : undefined,
        };

        // Add CFS (Call for Speakers) deadline event if applicable
        const cfsDeadlineEvents: Event[] = [];
        if (event.callForSpeakersClosingDate) {
          cfsDeadlineEvents.push({
            _id: `${event._id}-cfs-deadline`,
            _type: 'event',
            type: 'deadline',
            title: `${event.title}`,
            dateStart: event.callForSpeakersClosingDate,
            timezone: event.timezone,
            website: event.website,
            attendanceMode: event.attendanceMode,
            callForSpeakers: event.callForSpeakers,
          });
        }

        // Return the event with children and CFS deadline events
        return [eventWithChildren, ...cfsDeadlineEvents];
      })
    );

    // Flatten the array of events
    const flattenedEvents = eventsWithChildrenAndDeadlines.flat();

    // Use user's timezone for base calculations
    const now = dayjs().tz(userTimezone);
    const todayStart = now.startOf('day');
    const todayEnd = now.endOf('day');

    /**
     * Converts event time to user's timezone
     * - Handles international events (no timezone) differently
     * - For international events: preserves date, uses user's timezone
     * - For local events: converts from event timezone to user timezone
     */
    const getEventTimeInUserTz = (dateStr: string, eventTz?: string) => {
      if (!eventTz) {
        // For international events, preserve the date but use user's timezone
        return dayjs.utc(dateStr).tz(userTimezone, true);
      }
      // For location-specific events, properly convert the time
      return dayjs(dateStr).tz(eventTz).tz(userTimezone);
    };

    /**
     * Determines if event is happening today
     * Event types and rules:
     * 1. Deadline events: Must match user's today exactly
     * 2. International events (no timezone):
     *    - Single day: Must match user's today
     *    - Multi-day: Must overlap with user's today
     * 3. Local events (with timezone):
     *    - Must overlap with user's today considering timezone
     */
    const isEventToday = (event: Event): boolean => {
      const userToday = dayjs().tz(userTimezone).startOf('day');

      // For CFS deadlines, only check if they fall within today
      if (event.type === 'deadline') {
        // Convert event time to user timezone first
        const eventDateInEventTz = dayjs(event.dateStart).tz(event.timezone);
        const eventDateInUserTz = eventDateInEventTz.tz(userTimezone);

        // Add debug logging
        debugLogs.push({
          eventId: event._id,
          eventTitle: event.title,
          rawStartDate: event.dateStart,
          eventDateInEventTz: eventDateInEventTz.format(
            'YYYY-MM-DD HH:mm:ss Z'
          ),
          eventDateInUserTz: eventDateInUserTz.format('YYYY-MM-DD HH:mm:ss Z'),
          userToday: userToday.format('YYYY-MM-DD HH:mm:ss Z'),
          isDeadline: true,
          eventTimezone: event.timezone,
          userTimezone: userTimezone,
        });

        return eventDateInUserTz.isSame(userToday, 'day');
      }

      if (!event.timezone) {
        // For international events, use user's timezone but only compare dates
        const eventStart = dayjs
          .tz(event.dateStart, userTimezone)
          .startOf('day');
        const isSingleDayEvent = !event.dateEnd;
        const eventEnd = isSingleDayEvent
          ? eventStart
          : dayjs.tz(event.dateEnd, userTimezone).startOf('day');

        // Simplified logic for single day events
        const isToday = isSingleDayEvent
          ? eventStart.isSame(userToday, 'day')
          : eventStart.isSame(userToday, 'day') ||
            eventEnd.isSame(userToday, 'day') ||
            (eventStart.isBefore(userToday, 'day') &&
              eventEnd.isAfter(userToday, 'day'));

        debugLogs.push({
          eventId: event._id,
          eventTitle: event.title,
          rawStartDate: event.dateStart,
          rawEndDate: event.dateEnd || 'No end date',
          isSingleDayEvent,
          eventStart: eventStart.format('YYYY-MM-DD'),
          eventEnd: eventEnd.format('YYYY-MM-DD'),
          userToday: userToday.format('YYYY-MM-DD'),
          isToday,
          isInternational: true,
        });

        return isToday;
      }

      // For events with start and end dates, check if they overlap with today
      const eventStart = dayjs(event.dateStart).tz(event.timezone);
      const eventEnd = event.dateEnd
        ? dayjs(event.dateEnd).tz(event.timezone)
        : eventStart.endOf('day'); // Use end of start date for events without end date

      return eventStart.isBefore(todayEnd) && eventEnd.isAfter(todayStart);
    };

    const today = sortEventsByDate(
      flattenedEvents.filter((event) => !event.parent && isEventToday(event))
    );

    const future = sortEventsByDate(
      flattenedEvents.filter((event) => {
        if (!event.parent) {
          const eventStart = getEventTimeInUserTz(
            event.dateStart,
            event.timezone
          );
          return eventStart.isAfter(todayEnd);
        }
        return false;
      })
    );

    const past = flattenedEvents.filter((event) => {
      if (!event.parent) {
        const eventEnd = getEventTimeInUserTz(
          event.dateEnd || event.dateStart,
          event.timezone
        );
        return eventEnd.isBefore(todayStart);
      }
      return false;
    });

    return {
      events: flattenedEvents,
      future,
      past,
      today,
      debug: debugLogs,
    };
  } catch (error) {
    console.error(
      '[fetchEventsFromSanity] Failed:',
      (error as unknown as { message?: string })?.message || error
    );
    throw new Error('Failed to fetch events from Sanity');
  }
}

/**
 * Gets events with caching
 * Returns cached data if valid, otherwise fetches fresh data
 * @param {string} userTimezone - User's timezone
 * @returns {EventsResponse} Events object
 */
async function getEvents(userTimezone: string): Promise<EventsResponse> {
  const client = createSanityClient();

  // Check cache
  if (cache.data && Date.now() - cache.timestamp < cache.ttl) {
    console.log('[getEvents] Returning cached data');
    console.log(
      '[getEvents] Cache timestamp:',
      new Date(cache.timestamp).toISOString()
    );
    console.log('[getEvents] Cache TTL (ms):', cache.ttl);
    return cache.data;
  }

  // Fetch from Sanity
  console.log('[getEvents] Fetching fresh data from Sanity');
  const events = await fetchEventsFromSanity(client, userTimezone);

  // Update cache
  cache.data = events;
  cache.timestamp = Date.now();
  console.log(
    '[getEvents] Cache updated at:',
    new Date(cache.timestamp).toISOString()
  );

  return events;
}

/**
 * Edge function handler
 * - Gets user timezone from Netlify geo context
 * - Fetches and processes events
 * - Adds debug information to response
 * - Sets caching headers
 * @param {Request} request - HTTP request object
 * @returns {Response} JSON response with events data
 */
export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  console.log('[handler] Received request:', request);
  try {
    // Use the context directly instead of making another request
    const userTimezone = context.geo?.timezone || 'UTC';

    const timezoneDebug = {
      userInfoTimezone: context.geo?.timezone,
      resolvedTimezone: userTimezone,
      geo: context.geo,
      headers: Object.fromEntries(request.headers),
    };

    console.log('[handler] Timezone debug:', timezoneDebug);
    console.log('[handler] Fetching events...');
    const events = await getEvents(userTimezone);
    const eventsWithDebug = {
      ...events,
      debug: {
        timezone: timezoneDebug,
        events: events.debug,
      },
    };
    console.log('[handler] Events fetched successfully:', events.events.length);

    return new Response(JSON.stringify(eventsWithDebug), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
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
 * Defines API endpoint path
 */
export const config = { path: '/api/get-events' };

export { getEvents };
