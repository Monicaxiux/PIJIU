<script setup>
import { computed, ref, watch } from 'vue'
import { Download, RotateCcw } from 'lucide-vue-next'
import { useSystemStore } from '../stores/system'
import { getEngine } from '../mock'

const store = useSystemStore()
const engine = getEngine()
const saved = (() => {
  try { return JSON.parse(sessionStorage.getItem('trapvision.alarm-history.filters') || '{}') } catch { return {} }
})()
const search = ref(saved.search || '')
const level = ref(saved.level || 'all')
const state = ref(saved.state || 'all')

watch([search, level, state], () => {
  try { sessionStorage.setItem('trapvision.alarm-history.filters', JSON.stringify({ search: search.value, level: level.value, state: state.value })) } catch { /* Session persistence is optional. */ }
})

const levelMeta = {
  critical: { value: 1, label: '紧急', className: 'critical' },
  major: { value: 2, label: '重要', className: 'major' },
  minor: { value: 3, label: '一般', className: 'minor' }
}
const statusMeta = {
  pending: { label: '待处理', className: 'is-leak' },
  processing: { label: '处理中', className: 'is-blocked' },
  closed: { label: '已关闭', className: 'is-normal' }
}

function formatTime(value, fallback = '-') {
  if (value === null || value === undefined || value === '' || value === 0) return fallback
  if (typeof value === 'string' && /^\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function minutesBetween(start, end) {
  if (!start || !end) return 0
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : 0
}

const history = computed(() => store.alarms.map(alarm => ({
  ...alarm,
  tagNo: alarm.tagNo || alarm.deviceId,
  content: alarm.message || alarm.content || '-',
  createdDisplay: alarm.createdAt || formatTime(alarm.time),
  claimedDisplay: alarm.claimedAt ? formatTime(alarm.claimedAt) : '-',
  closedDisplay: alarm.closedAt ? formatTime(alarm.closedAt) : '-',
  responseMinutes: alarm.claimedAt ? minutesBetween(alarm.time, alarm.claimedAt) : null,
  closeMinutes: alarm.closedAt && alarm.claimedAt ? minutesBetween(alarm.claimedAt, alarm.closedAt) : null
})))

const rows = computed(() => history.value.filter(alarm => {
  const query = search.value.trim().toLowerCase()
  const matchesSearch = !query || `${alarm.id} ${alarm.tagNo} ${alarm.deviceName} ${alarm.content}`.toLowerCase().includes(query)
  return matchesSearch && (level.value === 'all' || levelMeta[alarm.level]?.value === Number(level.value)) && (state.value === 'all' || alarm.status === state.value)
}))

const average = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
const stats = computed(() => {
  const closed = history.value.filter(alarm => alarm.status === 'closed' && alarm.responseMinutes !== null && alarm.closeMinutes !== null)
  return {
    total: history.value.length,
    closed: history.value.filter(alarm => alarm.status === 'closed').length,
    response: average(closed.map(alarm => alarm.responseMinutes)),
    close: average(closed.map(alarm => alarm.closeMinutes))
  }
})

function levelInfo(value) {
  return levelMeta[value] || levelMeta.minor
}

function statusInfo(value) {
  return statusMeta[value] || { label: value || '-', className: '' }
}

function reset() {
  search.value = ''
  level.value = 'all'
  state.value = 'all'
  store.notify('筛选条件已重置')
}

function exportRows() {
  engine.downloadCsv('历史告警', rows.value.map(alarm => ({
    告警编号: alarm.id,
    位号: alarm.tagNo,
    设备: alarm.deviceName,
    区域: alarm.area,
    级别: levelInfo(alarm.level).label,
    告警内容: alarm.content,
    产生时间: alarm.createdDisplay,
    认领时间: alarm.claimedDisplay,
    关闭时间: alarm.closedDisplay,
    状态: statusInfo(alarm.status).label,
    处理人: alarm.owner || alarm.handler || '-',
    处理措施: alarm.measure || '-'
  })))
}
</script>

<template>
  <div class="page-stack history-page">
    <section class="alarm-stats history-kpis" aria-label="历史告警统计">
      <div><b>{{ stats.total }}</b><small>告警总数</small></div>
      <div><b class="good">{{ stats.closed }}</b><small>已关闭</small></div>
      <div><b class="warn-text">{{ stats.response }}<em>min</em></b><small>平均响应时长（认领）</small></div>
      <div><b>{{ stats.close }}<em>min</em></b><small>平均关闭时长</small></div>
    </section>

    <section class="panel table-panel">
      <div class="table-toolbar">
        <div class="filters">
          <label class="search-box"><input v-model="search" placeholder="搜索位号 / 告警内容" aria-label="搜索位号或告警内容" /></label>
          <select v-model="level" aria-label="告警级别">
            <option value="all">全部级别</option>
            <option value="1">紧急</option><option value="2">重要</option><option value="3">一般</option>
          </select>
          <select v-model="state" aria-label="告警状态">
            <option value="all">全部状态</option>
            <option value="pending">待处理</option><option value="processing">处理中</option><option value="closed">已关闭</option>
          </select>
          <button class="btn ghost" @click="reset"><RotateCcw />重置</button>
        </div>
        <div class="history-actions"><span class="result-count">共 {{ rows.length }} 条</span><button class="btn secondary" @click="exportRows"><Download />导出记录</button></div>
      </div>

      <div class="table-scroll history-table-scroll">
        <table class="history-table">
          <thead><tr><th>告警编号</th><th>位号</th><th>级别</th><th>告警内容</th><th>产生时间</th><th>认领时间</th><th>关闭时间</th><th>状态</th><th>处理人</th></tr></thead>
          <tbody>
            <tr v-for="alarm in rows" :key="alarm.id" class="clickable" @click="$router.push(`/monitor/${alarm.deviceId}`)">
              <td class="mono muted">{{ alarm.id }}</td>
              <td class="mono tag-cell">{{ alarm.tagNo }}</td>
              <td><span class="alarm-level" :class="levelInfo(alarm.level).className">{{ levelInfo(alarm.level).label }}</span></td>
              <td class="content-cell">{{ alarm.content }}</td>
              <td class="mono muted">{{ alarm.createdDisplay }}</td>
              <td class="mono muted">{{ alarm.claimedDisplay }}</td>
              <td class="mono muted">{{ alarm.closedDisplay }}</td>
              <td><span class="status-badge" :class="statusInfo(alarm.status).className"><i></i>{{ statusInfo(alarm.status).label }}</span></td>
              <td>{{ alarm.owner || alarm.handler || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!rows.length" class="empty-state"><span>无匹配告警记录</span><button class="btn ghost" @click="reset">重置筛选</button></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.history-kpis{grid-template-columns:repeat(4,1fr)}
.history-kpis>div{display:block;padding:16px 18px}
.history-kpis b{display:block;font:500 24px 'Fira Code';color:var(--cyan);margin-bottom:5px}
.history-kpis b.good{color:var(--green)}
.history-kpis b.warn-text{color:var(--amber)}
.history-kpis em{font:11px 'Fira Sans';color:#73859a;font-style:normal;margin-left:4px}
.history-actions{display:flex;align-items:center;gap:12px}
.result-count{color:#718499;font-size:11px;white-space:nowrap}
.history-table-scroll{max-height:calc(100vh - 255px);min-height:420px}
.history-table{min-width:1120px}
.history-table th,.history-table td{padding-inline:16px}
.history-table .tag-cell{color:var(--cyan)}
.history-table .content-cell{max-width:360px;white-space:normal;line-height:1.5;color:#b8c7d6}
.history-table .clickable{cursor:pointer}
.history-table .alarm-level{display:inline-flex}
.mono{font-family:'Fira Code'}
.muted{color:#718499}
@media (max-width:760px){.history-kpis{grid-template-columns:repeat(2,1fr)}.table-toolbar{align-items:flex-start;flex-direction:column}.history-actions{justify-content:space-between;width:100%}.history-table-scroll{max-height:none;min-height:360px}.history-table{min-width:1050px}}
</style>
