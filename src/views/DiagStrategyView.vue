<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, CheckCircle2, ChevronRight, DatabaseZap, ExternalLink, RotateCcw, Save } from 'lucide-vue-next'
import StatusBadge from '../components/StatusBadge.vue'
import { getEngine } from '../mock'
import { useSystemStore } from '../stores/system'

const route = useRoute()
const router = useRouter()
const store = useSystemStore()
const engine = getEngine()
const types = engine.leakStrategy.scope
const selected = ref(types.includes(route.params.type) ? route.params.type : '倒立桶')
const draft = ref({})
const dirty = ref(false)

function load(type) {
  selected.value = type
  draft.value = JSON.parse(JSON.stringify(engine.leakStrategy.types[type]))
  dirty.value = false
}

load(selected.value)

watch(() => route.params.type, type => {
  const next = types.includes(type) ? type : '倒立桶'
  if (next !== selected.value) load(next)
})

const baselineSummary = computed(() => {
  store.dataVersion
  return engine.baseline.summary()
})

const statsByType = computed(() => Object.fromEntries(types.map(type => [type, store.devices.filter(device => device.type === type).length])))
const isFloat = computed(() => selected.value === '浮球式')
const floatRows = computed(() => {
  store.dataVersion
  return store.devices
    .filter(device => device.type === '浮球式')
    .map(device => ({ device, evaluation: engine.floatEval(device), diagnosis: engine.baseline.diag(device) }))
    .sort((a, b) => a.evaluation.last.ratio - b.evaluation.last.ratio)
})
const floatSegments = computed(() => floatRows.value[0]?.evaluation.points || 0)

const leakSteps = computed(() => isFloat.value ? [
  { no: '01', title: '周期评估', tone: 'base', text: `每 ${draft.value.periodMin}min 监测一次，取最近 ${draft.value.dataMin}min 的 ΔT 均值` },
  { no: '02', title: '温差基准线', tone: 'base', text: '人工标注连续排放稳定段，计算 ΔT / ΔTbase' },
  { no: '03', title: '泄漏报警（初期）', tone: 'warn', text: `比值 ${percent(draft.value.dtMildLow)}% ~ ${percent(draft.value.dtMildHigh)}%，连续 ${draft.value.mildConsecutive} 次` },
  { no: '04', title: '严重报警', tone: 'danger', text: `比值低于 ${percent(draft.value.severeDtRatio)}%，连续 ${draft.value.severeConsecutive} 次` }
] : [
  { no: '01', title: '周期评估', tone: 'base', text: `每 ${draft.value.periodMin}min 监测一次，取最近 ${draft.value.dataMin}min 时序数据` },
  { no: '02', title: '稳定窗口判定', tone: 'base', text: `进口极差 < ${draft.value.rangeSteam}℃，且出口极差 < ${draft.value.rangeCond}℃` },
  { no: '03', title: '泄漏报警（轻度）', tone: 'warn', text: `出口温度 > 基准 +${draft.value.mildTcRise}℃，连续 ${draft.value.mildConsecutive} 次` },
  { no: '04', title: '严重报警', tone: 'danger', text: `出口 > 基准 +${draft.value.severeTcRise}℃，或 ΔT < 基准 × ${percent(draft.value.severeDtRatio)}%，连续 ${draft.value.severeConsecutive} 次` }
])

