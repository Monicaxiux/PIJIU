<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Activity, CalendarDays, Download, FileUp, Image, Plus, QrCode, Radio, RotateCcw, Search, Wrench, X } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import BaselineLearningView from './BaselineLearningView.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getEngine, statusMeta } from '../mock'
import { useSystemStore } from '../stores/system'
import { getSteamTrapConfigPage } from '../api/steamTrap'

const store = useSystemStore(), engine = getEngine(), route = useRoute(), router = useRouter()
const saved = (() => { try { return JSON.parse(sessionStorage.getItem('trapvision.ledger.filters') || '{}') } catch { return {} } })()
const regionLevel = ref(saved.regionLevel || ''), trapNo = ref(saved.trapNo || ''), supplier = ref(saved.supplier || ''), useDevice = ref(saved.useDevice || '')
const detail = ref(null), tab = ref('base'), current = ref(1), size = ref(Number(saved.size) || 10), total = ref(0), baselineMode = ref(saved.baselineMode || ''), deviceType = ref(saved.deviceType || '')
const ledgerDevices = ref([...store.devices]), loading = ref(false), loadError = ref('')
const regionOptions = computed(() => [...new Set(store.devices.map(device => device.workshopName).filter(Boolean))])
const typeStats = computed(() => { const counts = { 浮球式: 0, 倒立桶: 0, 热力型: 0 }; store.devices.forEach(d => { counts[d.type] = (counts[d.type] || 0) + 1 }); return counts })
const sensorRate = computed(() => store.devices.length ? Math.round(store.devices.filter(d => d.sensorSteam && d.sensorCond).length / store.devices.length * 100) : 0)
const gatewayCount = computed(() => new Set(store.devices.map(d => d.gatewayId).filter(Boolean)).size)
const list = computed(() => ledgerDevices.value.filter(d => (!deviceType.value || d.type === deviceType.value) && (!baselineMode.value || baselineOf(d)?.mode === baselineMode.value)))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
const baseline = computed(() => detail.value ? engine.baselineMap[detail.value.id] : null)
const lifecycle = computed(() => detail.value ? (engine.lifecycle?.[detail.value.id] || []) : [])
watch([regionLevel, trapNo, supplier, useDevice, size, baselineMode, deviceType], () => { try { sessionStorage.setItem('trapvision.ledger.filters', JSON.stringify({ regionLevel: regionLevel.value, trapNo: trapNo.value, supplier: supplier.value, useDevice: useDevice.value, size: size.value, baselineMode: baselineMode.value, deviceType: deviceType.value })) } catch {} })
async function loadLedger(pageNumber = current.value) {
  loading.value = true
  loadError.value = ''
  try {
    const page = await getSteamTrapConfigPage({
      current: pageNumber,
      size: size.value,
      regionLevel: regionLevel.value.trim(),
      trapNo: trapNo.value.trim(),
      supplier: supplier.value.trim(),
      useDevice: useDevice.value.trim()
    })
    ledgerDevices.value = page.records
    current.value = pageNumber
    total.value = page.total
  } catch (error) {
    loadError.value = error.message || '设备台账查询失败，当前展示上次数据'
  } finally {
    loading.value = false
  }
}
function searchLedger() { loadLedger(1) }
function changePage(pageNumber) { if (!loading.value && pageNumber >= 1 && pageNumber <= totalPages.value) loadLedger(pageNumber) }
function changeSize() { loadLedger(1) }
function baselineOf(device) { return engine.baselineMap[device.id] || null }
function baselineModeLabel(device) { const mode = baselineOf(device)?.mode; return mode === 'manual' ? '手动' : mode === 'auto' ? '自动' : '未配置' }
function toggleBaselineMode(device) { const baseline = baselineOf(device); if (!baseline) { store.notify('该接口设备暂未返回基线配置'); return } baseline.mode = baseline.mode === 'manual' ? 'auto' : 'manual'; baseline.nextAuto = baseline.mode === 'manual' ? '已暂停（人工维护）' : '自动排期（每 15 天）'; store.bumpData(); store.notify(`已切换为${baseline.mode === 'manual' ? '手动维护' : '自动学习'}模式`) }
function setScrollLock(locked) {
  if (locked) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : ''
    return
  }
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
}
watch(detail, value => { setScrollLock(Boolean(value)) })
function openProfile(d, selected = 'base') { detail.value = d; tab.value = selected }
function setTab(value) { tab.value = value }
function closeDetail() { detail.value = null; if (route.query.device || route.query.tab) router.replace('/ledger') }
function resetFilters() { regionLevel.value = ''; trapNo.value = ''; supplier.value = ''; useDevice.value = ''; baselineMode.value = ''; deviceType.value = ''; loadLedger(1); store.notify('台账查询条件已重置') }
function statusLabel(value) { return statusMeta[value]?.label || value || '-' }
function exportRows() { engine.downloadCsv('设备台账', list.value.map(d => { const b = baselineOf(d) || {}, r = baselineOf(d) ? engine.baseline?.diag?.(d) || {} : {}; return { 区域: d.workshopName, 位号: d.tagNo, 名称: d.name, 类型: d.type, 上游设备: d.equip, 管网位置: d.pipePos, 通径: d.caliber, 投运日期: d.installDate, 供应商: d.supplier, 型号: d.model, 基线模式: baselineModeLabel(d), '出口基准Tc(℃)': b.tcBase, '温差基准ΔT(℃)': b.dtBase, 基准来源: b.source, 基准更新时间: b.learnedAt, '累计上升(℃)': b.cumRise, 相对基准诊断: r.label, '偏离(%)': r.applicable ? r.dtPct : '不适用', 现场状态: statusLabel(d.status), 健康度: d.health } })) }
function notice(message) { store.notify(message) }
function keydown(e) { if (e.key === 'Escape' && detail.value) closeDetail() }
function openFromQuery() {
  const id = route.query.device
  if (!id) return
  const d = ledgerDevices.value.find(x => x.id === id || x.tagNo === id)
  if (d) openProfile(d, ['base', 'sensor', 'baseline', 'life'].includes(route.query.tab) ? route.query.tab : 'base')
}
onMounted(() => { openFromQuery(); loadLedger(); window.addEventListener('keydown', keydown) })
watch(() => route.fullPath, openFromQuery)
onBeforeUnmount(() => { window.removeEventListener('keydown', keydown); setScrollLock(false) })
</script>

