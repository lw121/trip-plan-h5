<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { explainAmapError, resolveNames } from '../lib/amap'
import { daySizePreview, orderByNearest, parsePlaceText, splitPlaces } from '../lib/itinerary'
import { placeFromHit } from '../lib/model'
import { uid } from '../lib/uid'
import type { Place, PoiHit } from '../types'

interface DraftPlace {
  id: string
  query: string
  options: PoiHit[]
  pick: number
  excluded: boolean
  error: string
}

interface DraftDay {
  title: string
  places: DraftPlace[]
}

const props = defineProps<{
  mode: 'create' | 'append'
  initialCity: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { name: string; city: string; days: { title: string; places: Place[] }[] }]
}>()

const name = ref('')
const city = ref(props.initialCity)
const text = ref('')
const sortNear = ref(false)
const splitMode = ref<'perDay' | 'days'>('perDay')
const perDay = ref(4)
const dayCount = ref(3)
const step = ref<'edit' | 'search' | 'review'>('edit')
const progress = ref('')
const error = ref('')
const grouped = ref(false)
const draftDays = ref<DraftDay[]>([])

const parsed = computed(() => parsePlaceText(text.value))
const nameCount = computed(() => parsed.value.groups.reduce((sum, group) => sum + group.names.length, 0))

const selectedCount = computed(() =>
  draftDays.value.reduce((sum, day) => sum + day.places.filter((place) => !place.excluded && place.options.length).length, 0),
)

const previewSizes = computed(() => {
  if (!draftDays.value.length) return []
  if (grouped.value) {
    return draftDays.value
      .map((day) => day.places.filter((place) => !place.excluded && place.options.length).length)
      .filter((count) => count > 0)
  }
  return daySizePreview(selectedCount.value, currentSplit())
})

onMounted(() => {
  document.body.classList.add('modal-open')
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.body.classList.remove('modal-open')
  window.removeEventListener('keydown', onKey)
})

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && step.value !== 'search') emit('close')
}

async function startSearch() {
  const snapshot = parsePlaceText(text.value)
  if (!nameCount.value) {
    error.value = '请先贴一份地点名单。一行一个，也可以用空行或「第1天」分天。'
    return
  }
  step.value = 'search'
  error.value = ''
  progress.value = '准备搜索…'
  const total = snapshot.groups.reduce((sum, group) => sum + group.names.length, 0)
  let cursor = 0
  try {
    const nextDays: DraftDay[] = []
    for (const group of snapshot.groups) {
      const resolved = await resolveNames(group.names, city.value, (index, _total, current) => {
        if (!current) return
        progress.value = `正在搜索 ${cursor + index + 1} / ${total}：${current}`
      })
      cursor += group.names.length
      nextDays.push({
        title: group.title,
        places: resolved.map((item) => ({
          id: uid(),
          query: item.query,
          options: item.options,
          pick: 0,
          excluded: item.options.length === 0,
          error: item.error,
        })),
      })
    }
    draftDays.value = nextDays
    grouped.value = snapshot.grouped
    step.value = 'review'
  } catch (caught) {
    error.value = explainAmapError(caught)
    step.value = 'edit'
  }
}

function cycle(place: DraftPlace) {
  if (place.options.length < 2) return
  place.pick = (place.pick + 1) % place.options.length
}

function currentSplit() {
  return splitMode.value === 'days'
    ? { days: Math.max(1, Math.floor(Number(dayCount.value) || 1)) }
    : { perDay: Math.max(1, Math.floor(Number(perDay.value) || 1)) }
}

function confirmImport() {
  const picked = draftDays.value.map((day) => {
    const places = day.places
      .filter((item) => !item.excluded && item.options[item.pick])
      .map((item) => placeFromHit(item.options[item.pick]))
    return {
      title: day.title,
      places: sortNear.value ? orderByNearest(places) : places,
    }
  })
  let days = picked.filter((day) => day.places.length)
  if (!grouped.value) {
    const flat = days.flatMap((day) => day.places)
    days = splitPlaces(flat, currentSplit()).map((places, index) => ({
      title: `第${index + 1}天`,
      places,
    }))
  }
  if (!days.length) {
    error.value = '没有可导入的地点。请至少保留一个匹配结果。'
    return
  }
  emit('confirm', {
    name: name.value.trim(),
    city: city.value.trim(),
    days,
  })
}
</script>

