<template>
  <div class="event__dates text-muted">
    <!-- Display the start date of the event -->
    <span class="event__dateStart">
      <span class="sr-only">Starts</span>
      <!-- Display the pre-formatted start date -->
      <time :datetime="event.dateStartLocalizedISO" itemprop="startDate">
        {{ event.dateStartLocalizedDisplay }} ({{ event.timezoneName }})
        <!-- If the event is not a full day event, display the timezone abbreviation -->
        <abbr v-if="!event.day" :title="event.timezone">{{ event.timezone }}</abbr>
      </time>
    </span>
    <!-- If the event has an end date, display it -->
    <span v-if="event.dateEnd" class="event__dateEnd">
      <span class="sr-only">Ends</span>
      <i class="fa-solid fa-arrow-right-long"></i>
      <!-- Display the pre-formatted end date -->
      <time :datetime="event.dateEnd" itemprop="endDate">
        {{ event.dateEnd }} ({{ event.timezoneName }})
        <!-- If the event is not a full day event, display the timezone abbreviation -->
        <abbr v-if="!event.day" :title="event.timezone">{{ event.timezone }}</abbr>
      </time>
    </span>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
});
</script>

<!-- <style scoped>
</style> -->