const parameterRows = computed(() => isFloat.value ? [
  { key: 'periodMin', label: '监测周期', unit: 'min', step: 1, help: '每 N 分钟触发一次泄漏评估。' },
  { key: 'dataMin', label: '数据窗口', unit: 'min', step: 1, help: '取最近 N 分钟进出口温差序列求均值。' },
  { key: 'dtMildHigh', label: '初期泄漏比值上限', unit: '倍', step: 0.01, help: '低于该值进入初期泄漏带，0.75 表示基准的 75%。' },
  { key: 'dtMildLow', label: '初期泄漏比值下限', unit: '倍', step: 0.01, help: '低于该值转入严重判据，边界采用左闭右开。' },
  { key: 'mildConsecutive', label: '初期泄漏连续次数', unit: '次', step: 1, help: '连续命中后才报警，未达次数仅进入观察序列。' },
  { key: 'severeDtRatio', label: '严重报警温差比', unit: '倍', step: 0.01, help: 'ΔT / ΔTbase 低于该比例判严重泄漏。' },
  { key: 'severeConsecutive', label: '严重报警连续次数', unit: '次', step: 1, help: '连续命中 N 次后生成严重报警。' },
  { key: 'blockMildRatio', label: '轻度堵塞温差比', unit: '倍', step: 0.01, help: '高于温差基准该比例时判轻度堵塞。' },
  { key: 'blockHeavyRatio', label: '重度堵塞温差比', unit: '倍', step: 0.01, help: '高于温差基准该比例时判重度堵塞。' }
] : [
  { key: 'periodMin', label: '监测周期', unit: 'min', step: 1, help: '周期触发评估任务，与采集终端调度同步。' },
  { key: 'dataMin', label: '数据窗口', unit: 'min', step: 1, help: '每次评估取最近 N 分钟时序数据。' },
  { key: 'rangeSteam', label: '进口极差阈值', unit: '℃', step: 1, help: '窗口内进口温度极差低于该值视为稳定生产。' },
  { key: 'rangeCond', label: '出口极差阈值', unit: '℃', step: 1, help: '窗口内出口温度极差低于该值视为非排水时间。' },
  { key: 'mildTcRise', label: '轻度报警出口温升', unit: '℃', step: 1, help: '出口温度高于出口温度基准该值以上。' },
  { key: 'mildConsecutive', label: '轻度报警连续次数', unit: '次', step: 1, help: '连续 N 个监测周期满足才报警。' },
  { key: 'severeTcRise', label: '严重报警出口温升', unit: '℃', step: 1, help: '出口均值高于基准该值以上进入严重判据。' },
  { key: 'severeDtRatio', label: '严重报警温差比', unit: '倍', step: 0.01, help: '温差均值低于温差基准的该比例时命中。' },
  { key: 'severeConsecutive', label: '严重报警连续次数', unit: '次', step: 1, help: '出口温升或温差比命中其一即计数。' },
  { key: 'blockMildRatio', label: '轻度堵塞温差比', unit: '倍', step: 0.01, help: '高于温差基准该比例时判轻度堵塞。' },
  { key: 'blockHeavyRatio', label: '重度堵塞温差比', unit: '倍', step: 0.01, help: '高于温差基准该比例时判重度堵塞。' }
])

function percent(value) {
  return Math.round(Number(value || 0) * 100)
}

function switchType(type) {
  load(type)
  router.replace(`/diag/strategy/${encodeURIComponent(type)}`)
}

function markDirty() {
  dirty.value = true
}

function reset() {
  load(selected.value)
  store.notify('已恢复为当前生效参数')
}

function save() {
  engine.leakStrategy.types[selected.value] = JSON.parse(JSON.stringify(draft.value))
  store.bumpData()
  dirty.value = false
  store.notify(`【${selected.value}】诊断策略已保存并下发采集终端`)
}

function ratioColor(ratio) {
  if (ratio < (draft.value.dtMildLow ?? 0.65)) return 'var(--red)'
  if (ratio < (draft.value.dtMildHigh ?? 0.75)) return 'var(--amber)'
  return 'var(--green)'
}

function gradeTone(key) {
  if (key === 'ok') return 'normal'
  if (key === 'na') return 'na'
  if (key.startsWith('block')) return key === 'blockHeavy' ? 'severe' : 'blocked'
  return key === 'leakSevere' ? 'severe' : 'leak'
}
</script>

