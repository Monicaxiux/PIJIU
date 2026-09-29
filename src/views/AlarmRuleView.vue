<script setup>
import { computed, ref } from 'vue'
import { BellRing, Plus } from 'lucide-vue-next'
import { useSystemStore } from '../stores/system'

const store = useSystemStore()

const rules = ref([
  { id: 1, target: '全部设备（默认模板）', cond: '状态切换为「泄漏」', level: 1, notify: '站内 + 短信 + 企业微信', quiet: '无', esc: '2 小时未处理升级至车间主任', on: true },
  { id: 9, target: '浮球式设备组（连续排放型）', cond: 'ΔT / ΔT基准 连续 3 次落入 65%~75%（初期泄漏）', level: 2, notify: '站内 + 企业微信', quiet: '无', esc: '4 小时未处理升级至能源工程师', on: true },
  { id: 10, target: '浮球式设备组（连续排放型）', cond: 'ΔT / ΔT基准 连续 2 次低于 65%（严重泄漏）', level: 1, notify: '站内 + 短信 + 企业微信', quiet: '无', esc: '2 小时未处理升级至车间主任', on: true },
  { id: 2, target: '全部设备（默认模板）', cond: '状态切换为「阻塞」', level: 2, notify: '站内 + 企业微信', quiet: '无', esc: '4 小时未处理升级至能源工程师', on: true },
  { id: 3, target: '全部设备（默认模板）', cond: '数据中断 > 3×采集周期', level: 3, notify: '站内', quiet: '22:00-06:00', esc: '无', on: true },
  { id: 4, target: '高温高压设备组（DN50）', cond: '温度跳变 > 20℃/min', level: 2, notify: '站内 + 短信', quiet: '无', esc: '无', on: true },
  { id: 5, target: '包装区域（采暖季外）', cond: '停产状态误报抑制', level: 3, notify: '站内', quiet: '全天静默', esc: '无', on: false },
  { id: 6, target: '全部设备（基线策略）', cond: '新基线相对原基线上升 ≥ 3℃，待人工确认', level: 3, notify: '站内 + 企业微信', quiet: '无', esc: '24 小时未确认升级至能源工程师', on: true },
  { id: 7, target: '全部设备（基线策略）', cond: '基线累计上升 ≥ 5℃（趋势预警，疑似故障数据污染基线）', level: 2, notify: '站内 + 短信 + 企业微信', quiet: '无', esc: '4 小时未处理升级至能源工程师', on: true },
  { id: 8, target: '全部设备（基线策略）', cond: '基线样本不足或稳定性校验未通过 → 自动降级为模板基线', level: 3, notify: '站内', quiet: '22:00-06:00', esc: '无', on: true }
])

const enabledCount = computed(() => rules.value.filter(rule => rule.on).length)

function levelName(level) {
  return level === 1 ? '紧急' : level === 2 ? '重要' : '一般'
}

function addRule() {
  store.notify('新增规则为原型占位功能')
}

function save() {
  store.notify('告警规则已保存（原型演示，正式版需审批留痕）')
}
</script>

