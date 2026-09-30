<script setup>
import { computed, ref, watch } from 'vue'
import { Download, Pause, Play, RotateCcw, Search } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import StatusBadge from '../components/StatusBadge.vue'
import { getEngine, statusMeta } from '../mock'
import { useSystemStore } from '../stores/system'

const store = useSystemStore(), router = useRouter()
const engine = getEngine()
const saved = (() => { try { return JSON.parse(sessionStorage.getItem('trapvision.monitor.filters') || '{}') } catch { return {} } })()
const search = ref(saved.search || '')
const area = ref(saved.area || '全部区域')
const statuses = ref(saved.statuses || [])
const baselineOnly = ref(Boolean(saved.baselineOnly))
const sort = ref(saved.sort || 'health')
const direction = ref(saved.direction || 'asc')
const gradeOrder = Object.fromEntries(engine.baseline.gradeOrder.map((item, index) => [item.key, index]))

watch([search, area, statuses, baselineOnly, sort, direction], () => {
  try { sessionStorage.setItem('trapvision.monitor.filters', JSON.stringify({ search: search.value, area: area.value, statuses: statuses.value, baselineOnly: baselineOnly.value, sort: sort.value, direction: direction.value })) } catch { /* Session persistence is optional. */ }
}, { deep: true })

function diagnosis(device) { return engine.baseline.diag(device) }
function baseline(device) { return engine.baseline.info(device) }
function modeKind(device) { return baseline(device).mode === 'manual' ? 'manual' : 'auto' }
function confirmKind(device) { const info = baseline(device); if (info.pending) return 'pending'; if (info.mode === 'manual' || info.confirmNeeded) return 'required'; return 'free' }
function confirmLabel(device) { return { pending: '待确认', required: '需确认', free: '免确认' }[confirmKind(device)] }
function updatedLabel(device) { return device.lastUpdate || new Date(device.updated).toLocaleTimeString('zh-CN', { hour12: false }) }
function toggleStatus(key) { statuses.value = statuses.value.includes(key) ? statuses.value.filter(item => item !== key) : [...statuses.value, key] }
function sortBy(key) { if (sort.value === key) direction.value = direction.value === 'asc' ? 'desc' : 'asc'; else { sort.value = key; direction.value = 'asc' } }
function mark(key) { return sort.value === key ? (direction.value === 'asc' ? ' ▲' : ' ▼') : '' }
function reset() { search.value = ''; area.value = '全部区域'; statuses.value = []; baselineOnly.value = false; sort.value = 'health'; direction.value = 'asc'; store.notify('筛选与排序已重置') }
function valueOf(device, key) {
  const rd = diagnosis(device), bi = baseline(device)
  const confirmRank = { pending: 0, required: 1, free: 2 }
  const values = { area: device.area, id: device.id, type: device.type, ts: rd.win.tsMean, tc: rd.win.tcMean, delta: rd.win.dtMean, grade: gradeOrder[rd.key] ?? 99, mode: bi.mode === 'manual' ? 1 : 0, confirm: confirmRank[confirmKind(device)], status: device.status, health: device.confidence, updated: device.updated }
  return values[key]
}
const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const dir = direction.value === 'asc' ? 1 : -1
  return store.devices.filter(device => {
    const bi = baseline(device)
    return (area.value === '全部区域' || device.area === area.value)
      && (!statuses.value.length || statuses.value.includes(device.status))
      && (!baselineOnly.value || bi.pending || bi.cumRise >= bi.warnRise)
      && (!keyword || `${device.id}${device.name}${device.equip || ''}`.toLowerCase().includes(keyword))
  }).sort((a, b) => {
    const av = valueOf(a, sort.value), bv = valueOf(b, sort.value)
    return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-CN')) * dir
  })
})
function exportRows() {
  engine.downloadCsv('设备监测列表', filtered.value.map(device => {
    const rd = diagnosis(device), bi = baseline(device)
    return { 区域: device.area, 位号: device.id, 名称: device.name, 类型: device.type, 'Ts窗口均值(℃)': rd.win.tsMean, 'Tc窗口均值(℃)': rd.win.tcMean, 'ΔT窗口均值(℃)': rd.win.dtMean, 'ΔT基准(℃)': bi.dtBase, '偏离(%)': rd.applicable ? rd.dtPct : '不适用', 相对基准诊断: rd.label, 基线模式: bi.mode === 'manual' ? '手动' : '自动', '自动同步阈值(℃)': bi.mode === 'manual' ? '—' : `±${bi.autoTh}`, 人工确认: confirmLabel(device), 现场状态: statusMeta[device.status].label, 健康度: device.confidence, 最近更新: updatedLabel(device) }
  }))
}
</script>