<template>
  <div class="strategy-page page-stack">
    <section class="strategy-kpis" aria-label="策略概览">
      <article><strong>3</strong><span>适用阀型</span><small>倒立桶 / 热力型 / 浮球式</small></article>
      <article><strong>20<em>min</em></strong><span>监测周期</span><small>取 30min 诊断窗口</small></article>
      <article><strong>200<em>点</em></strong><span>基线学习采样</span><small>稳定生产窗口</small></article>
      <article><strong>15<em>天</em></strong><span>自动重算周期</span><small>同步更新基线</small></article>
      <article class="warn"><strong>{{ baselineSummary.pending }}</strong><span>基线待确认</span><small>需人工核对后生效</small></article>
      <article :class="{ danger: baselineSummary.warn }"><strong>{{ baselineSummary.warn }}</strong><span>基线趋势预警</span><small>累计上升 ≥ 5℃</small></article>
    </section>

    <section class="panel strategy-selector">
      <div class="strategy-tabs" role="tablist" aria-label="阀型策略">
        <button v-for="type in types" :key="type" role="tab" :aria-selected="selected === type" :class="{ active: selected === type }" @click="switchType(type)">
          <b>{{ type }}</b><span>{{ statsByType[type] || 0 }} 台 · {{ type === '浮球式' ? '连续排放' : '间歇排放' }}</span>
        </button>
      </div>
      <p><DatabaseZap :size="16" aria-hidden="true" />{{ engine.leakStrategy.sensor }}</p>
    </section>

    <section class="panel strategy-section">
      <header class="strategy-head">
        <div><small>LEAK DIAGNOSIS PIPELINE</small><h2>泄漏判定逻辑 · {{ selected }}</h2></div>
        <span v-if="isFloat" class="strategy-badge warn">温差比值单判据</span>
        <span v-else class="strategy-badge">生产稳定模式周期评估</span>
      </header>
      <div class="process-flow">
        <template v-for="(step, index) in leakSteps" :key="step.no">
          <article :class="step.tone"><span>{{ step.no }}</span><h3>{{ step.title }}</h3><p>{{ step.text }}</p></article>
          <ChevronRight v-if="index < leakSteps.length - 1" class="process-arrow" aria-hidden="true" />
        </template>
      </div>
      <div v-if="!isFloat" class="logic-notes">
        <p>判定同时使用出口温升与进出口温差两条证据链：泄漏时出口温度抬升、温差缩小，两者互相印证。</p>
        <p>进口和出口极差低于阈值的稳定窗口用于排除排水脉冲期；异常命中计数 +1，正常即清零，未达连续次数只进入观察序列。</p>
      </div>
      <div v-else class="logic-notes">
        <p>浮球式持续排放，出口温度基准本身偏高，因此不使用出口温升判据，仅按进出口温差相对温差基准的比值分档。</p>
        <p><b>≥ {{ percent(draft.dtMildHigh) }}%</b> 正常；<b>{{ percent(draft.dtMildLow) }}% ~ {{ percent(draft.dtMildHigh) }}%</b> 初期泄漏；<b>&lt; {{ percent(draft.severeDtRatio) }}%</b> 严重泄漏。边界采用左闭右开，未达连续次数只标记为观察中。</p>
      </div>

      <div v-if="isFloat" class="comparison-block">
        <h3>与间歇排放型的业务差异</h3>
        <div class="table-scroll">
          <table class="comparison-table">
            <thead><tr><th>对比项</th><th>倒立桶 / 热力型</th><th>浮球式</th></tr></thead>
            <tbody>
              <tr><td>稳定窗口</td><td>进出口极差均低于 5℃ 的非排水时间窗口</td><td>连续排放，取 30min 稳定段 ΔT 均值</td></tr>
              <tr><td>判据特征</td><td>出口温升 + 温差缩水双证据链</td><td>仅使用温差比值单判据</td></tr>
              <tr><td>初期报警</td><td>出口 > 基准 +10℃，连续 3 次</td><td>比值 {{ percent(draft.dtMildLow) }}% ~ {{ percent(draft.dtMildHigh) }}%，连续 {{ draft.mildConsecutive }} 次</td></tr>
              <tr><td>严重报警</td><td>出口 > 基准 +25℃ 或 ΔT &lt; 基准 × 65%</td><td>比值 &lt; {{ percent(draft.severeDtRatio) }}%，连续 {{ draft.severeConsecutive }} 次</td></tr>
              <tr><td>堵塞判据</td><td colspan="2">一致：ΔT 高于基准 × {{ draft.blockMildRatio }} 为轻度，× {{ draft.blockHeavyRatio }} 为重度</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section v-if="isFloat" class="panel strategy-section">
      <header class="strategy-head">
        <div><small>FLOAT TRAP EVALUATION</small><h2>浮球式泄漏评估明细</h2></div>
        <p>每 {{ draft.periodMin }}min 评估 · {{ floatSegments }} 个评估点 · 劣化最重在前</p>
      </header>
      <div class="table-scroll bounded-table">
        <table class="strategy-table float-table">
          <thead><tr><th>位号</th><th>区域</th><th>上游设备</th><th>现场状态</th><th>ΔT 均值</th><th>ΔT 基准</th><th>比值</th><th>连续次数<br><small>初期 · 严重</small></th><th>相对基准结论</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="row in floatRows" :key="row.device.id">
              <td class="tag-no">{{ row.device.tagNo }}</td><td>{{ row.device.workshopName }}</td><td>{{ row.device.equip }}</td>
              <td><StatusBadge :status="row.device.status" /></td><td class="mono">{{ row.evaluation.last.dtMean }}℃</td><td class="mono muted">{{ row.evaluation.base }}℃</td>
              <td class="mono" :style="{ color: ratioColor(row.evaluation.last.ratio) }">{{ percent(row.evaluation.last.ratio) }}% <small>{{ row.evaluation.last.ratio < row.evaluation.severeRatio ? '< 严重线' : row.evaluation.last.ratio < row.evaluation.mildHigh ? '初期带' : '正常带' }}</small></td>
              <td class="mono">{{ row.evaluation.consecMild }}/{{ row.evaluation.needMild }} · {{ row.evaluation.consecSevere }}/{{ row.evaluation.needSevere }}</td>
              <td><span class="diagnosis-grade" :class="gradeTone(row.diagnosis.key)">{{ row.diagnosis.label }}</span><small v-if="row.diagnosis.watch" class="watching">观察中</small></td>
              <td><RouterLink class="btn tiny" :to="{ path: '/ledger', query: { device: row.device.id, tab: 'baseline' } }">基线标注</RouterLink></td>
            </tr>
            <tr v-if="!floatRows.length"><td colspan="10" class="empty-row">暂无浮球式设备</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel strategy-section">
      <header class="strategy-head"><div><small>BLOCK DIAGNOSIS PIPELINE</small><h2>堵塞判定逻辑 · 全阀型适用</h2></div><span class="strategy-badge">相对温差基准</span></header>
      <div class="process-flow block-flow">
        <article class="base"><span>01</span><h3>温差窗口均值</h3><p>取 {{ draft.dataMin }}min 稳定窗口 ΔT 均值，与 ΔTbase 比对</p></article><ChevronRight class="process-arrow" aria-hidden="true" />
        <article class="warn"><span>02</span><h3>轻度堵塞</h3><p>ΔT > ΔTbase × {{ draft.blockMildRatio }}（+{{ percent(draft.blockMildRatio - 1) }}%），且 ≤ × {{ draft.blockHeavyRatio }}</p></article><ChevronRight class="process-arrow" aria-hidden="true" />
        <article class="danger"><span>03</span><h3>重度堵塞</h3><p>ΔT > ΔTbase × {{ draft.blockHeavyRatio }}（+{{ percent(draft.blockHeavyRatio - 1) }}%），存在水击风险</p></article>
      </div>
      <div class="logic-notes"><p>堵塞表现为冷凝水无法排出、进出口温差被拉大，与泄漏侧的温差缩水判据互斥。浮球式同样参与该堵塞判据。</p></div>
    </section>

    <section class="panel strategy-section parameter-section">
      <header class="strategy-head">
        <div><small>PARAMETER MAINTENANCE</small><h2>参数维护 · {{ selected }}</h2></div>
        <span v-if="dirty" class="strategy-badge danger"><AlertTriangle :size="14" aria-hidden="true" />未保存修改</span>
      </header>
      <div class="parameter-grid">
        <label v-for="row in parameterRows" :key="row.key" class="parameter-field">
          <span>{{ row.label }}</span>
          <div><input v-model.number="draft[row.key]" type="number" min="0" :step="row.step" @input="markDirty" /><b>{{ row.unit }}</b></div>
          <small>{{ row.help }}</small>
        </label>
      </div>
      <p v-if="isFloat" class="parameter-note">浮球式不提供出口温升和进出口极差阈值。初期、严重两级使用同一温差基准的两个比值切分。</p>
      <footer class="strategy-actions"><button class="btn secondary" @click="reset"><RotateCcw aria-hidden="true" />还原</button><button class="btn primary" @click="save"><Save aria-hidden="true" />保存并下发</button></footer>
    </section>

    <section class="panel strategy-section baseline-policy">
      <header class="strategy-head"><div><small>BASELINE MANAGEMENT</small><h2>基线管理策略 · PT100 双通道</h2></div><span class="strategy-badge">出口基准 + 温差基准</span></header>
      <div class="baseline-fields">
        <label><span>学习采样点数</span><div><input v-model.number="draft.blSamples" type="number" min="1" @input="markDirty" /><b>点</b></div><small>生产稳定模式下“{{ draft.blPhase }}”窗口内采样。</small></label>
        <label><span>自动重算周期</span><div><input v-model.number="draft.blRecalcDays" type="number" min="1" @input="markDirty" /><b>天</b></div><small>每 N 天同步重新计算基线。</small></label>
        <label><span>人工确认触发线</span><div><input v-model.number="draft.blConfirmRise" type="number" min="0" step="0.1" @input="markDirty" /><b>℃</b></div><small>新基线相对原基线上升超过该值后需人工确认。</small></label>
        <article><span>基线统计方式</span><strong>出口温度均值 + 进出口温差均值</strong><small>支持在设备台账的基线学习页对单台设备手动标注。浮球式泄漏只使用 ΔTbase，出口基准用于交叉印证。</small></article>
      </div>
      <div class="baseline-warning"><AlertTriangle aria-hidden="true" /><div><h3>基线趋势预警</h3><p>所有基线更改均记录时间、触发方式、原值、新值、操作人和生效状态。累计上升 ≥5℃ 时触发趋势预警，避免故障数据被学习进基线；未通过人工确认的结果不会覆盖原基线。</p></div></div>
      <footer class="strategy-actions"><button class="btn secondary" @click="reset"><RotateCcw aria-hidden="true" />还原</button><button class="btn primary" @click="save"><Save aria-hidden="true" />保存并下发</button></footer>
    </section>

    <section class="panel strategy-section">
      <header class="strategy-head"><div><small>BASELINE TODO</small><h2>基线台账 · 待人工确认与趋势预警</h2></div><p>直达设备基线标注学习页处理</p></header>
      <div class="table-scroll">
        <table class="strategy-table todo-table">
          <thead><tr><th>位号</th><th>阀型</th><th>区域</th><th>基线来源</th><th>累计上升</th><th>状态</th><th>处理建议</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="row in baselineSummary.pendingList" :key="row.d.id">
              <td class="tag-no">{{ row.d.tagNo }}</td><td>{{ row.d.type }}</td><td>{{ row.d.workshopName }}</td><td class="muted">{{ row.i.source }} · {{ row.i.learnedAt }}</td>
              <td class="mono" :class="row.i.cumRise >= 5 ? 'danger-text' : 'warn-text'">+{{ row.i.cumRise }}℃</td>
              <td><span class="todo-state" :class="{ danger: row.i.cumRise >= 5 }">{{ row.i.cumRise >= 5 ? '趋势预警' : '待确认' }}</span></td>
              <td class="advice">{{ row.i.cumRise >= 5 ? '疑似故障数据污染基线，建议先排除泄漏/堵塞再学习。' : '核对工况平稳后确认生效或拒绝。' }}</td>
              <td><RouterLink class="btn tiny" :to="{ path: '/ledger', query: { device: row.d.id, tab: 'baseline' } }"><ExternalLink aria-hidden="true" />去处理</RouterLink></td>
            </tr>
            <tr v-if="!baselineSummary.pendingList.length"><td colspan="8" class="empty-row">当前无待确认基线</td></tr>
          </tbody>
        </table>
      </div>
      <footer class="baseline-summary"><CheckCircle2 aria-hidden="true" />已生效 <b>{{ baselineSummary.ok }}</b> 台 · 待确认 <b class="warn-text">{{ baselineSummary.pending }}</b> 台 · 趋势预警 <b class="danger-text">{{ baselineSummary.warn }}</b> 台 · 模板冷启动 <b>{{ baselineSummary.templ }}</b> 台</footer>
    </section>
  </div>
