<script setup>
import { ref, onMounted, watch } from 'vue';
import Event from './Event.vue';
import EventBook from './EventBook.vue';
import Skeleton from './Skeleton.vue';
import userStore from '../store/userStore';
import filtersStore from '../store/filtersStore';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.locale(userStore.locale || 'en');

/**
 * EventList component
 * Displays a grouped list of events by month
 * Handles both upcoming and past events with different sorting
 */

/**
 * @prop {string} type - Type of events to display ('past' or 'upcoming')
 */
const props = defineProps({
  // 'past' or 'upcoming'
  type: {
    type: String,
    required: true,
    validator: (value) => ['past', 'upcoming'].includes(value),
  },
});

// Reactive references for component state
const groupedEvents = ref({});
const loading = ref(true);
const error = ref(null);

/**
 * Formats year-month string into readable date
 * @param {string} yearMonth - Format: "YYYY-M"
 * @returns {string} Formatted date (e.g., "January" or "January 2024")
 */
const formatDate = (yearMonth) => {
  const [year, month] = yearMonth.split('-');
  const date = dayjs
    .utc()
    .year(year)
    .month(month - 1);
  const now = dayjs.utc();

  if (date.isSame(now, 'month') && date.isSame(now, 'year')) {
    return 'This month';
  }

  const formattedDate =
    userStore.timezone === 'event'
      ? date
      : date.tz(userStore.timezone || 'UTC');

  return date.isSame(now, 'year')
    ? formattedDate.format('MMMM')
    : formattedDate.format('MMMM YYYY');
};

/**
 * Groups and sorts events and books by month
 * - Groups items by calendar month
 * - Books appear at top of each month group
 * - Past events: reverse chronological order
 * - Upcoming events: chronological order
 * @param {Array} events - Array of event and book objects
 */
const groupEvents = (events) => {
  /**
   * Sort events chronologically
   * Past events are sorted in reverse order
   */
  const sortedEvents = [...events].sort((a, b) => {
    const comparison = dayjs(a.dateStart).diff(dayjs(b.dateStart));
    return props.type === 'past' ? -comparison : comparison;
  });

  /**
   * Group by year-month
   * Books use UTC dates
   * Events use local dates based on timezone
   */
  const groups = sortedEvents.reduce((groups, event) => {
    const date = dayjs(event.dateStart);
    const yearMonth =
      event._type === 'book'
        ? `${date.utc().year()}-${date.utc().month() + 1}`
        : `${date.year()}-${date.month() + 1}`;
    if (!groups[yearMonth]) groups[yearMonth] = [];
    groups[yearMonth].push(event);
    return groups;
  }, {});

  /**
   * Sort events within each month
   * Books appear first, followed by chronological events
   */
  Object.keys(groups).forEach((yearMonth) => {
    groups[yearMonth].sort((a, b) => {
      if ((a._type === 'book') === (b._type === 'book')) {
        return dayjs(a.dateStart).diff(dayjs(b.dateStart));
      }
      return a._type === 'book' ? -1 : 1;
    });
  });

  // Sort months (reverse for past events)
  const sortedGroups = Object.fromEntries(
    Object.entries(groups).sort((a, b) => {
      const [yearA, monthA] = a[0].split('-').map(Number);
      const [yearB, monthB] = b[0].split('-').map(Number);
      const comparison = yearA - yearB || monthA - monthB;
      return props.type === 'past' ? -comparison : comparison;
    })
  );

  groupedEvents.value = sortedGroups;
};

/**
 * Fetches books from the API endpoint
 * @returns {Promise<Array>} Array of book objects or empty array on error
 */
async function fetchBooks() {
  try {
    const response = await fetch('/api/get-books');
    if (!response.ok) throw new Error('Failed to fetch books');
    return await response.json();
  } catch (error) {
    console.error('Error fetching books:', error);
    return [];
  }
}

/**
 * Normalizes a date string to ISO format
 * @param {string} dateString - Date string from various sources
 * @returns {string|null} ISO date string or null if invalid
 */
