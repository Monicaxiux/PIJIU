<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, Check, FlaskConical, MoveHorizontal, RefreshCw, RotateCcw, Sparkles, Trash2, X } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import BaseChart from '../components/BaseChart.vue'
import { getEngine } from '../mock'
import { useSystemStore } from '../stores/system'
import { axisStyle, baseGrid, temperatureSeriesMeta, tooltip } from '../utils/chart'

const route = useRoute(), router = useRouter(), store = useSystemStore(), engine = getEngine()
const props = defineProps({ deviceId: { type: String, default: '' }, embedded: { type: Boolean, default: false } })
const device = computed(() => store.devices.find(d => d.id === (props.deviceId || route.params.id)) || store.devices[0])
const series = computed(() => { store.dataVersion; return engine.annoSeries(device.value.id) })
const start = ref(6), end = ref(36), stableOnly = ref(true), learning = ref(false), result = ref(null)
const marking = ref(false), continuous = ref(true), activeHandle = ref('b'), dragging = ref(false), dragFrom = ref(null), track = ref(null)
const confirmAction = ref(null)
const annotations = computed(() => { store.dataVersion; return [...(engine.baselineAnnot[device.value.id] || [])] })
const stat = computed(() => engine.rangeStat(device.value.id, Math.min(Number(start.value), Number(end.value)), Math.max(Number(start.value), Number(end.value))))
const annotationStep = computed(() => {
  if (result.value) return 4
  if (annotations.value.length) return marking.value ? 2 : 3
  return marking.value ? 2 : 1
})
const annotationOverlay = computed(() => {
  const sources = [series.value.ts, series.value.tc, series.value.dt]
  const ranges = annotations.value
  if (!ranges.length) return []
  return sources.map((source, sourceIndex) => ({
    name: `已标注 ${[temperatureSeriesMeta.ts.name, temperatureSeriesMeta.tc.name, temperatureSeriesMeta.dt.name][sourceIndex]}`,
    type: 'line',
    showSymbol: false,
    smooth: .2,
    connectNulls: false,
    data: source.map((value, index) => ranges.some(item => index >= item.startIdx && index <= item.endIdx) ? value : null),
    lineStyle: { color: '#ffcf5a', width: 2.6, shadowBlur: 7, shadowColor: 'rgba(255,207,90,.38)' },
    itemStyle: { color: '#ffcf5a' },
    emphasis: { disabled: true },
    silent: true,
    tooltip: { show: false },
    z: 4
  }))
})
const markedAreas = computed(() => {
  const areas = annotations.value.map(item => [
    { xAxis: series.value.times[item.startIdx]?.slice(-5), itemStyle: { color: 'rgba(255,181,71,.12)' } },
    { xAxis: series.value.times[item.endIdx]?.slice(-5) }
  ])
  if (marking.value) areas.unshift([
    { xAxis: series.value.times[stat.value.startIdx]?.slice(-5), itemStyle: { color: 'rgba(70,216,255,.14)' } },
    { xAxis: series.value.times[stat.value.endIdx]?.slice(-5) }
  ])
  return areas
})
const selectionHint = computed(() => `${Math.abs(stat.value.endIdx - stat.value.startIdx)} min · ${stat.value.count} 点 · 拖动区间平移`)
const option = computed(() => ({
  color: [temperatureSeriesMeta.ts.color, temperatureSeriesMeta.tc.color, temperatureSeriesMeta.dt.color], tooltip: tooltip(), grid: { ...baseGrid, top: 58, bottom: 48 },
  legend: { type: 'scroll', top: 5, left: 12, right: 12, itemWidth: 24, itemHeight: 8, textStyle: { color: '#a4b7c8', fontSize: 11 }, pageTextStyle: { color: '#91a8bb' }, pageIconColor: '#46d8ff', pageIconInactiveColor: '#40566a', data: [temperatureSeriesMeta.ts.name, temperatureSeriesMeta.tc.name, temperatureSeriesMeta.dt.name] },
  xAxis: { type: 'category', data: series.value.times.map(time => time.slice(-5)), ...axisStyle(), boundaryGap: false },
  yAxis: { type: 'value', ...axisStyle() },
  series: [
    { name: temperatureSeriesMeta.ts.name, type: 'line', showSymbol: false, symbol: 'circle', smooth: .2, itemStyle: { color: temperatureSeriesMeta.ts.color }, lineStyle: { color: temperatureSeriesMeta.ts.color, width: 2.2 }, data: series.value.ts },
    { name: temperatureSeriesMeta.tc.name, type: 'line', showSymbol: false, symbol: 'circle', smooth: .2, itemStyle: { color: temperatureSeriesMeta.tc.color }, lineStyle: { color: temperatureSeriesMeta.tc.color, width: 2.2 }, data: series.value.tc },
    { name: temperatureSeriesMeta.dt.name, type: 'line', showSymbol: false, symbol: 'circle', smooth: .2, itemStyle: { color: temperatureSeriesMeta.dt.color }, lineStyle: { color: temperatureSeriesMeta.dt.color, width: 2, type: 'dashed' }, data: series.value.dt, markArea: { data: markedAreas.value } },
    ...annotationOverlay.value
  ]
}))