</template>

<style scoped>
.strategy-page{--section-pad:20px}.strategy-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.strategy-kpis article{min-width:0;padding:15px 16px;border:1px solid var(--border);background:#111a25}.strategy-kpis strong{display:block;color:var(--cyan);font:500 24px 'Fira Code'}.strategy-kpis em{margin-left:4px;color:#7f93a7;font:10px 'Fira Sans';font-style:normal}.strategy-kpis span{display:block;margin-top:7px;color:#d8e5ef;font-size:11px}.strategy-kpis small{display:block;margin-top:3px;color:#718499;font-size:10px;line-height:1.4}.strategy-kpis .warn strong{color:var(--amber)}.strategy-kpis .danger strong{color:var(--red)}
.strategy-selector{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px}.strategy-tabs{display:flex;gap:6px;flex-wrap:wrap}.strategy-tabs button{min-height:44px;padding:7px 14px;border:1px solid #2b4053;background:#101a25;color:#8496a8;text-align:left;transition:background .18s,border-color .18s,color .18s}.strategy-tabs button:hover,.strategy-tabs button.active{border-color:#3c718b;background:rgba(70,216,255,.09);color:#e7f8ff}.strategy-tabs b,.strategy-tabs span{display:block}.strategy-tabs b{font-size:12px}.strategy-tabs span{margin-top:3px;font-size:9px}.strategy-selector>p{display:flex;align-items:center;gap:7px;max-width:460px;margin:0;color:#75899c;font-size:10px;line-height:1.5}
.strategy-section{padding:var(--section-pad)}.strategy-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.strategy-head small{color:#60768b;font:10px 'Fira Code'}.strategy-head h2{margin:5px 0 0;font-size:16px}.strategy-head>p{margin:2px 0 0;color:#718499;font-size:10px}.strategy-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid rgba(70,216,255,.35);background:rgba(70,216,255,.07);color:#8bdff5;font-size:10px;white-space:nowrap}.strategy-badge.warn{border-color:rgba(255,181,71,.4);background:rgba(255,181,71,.08);color:var(--amber)}.strategy-badge.danger{border-color:rgba(255,93,108,.4);background:rgba(255,93,108,.08);color:#ff929c}
.process-flow{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr) 24px minmax(0,1fr) 24px minmax(0,1fr);align-items:stretch}.process-flow article{min-width:0;padding:13px;border:1px solid rgba(70,216,255,.26);background:#101b27}.process-flow article.warn{border-color:rgba(255,181,71,.4)}.process-flow article.danger{border-color:rgba(255,93,108,.42)}.process-flow article>span{color:#52758a;font:9px 'Fira Code'}.process-flow h3{margin:6px 0;color:#dceaf4;font-size:12px}.process-flow article.warn h3{color:var(--amber)}.process-flow article.danger h3{color:#ff7f8a}.process-flow p{margin:0;color:#8093a6;font-size:10px;line-height:1.6}.process-arrow{align-self:center;justify-self:center;width:15px;color:#477087}.block-flow{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1fr)}
.logic-notes{margin-top:14px;padding-top:12px;border-top:1px solid #253548}.logic-notes p{margin:4px 0;color:#8fa2b3;font-size:11px;line-height:1.7}.logic-notes b{color:#bfefff}.comparison-block{margin-top:14px;padding:13px;border:1px solid rgba(70,216,255,.25);background:rgba(70,216,255,.025)}.comparison-block h3{margin:0 0 10px;color:#9be8fa;font-size:12px}.comparison-table{min-width:780px}.comparison-table td{white-space:normal;line-height:1.55}
.strategy-table{min-width:1080px}.strategy-table td,.strategy-table th{padding-inline:13px}.bounded-table{max-height:430px}.float-table{min-width:1320px}.tag-no{color:var(--cyan);font-family:'Fira Code'}.mono{font-family:'Fira Code'}.muted{color:#718499}.strategy-table td small{display:inline;margin-left:4px}.watching{padding:3px 5px;border:1px solid rgba(240,153,123,.4);color:#f0997b}.danger-text{color:var(--red)!important}.warn-text{color:var(--amber)!important}
.parameter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.parameter-field,.baseline-fields>label,.baseline-fields>article{display:flex;min-width:0;min-height:126px;flex-direction:column;padding:13px;border:1px solid #283a4d;background:#101923}.parameter-field>span,.baseline-fields span{color:#c3d2de;font-size:11px}.parameter-field>div,.baseline-fields label>div{display:flex;align-items:center;gap:8px;margin:10px 0}.parameter-field input,.baseline-fields input{width:100%;min-width:0;height:38px;border:1px solid #345066;background:#0c1721;padding:0 10px;outline:0;color:#e7f6ff;font:12px 'Fira Code'}.parameter-field input:focus,.baseline-fields input:focus{border-color:var(--cyan)}.parameter-field b,.baseline-fields label b{color:#7d91a4;font:10px 'Fira Code';white-space:nowrap}.parameter-field small,.baseline-fields small{color:#718499;font-size:10px;line-height:1.5}.parameter-note{margin:12px 0 0;padding:10px 12px;border-left:2px solid var(--cyan);background:rgba(70,216,255,.04);color:#8da1b3;font-size:11px;line-height:1.6}.strategy-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid #253548}
.baseline-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.baseline-fields>article strong{margin:12px 0 8px;color:#dceaf4;font-size:12px;line-height:1.5}.baseline-warning{display:flex;gap:12px;margin-top:12px;padding:13px;border:1px solid rgba(255,181,71,.38);background:rgba(255,181,71,.045)}.baseline-warning>svg{flex:0 0 19px;color:var(--amber)}.baseline-warning h3{margin:0;color:var(--amber);font-size:12px}.baseline-warning p{margin:6px 0 0;color:#8fa2b3;font-size:11px;line-height:1.7}.todo-state{display:inline-flex;padding:4px 7px;border:1px solid rgba(255,181,71,.38);background:rgba(255,181,71,.08);color:var(--amber);font-size:10px}.todo-state.danger{border-color:rgba(255,93,108,.38);background:rgba(255,93,108,.08);color:#ff8c97}.advice{max-width:360px;white-space:normal;line-height:1.55}.empty-row{text-align:center;color:#718499}.baseline-summary{display:flex;align-items:center;gap:5px;padding-top:14px;color:#8295a7;font-size:11px}.baseline-summary svg{width:15px;color:var(--green)}.baseline-summary b{color:#d7e6ef;font-family:'Fira Code'}
@media (max-width:1280px){.strategy-kpis{grid-template-columns:repeat(3,1fr)}.parameter-grid{grid-template-columns:repeat(2,1fr)}.baseline-fields{grid-template-columns:repeat(2,1fr)}}
@media (max-width:900px){.strategy-selector{align-items:flex-start;flex-direction:column}.strategy-selector>p{max-width:none}.process-flow,.block-flow{grid-template-columns:1fr}.process-arrow{transform:rotate(90deg);margin:4px 0}.strategy-head{flex-wrap:wrap}}
@media (max-width:760px){.strategy-page{--section-pad:14px}.strategy-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.strategy-kpis article{padding:12px}.strategy-kpis strong{font-size:21px}.strategy-tabs{display:grid;width:100%;grid-template-columns:1fr}.strategy-tabs button{width:100%}.parameter-grid,.baseline-fields{grid-template-columns:1fr}.parameter-field,.baseline-fields>label,.baseline-fields>article{min-height:0}.strategy-actions .btn{min-height:44px;flex:1}.baseline-summary{align-items:flex-start;flex-wrap:wrap;line-height:1.6}}

/* Readability pass for the dense strategy workspace. */
.strategy-kpis article{padding:17px 18px}
.strategy-kpis strong{font-size:26px}
.strategy-kpis em{font-size:12px}
.strategy-kpis span{font-size:14px}
.strategy-kpis small{color:#9cafbf;font-size:12px;line-height:1.5}
.strategy-tabs b{font-size:14px}
.strategy-tabs span{font-size:12px}
.strategy-selector>p{color:#9cafbf;font-size:12px}
.strategy-head small{color:#8fa6b8;font-size:11px}
.strategy-head h2{font-size:20px}
.strategy-head>p{color:#9cafbf;font-size:12px}
.strategy-badge{font-size:12px}
.process-flow article>span{font-size:11px}
.process-flow h3{font-size:15px}
.process-flow p{color:#a9b9c7;font-size:13px;line-height:1.6}
.logic-notes p{color:#a9b9c7;font-size:13px;line-height:1.7}
.comparison-block h3{font-size:14px}
.parameter-field>span,.baseline-fields span{font-size:13px}
.parameter-field input,.baseline-fields input{font-size:14px}
.parameter-field b,.baseline-fields label b{font-size:12px}
.parameter-field small,.baseline-fields small{color:#9cafbf;font-size:12px;line-height:1.55}
.parameter-note{color:#a9b9c7;font-size:13px;line-height:1.65}
.baseline-fields>article strong{font-size:14px}
.baseline-warning h3{font-size:14px}
.baseline-warning p{color:#a9b9c7;font-size:13px;line-height:1.7}
.todo-state{font-size:12px}
.baseline-summary{font-size:13px}
@media (max-width:760px){
  .strategy-kpis article{padding:14px}
  .strategy-kpis strong{font-size:23px}
  .strategy-head h2{font-size:18px}
}
</style>