const normalizeDate = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateString);
    return null;
  }
  return date.toISOString();
};

/**
 * Lifecycle hook: initializes component data
 * - Fetches and sets user info if needed
 * - Gets events from store
 * - Fetches and merges books with events
 * - Groups combined items by month
 */
onMounted(async () => {
  loading.value = true;
  error.value = null;

  try {
    if (!userStore.userInfoFetched) {
      const response = await fetch('/api/get-user-info');
      if (!response.ok) throw new Error('Failed to fetch user info');
      const data = await response.json();
      userStore.setUserInfo(data.timezone, data.acceptLanguage, data.geo);
    }

    // Get events from the store
    let events =
      props.type === 'past'
        ? filtersStore.pastEvents
        : filtersStore.filteredEvents;

    // Process events if we have them
    if (events && events.length > 0) {
      groupEvents(events);
    }
  } catch (e) {
    error.value = `Unable to load ${props.type} events. Please try again later.`;
    console.error('Error:', e);
  } finally {
    if (error.value || Object.keys(groupedEvents.value).length > 0) {
      loading.value = false;
    }
  }
});

onMounted(() => {
  const events =
    props.type === 'past'
      ? filtersStore.pastEvents
      : filtersStore.filteredEvents;
  if (events !== undefined) {
    groupEvents(events);
    loading.value = false;
  }
});

/**
 * Watch handler: updates grouped events when filters change
 * - Maintains books at top of each month group
 * - Preserves past/upcoming sort order
 */
watch(
  () =>
    props.type === 'past'
      ? filtersStore.pastEvents
      : filtersStore.filteredEvents,
  (newEvents) => {
    if (!loading.value) loading.value = true;
    error.value = null;

    try {
      if (newEvents) {
        // Remove length check to handle empty arrays
        groupEvents(newEvents);
        loading.value = false; // Always set loading to false when we have a response
      }
    } catch (e) {
      error.value = `Error updating ${props.type} events.`;
      console.error('Error:', e);
      loading.value = false;
    }
  }
);

watch(
  () =>
    props.type === 'past'
      ? filtersStore.pastEvents
      : filtersStore.filteredEvents,
  (newEvents) => {
    if (!loading.value) loading.value = true;
    error.value = null;

    try {
      if (newEvents !== undefined) {
        groupEvents(newEvents);
        loading.value = false;
      }
    } catch (e) {
      error.value = `Error updating ${props.type} events.`;
      console.error('Error:', e);
      loading.value = false;
    }
  }
);
</script>

<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="flow flow-xl">
      <Skeleton effect="sheen" />
      <Skeleton effect="sheen" />
      <Skeleton effect="sheen" />
    </div>

    <!-- Error state -->
    <sl-alert v-else-if="error" open variant="danger" class="my-xl">
      <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
      {{ error }}
    </sl-alert>

    <!-- No events state -->
    <sl-alert
      v-else-if="!loading && Object.keys(groupedEvents).length === 0"
      open
      class="my-xl"
    >
      <sl-icon slot="icon" name="info-circle"></sl-icon>
      {{
        type === 'past'
          ? 'There are no past events to display.'
          : 'There are no upcoming events to display.'
      }}
    </sl-alert>

    <!-- Events list -->
    <div :id="`${type}-events`" v-else class="flow flow-2xl">
      <section
        v-for="(events, yearMonth) in groupedEvents"
        :key="yearMonth"
        :id="'section-' + yearMonth"
        class="month flow flow-m"
      >
        <h2 :id="'heading-' + yearMonth" class="month__heading">
          {{ formatDate(yearMonth) }}
        </h2>
        <ol
          role="list"
          class="flow flow-l"
          :aria-labelledby="'heading-' + yearMonth"
        >
          <li v-for="event in events" :key="event._id">
            <EventBook v-if="event._type === 'book'" :book="event" />
            <Event v-else :event="event" />
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style>
h2 {
  font-size: var(--p-step-4);
}
</style>
