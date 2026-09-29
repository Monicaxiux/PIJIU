<script setup>
import { computed, ref } from 'vue'
import { ChartNoAxesCombined } from 'lucide-vue-next'
import BaseChart from '../components/BaseChart.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getEngine } from '../mock'
import { useSystemStore } from '../stores/system'
import { axisStyle, chartColors, tooltip } from '../utils/chart'
const store=useSystemStore(), engine=getEngine()
const initialSelection = store.devices.filter(device => ['normal', 'leak', 'block'].includes(device.status)).slice(0, 3)
const selected=ref(initialSelection.map(device => device.id)), range=ref(8)
function toggleDevice(id, checked){
  if(checked&&!selected.value.includes(id)&&selected.value.length<8) selected.value.push(id)
  if(!checked) selected.value=selected.value.filter(deviceId=>deviceId!==id)
}

const option=computed(()=>{
  const pointCount=range.value===2 ? 24 : range.value===8 ? 96 : 288
  const firstSeries = selected.value.map(id => engine.seriesMap[id]).find(Boolean)
  const times = firstSeries ? firstSeries.times.slice(-pointCount) : []
  return {
    color:chartColors,
    tooltip:tooltip(),
    grid:{left:54,right:28,top:58,bottom:42},
    legend:{type:'scroll',top:8,left:18,right:18,itemWidth:22,itemHeight:7,textStyle:{color:'#a4b7c8',fontFamily:'Fira Sans',fontSize:10},pageTextStyle:{color:'#91a8bb'},pageIconColor:'#46d8ff',pageIconInactiveColor:'#40566a'},
    xAxis:{type:'category',data:times,...axisStyle(),boundaryGap:false,axisLabel:{...axisStyle().axisLabel,formatter:value=>String(value).slice(-5)}},
    yAxis:{type:'value',scale:true,name:'温差 ℃',nameTextStyle:{color:'#8190a5'},...axisStyle()},
    series:selected.value.map((id,index)=>{
      const d=store.devices.find(x=>x.id===id)
      const raw=engine.seriesMap[id]
      const base=engine.baseline.info(d).dtBase
      const color=chartColors[index % chartColors.length]
      return {
        name:`${d.id} · ${d.name}`,
        type:'line',showSymbol:false,smooth:.25,
        lineStyle:{width:2.2,shadowBlur:6,shadowColor:color},
        itemStyle:{color},
        emphasis:{focus:'series',lineStyle:{width:3.4}},
        data:raw ? raw.dt.slice(-pointCount) : [],
        markLine:{silent:true,symbol:'none',data:[{yAxis:base,lineStyle:{color,type:'dashed',width:1,opacity:.72},label:{show:true,position:'insideEndTop',formatter:`${d.id.slice(-3)} 基准 ${base}℃`,color,fontSize:9}}]}
      }
    })
  }
})

const selectedDevices = computed(() => selected.value.map(id => store.devices.find(device => device.id === id)).filter(Boolean))
</script>
<template>
  <div class="trend-workspace">
    <aside class="panel trend-device-panel">
      <div class="trend-selector-head">
        <div><small>DEVICE SELECTOR</small><h2>选择对比设备</h2></div>
        <b>{{ selected.length }} / 8</b>
      </div>
      <div class="trend-device-list">
        <label v-for="device in store.devices" :key="device.id" class="trend-device-row" :class="{ selected: selected.includes(device.id), disabled: selected.length >= 8 && !selected.includes(device.id) }">
          <input type="checkbox" :checked="selected.includes(device.id)" :disabled="selected.length >= 8 && !selected.includes(device.id)" @change="toggleDevice(device.id, $event.target.checked)" />
          <span class="trend-check" aria-hidden="true"></span>
          <span class="trend-device-name"><b>{{ device.id }}</b><small>{{ device.area }}</small></span>
          <span class="trend-device-deviation" :class="{ warn: Math.abs(engine.baseline.diag(device).dtPct) > 25 }">{{ engine.baseline.diag(device).dtPct >= 0 ? '+' : '' }}{{ engine.baseline.diag(device).dtPct }}%</span>
          <StatusBadge :status="device.status" />
        </label>
      </div>
      <div class="trend-selector-foot"><span>共 {{ store.devices.length }} 台设备</span><b v-if="selected.length >= 8">已达选择上限</b></div>
    </aside>

    <section class="panel chart-panel trend-chart-panel">
      <div class="panel-head">
        <div><small>MULTI-DEVICE DELTA T</small><h2>温差趋势叠加对比</h2></div>
        <div class="segmented" aria-label="趋势时间范围">
          <button v-for="hours in [2,8,24]" :key="hours" :class="{ active: range === hours }" :aria-pressed="range === hours" @click="range=hours">{{ hours }} 小时</button>
        </div>
      </div>
      <div class="trend-chart-wrap">
        <BaseChart :option="option" height="520px" :aria-label="`已选 ${selected.length} 台设备的 ${range} 小时温差趋势对比图`" />
        <div v-if="!selected.length" class="trend-empty">
          <ChartNoAxesCombined :size="34" aria-hidden="true" />
          <strong>请选择对比设备</strong>
          <span>勾选左侧设备后，曲线将显示在此处</span>
        </div>
      </div>
      <p class="trend-chart-note">虚线为各设备人工学习得到的温差基准，左侧显示当前窗口相对基准偏离百分比。相同工况下长期偏离可能表示排放效率下降或传感器偏移。</p>
    </section>
  </div>
</template>
