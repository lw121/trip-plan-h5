<script setup lang="ts">
import type { DayPlan, Place } from '../types'

defineProps<{
  places: Place[]
  days: DayPlan[]
  dayId: string
  activeId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  locate: [id: string]
  up: [id: string]
  down: [id: string]
  remove: [id: string]
  move: [id: string, toDayId: string]
  navigate: [id: string]
}>()

function onMove(placeId: string, event: Event) {
  const select = event.target as HTMLSelectElement
  const toDayId = select.value
  select.value = ''
  if (toDayId) emit('move', placeId, toDayId)
}
</script>

<template>
  <ol v-if="places.length" class="stops">
    <li
      v-for="(place, index) in places"
      :id="`stop-${place.id}`"
      :key="place.id"
      class="stop"
      :class="{ 'is-active': place.id === activeId }"
    >
      <button type="button" class="stop-main" @click="emit('select', place.id)">
        <span class="stop-index">{{ index + 1 }}</span>
        <span class="stop-copy">
          <strong>{{ place.name }}</strong>
          <small>{{ place.address || place.city || '已保存的地点' }}</small>
        </span>
      </button>
      <div class="stop-actions">
        <button type="button" :disabled="index === 0" @click="emit('up', place.id)">上移</button>
        <button type="button" :disabled="index === places.length - 1" @click="emit('down', place.id)">下移</button>
        <button type="button" @click="emit('locate', place.id)">定位</button>
        <button type="button" @click="emit('navigate', place.id)">导航</button>
        <button type="button" class="danger" @click="emit('remove', place.id)">删除</button>
        <label v-if="days.length > 1" class="move-day">
          <span>移到</span>
          <select aria-label="移到其他天" @change="onMove(place.id, $event)">
            <option value="">选择一天</option>
            <option v-for="day in days.filter((item) => item.id !== dayId)" :key="day.id" :value="day.id">
              {{ day.title }}
            </option>
          </select>
        </label>
      </div>
    </li>
  </ol>
  <div v-else class="empty-day">
    <p>这一天还是空的。</p>
    <p>搜索一个地点加进来，或导入一整份名单。</p>
  </div>
</template>