<template>
  <div class="modal-root">
    <button type="button" class="modal-backdrop" aria-label="关闭导入" @click="step === 'search' ? undefined : emit('close')"></button>
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <header class="modal-head">
        <div>
          <p class="eyebrow">名单导入</p>
          <h2 id="import-title">{{ mode === 'create' ? '从名单生成行程' : '把名单加进当前行程' }}</h2>
        </div>
        <button type="button" class="btn ghost" :disabled="step === 'search'" @click="emit('close')">关闭</button>
      </header>

      <form v-if="step === 'edit'" class="import-form" @submit.prevent="startSearch">
        <label v-if="mode === 'create'">
          行程名称
          <input v-model="name" maxlength="40" placeholder="例如：杭州周末" />
        </label>
        <label>
          优先城市
          <input v-model="city" maxlength="20" placeholder="例如：杭州。留空则搜全国" />
        </label>
        <label>
          地点名单
          <textarea
            v-model="text"
            rows="10"
            maxlength="10000"
            placeholder="一行一个地点。空行或「第1天」会分成不同天。&#10;&#10;西湖&#10;灵隐寺&#10;&#10;第2天&#10;千岛湖"
          ></textarea>
        </label>
        <p class="form-hint">{{ parsed.note }}</p>
        <p v-if="nameCount > 20" class="form-hint">名单有点长，搜索会逐条询问高德，请稍等。</p>

        <fieldset v-if="!parsed.grouped && nameCount" class="split-box">
          <legend>怎么分天</legend>
          <label class="choice">
            <input v-model="splitMode" type="radio" value="perDay" />
            <span>每天大约</span>
            <input v-model.number="perDay" type="number" min="1" max="16" :disabled="splitMode !== 'perDay'" />
            <span>个地点</span>
          </label>
          <label class="choice">
            <input v-model="splitMode" type="radio" value="days" />
            <span>平均分成</span>
            <input v-model.number="dayCount" type="number" min="1" max="31" :disabled="splitMode !== 'days'" />
            <span>天</span>
          </label>
        </fieldset>

        <label class="check-row">
          <input v-model="sortNear" type="checkbox" />
          <span>导入前按距离就近重排，减少来回折返。名单本身有顺序时不要勾。</span>
        </label>
        <p v-if="error" class="form-hint warn">{{ error }}</p>
        <button type="submit" class="btn primary" :disabled="!nameCount">搜索这些地点</button>
      </form>

      <div v-else-if="step === 'search'" class="import-progress">
        <p>{{ progress }}</p>
        <p class="form-hint">地点会按顺序匹配高德结果，下一步可以改掉不对的条目。</p>
      </div>

      <div v-else class="import-review">
        <p class="form-hint">
          匹配了 {{ selectedCount }} 个地点。名称不对时可以换下一个结果，或者去掉。
        </p>
        <section v-for="(day, dayIndex) in draftDays" :key="`${day.title}-${dayIndex}`" class="review-day">
          <h3>{{ day.title || '待分天的地点' }}</h3>
          <ul>
            <li v-for="place in day.places" :key="place.id">
              <label class="check-row">
                <input
                  type="checkbox"
                  :checked="!place.excluded"
                  :disabled="!place.options.length"
                  @change="place.excluded = !($event.target as HTMLInputElement).checked"
                />
                <span>导入</span>
              </label>
              <div>
                <strong>{{ place.options[place.pick]?.name || place.query }}</strong>
                <small v-if="place.options[place.pick]">
                  名单：{{ place.query }} · {{ place.options[place.pick].address || place.options[place.pick].city }}
                </small>
                <small v-else class="warn-text">{{ place.error || '没有匹配的地点' }}</small>
              </div>
              <button v-if="place.options.length > 1" type="button" class="btn ghost" @click="cycle(place)">
                换一个（{{ place.pick + 1 }}/{{ place.options.length }}）
              </button>
            </li>
          </ul>
        </section>

        <fieldset v-if="!grouped" class="split-box">
          <legend>怎么分天</legend>
          <label class="choice">
            <input v-model="splitMode" type="radio" value="perDay" />
            <span>每天大约</span>
            <input v-model.number="perDay" type="number" min="1" max="16" :disabled="splitMode !== 'perDay'" />
            <span>个地点</span>
          </label>
          <label class="choice">
            <input v-model="splitMode" type="radio" value="days" />
            <span>平均分成</span>
            <input v-model.number="dayCount" type="number" min="1" max="31" :disabled="splitMode !== 'days'" />
            <span>天</span>
          </label>
        </fieldset>
        <label class="check-row">
          <input v-model="sortNear" type="checkbox" />
          <span>按距离就近重排后再放入每天。</span>
        </label>
        <p class="form-hint">
          {{ previewSizes.length ? `将生成 ${previewSizes.length} 天：${previewSizes.join(' + ')} 个地点` : '当前没有可导入的地点' }}
        </p>
        <p v-if="error" class="form-hint warn">{{ error }}</p>
        <div class="modal-actions">
          <button type="button" class="btn ghost" @click="step = 'edit'">返回修改</button>
          <button type="button" class="btn primary" :disabled="!selectedCount" @click="confirmImport">
            {{ mode === 'create' ? '生成行程' : '加入行程' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
