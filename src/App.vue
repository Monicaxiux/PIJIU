<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useSystemStore } from './stores/system'

const store = useSystemStore()
onMounted(() => {
  window.showToast = store.notify
  store.startClock()
})
onUnmounted(() => {
  delete window.showToast
  store.stopClock()
})
</script>

<template><RouterView /></template>