<template>
  <div class="page-stack">
    <section class="status-filter panel slim-panel">
      <button :class="{ active: !statuses.length }" @click="statuses = []"><strong>{{ store.devices.length }}</strong><span>全部设备</span></button>
      <button v-for="(meta,key) in statusMeta" :key="key" :class="[`tone-${key}`, { active: statuses.includes(key) }]" @click="toggleStatus(key)"><strong>{{ store.counts[key] }}</strong><span>{{ meta.label }}</span></button>
    </section>
    <section class="panel table-panel">
      <div class="table-toolbar">
        <div class="filters">
          <label class="search-box"><Search /><input v-model="search" placeholder="搜索位号 / 名称 / 上游设备" /></label>
          <select v-model="area" aria-label="区域筛选"><option>全部区域</option><option>动力区域</option><option>酿造区域</option><option>包装区域</option></select>
          <button class="btn secondary" :class="{ active: baselineOnly }" :aria-pressed="baselineOnly" @click="baselineOnly = !baselineOnly">基线待办 {{ store.baselineTodoCount }}</button>
        </div>
        <div class="toolbar-actions">
          <button class="btn ghost" @click="store.autoRefresh = !store.autoRefresh"><component :is="store.autoRefresh ? Pause : Play" />{{ store.autoRefresh ? '暂停刷新' : '继续刷新' }}</button>
          <button class="btn ghost" @click="reset"><RotateCcw />重置</button>
          <button class="btn secondary" @click="exportRows"><Download />导出 Excel</button>
        </div>
      </div>
      <div class="table-hint">共 <b>{{ filtered.length }}</b> 台设备。Ts、Tc、ΔT 均采用 30 分钟稳定生产窗口均值，并与人工学习基线比对；可与现场状态交叉印证，点击表头排序、点击行进入详情。</div>
      <div class="table-scroll monitor-table"><table><thead><tr>
        <th @click="sortBy('area')">区域{{ mark('area') }}</th><th @click="sortBy('id')">设备{{ mark('id') }}</th><th @click="sortBy('type')">类型{{ mark('type') }}</th><th @click="sortBy('ts')">Ts 窗口均值{{ mark('ts') }}</th><th @click="sortBy('tc')">Tc 窗口均值{{ mark('tc') }}</th><th @click="sortBy('delta')">ΔT / 基准{{ mark('delta') }}</th><th @click="sortBy('grade')">相对基准诊断{{ mark('grade') }}</th><th @click="sortBy('mode')">基线模式{{ mark('mode') }}</th><th @click="sortBy('confirm')">人工确认{{ mark('confirm') }}</th><th @click="sortBy('status')">现场状态{{ mark('status') }}</th><th @click="sortBy('health')">健康度{{ mark('health') }}</th><th @click="sortBy('updated')">最近更新{{ mark('updated') }}</th><th>操作</th>
      </tr></thead><tbody>
        <tr v-for="device in filtered" :key="device.id" class="clickable" @click="router.push(`/monitor/${device.id}`)">
          <td>{{ device.area }}<small>{{ device.line }}</small></td>
          <td><RouterLink class="device-cell" :to="`/monitor/${device.id}`"><b>{{ device.id }}</b><span>{{ device.name }}</span></RouterLink></td>
          <td>{{ device.type }}</td>
          <td class="metric" :title="`瞬时值 ${device.ts?.toFixed(1)}℃；窗口极差 ${diagnosis(device).win.tsRange}℃`">{{ diagnosis(device).win.tsMean }}<small>瞬时 {{ device.ts?.toFixed(1) }}℃ · 极差 {{ diagnosis(device).win.tsRange }}℃</small></td>
          <td class="metric" :title="`瞬时值 ${device.tc?.toFixed(1)}℃；窗口极差 ${diagnosis(device).win.tcRange}℃`">{{ diagnosis(device).win.tcMean }}<small>瞬时 {{ device.tc?.toFixed(1) }}℃ · 极差 {{ diagnosis(device).win.tcRange }}℃</small></td>
          <td class="metric">{{ diagnosis(device).win.dtMean }} / {{ baseline(device).dtBase }}<small :class="{ warn: Math.abs(diagnosis(device).dtPct) > 25 }">{{ diagnosis(device).applicable ? `${diagnosis(device).dtPct >= 0 ? '+' : ''}${diagnosis(device).dtPct}%` : '不适用' }}</small></td>
          <td><span class="diagnosis-grade" :class="diagnosis(device).key">{{ diagnosis(device).label }}</span><small v-if="diagnosis(device).isFloat && diagnosis(device).consec">连续 {{ diagnosis(device).consec }} 次命中</small><small v-if="baseline(device).pending" class="warn">基线待确认</small><small v-else-if="baseline(device).cumRise >= baseline(device).warnRise" class="warn">趋势预警</small></td>
          <td><span class="baseline-mode" :class="modeKind(device)">{{ modeKind(device) === 'manual' ? '手动' : '自动' }}</span><small v-if="modeKind(device) === 'auto'">±{{ baseline(device).autoTh }}℃</small></td>
          <td><span class="confirm-state" :class="confirmKind(device)">{{ confirmKind(device) === 'pending' ? '⏸' : confirmKind(device) === 'free' ? '⚡' : '✋' }} {{ confirmLabel(device) }}</span></td>
          <td><StatusBadge :status="device.status" /></td>
          <td><span class="confidence"><i :style="{ width: `${device.confidence}%` }"></i></span>{{ device.confidence }}%</td>
          <td class="mono muted">{{ updatedLabel(device) }}</td>
          <td @click.stop><div class="row-actions"><RouterLink class="btn tiny" :to="`/monitor/${device.id}`">详情</RouterLink><RouterLink class="btn tiny" :to="{ path: '/ledger', query: { device: device.id, tab: 'baseline' } }">基线</RouterLink></div></td>
        </tr>
      </tbody></table><div v-if="!filtered.length" class="empty-state"><span>无匹配设备</span><button class="btn ghost" @click="reset">重置筛选</button></div></div>
      <div class="table-footer"><span>共 {{ filtered.length }} 台设备</span><span class="live-dot"><i></i>{{ store.autoRefresh ? '每 6 秒自动刷新' : '自动刷新已暂停' }}</span></div>
    </section>
  </div>
</template>

<style scoped>
.monitor-table table{min-width:1540px}.monitor-table th{cursor:pointer}.baseline-mode,.confirm-state{display:inline-flex;padding:4px 7px;border:1px solid;border-radius:3px;font-size:10px;white-space:nowrap}.baseline-mode.auto{color:var(--cyan);border-color:rgba(70,216,255,.38);background:rgba(70,216,255,.08)}.baseline-mode.manual{color:var(--amber);border-color:rgba(255,181,71,.4);background:rgba(255,181,71,.08)}.confirm-state.pending,.confirm-state.required{color:var(--amber);border-color:rgba(255,181,71,.4);background:rgba(255,181,71,.08)}.confirm-state.free{color:#91a0b0;border-color:#3a4a5c;background:#17212c}.muted{color:#718499}
</style>
