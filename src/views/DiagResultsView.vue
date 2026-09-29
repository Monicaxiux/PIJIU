<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, RotateCcw, Search } from 'lucide-vue-next'
import StatusBadge from '../components/StatusBadge.vue'
import { getEngine, statusMeta } from '../mock'
import { useSystemStore } from '../stores/system'

const router = useRouter()
const store = useSystemStore()
const engine = getEngine()
const state = ref('')
const grade = ref('')
const search = ref('')
const filterKey = 'trapvision.diag-results.filters'

onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(filterKey) || '{}')
    if (typeof saved.state === 'string') state.value = saved.state === 'all' ? '' : saved.state
    if (typeof saved.grade === 'string') grade.value = saved.grade === 'all' ? '' : saved.grade
    if (typeof saved.search === 'string') search.value = saved.search
  } catch {
    // Session persistence is optional.
  }
})

watch([state, grade, search], () => {
  try {
    sessionStorage.setItem(filterKey, JSON.stringify({ state: state.value, grade: grade.value, search: search.value }))
  } catch {
    // Session persistence is optional.
  }
})

const rows = computed(() => {
  store.dataVersion
  const keyword = search.value.trim().toLowerCase()
  return (engine.diagResults || []).map(result => {
    const device = store.devices.find(item => item.id === result.deviceId)
    return device ? { result, device, diagnosis: engine.baseline.diag(device) } : null
  }).filter(Boolean).filter(({ result, device, diagnosis }) =>
    (!state.value || result.state === state.value) &&
    (!grade.value || diagnosis.key === grade.value) &&
    (!keyword || String(device.tagNo || device.id).toLowerCase().includes(keyword))
  )
})

function gradeTone(diagnosis) {
  if (!diagnosis.applicable) return 'na'
  if (diagnosis.key === 'ok') return 'normal'
  if (diagnosis.key.startsWith('block')) return diagnosis.key === 'blockHeavy' ? 'severe' : 'blocked'
  if (diagnosis.key.startsWith('leak')) return diagnosis.key === 'leakSevere' ? 'severe' : 'leak'
  return ''
}

function deviationColor(diagnosis) {
  if (!diagnosis.applicable) return '#8a97a8'
  const deviation = Math.abs(diagnosis.dtPct)
  return deviation > 35 ? '#ff5d6c' : deviation > 25 ? '#ffb547' : '#35d7a0'
}

function confidenceColor(value) {
  return value >= 85 ? '#35d7a0' : value >= 70 ? '#46d8ff' : '#ffb547'
}

function reset() {
  state.value = ''
  grade.value = ''
  search.value = ''
  store.notify('筛选条件已重置')
}

function exportRows() {
  engine.downloadCsv('诊断结果清单', rows.value.map(({ result, device, diagnosis }) => ({
    位号: device.tagNo || device.id,
    设备: device.name,
    类型: device.type,
    区域: device.workshopName || device.area,
    评价窗口: `${diagnosis.win.spanMin}min`,
    'ΔT窗口均值(℃)': diagnosis.win.dtMean,
    'ΔT基准(℃)': diagnosis.info.dtBase,
    '偏离(%)': diagnosis.applicable ? diagnosis.dtPct : '不适用',
    'Tc窗口均值(℃)': diagnosis.win.tcMean,
    'Tc基准(℃)': diagnosis.info.tcBase,
    相对基准档位: diagnosis.label,
    现场状态: statusMeta[result.state]?.label || result.state,
    诊断时间: result.time,
    判定依据: diagnosis.reason,
    '置信度(%)': result.confidence,
    复核状态: result.manual ? `人工复核 · ${result.reviewer}` : '自动判定'
  })))
}

function openDevice(id) {
  router.push(`/monitor/${id}`)
}
</script>

