<template>
  <section id="today">
    <div class="container flow">
      <hgroup role="group" aria-roledescription="Heading group">
        <h2>Today</h2>
        <p aria-roledescription="subtitle">
          <time class="text-muted" :datetime="today.format('YYYY-MM-DDTHH:mm:ssZ')">
            {{ today.format('MMMM D, YYYY h:mm A') }} ({{ userTimezone }})
          </time>
        </p>
      </hgroup>

      <p v-if="todaysEvents.length === 0">Take it easy, there are no events today.</p>
      <div v-else class="events flow">
        <ul role="list" class="flow">
          <li v-for="event in todaysEvents" :key="event._id">
            <Event :event="event" />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import Event from './Event.vue';
import filtersStore from '../store/filtersStore';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

const today = ref(dayjs());
const todaysEvents = ref([]);
const userTimezone = ref('America/New_York'); // Hardcoded for now

const updateTodaysEvents = () => {
  todaysEvents.value = filtersStore.todayEvents;
};

onMounted(async () => {
  // Get user's timezone from headers or context
  userTimezone.value = 'America/New_York'; // Hardcoded for now
  today.value = dayjs().tz(userTimezone.value);
  
  // if (!filtersStore.events.length) {
  //   await filtersStore.fetchEvents();
  // }
  updateTodaysEvents();
});

watch(
  () => filtersStore.todayEvents,
  () => {
    updateTodaysEvents();
  },
  { deep: true }
);
</script>

<!-- <style scoped>
</style> -->