<template>
  <div class="page-stack ledger-page">
    <section class="ledger-summary ledger-kpis" aria-label="设备台账统计">
      <div><small>设备总数</small><strong>{{ store.devices.length }}</strong></div>
      <div v-for="(n, label) in typeStats" :key="label"><small>{{ label }}</small><strong class="type-count">{{ n }}</strong></div>
      <div><small>传感器绑定率（双通道）</small><strong class="bound-count">{{ sensorRate }}<em>%</em></strong></div>
      <div><small>网关接入数</small><strong class="gateway-count">{{ gatewayCount }}</strong></div>
    </section>
    <section class="panel table-panel">
      <form class="table-toolbar ledger-toolbar" @submit.prevent="searchLedger">
        <div class="filters ledger-filters">
          <select v-model="regionLevel" aria-label="区域"><option value="">全部区域</option><option v-for="region in regionOptions" :key="region" :value="region">{{ region }}</option></select>
          <label class="search-box ledger-filter-input"><input v-model="trapNo" placeholder="位号" aria-label="位号" /></label>
          <label class="search-box ledger-filter-input"><input v-model="supplier" placeholder="供应商" aria-label="供应商" /></label>
          <label class="search-box ledger-filter-input"><input v-model="useDevice" placeholder="上游设备" aria-label="上游设备" /></label>
          <select v-model="baselineMode" aria-label="基线模式"><option value="">基线全部模式</option><option value="auto">自动学习</option><option value="manual">手动维护</option></select>
          <select v-model="deviceType" aria-label="设备类型"><option value="">全部类型</option><option>浮球式</option><option>倒立桶</option><option>热力型</option></select>
          <button class="btn primary" type="submit" :disabled="loading"><Search/>查询</button>
          <button v-if="regionLevel || trapNo || supplier || useDevice || baselineMode || deviceType" class="btn ghost" type="button" :disabled="loading" @click="resetFilters"><RotateCcw/>重置</button>
        </div>
        <div class="toolbar-actions"><button class="btn ghost" type="button" @click="notice('批量导入为原型占位功能（Excel 模板导入）')"><FileUp/>批量导入</button><button class="btn secondary" type="button" @click="exportRows"><Download/>导出台账</button><button class="btn primary" type="button" @click="notice('新增设备为原型占位功能')"><Plus/>新增设备</button></div>
      </form>
      <div v-if="loading" class="ledger-request-state">正在查询设备台账…</div>
      <div v-else-if="loadError" class="ledger-request-state is-error">{{ loadError }}</div>
      <div class="table-scroll ledger-table-scroll">
        <table class="ledger-table"><thead><tr><th>区域</th><th>位号</th><th>名称</th><th>型号</th><th>类型</th><th>口径</th><th>安装位置</th><th>上游用汽设备</th><th>投运日期</th><th>供应商</th><th>运行状态</th><th>基线模式</th><th>操作</th></tr></thead>
          <tbody><tr v-for="d in list" :key="d.id"><td>{{ d.workshopName }}</td><td class="mono tag-no">{{ d.tagNo }}</td><td><b>{{ d.name }}</b></td><td class="mono muted">{{ d.model }}</td><td><span class="device-type">{{ d.type }}</span></td><td class="mono">{{ d.caliber }}</td><td class="muted">{{ d.pipePos }}</td><td>{{ d.equip }}</td><td class="mono muted">{{ d.installDate }}</td><td>{{ d.supplier }}</td><td><StatusBadge :status="d.status"/></td><td><button class="baseline-mode-toggle" :class="baselineOf(d)?.mode || 'empty'" @click="toggleBaselineMode(d)">{{ baselineModeLabel(d) }}</button></td><td><div class="row-actions"><button class="btn tiny" @click="openProfile(d,'baseline')">基线标注</button><button class="btn tiny" @click="openProfile(d)">档案</button></div></td></tr></tbody>
        </table>
        <div v-if="!list.length && !loading" class="empty-state ledger-empty"><span>暂无设备数据</span><button class="btn ghost" @click="resetFilters">重置查询</button></div>
      </div>
      <footer class="ledger-pagination">
        <span>共 {{ total }} 条</span>
        <label>每页 <select v-model.number="size" :disabled="loading" aria-label="每页条数" @change="changeSize"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select> 条</label>
        <button class="btn ghost" :disabled="loading || current <= 1" @click="changePage(current - 1)">上一页</button>
        <span>第 {{ current }} / {{ totalPages }} 页</span>
        <button class="btn ghost" :disabled="loading || current >= totalPages" @click="changePage(current + 1)">下一页</button>
      </footer>
    </section>

    <div v-if="detail" class="modal-backdrop ledger-modal-backdrop" @click.self="closeDetail"><aside class="panel ledger-modal" role="dialog" aria-modal="true" aria-labelledby="ledger-profile-title">
      <header class="drawer-header"><div><small>ASSET PROFILE / {{ detail.tagNo }}</small><h2 id="ledger-profile-title">{{ detail.name }}</h2><span>{{ detail.workshopName }} · {{ detail.pipePos }}</span></div><div class="drawer-head-actions"><button class="btn tiny" @click="notice('二维码生成：扫码可直达该设备监测详情（原型占位）')"><QrCode/>二维码</button><button class="icon-btn" aria-label="关闭设备档案" @click="closeDetail"><X/></button></div></header>
      <div class="drawer-status"><StatusBadge :status="detail.status"/><span>健康度 <b :class="detail.health >= 85 ? 'good' : detail.health >= 60 ? 'attention' : 'danger'">{{ detail.health }} / 100</b></span></div>
      <div class="drawer-tabs" role="tablist"><button :class="{active:tab==='base'}" @click="setTab('base')">基础信息</button><button :class="{active:tab==='sensor'}" @click="setTab('sensor')">传感器绑定</button><button :class="{active:tab==='baseline'}" @click="setTab('baseline')">基线学习<i v-if="baseline?.pending" class="pending-dot"/></button><button :class="{active:tab==='life'}" @click="setTab('life')">生命周期记录</button></div>
      <div v-if="tab==='base'" class="drawer-content"><dl class="profile-grid"><div><dt>设备位号</dt><dd class="mono tag-no">{{ detail.tagNo }}</dd></div><div><dt>设备名称</dt><dd>{{ detail.name }}</dd></div><div><dt>型号</dt><dd class="mono">{{ detail.model }}</dd></div><div><dt>类型 / 口径</dt><dd>{{ detail.type }} · {{ detail.caliber }}</dd></div><div><dt>连接方式</dt><dd>{{ detail.connect }}</dd></div><div><dt>蒸汽压力</dt><dd class="mono">{{ detail.steamPressure }} MPa</dd></div><div><dt>安装位置</dt><dd>{{ detail.pipePos }}</dd></div><div><dt>上游用汽设备</dt><dd>{{ detail.equip }}</dd></div><div><dt>投运日期</dt><dd class="mono">{{ detail.installDate }}</dd></div><div><dt>供应商</dt><dd>{{ detail.supplier }}</dd></div></dl><div class="nameplate-placeholder"><Image aria-hidden="true"/><span>铭牌 / 现场照片</span><small>原型资料占位</small></div></div>
      <div v-else-if="tab==='sensor'" class="drawer-content sensor-content"><p class="binding-intro">绑定链路：疏水阀 → 双温度传感器 → 采集终端 → 采集网关</p><div class="binding-flow"><div><Activity/><small>蒸汽侧传感器</small><b>{{ detail.sensorSteam }}</b></div><span>+</span><div><Activity/><small>冷凝水侧传感器</small><b>{{ detail.sensorCond }}</b></div><span>→</span><div><Radio/><small>采集终端</small><b>{{ detail.terminalId }}</b></div><span>→</span><div><Radio/><small>所属网关</small><b>{{ detail.gatewayId }}</b></div></div><dl class="sensor-details"><div><dt>采样方式</dt><dd>双通道同步采集</dd></div><div><dt>采样周期</dt><dd>60 秒</dd></div><div><dt>通汽自检</dt><dd class="good">{{ detail.sensorCheck }} · 绑定方向正确</dd></div></dl><button class="btn secondary sensor-action" @click="notice('重新绑定将启动「通汽自检」向导：通汽后蒸汽侧温度应明显高于冷凝水侧（原型占位）')">重新绑定 / 通汽自检</button></div>
      <div v-else-if="tab==='baseline'" class="drawer-content baseline-learning-content"><BaselineLearningView :device-id="detail.id" :device-data="detail" embedded /></div>
      <div v-else class="drawer-content"><p class="life-summary">共 {{ lifecycle.length }} 条设备生命周期记录，按时间倒序展示。</p><div class="life-list"><div v-for="(e,i) in lifecycle" :key="`${e.time}-${i}`"><Wrench v-if="e.type==='检修'||e.type==='更换阀芯'"/><CalendarDays v-else/><span><b>{{ e.time }} · {{ e.operator }}</b><strong>{{ e.type }}</strong><p>{{ e.desc }}</p></span></div></div><div v-if="!lifecycle.length" class="empty-state">暂无生命周期记录</div></div>
      <footer class="drawer-footer"><button class="btn ghost" @click="closeDetail">关闭</button></footer>
    </aside></div>
  </div>
