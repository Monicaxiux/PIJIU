<script setup>
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '280px' },
  ariaLabel: { type: String, default: '数据可视化图表' }
})
const el = ref()
let chart
let observer
function draw() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (chart) chart.setOption({
    animation: !reducedMotion,
    animationDuration: reducedMotion ? 0 : 700,
    animationDurationUpdate: reducedMotion ? 0 : 520,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicInOut',
    ...props.option
  }, true)
}
onMounted(async () => {
  await nextTick()
  chart = echarts.init(el.value)
  draw()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(el.value)
})
watch(() => props.option, draw, { deep: true })
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose() })
</script>

<template><div ref="el" class="chart" :style="{ height }" role="img" :aria-label="ariaLabel"></div></template>
