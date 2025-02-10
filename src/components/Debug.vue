<template>
  <div>
    <p>Random Number: {{ currentNumber }}</p>
    <button type="button" @click="generateNew">Generate New Number</button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'Debug',
  props: {
    ssrNumber: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    console.log('Received SSR number:', props.ssrNumber);
    const currentNumber = ref(props.ssrNumber);

    const generateNew = () => {
      currentNumber.value = Math.floor(Math.random() * 100) + 1;
    };

    return {
      currentNumber,
      generateNew,
    };
  },
});
</script>

<style scoped>
.random-number {
  padding: 1rem;
  text-align: center;
}

.button {
  padding: 0.5rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.button:hover {
  background-color: #45a049;
}

.debug {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 1rem;
}
</style>