<template>
  <div class="page-stack alarm-rule-page">
    <section class="panel alarm-rule-panel">
      <div class="alarm-rule-head">
        <div>
          <div class="panel-title-row"><BellRing :size="17" aria-hidden="true" /><h2>告警规则配置</h2></div>
          <p class="alarm-rule-intro">规则要素：监控对象（设备/设备组）、触发条件（状态切换 / 阈值越限 / 数据中断超时）、告警级别、通知方式、免打扰时段、升级策略。</p>
        </div>
        <button class="btn primary" @click="addRule"><Plus :size="15" aria-hidden="true" />新增规则</button>
      </div>

      <div class="table-scroll alarm-rule-scroll">
        <table class="alarm-rule-table">
          <thead>
            <tr><th>启用</th><th>监控对象</th><th>触发条件</th><th>级别</th><th>通知方式</th><th>免打扰时段</th><th>升级策略</th></tr>
          </thead>
          <tbody>
            <tr v-for="rule in rules" :key="rule.id" :class="{ 'rule-disabled': !rule.on }">
              <td>
                <button class="rule-switch" :class="{ on: rule.on }" :aria-pressed="rule.on" :aria-label="`${rule.on ? '停用' : '启用'}规则 ${rule.id}`" @click="rule.on = !rule.on">
                  <i aria-hidden="true"></i>
                </button>
              </td>
              <td><strong>{{ rule.target }}</strong><small>R-{{ String(rule.id).padStart(2, '0') }}</small></td>
              <td class="condition-cell">{{ rule.cond }}</td>
              <td><span class="rule-level" :class="`lv-${rule.level}`">{{ levelName(rule.level) }}</span></td>
              <td class="muted-cell">{{ rule.notify }}</td>
              <td class="muted-cell">{{ rule.quiet }}</td>
              <td class="muted-cell escalation-cell">{{ rule.esc }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="alarm-rule-footer">
        <span>当前规则集包含 {{ enabledCount }} 条已启用规则</span>
        <button class="btn primary" @click="save">保存配置</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.alarm-rule-panel{overflow:hidden}
.alarm-rule-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:20px 22px 16px;border-bottom:1px solid #223145}
.panel-title-row{display:flex;align-items:center;gap:8px;color:var(--cyan)}
.panel-title-row h2{margin:0;color:#eaf2fb;font-size:16px;font-weight:600}
.alarm-rule-intro{max-width:920px;margin:12px 0 0;color:#8192a5;font-size:11px;line-height:1.7}
.alarm-rule-scroll{overflow:auto}
.alarm-rule-table{min-width:1120px;table-layout:fixed}
.alarm-rule-table th,.alarm-rule-table td{padding:12px 14px;vertical-align:middle}
.alarm-rule-table th:first-child,.alarm-rule-table td:first-child{width:62px;text-align:center}
.alarm-rule-table th:nth-child(2),.alarm-rule-table td:nth-child(2){width:205px}
.alarm-rule-table th:nth-child(3),.alarm-rule-table td:nth-child(3){width:300px}
.alarm-rule-table th:nth-child(4),.alarm-rule-table td:nth-child(4){width:72px}
.alarm-rule-table th:nth-child(5),.alarm-rule-table td:nth-child(5){width:178px}
.alarm-rule-table th:nth-child(6),.alarm-rule-table td:nth-child(6){width:120px}
.alarm-rule-table td{font-size:11px;white-space:normal;line-height:1.5}
.alarm-rule-table td strong{display:block;color:#dce8f3;font-size:11px;font-weight:500}
.alarm-rule-table td small{display:block;margin-top:4px;color:#60768b;font:9px 'Fira Code';letter-spacing:.06em}
.condition-cell{color:#b5c4d2}
.muted-cell{color:#8293a7;font-size:10px!important}
.escalation-cell{color:#97a8b8}
.rule-disabled{opacity:.58}
.rule-disabled:hover{background:transparent}
.rule-switch{position:relative;width:34px;height:18px;padding:0;border:0;border-radius:10px;background:#2a3b4c;transition:.16s}
.rule-switch.on{background:linear-gradient(90deg,#0092c4,#1f6fd4)}
.rule-switch i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#f4f8fb;transition:.16s}
.rule-switch.on i{left:18px}
.rule-level{display:inline-flex;align-items:center;justify-content:center;min-width:38px;padding:4px 7px;border-radius:2px;font-size:10px;white-space:nowrap}
.rule-level.lv-1{color:var(--red);background:rgba(255,93,108,.13)}
.rule-level.lv-2{color:var(--amber);background:rgba(255,181,71,.13)}
.rule-level.lv-3{color:var(--cyan);background:rgba(70,216,255,.13)}
.alarm-rule-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 22px;border-top:1px solid #223145;background:#101b27;color:#8192a5;font-size:11px}
@media (max-width:760px){.alarm-rule-head{padding:16px;flex-direction:column}.alarm-rule-head>.btn{align-self:flex-end}.alarm-rule-intro{margin-top:10px}.alarm-rule-table{min-width:1120px}.alarm-rule-footer{padding:12px 16px}}
</style>