const selectionStyle = computed(() => {
  const total = Math.max(1, series.value.times.length - 1)
  const a = Math.min(Number(start.value), Number(end.value)), b = Math.max(Number(start.value), Number(end.value))
  return { left: `${a / total * 100}%`, width: `${Math.max(1, (b - a) / total * 100)}%` }
})
function bounds() {
  const n = series.value.times.length
  let a = Math.max(0, Math.min(Number(start.value) || 0, n - 2))
  let b = Math.max(1, Math.min(Number(end.value) || 1, n - 1))
  if (b - a < 2) {
    if (activeHandle.value === 'a') a = Math.max(0, b - 2)
    else b = Math.min(n - 1, a + 2)
  }
  start.value = a; end.value = b
  return [a, b]
}
function setBounds(a, b) {
  const n = series.value.times.length
  const width = Math.max(2, b - a)
  a = Math.max(0, Math.min(Math.round(a), n - 1 - width))
  b = a + width
  start.value = a; end.value = b
  bounds()
}
function autoWindow(width = 30) {
  const s = series.value, n = s.times.length
  width = Math.min(width, n - 2)
  let best = 0, score = Infinity
  for (let a = 0; a + width <= n - 1; a++) {
    const ts = s.ts.slice(a, a + width + 1), tc = s.tc.slice(a, a + width + 1)
    const next = Math.max(...ts) - Math.min(...ts) + Math.max(...tc) - Math.min(...tc)
    if (next < score) { score = next; best = a }
  }
  return { a: best, b: best + width }
}
function startMark() {
  const window = autoWindow(30)
  setBounds(window.a, window.b); marking.value = true; activeHandle.value = 'b'
  store.notify('已定位最平稳的 30 分钟窗口，可拖动游标或整段平移')
}
function cancelMark() { marking.value = false; dragging.value = false; dragFrom.value = null }
function snapWindow() {
  if (!marking.value) return
  const [a, b] = bounds(), width = b - a, s = series.value, n = s.times.length
  const center = Math.round((a + b) / 2), from = Math.max(0, center - 30), to = Math.min(n - 1 - width, center + 30)
  let best = a, score = Infinity
  for (let i = from; i <= to; i++) {
    const ts = s.ts.slice(i, i + width + 1), tc = s.tc.slice(i, i + width + 1)
    const next = Math.max(...ts) - Math.min(...ts) + Math.max(...tc) - Math.min(...tc)
    if (next < score) { score = next; best = i }
  }
  setBounds(best, best + width); store.notify(`已吸附到最平稳窗口，Ts/Tc 极差合计 ${Math.round(score * 10) / 10}℃`)
}
function confirmMark() {
  const [a, b] = bounds(), statValue = engine.rangeStat(device.value.id, a, b), list = engine.baselineAnnot[device.value.id]
  if (list.some(item => item.startIdx === a && item.endIdx === b)) { store.notify('该区间已经标注'); return }
  list.push({ ...statValue, id: `${device.value.id}-MK-${Date.now()}`, deviceId: device.value.id, operator: '当前用户', createdAt: new Date().toLocaleString('zh-CN', { hour12: false }) })
  mergeAnnotations()
  result.value = null
  const segments = engine.baselineAnnot[device.value.id].length
  const nextAction = continuous.value ? '可继续框选下一段' : '可开始数据学习'
  const stability = statValue.stable ? '稳定窗口，可纳入基准样本' : '含波动，建议复核后再纳入基准样本'
  store.bumpData(); store.notify(`本区间已标注（曲线变黄）：${statValue.count} 个采样点 · ${stability}；与相邻区间合并后共 ${segments} 段；${nextAction}`)
  if (continuous.value) { const next = autoWindow(30); setBounds(next.a, next.b); marking.value = true } else cancelMark()
}
function mergeAnnotations() {
  const list = engine.baselineAnnot[device.value.id] || [], sorted = [...list].sort((a, b) => a.startIdx - b.startIdx), merged = []
  sorted.forEach(item => {
    const last = merged.at(-1)
    if (last && item.startIdx <= last.endIdx + 1) {
      const statValue = engine.rangeStat(device.value.id, last.startIdx, Math.max(last.endIdx, item.endIdx))
      merged[merged.length - 1] = { ...statValue, id: last.id, deviceId: device.value.id, operator: last.operator, createdAt: last.createdAt, merged: true }
    } else merged.push(item)
  })
  if (merged.length !== list.length) list.splice(0, list.length, ...merged)
}
function clearAll() { engine.baselineAnnot[device.value.id].splice(0); result.value = null; cancelMark(); store.bumpData(); store.notify('已清空全部标注区间') }
function refreshData() { engine.annoReset(device.value.id); store.bumpData(); store.notify('已重新拉取最近 4 小时时序数据') }
function reset() { start.value = 6; end.value = 36; result.value = null; cancelMark() }
function mark() {
  const list = engine.baselineAnnot[device.value.id]
  if (!marking.value) startMark()
  else confirmMark()
}
function remove(index) { engine.baselineAnnot[device.value.id].splice(index, 1); result.value = null; store.bumpData(); store.notify('已删除该标注区间') }
function askRemove(index) { confirmAction.value = { type: 'remove', index, item: annotations.value[index] } }
function askClearAll() { if (annotations.value.length) confirmAction.value = { type: 'clear' } }
function cancelConfirm() { confirmAction.value = null }
function executeConfirm() {
  if (!confirmAction.value) return
  if (confirmAction.value.type === 'remove') remove(confirmAction.value.index)
  else clearAll()
  confirmAction.value = null
}
function calculate(mode = 'manual') {
  const current = engine.baselineMap[device.value.id]
  let used = mode === 'auto' ? [] : annotations.value.filter(item => !stableOnly.value || item.stable)
  if (mode === 'manual' && !used.length) { store.notify('没有可学习的稳定标注区间'); return }
  learning.value = true
  setTimeout(() => {
    let tcNew, dtNew, tsNew, points
    if (mode === 'auto') {
      const auto = engine.rangeStat(device.value.id, 6, 205)
      tcNew = auto.tcMean; dtNew = auto.dtMean; tsNew = auto.tsMean; points = 200
    } else {
      const values = { ts: [], tc: [], dt: [] }
      used.forEach(segment => { for (let i = segment.startIdx; i <= segment.endIdx; i++) { values.ts.push(series.value.ts[i]); values.tc.push(series.value.tc[i]); values.dt.push(series.value.dt[i]) } })
      const mean = list => Math.round(list.reduce((sum, value) => sum + value, 0) / list.length * 10) / 10
      tsNew = mean(values.ts); tcNew = mean(values.tc); dtNew = mean(values.dt); points = values.ts.length
    }
    const rise = Math.round((tcNew - current.tcBase) * 10) / 10
    result.value = { mode, tcOld: current.tcBase, dtOld: current.dtBase, tsNew, tcNew, dtNew, points, rise, needConfirm: rise >= 3, used: mode === 'auto' ? 1 : used.length }
    learning.value = false
  }, 520)
}
function apply(accepted) {
  const baseline = engine.baselineMap[device.value.id], item = result.value
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  if (accepted) Object.assign(baseline, { tcBase: item.tcNew, dtBase: item.dtNew, pending: false, sampleCnt: item.points, source: item.mode === 'auto' ? '实测（200 点自动学习）' : `实测（人工标注 ${item.points} 点）`, learnedAt: now })
  engine.baselineHistory[device.value.id].unshift({ id: `${device.value.id}-BH-${Date.now()}`, time: now, trigger: item.mode === 'auto' ? '自动学习' : '人工标注学习', tcOld: item.tcOld, tcNew: accepted ? item.tcNew : item.tcOld, dtOld: item.dtOld, dtNew: accepted ? item.dtNew : item.dtOld, operator: '当前用户', status: accepted ? '已生效' : '已拒绝', note: accepted ? `基于 ${item.points} 个采样点更新并同步全站` : '人工拒绝，保持原基线' })
  baseline.cumRise = Math.round((baseline.tcBase - (engine.baselineHistory[device.value.id].at(-1)?.tcOld || baseline.tcBase)) * 10) / 10
  result.value = null
  store.bumpData()
  store.notify(accepted ? '新基线已生效并同步至全站诊断' : '已拒绝本次学习，原基线保持不变')
}

