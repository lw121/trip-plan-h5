<script setup lang="ts">
import { ref } from 'vue'
import { explainAmapError, searchPois } from '../lib/amap'
import type { PoiHit } from '../types'

const props = defineProps<{
  city: string
}>()

const emit = defineEmits<{
  select: [hit: PoiHit]
}>()

const keyword = ref('')
const results = ref<PoiHit[]>([])
const searching = ref(false)
const error = ref('')
const open = ref(false)
const composing = ref(false)
let timer = 0
let sequence = 0

function onInput(value: string) {
  keyword.value = value
  if (!composing.value) schedule()
}

function schedule() {
  window.clearTimeout(timer)
  const text = keyword.value.trim()
  if (!text) {
    results.value = []
    error.value = ''
    open.value = false
    searching.value = false
    return
  }
  timer = window.setTimeout(() => {
    void run(text)
  }, 320)
}

async function run(text: string) {
  const current = ++sequence
  searching.value = true
  error.value = ''
  try {
    const hits = await searchPois(text, props.city)
    if (current !== sequence || keyword.value.trim() !== text) return
    results.value = hits
    open.value = true
    if (!hits.length) error.value = '没有找到相关地点。可以换个关键词，或改一下上面的城市。'
  } catch (caught) {
    if (current !== sequence) return
    results.value = []
    open.value = false
    error.value = explainAmapError(caught)
  } finally {
    if (current === sequence) searching.value = false
  }
}

function choose(hit: PoiHit) {
  emit('select', hit)
  keyword.value = ''
  results.value = []
  open.value = false
  error.value = ''
}

function onEnter() {
  if (results.value[0]) choose(results.value[0])
}
</script>

<template>
  <div class="search">
    <label class="search-label" for="place-search">搜索地点</label>
    <div class="search-box">
      <input
        id="place-search"
        :value="keyword"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        placeholder="输入名称，如 西湖、灵隐寺"
        @input="onInput(($event.target as HTMLInputElement).value)"
        @compositionstart="composing = true"
        @compositionend="composing = false; schedule()"
        @keydown.enter.prevent="onEnter"
        @focus="open = results.length > 0"
      />
      <span v-if="searching" class="search-status">搜索中</span>
    </div>
    <p v-if="error" class="form-hint warn">{{ error }}</p>
    <ul v-if="open && results.length" class="search-results">
      <li v-for="hit in results" :key="hit.poiId + hit.name + hit.lng">
        <button type="button" @mousedown.prevent @click="choose(hit)">
          <strong>{{ hit.name }}</strong>
          <small>{{ hit.address || hit.city || '高德地点' }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>
