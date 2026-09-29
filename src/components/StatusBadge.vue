<script setup>
import { statusMeta } from '../mock'
defineProps({ status: { type: String, required: true } })
</script>

<template><span class="status-badge" :class="`is-${status}`"><i></i>{{ statusMeta[status]?.label || status }}</span></template>