function onKey(event) {
  if (!marking.value || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const step = (event.shiftKey ? 5 : 1) * (event.key === 'ArrowLeft' ? -1 : 1)
  if (activeHandle.value === 'a') start.value += step
  else end.value += step
  bounds()
}
function onHandle(event, which) {
  activeHandle.value = which
  marking.value = true
  if (!track.value) return
  const rect = track.value.getBoundingClientRect(), [a, b] = bounds()
  dragFrom.value = { x: event.clientX, a, b, width: rect.width, handle: which }
  dragging.value = true
  event.preventDefault()
}
function beginBand(event) {
  if (!marking.value || !track.value) return
  const rect = track.value.getBoundingClientRect(), [a, b] = bounds()
  dragFrom.value = { x: event.clientX, a, b, width: rect.width }; dragging.value = true
  event.preventDefault()
}
function moveBand(event) {
  if (!dragging.value || !dragFrom.value) return
  const delta = (event.clientX - dragFrom.value.x) / dragFrom.value.width * (series.value.times.length - 1)
  if (dragFrom.value.handle === 'a') {
    start.value = Math.round(dragFrom.value.a + delta)
    end.value = dragFrom.value.b
    activeHandle.value = 'a'
    bounds()
  } else if (dragFrom.value.handle === 'b') {
    start.value = dragFrom.value.a
    end.value = Math.round(dragFrom.value.b + delta)
    activeHandle.value = 'b'
    bounds()
  } else {
    setBounds(dragFrom.value.a + delta, dragFrom.value.b + delta)
  }
}
function endBand() { dragging.value = false; dragFrom.value = null }
onMounted(() => { window.addEventListener('keydown', onKey); window.addEventListener('pointermove', moveBand); window.addEventListener('pointerup', endBand) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointermove', moveBand); window.removeEventListener('pointerup', endBand) })
</script>

<template>
  <div class="page-stack baseline-page" :class="{ 'baseline-embedded': embedded }">
    <div v-if="!embedded" class="detail-nav"><button class="btn ghost" @click="router.back()"><ArrowLeft />返回</button><button class="btn secondary" @click="reset"><RotateCcw />重置选区</button></div>
    <section class="panel device-hero"><div><span class="eyebrow">BASELINE LEARNING / {{ device.id }}</span><h2>{{ device.name }} <small>{{ device.id }}</small></h2><p>{{ device.type }} · {{ device.area }} · 最近 4 小时，1 分钟粒度</p></div><div class="device-live-metrics"><div><span>出口温度基准</span><strong>{{ device.baseline?.tcBase?.toFixed(1) || '--' }}<em>℃</em></strong></div><div><span>温差基准</span><strong>{{ device.baseline?.dtBase?.toFixed(1) || '--' }}<em>℃</em></strong></div><div><span>样本数</span><strong>{{ device.baseline?.sampleCnt || 0 }}<em>点</em></strong></div><div><span>已标注窗口</span><strong>{{ annotations.length }}<em>段</em></strong></div></div></section>
    <section class="panel chart-panel"><div class="panel-head"><div><small>CURVE ANNOTATION</small><h2>稳定生产 · 非排水时间标注</h2></div><div class="chart-actions"><button class="btn ghost tiny" @click="refreshData"><RefreshCw/>刷新最近 4 小时</button><span class="selection-state" :class="{ stable: stat.stable }">{{ stat.stable ? '满足稳定门控' : '波动超限' }}</span></div></div>
      <div class="annotation-steps" aria-label="标注步骤"><span :class="{ active: annotationStep >= 1, current: annotationStep === 1 }">1 选择区间</span><i>/</i><span :class="{ active: annotationStep >= 2, current: annotationStep === 2 }">2 检查稳定性</span><i>/</i><span :class="{ active: annotationStep >= 3, current: annotationStep === 3 }">3 确认标注</span><i>/</i><span :class="{ active: annotationStep >= 4, current: annotationStep === 4 }">4 纳入基准样本</span></div>
      <section class="baseline-controls"><div class="mark-toolbar"><button v-if="!marking" class="btn primary" @click="startMark"><Check/>开始数据标记</button><template v-else><button class="btn secondary" @click="snapWindow">吸附最平稳窗口</button><button class="btn ghost" @click="cancelMark"><X/>取消标记</button><button class="btn primary" @click="confirmMark"><Check/>确认标注本区间</button></template><label class="check-line compact"><input v-model="continuous" type="checkbox"/>连续标注</label></div><div class="range-control"><label>开始点 <b>{{ stat.startTime?.slice(-5) }}</b><input v-model.number="start" type="range" min="0" :max="series.times.length - 2" @focus="activeHandle='a'" @input="marking=true" /></label><label>结束点 <b>{{ stat.endTime?.slice(-5) }}</b><input v-model.number="end" type="range" min="1" :max="series.times.length - 1" @focus="activeHandle='b'" @input="marking=true" /></label></div><div class="range-stats"><span>样本 <b>{{ stat.count }}</b></span><span>Ts 极差 <b>{{ stat.tsRange }}℃</b></span><span>Tc 极差 <b>{{ stat.tcRange }}℃</b></span><span>ΔT 均值 <b>{{ stat.dtMean }}℃</b></span></div></section>
      <div class="annotation-chart-wrap"><BaseChart :option="option" height="370px" aria-label="基线学习中的进口温度、出口温度与进出口温差曲线" /><div class="annotation-track" ref="track" :class="{ active: marking }"><div class="annotation-band" :style="selectionStyle" @pointerdown="beginBand"><button class="annotation-handle handle-a" aria-label="拖动开始游标" @pointerdown.stop="onHandle($event, 'a')"><span>{{ stat.startTime }}</span></button><button class="annotation-handle handle-b" aria-label="拖动结束游标" @pointerdown.stop="onHandle($event, 'b')"><span>{{ stat.endTime }}</span></button><span class="annotation-band-hint">{{ selectionHint }}</span><MoveHorizontal class="annotation-band-icon" :size="14" aria-hidden="true"/></div></div></div></section>
    <section class="two-column">
      <article class="panel table-panel confirmed-windows-panel"><div class="panel-head"><div><small>CONFIRMED WINDOWS</small><h2>已确认标注</h2></div><button v-if="annotations.length" class="btn ghost tiny" @click="askClearAll"><Trash2/>清空全部</button></div><div class="table-scroll confirmed-windows-table"><table><thead><tr><th>区间</th><th>样本</th><th>Ts / Tc 极差</th><th>稳定性</th><th>操作</th></tr></thead><tbody><tr v-for="(item,index) in annotations" :key="item.id"><td>{{ item.startTime?.slice(-5) }} - {{ item.endTime?.slice(-5) }}</td><td>{{ item.count }} 点</td><td>{{ item.tsRange }} / {{ item.tcRange }}℃</td><td :class="item.stable?'good':'warn'">{{ item.stable?'稳定':'含波动' }}</td><td><button class="icon-btn" aria-label="删除标注" @click="askRemove(index)"><Trash2 /></button></td></tr></tbody></table><div v-if="!annotations.length" class="empty-state">尚未标注区间</div></div></article>
      <article class="panel learning-panel"><div class="panel-head"><div><small>DATA LEARNING</small><h2>开始数据学习</h2></div></div><label class="check-line"><input v-model="stableOnly" type="checkbox" />仅使用满足双侧极差 &lt; 5℃ 的稳定窗口</label><p>人工标注可批量合并计算；自动学习将抽取 200 个采样点作为备用方案。</p><div class="learning-actions"><button class="btn primary" :disabled="learning || !annotations.length" @click="calculate('manual')"><FlaskConical />{{ learning?'正在计算':'开始数据学习' }}</button><button class="btn secondary" :disabled="learning" @click="calculate('auto')"><Sparkles />自动学习 200 点</button></div></article>
    </section>
    <section class="panel table-panel"><div class="panel-head"><div><small>BASELINE HISTORY</small><h2>基线变更历史</h2></div></div><div class="table-scroll"><table><thead><tr><th>时间</th><th>触发方式</th><th>Tc 变化</th><th>ΔT 变化</th><th>操作人</th><th>结果</th><th>说明</th></tr></thead><tbody><tr v-for="item in engine.baselineHistory[device.id]" :key="item.id || item.time"><td>{{item.time}}</td><td>{{item.trigger}}</td><td>{{item.tcOld}} → {{item.tcNew}}℃</td><td>{{item.dtOld}} → {{item.dtNew}}℃</td><td>{{item.operator}}</td><td :class="item.status==='已拒绝'?'warn':'good'">{{item.status}}</td><td>{{item.note}}</td></tr></tbody></table></div></section>
    <div v-if="confirmAction" class="modal-backdrop confirm-backdrop" @click.self="cancelConfirm"><form class="modal panel confirm-modal" @submit.prevent="executeConfirm"><div class="modal-head"><div><small>CONFIRM ACTION</small><h2>{{ confirmAction.type === 'clear' ? '清空已确认标注' : '删除标注区间' }}</h2></div><button type="button" class="icon-btn" aria-label="关闭确认窗口" @click="cancelConfirm"><X /></button></div><p class="confirm-warning">{{ confirmAction.type === 'clear' ? '将删除当前设备的全部已确认标注区间，此操作不可恢复。' : `将删除 ${confirmAction.item?.startTime?.slice(-5)} - ${confirmAction.item?.endTime?.slice(-5)} 区间，此操作不可恢复。` }}</p><div class="modal-actions"><button type="button" class="btn secondary" @click="cancelConfirm">取消</button><button class="btn danger-action">{{ confirmAction.type === 'clear' ? '确认清空' : '确认删除' }}</button></div></form></div>
    <Teleport to="body">
      <div v-if="result" class="modal-backdrop baseline-result-backdrop" role="dialog" aria-modal="true" aria-labelledby="baseline-result-title" @click.self="result = null">
        <section class="modal panel baseline-result-modal">
          <div class="modal-head">
            <div><small>LEARNING RESULT</small><h2 id="baseline-result-title">新基线计算结果</h2></div>
            <button class="icon-btn" type="button" aria-label="关闭结果窗口" @click="result = null"><X /></button>
          </div>
          <p class="baseline-result-summary">使用 {{ result.used }} 段、{{ result.points }} 个样本。出口基准变化 {{ result.rise >= 0 ? '+' : '' }}{{ result.rise }}℃{{ result.needConfirm ? '，达到人工确认触发线。' : '，可直接生效。' }}</p>
          <dl class="baseline-result-metrics">
            <div><dt>Ts 均值</dt><dd>{{ result.tsNew }}℃</dd></div>
            <div><dt>Tc 基准</dt><dd>{{ result.tcOld }} → {{ result.tcNew }}℃</dd></div>
            <div><dt>ΔT 基准</dt><dd>{{ result.dtOld }} → {{ result.dtNew }}℃</dd></div>
          </dl>
          <div class="modal-actions"><button class="btn secondary" type="button" @click="apply(false)">拒绝并保留原基线</button><button class="btn primary" type="button" @click="apply(true)">确认生效</button></div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.confirm-backdrop{z-index:70}.confirm-modal{width:min(420px,calc(100vw - 32px));padding:20px}.confirm-warning{margin:4px 0 0;color:#b7c5d2;font-size:12px;line-height:1.7}.danger-action{background:rgba(255,93,108,.14);border-color:rgba(255,93,108,.45);color:#ff9aa3}.danger-action:hover{background:rgba(255,93,108,.24);color:#ffd9dc}.baseline-result-backdrop{z-index:65}.baseline-result-modal{width:min(700px,calc(100vw - 32px));padding:22px}.baseline-result-summary{margin:0;color:#a8bac8;font-size:12px;line-height:1.7}.baseline-result-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0 0;padding-top:16px;border-top:1px solid #26394b}.baseline-result-metrics>div{padding:12px;border:1px solid #2c4357;background:#101d29}.baseline-result-metrics dt{color:#718499;font-size:10px}.baseline-result-metrics dd{margin:7px 0 0;color:#d8e8f1;font:12px 'Fira Code';white-space:nowrap}.baseline-result-modal .modal-actions{margin-top:20px}.baseline-result-modal .modal-head{margin-bottom:14px}@media (max-width:560px){.baseline-result-modal{padding:18px}.baseline-result-metrics{grid-template-columns:1fr;gap:8px}.baseline-result-metrics dd{white-space:normal}}
</style>