<template>
  <section class="panel diag-results-panel">
    <div class="diag-filter-bar">
      <select v-model="state" aria-label="诊断结论">
        <option value="">全部诊断结论</option>
        <option v-for="(meta, key) in statusMeta" :key="key" :value="key">{{ meta.label }}</option>
      </select>
      <select v-model="grade" aria-label="相对基准档位">
        <option value="">全部相对基准档位</option>
        <option v-for="item in engine.baseline.gradeOrder" :key="item.key" :value="item.key">{{ item.label }}</option>
      </select>
      <label class="search-box diag-search">
        <Search aria-hidden="true" />
        <input v-model="search" placeholder="搜索设备位号" />
      </label>
      <span class="diag-result-hint">共 {{ rows.length }} 条最新诊断结论 · 判定基准取「30 分钟稳定生产窗口均值 vs 人工学习基线」</span>
      <div class="diag-filter-actions">
        <button class="btn ghost" @click="reset"><RotateCcw />重置</button>
        <button class="btn secondary" @click="exportRows"><Download />导出清单</button>
      </div>
    </div>

    <div class="table-scroll diag-table-scroll">
      <table class="diag-results-table">
        <thead>
          <tr>
            <th>位号</th><th>设备</th><th>口径</th><th>温差窗口均值 / 基准</th><th>相对基准档位</th>
            <th>现场状态</th><th>诊断时间</th><th>判定依据</th><th>置信度</th><th>复核状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.result.id" class="clickable" tabindex="0" @click="openDevice(row.device.id)" @keydown.enter="openDevice(row.device.id)">
            <td class="diag-tag">{{ row.device.tagNo || row.device.id }}</td>
            <td><b>{{ row.device.name }}</b><small>{{ row.device.type }}</small></td>
            <td class="diag-muted diag-mono">{{ row.diagnosis.win.spanMin }}min 窗口</td>
            <td class="metric">
              {{ row.diagnosis.win.dtMean }} / <span class="diag-muted">{{ row.diagnosis.info.dtBase }}</span>
              <small class="diag-deviation" :style="{ color: deviationColor(row.diagnosis) }">{{ row.diagnosis.applicable ? `${row.diagnosis.dtPct >= 0 ? '+' : ''}${row.diagnosis.dtPct}%` : '不适用' }}</small>
            </td>
            <td>
              <div class="diag-grade-cell">
                <span class="diagnosis-grade" :class="gradeTone(row.diagnosis)" :title="row.diagnosis.reason">{{ row.diagnosis.label }}</span>
                <button class="btn tiny" @click.stop="router.push({ path: '/ledger', query: { device: row.device.id, tab: 'baseline' } })">基线</button>
              </div>
            </td>
            <td><StatusBadge :status="row.result.state" /></td>
            <td class="diag-muted diag-mono">{{ row.result.time }}</td>
            <td class="diag-reason" :title="row.diagnosis.reason">{{ row.diagnosis.reason }}</td>
            <td>
              <div class="diag-confidence">
                <span><i :style="{ width: `${row.result.confidence}%`, background: confidenceColor(row.result.confidence) }"></i></span>
                <b :style="{ color: confidenceColor(row.result.confidence) }">{{ row.result.confidence }}%</b>
              </div>
            </td>
            <td><span v-if="row.result.manual" class="diag-reviewed">人工复核 · {{ row.result.reviewer }}</span><span v-else class="diag-muted">自动判定</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty-state diag-empty">
        <span>无匹配诊断结论，请调整筛选条件</span>
        <button class="btn ghost" @click="reset">重置筛选</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diag-results-panel{overflow:hidden}
.diag-filter-bar{display:flex;align-items:center;gap:8px;padding:17px 20px;border-bottom:1px solid #223145}
.diag-filter-bar select{width:150px;height:36px;flex:0 0 auto;border:1px solid var(--border);background:#111b27;border-radius:5px;padding:0 10px;outline:0;font-size:12px}
.diag-search{width:180px;flex:0 0 180px}.diag-search input{min-width:0;width:100%}
.diag-result-hint{min-width:220px;color:#718499;font-size:11px;line-height:1.45}
.diag-filter-actions{display:flex;gap:8px;margin-left:auto;flex:0 0 auto}
.diag-table-scroll{max-height:calc(100vh - 190px);min-height:420px;overflow:auto}
.diag-results-table{min-width:1540px}.diag-results-table thead{position:sticky;top:0;z-index:2}
.diag-results-table th{padding-inline:14px}.diag-results-table td{padding:12px 14px}
.diag-tag{color:var(--cyan);font:12px 'Fira Code'}.diag-mono{font-family:'Fira Code'}.diag-muted{color:#718499}
.diag-deviation{display:inline;margin-left:5px;font-family:'Fira Code'}
.diag-grade-cell{display:flex;align-items:center;gap:6px}
.diag-reason{max-width:360px;overflow:hidden;text-overflow:ellipsis;color:#9fb0be;font-size:11px}
.diag-confidence{display:flex;align-items:center;gap:8px}.diag-confidence>span{width:58px;height:5px;overflow:hidden;border-radius:4px;background:#263547}
.diag-confidence i{display:block;height:100%;border-radius:4px}.diag-confidence b{font:11px 'Fira Code';white-space:nowrap}
.diag-reviewed{color:#a77bf3;font-size:11px}.diag-empty{min-height:240px;gap:10px}
@media (max-width:1100px){.diag-filter-bar{align-items:flex-start;flex-wrap:wrap}.diag-result-hint{order:3;width:100%}.diag-filter-actions{margin-left:0}.diag-table-scroll{max-height:calc(100vh - 240px)}}
@media (max-width:760px){.diag-filter-bar{padding:12px 14px}.diag-filter-bar select,.diag-search{width:100%;flex-basis:100%}.diag-filter-actions{width:100%}.diag-filter-actions .btn{flex:1}.diag-table-scroll{max-height:none;min-height:360px}.diag-result-hint{min-width:0}}
</style>
