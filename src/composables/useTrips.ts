import { computed, ref, watch } from 'vue'
import type { DayPlan, PoiHit, Place, TravelMode, Trip } from '../types'
import { makeDay, placeFromHit } from '../lib/model'
import { loadTrips, saveTrips } from '../lib/storage'
import { uid } from '../lib/uid'

const trips = ref<Trip[]>([])
const activeTripId = ref<string | null>(null)
let started = false
let saveTimer = 0

export function initTrips() {
  if (started) return
  started = true
  trips.value = loadTrips()
  watch(
    trips,
    () => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => saveTrips(trips.value), 120)
    },
    { deep: true },
  )
  window.addEventListener('hashchange', syncFromHash)
  window.addEventListener('pagehide', flushTrips)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushTrips()
  })
  syncFromHash()
}

export function useTrips() {
  const activeTrip = computed(() => trips.value.find((trip) => trip.id === activeTripId.value) ?? null)
  const sortedTrips = computed(() => [...trips.value].sort((a, b) => b.updatedAt - a.updatedAt))

  return {
    trips,
    sortedTrips,
    activeTrip,
    activeTripId,
    createTrip,
    openTrip,
    closeTrip,
    deleteTrip,
    touchTrip,
    addDay,
    removeDay,
    addPlace,
    removePlace,
    movePlace,
    movePlaceToDay,
    appendDays,
  }
}

export function createTrip(partial?: { name?: string; city?: string; days?: DayPlan[] }): string {
  const now = Date.now()
  const trip: Trip = {
    id: uid(),
    name: partial?.name?.trim() || '未命名行程',
    city: partial?.city?.trim() || '',
    days: partial?.days?.length ? partial.days : [makeDay('第1天')],
    createdAt: now,
    updatedAt: now,
  }
  trips.value.unshift(trip)
  return trip.id
}

export function openTrip(id: string) {
  activeTripId.value = id
  const next = `#/trip/${encodeURIComponent(id)}`
  if (location.hash !== next) location.hash = next
}

export function closeTrip() {
  activeTripId.value = null
  if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '#/'
}

export function deleteTrip(id: string) {
  const index = trips.value.findIndex((trip) => trip.id === id)
  if (index < 0) return
  trips.value.splice(index, 1)
  if (activeTripId.value === id) closeTrip()
}

export function touchTrip(tripId: string) {
  const trip = findTrip(tripId)
  if (trip) trip.updatedAt = Date.now()
}

export function addDay(tripId: string): string | null {
  const trip = findTrip(tripId)
  if (!trip) return null
  const titles = new Set(trip.days.map((day) => day.title))
  let number = trip.days.length + 1
  while (titles.has(`第${number}天`)) number += 1
  const mode = trip.days[trip.days.length - 1]?.mode ?? 'driving'
  const day = makeDay(`第${number}天`, [], mode)
  trip.days.push(day)
  touchTrip(tripId)
  return day.id
}

export function removeDay(tripId: string, dayId: string) {
  const trip = findTrip(tripId)
  if (!trip || trip.days.length <= 1) return
  const index = trip.days.findIndex((day) => day.id === dayId)
  if (index < 0) return
  trip.days.splice(index, 1)
  touchTrip(tripId)
}

export function addPlace(tripId: string, dayId: string, hit: PoiHit) {
  const located = findDay(tripId, dayId)
  if (!located) return
  located.day.places.push(placeFromHit(hit))
  touchTrip(tripId)
}

export function removePlace(tripId: string, dayId: string, placeId: string): Place | null {
  const located = findDay(tripId, dayId)
  if (!located) return null
  const index = located.day.places.findIndex((place) => place.id === placeId)
  if (index < 0) return null
  const [removed] = located.day.places.splice(index, 1)
  touchTrip(tripId)
  return removed
}

export function movePlace(tripId: string, dayId: string, placeId: string, direction: -1 | 1) {
  const located = findDay(tripId, dayId)
  if (!located) return
  const index = located.day.places.findIndex((place) => place.id === placeId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= located.day.places.length) return
  const [place] = located.day.places.splice(index, 1)
  located.day.places.splice(target, 0, place)
  touchTrip(tripId)
}

export function movePlaceToDay(tripId: string, fromDayId: string, placeId: string, toDayId: string) {
  if (fromDayId === toDayId) return
  const from = findDay(tripId, fromDayId)
  const to = findDay(tripId, toDayId)
  if (!from || !to) return
  const index = from.day.places.findIndex((place) => place.id === placeId)
  if (index < 0) return
  const [place] = from.day.places.splice(index, 1)
  to.day.places.push(place)
  touchTrip(tripId)
}

export function appendDays(
  tripId: string,
  incoming: { title: string; places: Place[]; mode?: TravelMode }[],
): string | null {
  const trip = findTrip(tripId)
  if (!trip || !incoming.length) return null
  const used = new Set(trip.days.map((day) => day.title))
  let lastId: string | null = null
  incoming.forEach((item) => {
    let title = item.title.trim()
    if (!title || used.has(title)) {
      let number = trip.days.length + 1
      while (used.has(`第${number}天`)) number += 1
      title = `第${number}天`
    }
    used.add(title)
    const mode = item.mode ?? trip.days[trip.days.length - 1]?.mode ?? 'driving'
    const day = makeDay(title, item.places, mode)
    trip.days.push(day)
    lastId = day.id
  })
  touchTrip(tripId)
  return lastId
}

function syncFromHash() {
  const matched = /^#\/trip\/([^/?#]+)/.exec(location.hash)
  const id = matched ? decodeURIComponent(matched[1]) : null
  if (id && trips.value.some((trip) => trip.id === id)) {
    activeTripId.value = id
    return
  }
  activeTripId.value = null
  if (id) history.replaceState(null, '', '#/')
}

function findTrip(tripId: string): Trip | null {
  return trips.value.find((trip) => trip.id === tripId) ?? null
}

function findDay(tripId: string, dayId: string): { trip: Trip; day: DayPlan } | null {
  const trip = findTrip(tripId)
  const day = trip?.days.find((item) => item.id === dayId)
  if (!trip || !day) return null
  return { trip, day }
}

function flushTrips() {
  window.clearTimeout(saveTimer)
  saveTrips(trips.value)
}
