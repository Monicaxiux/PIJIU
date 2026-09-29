<script setup>
import { computed } from 'vue'
import { ArrowUpRight, Gauge, Radio, Waves, OctagonAlert, PauseCircle, ShieldCheck, TimerReset } from 'lucide-vue-next'
import BaseChart from '../components/BaseChart.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useSystemStore } from '../stores/system'
import { axisStyle, baseGrid, chartColors, tooltip } from '../utils/chart'
import { getEngine, statusMeta } from '../mock'

const store = useSystemStore()
const engine = getEngine()
const statusItems = computed(() => Object.entries(store.counts).map(([key, value]) => ({
  key,
  label: statusMeta[key].label,
  color: statusMeta[key].color,
  value,
  percent: store.devices.length ? value / store.devices.length * 100 : 0
})))
const normalRate = computed(() => store.devices.length ? store.counts.normal / store.devices.length * 100 : 0)
const onlineCount = computed(() => store.devices.filter(device => device.online).length)
const todayAlarmCount = computed(() => store.alarms.filter(alarm => Date.now() - alarm.time < 24 * 60 * 60 * 1000).length)
const statusOption = computed(() => ({
  color: chartColors,
  title: {
    text: String(store.devices.length), subtext: '设备总数', left: 'center', top: '37%', itemGap: 2,
    textStyle: { color: '#f2f8fc', fontFamily: 'Fira Code', fontSize: 25, fontWeight: 600 },
    subtextStyle: { color: '#7890a5', fontFamily: 'Fira Sans', fontSize: 10, lineHeight: 18 }
  },
  tooltip: {
    trigger: 'item', backgroundColor: '#0b1621', borderColor: '#3a5b73', borderWidth: 1, padding: [9, 12],
    extraCssText: 'box-shadow: 0 12px 28px rgba(0,0,0,.42);',
    textStyle: { color: '#eaf2fb', fontFamily: 'Fira Sans', fontSize: 12 },
    formatter: params => `${params.marker}${params.name}<br/><strong style="font:600 16px Fira Code">${params.value}</strong> 台&nbsp;&nbsp;<span style="color:#8fa4b6">${params.percent.toFixed(1)}%</span>`
  },
  series: [
    {
      type: 'pie', radius: ['62%', '79%'], center: ['50%', '50%'], silent: true, z: 0,
      label: { show: false }, data: [{ value: 1, itemStyle: { color: 'rgba(85,112,133,.15)' } }]
    },
    {
      name: '设备状态', type: 'pie', radius: ['62%', '79%'], center: ['50%', '50%'], startAngle: 90,
      clockwise: true, minAngle: 3, padAngle: 3, avoidLabelOverlap: true, z: 2,
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4, itemStyle: { shadowBlur: 16, shadowColor: 'rgba(70,216,255,.28)' } },
      itemStyle: { borderColor: '#101a25', borderWidth: 1, borderRadius: 3 },
      data: statusItems.value.map(item => ({ name: item.label, value: item.value, itemStyle: { color: item.color } }))
    }
  ]
}))
const trendOption = computed(() => ({
  color: ['#ff5d6c', '#ffb547'], tooltip: { ...tooltip(), axisPointer: { type: 'line', lineStyle: { color: '#4f6d84', type: 'dashed' } } }, grid: { ...baseGrid, top: 48, bottom: 34 },
  legend: { top: 4, right: 10, textStyle: { color: '#91a0b4' }, data: ['异常设备', '新增告警'] },
  xAxis: { type: 'category', data: Array.from({ length: 12 }, (_, i) => `${i * 2}:00`), ...axisStyle(), boundaryGap: false },
  yAxis: { type: 'value', ...axisStyle() },
  series: [{ name: '异常设备', type: 'line', smooth: .35, showSymbol: false, lineStyle: { width: 3, shadowBlur: 8, shadowColor: 'rgba(255,93,108,.5)' }, data: [7, 6, 8, 7, 9, 8, 10, 9, 11, 10, 12, 9], areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,93,108,.3)' }, { offset: 1, color: 'rgba(255,93,108,0)' }] } } }, { name: '新增告警', type: 'line', smooth: .35, showSymbol: false, lineStyle: { width: 2, shadowBlur: 7, shadowColor: 'rgba(255,181,71,.45)' }, data: [2, 1, 3, 2, 4, 2, 5, 3, 4, 3, 5, 2], areaStyle: { color: 'rgba(255,181,71,.08)' } }]
}))
const topDevices = computed(() => [...store.devices].sort((a, b) => a.confidence - b.confidence).slice(0, 8))
const baselineSummary = computed(() => {
  const summary = engine.baseline.summary()
  return { ...summary, gradeList: summary.gradeList || [], health: summary.total ? Math.round(summary.ok / summary.total * 100) : 0 }
})
const baselineRiseTop = computed(() => [...store.devices].map(device => ({ device, info: engine.baseline.info(device) })).filter(item => item.info.cumRise > 0).sort((a, b) => b.info.cumRise - a.info.cumRise).slice(0, 5))
</script>

<template>
  <div class="dashboard page-stack">
    <section class="kpi-grid">
      <article class="kpi"><div class="kpi-icon cyan"><Radio /></div><div><small>设备总数</small><strong>{{ store.devices.length }}<em>台</em></strong><span>全部纳入在线监测</span></div></article>
      <article class="kpi"><div class="kpi-icon cyan"><Radio /></div><div><small>在线率</small><strong>{{ store.devices.length ? (onlineCount / store.devices.length * 100).toFixed(1) : '0.0' }}<em>%</em></strong><span class="good"><ArrowUpRight /> {{ onlineCount }}/{{ store.devices.length }} 台在线</span></div></article>
      <article class="kpi"><div class="kpi-icon green"><Gauge /></div><div><small>运行正常</small><strong>{{ store.counts.normal }}<em>台</em></strong><span class="good"><ArrowUpRight /> 较昨日 +2</span></div></article>
      <article class="kpi"><div class="kpi-icon red"><OctagonAlert /></div><div><small>泄漏设备</small><strong>{{ store.counts.leak }}<em>台</em></strong><span class="bad">重点复核</span></div></article>
      <article class="kpi"><div class="kpi-icon amber"><Waves /></div><div><small>阻塞设备</small><strong>{{ store.counts.block }}<em>台</em></strong><span class="bad">需要诊断</span></div></article>
      <article class="kpi"><div class="kpi-icon"><PauseCircle /></div><div><small>停产设备</small><strong>{{ store.counts.stop }}<em>台</em></strong><span>暂停参与诊断</span></div></article>
      <article class="kpi"><div class="kpi-icon red"><TimerReset /></div><div><small>今日新增告警</small><strong>{{ todayAlarmCount }}<em>条</em></strong><span class="bad">待处理告警</span></div></article>
      <article class="kpi"><div class="kpi-icon amber"><ShieldCheck /></div><div><small>基线待确认</small><strong>{{ baselineSummary.pending }}<em>台</em></strong><span :class="baselineSummary.warn ? 'bad' : 'good'">{{ baselineSummary.warn ? `趋势预警 ${baselineSummary.warn} 台` : '无趋势预警' }}</span></div></article>
    </section>

    <section class="dashboard-main">
      <article class="panel network-panel">
        <div class="panel-head"><div><small>PLANT OVERVIEW</small><h2>厂区蒸汽管网</h2></div><span class="live-dot"><i></i>实时状态</span></div>
        <div class="network-map">
          <div class="pipe pipe-main"></div><div class="pipe pipe-a"></div><div class="pipe pipe-b"></div><div class="pipe pipe-c"></div>
          <div class="plant-node source"><Waves /><strong>锅炉房</strong><span>0.86 MPa</span></div>
          <div v-for="(area, ai) in ['动力区域','酿造区域','包装区域']" :key="area" class="area-cluster" :class="`area-${ai}`">
            <div class="area-label"><strong>{{ area }}</strong><span>{{ store.devices.filter(d => d.area === area && d.status === 'normal').length }}/15 正常</span></div>
            <div class="nodes"><RouterLink v-for="d in store.devices.filter(x => x.area === area)" :key="d.id" :to="`/monitor/${d.id}`" :class="d.status" :title="`${d.id} · ${d.name} · ${statusMeta[d.status].label}`" :aria-label="`${d.id} ${d.name}，状态：${statusMeta[d.status].label}`"><i class="node-dot" aria-hidden="true"></i><span>{{ d.id }}</span><small>{{ statusMeta[d.status].label }}</small></RouterLink></div>
          </div>
          <div class="map-legend"><span v-for="(m,k) in statusMeta" :key="k"><i :style="{ background: m.color }"></i>{{ m.label }}</span></div>
        </div>
      </article>
      <article class="panel alarm-feed">
        <div class="panel-head"><div><small>ALARM STREAM</small><h2>实时告警</h2></div><RouterLink to="/alarm/realtime">查看全部</RouterLink></div>
        <div class="alarm-list">
          <div v-for="a in store.alarms.slice(0, 5)" :key="a.id" class="alarm-row" :class="a.level">
            <span class="alarm-level" :class="a.level">{{ a.level === 'critical' ? '紧急' : a.level === 'major' ? '重要' : '一般' }}</span>
            <div class="alarm-copy"><div class="alarm-row-head"><strong>{{ a.deviceName }}</strong><time :datetime="new Date(a.time).toISOString()">{{ new Date(a.time).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' }) }}</time></div><p>{{ a.message }}</p><small>{{ a.area }}</small></div>
          </div>
        </div>
      </article>
    </section>

    <section class="dashboard-lower">
      <article class="panel status-panel">
        <div class="panel-head"><div><small>STATUS DISTRIBUTION</small><h2>设备状态分布</h2></div><span class="status-rate"><i></i>正常率 {{ normalRate.toFixed(1) }}%</span></div>
        <div class="status-distribution">
          <div class="status-donut"><BaseChart :option="statusOption" height="100%" aria-label="设备状态分布环形图，下方列表提供精确数据" /></div>
          <dl class="status-breakdown" aria-label="设备状态精确数据">
            <div v-for="item in statusItems" :key="item.key">
              <dt><i :style="{ background: item.color }"></i><span>{{ item.label }}</span></dt>
              <dd><strong>{{ item.value }}</strong><small>{{ item.percent.toFixed(1) }}%</small></dd>
            </div>
          </dl>
        </div>
      </article>
      <article class="panel trend-wide"><div class="panel-head"><div><small>24H TREND</small><h2>异常与告警趋势</h2></div></div><BaseChart :option="trendOption" height="250px" aria-label="异常设备与新增告警数量趋势图" /></article>
      <article class="panel health-ranking"><div class="panel-head"><div><small>HEALTH RANKING</small><h2>设备健康度 TOP 8</h2></div></div>
        <div v-for="(d, i) in topDevices" :key="d.id" class="rank-row"><b>{{ String(i + 1).padStart(2,'0') }}</b><div><span>{{ d.id }} · {{ d.name }}</span><i><em :style="{ width: `${d.confidence}%` }"></em></i></div><strong>{{ d.confidence }}</strong></div>
      </article>
    </section>

    <section class="baseline-dashboard-grid">
      <article class="panel baseline-dashboard-panel">
        <div class="panel-head"><div><small>BASELINE HEALTH</small><h2>基线健康度 · 人工标注学习</h2></div><RouterLink to="/diag/strategy">进入基线策略</RouterLink></div>
        <div class="baseline-health-grid">
          <div><strong class="good">{{ baselineSummary.ok }}</strong><span>已生效</span></div>
          <div><strong class="amber-text">{{ baselineSummary.pending }}</strong><span>待人工确认</span></div>
          <div><strong class="bad-text">{{ baselineSummary.warn }}</strong><span>趋势预警</span></div>
          <div><strong class="purple-text">{{ baselineSummary.templ }}</strong><span>模板冷启动</span></div>
        </div>
        <div v-if="baselineRiseTop.length" class="baseline-rise-list">
          <RouterLink v-for="entry in baselineRiseTop" :key="entry.device.id" :to="{ path: '/ledger', query: { device: entry.device.id, tab: 'baseline' } }" class="baseline-rise-row">
            <b>{{ entry.device.id }}</b><span>{{ entry.device.name }}</span><small>{{ entry.info.source }}</small><strong :class="entry.info.cumRise >= entry.info.warnRise ? 'bad-text' : 'amber-text'">+{{ entry.info.cumRise }}℃</strong>
          </RouterLink>
        </div>
        <div v-else class="empty-state baseline-empty">全厂基线稳定，无待办事项</div>
      </article>

      <article class="panel baseline-dashboard-panel">
        <div class="panel-head"><div><small>RELATIVE DIAGNOSIS</small><h2>相对基准诊断档位分布</h2></div><span class="panel-note">30min 稳定窗口均值</span></div>
        <div class="grade-list">
          <div v-for="grade in baselineSummary.gradeList" :key="grade.key" class="grade-row">
            <span class="diagnosis-grade" :class="grade.cls.replace('st-', '')">{{ grade.label }}</span>
            <i><em :style="{ width: `${baselineSummary.total ? grade.n / baselineSummary.total * 100 : 0}%`, background: grade.color }"></em></i>
            <strong :style="{ color: grade.color }">{{ grade.n }}</strong>
          </div>
        </div>
        <p class="baseline-criteria">判据：出口均值 ≥ 基准 +10℃（连续 3 周期）→ 泄漏；≥ +25℃ 或温差 ≤ 基准 65%（连续 2 周期）→ 严重泄漏；温差 ≥ 基准 25% / 35% → 轻度 / 重度堵塞。停产与数据异常不参与诊断。</p>
      </article>
    </section>
  </div>
</template>