</template>

<style scoped>
.ledger-kpis{grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.ledger-kpis>div{min-width:0;padding:14px 16px}.ledger-kpis strong{font-size:23px;color:var(--cyan)}.ledger-kpis .type-count{color:#8adfff}.ledger-kpis .bound-count{color:var(--green)}.ledger-kpis .gateway-count{color:var(--purple)}
.ledger-toolbar{align-items:flex-start}.ledger-filters{align-items:center}.ledger-filters select:first-child{width:130px}.ledger-filters select:nth-child(2){width:120px}.ledger-search input{width:280px}.ledger-search svg{width:15px;flex:none}.result-count{color:#718499;font-size:11px;white-space:nowrap;padding-inline:4px}.ledger-table-scroll{max-height:calc(100vh - 262px);min-height:420px}.ledger-table{min-width:1480px}.ledger-table th,.ledger-table td{padding-inline:14px}.ledger-table .tag-no,.tag-no{color:var(--cyan)}.ledger-table .muted,.muted{color:#718499}.device-type{display:inline-flex;padding:4px 7px;border:1px solid rgba(70,216,255,.25);background:rgba(70,216,255,.06);color:#9edff1;font-size:10px;white-space:nowrap}.ledger-empty{min-height:220px}
.ledger-modal-backdrop{padding:20px}.ledger-modal{width:min(1240px,calc(100vw - 64px));max-height:calc(100dvh - 40px);padding:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.48)}.drawer-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:14px 24px 0;flex:none}.drawer-header>div:first-child{min-width:0}.drawer-header small{color:#60768b;font:10px 'Fira Code';letter-spacing:.1em}.drawer-header h2{font-size:18px;margin:4px 0 2px}.drawer-header span{font-size:11px;line-height:1.35}.drawer-head-actions{flex:none}.drawer-status{margin:10px 24px 0;padding:10px 0;flex:none}.drawer-status b.good{color:var(--green)}.drawer-status b.attention{color:var(--amber)}.drawer-status b.danger,.danger{color:var(--red)!important}.drawer-tabs{padding:0 24px;margin-top:2px;overflow-x:auto;flex:none}.drawer-tabs button{position:relative;min-height:36px;padding:7px 14px;white-space:nowrap}.pending-dot{position:absolute;width:6px;height:6px;border-radius:50%;background:var(--red);right:5px;top:6px}.drawer-content{padding:22px 24px;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:0;border-top:1px solid #26384b;border-left:1px solid #26384b}.profile-grid>div{padding:14px 16px;border-right:1px solid #26384b;border-bottom:1px solid #26384b;min-width:0}.profile-grid dt,.sensor-details dt,.baseline-info dt{color:#6f8195;font-size:10px}.profile-grid dd,.sensor-details dd,.baseline-info dd{margin:6px 0 0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.nameplate-placeholder{height:92px;margin-top:18px;border:1px dashed #35506a;display:flex;align-items:center;justify-content:center;gap:10px;color:#7d90a4}.nameplate-placeholder svg{width:20px;color:#4a6b84}.nameplate-placeholder span{font-size:11px}.nameplate-placeholder small{font-size:10px;color:#586d82}
.baseline-learning-content{padding:14px 16px 18px}.baseline-learning-content .baseline-page{gap:12px}.baseline-learning-content .device-hero{padding:16px}.baseline-learning-content .panel-head{padding:14px 16px 8px}.baseline-learning-content .table-toolbar{padding-inline:16px}
.baseline-learning-content :deep(.baseline-page){gap:10px}.baseline-learning-content :deep(.device-hero){padding:12px 16px;gap:10px}.baseline-learning-content :deep(.device-hero h2){font-size:18px;margin:4px 0}.baseline-learning-content :deep(.device-live-metrics){margin-top:2px;padding-top:10px;gap:8px}.baseline-learning-content :deep(.device-live-metrics strong){font-size:18px;margin-top:1px}.baseline-learning-content :deep(.baseline-controls){padding:12px 16px;gap:12px}.baseline-learning-content :deep(.range-control){gap:10px}.baseline-learning-content :deep(.range-control label){gap:5px}.baseline-learning-content :deep(.range-stats){gap:6px}.baseline-learning-content :deep(.range-stats span){padding:6px 8px}.baseline-learning-content :deep(.two-column){gap:12px}.baseline-learning-content :deep(.two-column .panel-head){padding:10px 14px 6px}.baseline-learning-content :deep(.learning-panel){padding-bottom:12px}.baseline-learning-content :deep(.learning-panel>p){margin:8px 14px}.baseline-learning-content :deep(.check-line){margin-inline:14px}.baseline-learning-content :deep(.learning-actions){margin-inline:14px}.baseline-learning-content :deep(.learn-result){padding:12px 14px;gap:12px}.baseline-learning-content :deep(.learn-result>div:first-child p){margin-top:8px}.baseline-learning-content :deep(.baseline-page>section:last-child .panel-head){padding:10px 14px 6px}
.baseline-mode-toggle{min-width:64px;height:28px;padding:0 9px;border:1px solid;border-radius:4px;background:transparent}.baseline-mode-toggle.auto{color:var(--cyan);border-color:rgba(70,216,255,.38);background:rgba(70,216,255,.08)}.baseline-mode-toggle.manual{color:var(--amber);border-color:rgba(255,181,71,.4);background:rgba(255,181,71,.08)}.baseline-mode-toggle.empty{color:#718499;border-color:#364759;background:#151f29}
.ledger-request-state{padding:8px 16px;color:#8da4b8;font-size:11px;border-top:1px solid #26384b;background:rgba(70,216,255,.04)}.ledger-request-state.is-error{color:#ffb3bb;background:rgba(255,93,108,.07)}.ledger-filter-input input{width:120px}.ledger-filter-input:nth-child(4) input{width:150px}.ledger-pagination{min-height:58px;padding:10px 20px;border-top:1px solid #223145;display:flex;justify-content:flex-end;align-items:center;gap:12px;color:#718298;font-size:11px}.ledger-pagination label{display:flex;align-items:center;gap:6px}.ledger-pagination select{height:32px;border:1px solid var(--border);background:#111b27;border-radius:5px;padding:0 8px;color:inherit}.ledger-pagination .btn{height:32px}.ledger-pagination .btn:disabled,.ledger-toolbar .btn:disabled{cursor:not-allowed;opacity:.45}
.baseline-learning-content :deep(.confirmed-windows-table){overflow:hidden}.baseline-learning-content :deep(.confirmed-windows-table table){width:100%;min-width:0;table-layout:fixed}.baseline-learning-content :deep(.confirmed-windows-table th),.baseline-learning-content :deep(.confirmed-windows-table td){padding:8px 6px;font-size:10px;white-space:nowrap}.baseline-learning-content :deep(.confirmed-windows-table th:nth-child(1)),.baseline-learning-content :deep(.confirmed-windows-table td:nth-child(1)){width:29%}.baseline-learning-content :deep(.confirmed-windows-table th:nth-child(2)),.baseline-learning-content :deep(.confirmed-windows-table td:nth-child(2)){width:16%}.baseline-learning-content :deep(.confirmed-windows-table th:nth-child(3)),.baseline-learning-content :deep(.confirmed-windows-table td:nth-child(3)){width:25%}.baseline-learning-content :deep(.confirmed-windows-table th:nth-child(4)),.baseline-learning-content :deep(.confirmed-windows-table td:nth-child(4)){width:18%}.baseline-learning-content :deep(.confirmed-windows-table th:nth-child(5)),.baseline-learning-content :deep(.confirmed-windows-table td:nth-child(5)){width:12%}.baseline-learning-content :deep(.confirmed-windows-table .icon-btn){width:26px;height:26px}
.binding-intro,.life-summary{margin:0 0 18px;color:#7f92a5;font-size:11px}.binding-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;align-items:center;gap:8px}.binding-flow>div{min-width:0;min-height:112px;border:1px solid #2b4054;background:#101a25;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;text-align:center}.binding-flow>div svg{width:22px;color:var(--cyan);margin-bottom:9px}.binding-flow>span{color:#587087;font:15px 'Fira Code'}.binding-flow small{color:#708398;font-size:9px}.binding-flow b{margin-top:5px;font:11px 'Fira Code';overflow-wrap:anywhere}.sensor-details,.baseline-info{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 0}.sensor-details>div,.baseline-info>div{border:1px solid #26394c;padding:12px;min-width:0}.sensor-action{display:flex;margin:18px 0 0 auto}
.baseline-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.baseline-metrics>div{border:1px solid #2a4054;background:#101b27;padding:14px}.baseline-metrics small{display:block;color:#718499;font-size:10px;line-height:1.45}.baseline-metrics strong{display:block;color:var(--cyan);font:500 23px 'Fira Code';margin-top:8px}.baseline-metrics em{font:11px 'Fira Sans';font-style:normal;color:#74869a;margin-left:4px}.baseline-info{grid-template-columns:1fr 1fr}.trend-warning{border:1px solid rgba(255,93,108,.42);background:rgba(255,93,108,.07);padding:12px 14px;margin-top:14px}.trend-warning strong{font-size:11px;color:var(--red)}.trend-warning p{font-size:10px;color:#b9979d;line-height:1.6;margin:6px 0 0}.baseline-history-head{display:flex;justify-content:space-between;align-items:flex-end;margin:20px 0 8px}.baseline-history-head small{color:#60768b;font:9px 'Fira Code';letter-spacing:.1em}.baseline-history-head h3{font-size:13px;margin:4px 0 0}.baseline-history-head>span{font-size:10px;color:#718499}.baseline-history-table{border:1px solid #26384b}.baseline-history-table table{min-width:620px}.baseline-history-table th,.baseline-history-table td{padding:10px 12px}.mini-empty{padding:18px;text-align:center;color:#65788c;font-size:11px}.baseline-entry{margin-top:16px}.life-content{padding-top:18px}.life-list{border-top:1px solid #253548}.life-list>div{display:flex;gap:12px;padding:15px 2px;border-bottom:1px solid #253548}.life-list svg{width:17px;color:var(--cyan);flex:none}.life-list span{flex:1}.life-list strong{float:right;font-size:10px;font-weight:500;color:var(--purple)}.life-list p{font-size:10px;color:#73859a;margin:5px 0 0}.drawer-footer{position:static;display:flex;justify-content:flex-end;padding:12px 24px;background:#111a25;border-top:1px solid #26384b;z-index:2;flex:none}.mono{font-family:'Fira Code'}
@media (max-width:1250px){.ledger-kpis{grid-template-columns:repeat(3,1fr)}.ledger-toolbar{flex-direction:column}.ledger-toolbar>.toolbar-actions{width:100%;justify-content:flex-end}}@media (max-width:760px){.ledger-kpis{grid-template-columns:repeat(2,1fr)}.ledger-kpis>div{padding:12px}.ledger-filters{align-items:stretch}.ledger-filter-input{width:calc(50% - 4px)}.ledger-filter-input input,.ledger-filter-input:nth-child(4) input{width:100%}.ledger-toolbar>.toolbar-actions{justify-content:flex-start}.ledger-pagination{justify-content:center;flex-wrap:wrap;padding-inline:12px}.ledger-table-scroll{max-height:none;min-height:360px}.ledger-modal-backdrop{padding:10px}.ledger-modal{width:calc(100vw - 20px);max-height:calc(100dvh - 20px)}.drawer-header{padding:18px 16px 0}.drawer-status{margin-inline:16px}.drawer-tabs{padding-inline:16px}.drawer-content{padding:18px 16px}.baseline-learning-content{padding:10px 10px 14px}.profile-grid{grid-template-columns:1fr}.binding-flow{grid-template-columns:1fr}.binding-flow>span{transform:rotate(90deg);justify-self:center}.sensor-details,.baseline-info{grid-template-columns:1fr}.baseline-metrics{grid-template-columns:1fr}.drawer-footer{padding-inline:16px}}
</style>
