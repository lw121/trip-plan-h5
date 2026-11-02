<script setup lang="ts">
import { ref } from 'vue'
import ImportDialog from './ImportDialog.vue'
import { useToast } from '../composables/useToast'
import { createTrip, deleteTrip, openTrip, useTrips } from '../composables/useTrips'
import { hasAmapKey } from '../lib/amap'
import { formatUpdated, tripStatsText } from '../lib/format'
import { makeDay } from '../lib/model'
import type { Place } from '../types'

const { sortedTrips } = useTrips()
const { show } = useToast()
const creating = ref(false)
const importing = ref(false)
const name = ref('')
const city = ref('')
const keyReady = hasAmapKey()

function submitCreate() {
  const id = createTrip({ name: name.value, city: city.value })
  name.value = ''
  city.value = ''
  creating.value = false
  openTrip(id)
}

function remove(id: string, tripName: string) {
  if (!window.confirm(`删除行程「${tripName}」？这台浏览器里的这份行程会被清掉。`)) return
  deleteTrip(id)
  show('已删除行程')
}

function onImport(payload: { name: string; city: string; days: { title: string; places: Place[] }[] }) {
  const id = createTrip({
    name: payload.name,
    city: payload.city,
    days: payload.days.map((day) => makeDay(day.title, day.places)),
  })
  importing.value = false
  openTrip(id)
  show(`已生成 ${payload.days.length} 天行程`)
}
</script>

<template>
  <main class="home">
    <header class="home-hero">
      <p class="eyebrow">本地行程本</p>
      <h1>行囊</h1>
      <p class="lede">把想去的地方排进每一天，在地图上看路线，再用高德开始导航。</p>
      <div class="hero-actions">
        <button type="button" class="btn primary" @click="creating = !creating">新建行程</button>
        <button type="button" class="btn pine" @click="importing = true">导入名单</button>
      </div>
      <p v-if="!keyReady" class="banner">
        还没有配置高德 Key。按 README 复制 .env.example 为 .env，填入 VITE_AMAP_KEY 后重新运行 npm run dev。
      </p>
      <form v-if="creating" class="create-card" @submit.prevent="submitCreate">
        <label>
          行程名称
          <input v-model="name" maxlength="40" placeholder="例如：杭州周末" />
        </label>
        <label>
          城市
          <input v-model="city" maxlength="20" placeholder="搜索地点时优先这个城市" />
        </label>
        <div class="modal-actions">
          <button type="button" class="btn ghost" @click="creating = false">取消</button>
          <button type="submit" class="btn primary">创建并编辑</button>
        </div>
      </form>
    </header>

    <section class="trip-list" aria-label="已保存的行程">
      <h2 v-if="sortedTrips.length">已保存</h2>
      <article v-for="trip in sortedTrips" :key="trip.id" class="trip-card">
        <button type="button" class="trip-open" @click="openTrip(trip.id)">
          <strong>{{ trip.name }}</strong>
          <span>{{ tripStatsText(trip.days.length, trip.days.reduce((sum, day) => sum + day.places.length, 0)) }}</span>
          <small>{{ trip.city || '未填城市' }} · 更新于 {{ formatUpdated(trip.updatedAt) }}</small>
        </button>
        <button type="button" class="btn ghost danger" @click="remove(trip.id, trip.name)">删除</button>
      </article>
      <div v-if="!sortedTrips.length" class="home-empty">
        <h2>还没有行程</h2>
        <ol>
          <li>新建一个行程，填上城市。</li>
          <li>按天搜索地点，上下移动安排顺序。</li>
          <li>打开地图看路线，或一键跳到高德导航。</li>
        </ol>
      </div>
    </section>

    <ImportDialog
      v-if="importing"
      mode="create"
      :initial-city="city"
      @close="importing = false"
      @confirm="onImport"
    />
  </main>
</template>
