<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CheckCircle2, ClipboardCheck, Download, Gauge, History, Radio } from 'lucide-vue-next'
import BaseChart from '../components/BaseChart.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { decisionText, getEngine, makeHistory, statusMeta } from '../mock'
import { useSystemStore } from '../stores/system'
import { axisStyle, baseGrid, temperatureSeriesMeta, tooltip } from '../utils/chart'

const route = useRoute(), router = useRouter(), store = useSystemStore()
const engine = getEngine()
const device = computed(() => store.devices.find(d => d.id === route.params.id) || store.devices[0])
const reviewOpen = ref(false), reviewStatus = ref(device.value.status), reviewNote = ref('现场复核结果与系统诊断一致')
const range = ref(8)
const history = computed(() => makeHistory(device.value).slice(-range.value * 4))
const diagnosis = computed(() => engine.baseline.diag(device.value))
const baseline = computed(() => engine.baseline.info(device.value))
const floatEvaluation = computed(() => device.value.type === '浮球式' ? engine.floatEval(device.value) : null)
const option = computed(() => ({
  color: [temperatureSeriesMeta.ts.color, temperatureSeriesMeta.tc.color, temperatureSeriesMeta.dt.color], tooltip: tooltip(), grid: { ...baseGrid, top: 58, right: 34, bottom: 42, containLabel: true },
  legend: { type: 'scroll', top: 8, left: 14, right: 14, itemWidth: 24, itemHeight: 8, textStyle: { color: '#a4b7c8', fontSize: 11 }, pageTextStyle: { color: '#91a8bb' }, pageIconColor: '#46d8ff', pageIconInactiveColor: '#40566a', data: [temperatureSeriesMeta.ts.name, temperatureSeriesMeta.tc.name, temperatureSeriesMeta.dt.name] },
  xAxis: { type: 'category', data: history.value.map((_,i) => `${String(Math.floor(i / 4)).padStart(2,'0')}:${String((i % 4) * 15).padStart(2,'0')}`), ...axisStyle(), boundaryGap: false },
  yAxis: { type: 'value', name: '℃', nameTextStyle: { color: '#8190a5' }, ...axisStyle() },
  series: [
    { name:temperatureSeriesMeta.ts.name, type:'line', showSymbol:false, symbol:'circle', smooth:.25, itemStyle:{color:temperatureSeriesMeta.ts.color}, lineStyle:{ color:temperatureSeriesMeta.ts.color, width:2.5, shadowBlur:9, shadowColor:'rgba(255,181,71,.4)' }, areaStyle:{ color:{ type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(255,181,71,.16)'},{offset:1,color:'rgba(255,181,71,0)'}] } }, data:history.value.map(x=>x.ts), markArea:{ silent:true, itemStyle:{ color:'rgba(255,93,108,.065)' }, data:[[ { yAxis:150 }, { yAxis:180 } ]] } },
    { name:temperatureSeriesMeta.tc.name, type:'line', showSymbol:false, symbol:'circle', smooth:.25, itemStyle:{color:temperatureSeriesMeta.tc.color}, lineStyle:{ color:temperatureSeriesMeta.tc.color, width:2.3, shadowBlur:7, shadowColor:'rgba(70,216,255,.38)' }, data:history.value.map(x=>x.tc), markLine:{silent:true,symbol:'none',lineStyle:{color:temperatureSeriesMeta.tc.color,type:'dashed',opacity:.7},data:[{yAxis:baseline.value.tcBase,label:{show:true,position:'insideEndTop',distance:8,formatter:`出口温度基准 ${baseline.value.tcBase}℃`,color:temperatureSeriesMeta.tc.color,fontSize:10}}]} },
    { name:temperatureSeriesMeta.dt.name, type:'line', showSymbol:false, symbol:'circle', smooth:.25, itemStyle:{color:temperatureSeriesMeta.dt.color}, lineStyle:{ color:temperatureSeriesMeta.dt.color, width:2, type:'dashed' }, data:history.value.map(x=>x.delta), markLine:{ silent:true, symbol:'none', data:[{ yAxis:baseline.value.dtBase, lineStyle:{color:temperatureSeriesMeta.dt.color,type:'dashed'},label:{show:true,position:'insideEndTop',distance:8,formatter:`温差基准 ${baseline.value.dtBase}℃`,color:temperatureSeriesMeta.dt.color,fontSize:10} },{ yAxis:baseline.value.dtBase*.65, lineStyle:{color:'#ff5d6c',type:'dotted'},label:{show:true,position:'insideEndTop',distance:8,formatter:'严重泄漏线',color:'#ff5d6c',fontSize:10} }] } }
  ]
}))
function submitReview() { if(!reviewNote.value.trim()){store.notify('请填写复核理由');return}store.reviewDevice(device.value.id, reviewStatus.value, reviewNote.value.trim()); reviewOpen.value = false }
function exportData(){engine.downloadCsv(`${device.value.id}-历史数据`,history.value.map(row=>({时间:row.time,'进口温度Ts(℃)':row.ts,'出口温度Tc(℃)':row.tc,'进出口温差ΔT(℃)':row.delta,'出口温度基准(℃)':baseline.value.tcBase,'温差基准(℃)':baseline.value.dtBase})))}
</script>

<template>
  <div class="page-stack detail-page">
    <div class="detail-nav"><button class="btn ghost" @click="router.push('/monitor')"><ArrowLeft />返回设备列表</button><div class="toolbar-actions"><button class="btn secondary" @click="exportData"><Download/>导出数据</button><button class="btn primary" @click="reviewOpen = true"><ClipboardCheck />人工复核改判</button></div></div>
    <section class="device-hero panel">
      <div><span class="eyebrow">{{ device.area }} / {{ device.line }}</span><h2>{{ device.name }} <small>{{ device.id }}</small></h2><p>{{ device.type }} · 传感器 {{ device.sensor }}</p></div><StatusBadge :status="device.status" />
      <div class="device-live-metrics"><div><Radio /><span>蒸汽侧 Ts</span><strong>{{ device.ts?.toFixed(1) }}<em>℃</em></strong></div><div><Gauge /><span>冷凝侧 Tc</span><strong>{{ device.tc?.toFixed(1) ?? '--' }}<em>℃</em></strong></div><div><History /><span>温差 ΔT</span><strong>{{ device.delta?.toFixed(1) ?? '--' }}<em>℃</em></strong></div><div><CheckCircle2 /><span>诊断置信度</span><strong>{{ device.confidence }}<em>%</em></strong></div></div>
    </section>
    <section class="detail-grid">
      <article class="panel chart-panel"><div class="panel-head"><div><small>TEMPERATURE PROFILE / BASELINE</small><h2>温度与温差趋势</h2></div><div class="segmented"><button v-for="hours in [2,8,24]" :key="hours" :class="{active:range===hours}" @click="range=hours">{{hours}} 小时</button></div></div><BaseChart :option="option" height="390px" aria-label="进口温度、出口温度与进出口温差趋势图" /><p class="chart-caption">虚线显示出口温度与进出口温差的人工学习基准，红色点线为温差基准的 65% 严重泄漏线。</p></article>
      <aside class="detail-side">
        <article class="panel verdict"><small>RELATIVE BASELINE DIAGNOSIS</small><h2>相对基准诊断结论</h2><div class="verdict-status"><span class="diagnosis-grade">{{diagnosis.label}}</span><b>{{ device.confidence }}%</b></div><p>{{ diagnosis.reason || decisionText[device.status] }}</p><ul><li><span>窗口口径</span><b>{{diagnosis.win?.spanMin}} 分钟稳定窗口</b></li><li><span>ΔT 均值 / 基准</span><b>{{diagnosis.win?.dtMean}} / {{baseline.dtBase}}℃</b></li><li><span>Tc 均值 / 基准</span><b>{{diagnosis.win?.tcMean}} / {{baseline.tcBase}}℃</b></li><li><span>相对偏离</span><b>{{diagnosis.dtPct>=0?'+':''}}{{diagnosis.dtPct}}%</b></li></ul><RouterLink class="btn secondary full" :to="{ path: '/ledger', query: { device: device.id, tab: 'baseline' } }">基线标注与学习</RouterLink></article>
        <article v-if="floatEvaluation" class="panel verdict"><small>FLOAT TRAP EVALUATION</small><h2>浮球式泄漏评估序列</h2><div class="verdict-status"><span class="diagnosis-grade">{{floatEvaluation.verdict}}</span><b>{{Math.round(floatEvaluation.last.ratio*100)}}%</b></div><p>每 {{floatEvaluation.periodMin}} 分钟评估一次，取最近 {{floatEvaluation.dataMin}} 分钟 ΔT 均值。初期泄漏需连续 {{floatEvaluation.needMild}} 次，严重泄漏需连续 {{floatEvaluation.needSevere}} 次。</p><ul><li><span>初期泄漏连续次数</span><b>{{floatEvaluation.consecMild}} / {{floatEvaluation.needMild}}</b></li><li><span>严重泄漏连续次数</span><b>{{floatEvaluation.consecSevere}} / {{floatEvaluation.needSevere}}</b></li></ul></article>
        <article class="panel timeline"><small>STATE TIMELINE</small><h2>状态时间线</h2><div><i></i><b>当前 · {{ statusMeta[device.status].label }}</b><p>算法完成新一轮诊断</p></div><div><i></i><b>今天 06:20 · 正常</b><p>温差波形处于正常区间</p></div><div><i></i><b>09 月 16 日 · 人工巡检</b><p>外观与接线检查完成</p></div></article>
      </aside>
    </section>
    <div v-if="reviewOpen" class="modal-backdrop" @click.self="reviewOpen = false"><form class="modal panel" @submit.prevent="submitReview"><div class="modal-head"><div><small>MANUAL REVIEW</small><h2>人工复核改判</h2></div><button type="button" class="icon-btn" aria-label="关闭" @click="reviewOpen = false">×</button></div><label>复核结论<select v-model="reviewStatus"><option v-for="(m,k) in statusMeta" :key="k" :value="k">{{ m.label }}</option></select></label><label>复核说明<textarea v-model="reviewNote" rows="4"></textarea></label><div class="modal-actions"><button type="button" class="btn secondary" @click="reviewOpen = false">取消</button><button class="btn primary">确认提交</button></div></form></div>
  </div>
</template>
