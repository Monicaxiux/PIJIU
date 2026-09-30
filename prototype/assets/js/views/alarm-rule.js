/* ============================================================
   alarm-rule.js — 告警管理 · 告警规则配置（原型静态表单）
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-alarm-rule"] = defineComponent({
    name: "AlarmRule",
    data() {
      return {
        rules: [
          { id: 1, target: "全部设备（默认模板）", cond: "状态切换为「泄漏」", level: 1, notify: "站内 + 短信 + 企业微信", quiet: "无", esc: "2 小时未处理升级至车间主任", on: true },
          { id: 9, target: "浮球式设备组（连续排放型）", cond: "ΔT / ΔT基准 连续 3 次落入 65%~75%（初期泄漏）", level: 2, notify: "站内 + 企业微信", quiet: "无", esc: "4 小时未处理升级至能源工程师", on: true },
          { id: 10, target: "浮球式设备组（连续排放型）", cond: "ΔT / ΔT基准 连续 2 次低于 65%（严重泄漏）", level: 1, notify: "站内 + 短信 + 企业微信", quiet: "无", esc: "2 小时未处理升级至车间主任", on: true },
          { id: 2, target: "全部设备（默认模板）", cond: "状态切换为「阻塞」", level: 2, notify: "站内 + 企业微信", quiet: "无", esc: "4 小时未处理升级至能源工程师", on: true },
          { id: 3, target: "全部设备（默认模板）", cond: "数据中断 > 3×采集周期", level: 3, notify: "站内", quiet: "22:00-06:00", esc: "无", on: true },
          { id: 4, target: "高温高压设备组（DN50）", cond: "温度跳变 > 20℃/min", level: 2, notify: "站内 + 短信", quiet: "无", esc: "无", on: true },
          { id: 5, target: "包装区域（采暖季外）", cond: "停产状态误报抑制", level: 3, notify: "站内", quiet: "全天静默", esc: "无", on: false },
          { id: 6, target: "全部设备（基线策略）", cond: "新基线相对原基线上升 ≥ 3℃，待人工确认", level: 3, notify: "站内 + 企业微信", quiet: "无", esc: "24 小时未确认升级至能源工程师", on: true },
          { id: 7, target: "全部设备（基线策略）", cond: "基线累计上升 ≥ 5℃（趋势预警，疑似故障数据污染基线）", level: 2, notify: "站内 + 短信 + 企业微信", quiet: "无", esc: "4 小时未处理升级至能源工程师", on: true },
          { id: 8, target: "全部设备（基线策略）", cond: "基线样本不足或稳定性校验未通过 → 自动降级为模板基线", level: 3, notify: "站内", quiet: "22:00-06:00", esc: "无", on: true }
        ]
      };
    },
    methods: {
      lvName(l) { return l === 1 ? "紧急" : l === 2 ? "重要" : "一般"; },
      lvCls(l) { return "lv-" + l; },
      save() { window.showToast("告警规则已保存（原型演示，正式版需审批留痕）"); },
      add() { window.showToast("新增规则为原型占位功能"); }
    },
    template: `
      <div class="panel glow">
        <div class="panel-title">告警规则配置
          <span class="pt-extra"><button class="btn primary" @click="add">+ 新增规则</button></span>
        </div>
        <div class="dim" style="font-size:12px;margin-bottom:12px">
          规则要素：监控对象（设备/设备组）、触发条件（状态切换 / 阈值越限 / 数据中断超时）、告警级别、通知方式、免打扰时段、升级策略。
        </div>
        <table class="tbl">
          <thead><tr>
            <th>启用</th><th>监控对象</th><th>触发条件</th><th>级别</th><th>免打扰时段</th><th>升级策略</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in rules" :key="r.id" style="cursor:default">
              <td>
                <span @click="r.on = !r.on" style="cursor:pointer;display:inline-block;width:34px;height:18px;border-radius:9px;position:relative;
                      background: r.on ? 'linear-gradient(90deg,#0092c4,#1f6fd4)' : 'rgba(255,255,255,0.12)';transition:all 0.15s">
                  <span style="position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;
                        transition:all 0.15s" :style="{ left: r.on ? '18px' : '2px' }"></span>
                </span>
              </td>
              <td>{{ r.target }}</td>
              <td class="sub">{{ r.cond }}</td>
              <td><span class="al-lv" :class="lvCls(r.level)">{{ lvName(r.level) }}</span></td>
              <td class="dim" style="font-size:11px">{{ r.quiet }}</td>
              <td class="dim" style="font-size:11px">{{ r.esc }}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:16px;text-align:right">
          <button class="btn primary" @click="save">保存配置</button>
        </div>
      </div>
    `
  });
})();
