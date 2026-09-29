<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Search, UserCheck } from 'lucide-vue-next'
import StatusBadge from '../components/StatusBadge.vue'
import { useSystemStore } from '../stores/system'
const store=useSystemStore(), router=useRouter(), tab=ref('all'), search=ref(''), trigger=ref('')
function formatTime(value) {
  if (!value) return '-'
  if (typeof value === 'string' && /\d{1,2}-\d{1,2} \d{1,2}:\d{2}/.test(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('zh-CN',{hour12:false})
}
const records=computed(()=>store.stateChanges.map((change) => ({
  ...change,
  device: store.devices.find(d => d.id === change.deviceId),
  formattedTime: formatTime(change.time)
})).filter(item => item.device))
const pending=computed(()=>records.value.filter(item => item.pending || item.confidence < 70))
const shown=computed(()=>records.value.filter(item => (tab.value !== 'pending' || item.pending || item.confidence < 70) && (!trigger.value || item.trigger === trigger.value) && (!search.value.trim() || `${item.tagNo}${item.deviceName}`.toLowerCase().includes(search.value.trim().toLowerCase()))))
function confirm(change){store.reviewDevice(change.deviceId, change.device.status, change.rule)}
function viewDetail(change){ router.push(`/monitor/${change.deviceId}`) }
</script>
<template><div class="page-stack"><section v-if="pending.length" class="review-banner panel"><div><UserCheck/><span><strong>{{pending.length}} 条低置信度记录待确认</strong><small>建议结合现场工况完成复核，人工结论将进入模型校准样本。</small></span></div><button class="btn primary" @click="tab='pending'">查看待确认队列</button></section><section class="panel table-panel"><div class="table-toolbar"><div class="tabs"><button :class="{active:tab==='all'}" @click="tab='all'">全部记录</button><button :class="{active:tab==='pending'}" @click="tab='pending'">待人工确认</button></div><div class="filters"><select v-model="trigger" aria-label="触发方式"><option value="">全部触发方式</option><option>自动判定</option><option>人工复核</option><option>人工确认</option></select><label class="search-box"><Search/><input v-model="search" placeholder="搜索位号 / 设备" /></label><span>共 {{shown.length}} 条</span></div></div><div class="table-scroll"><table><thead><tr><th>变更时间</th><th>设备</th><th>状态变化</th><th>触发原因</th><th>置信度</th><th>复核状态</th><th>操作</th></tr></thead><tbody><tr v-for="r in shown" :key="r.id"><td>{{r.formattedTime}}</td><td><b>{{r.tagNo}}</b><small>{{r.deviceName}}</small></td><td><div class="state-change"><StatusBadge :status="r.from"/><span>→</span><StatusBadge :status="r.to"/></div></td><td>{{r.rule}}</td><td><b :class="{warn:r.confidence<70}">{{r.confidence}}%</b></td><td>{{r.pending || r.confidence<70 ? '待确认':'已确认'}}</td><td><div class="row-actions"><button class="btn tiny" @click="viewDetail(r)">详情</button><button v-if="r.pending || r.confidence<70" class="btn tiny" @click="confirm(r)"><Check/>确认</button></div></td></tr></tbody></table><div v-if="!shown.length" class="empty-state">暂无匹配状态变更记录</div></div></section></div></template>
