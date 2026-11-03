<script setup lang="ts">
import TripEditor from './components/TripEditor.vue'
import TripHome from './components/TripHome.vue'
import { initTrips, useTrips } from './composables/useTrips'
import { useToast } from './composables/useToast'

initTrips()
const { activeTrip } = useTrips()
const { message } = useToast()
</script>

<template>
  <TripEditor v-if="activeTrip" :trip-id="activeTrip.id" />
  <TripHome v-else />
  <div v-if="message" class="toast" role="status">{{ message }}</div>
</template>
