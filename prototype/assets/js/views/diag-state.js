/* ============================================================
   diag-state.js — 诊断分析 · 状态变更记录 + 待人工确认队列
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-diag-state"] = defineComponent({
    name: "DiagState",
    data() { return { kw: "", trigF: "" }; },
    computed: {
      store() { return window.Store; },
      pending() { return this.store.stateChanges.filter((c) => c.confidence < 70); },
      rows() {
        return this.store.stateChanges.filter((c) =>
          (!this.trigF || c.trigger === this.trigF) &&
          (!this.kw.trim() || c.tagNo.toLowerCase().includes(this.kw.trim().toLowerCase()))
        );
      }
    },
    methods: {
      goDev(id) { location.hash = "#/monitor/" + id; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      confirmOne(c) {
        c.pending = false;
        c.trigger = "人工确认";
        c.confidence = 100;
        window.showToast(c.tagNo + " 状态切换已人工确认");
      }
    },
    template: `
      <div>
        <div class="panel glow mb14" v-if="pending.length">
          <div class="panel-title">待人工确认队列
            <span class="pt-extra dim" style="font-size:11px">状态自动切换但置信度 &lt; 70%，确认后才会正式生效并推送告警</span>
          </div>
          <div v-for="c in pending" :key="c.id" class="al-card">
            <div class="al-head">
              <span class="mono" style="color:#00d4ff">{{ c.tagNo }}</span>
              <span class="al-title">{{ stLabel(c.from) }} → {{ stLabel(c.to) }}</span>
              <span class="st-tag st-block" style="margin-left:auto">置信度 {{ c.confidence }}%</span>
            </div>
            <div class="al-meta">{{ c.rule }}</div>
            <div style="margin-top:8px;display:flex;gap:10px;align-items:center">
              <span class="dim mono" style="font-size:11px">{{ c.time }}</span>
              <span style="flex:1"></span>
              <button class="btn" @click="goDev(c.deviceId)">查看详情</button>
              <button class="btn primary" @click="confirmOne(c)">确认切换</button>
            </div>
          </div>
        </div>

        <div class="panel glow">
          <div class="panel-title">状态机切换流水</div>
          <div class="filter-bar">
            <select class="sel" style="width:150px" v-model="trigF">
              <option value="">全部触发方式</option>
              <option>自动判定</option><option>人工复核</option><option>人工确认</option>
            </select>
            <input class="inp" style="width:200px" v-model="kw" placeholder="搜索位号" />
            <span class="dim" style="font-size:11px">共 {{ rows.length }} 条记录</span>
          </div>
          <table class="tbl">
            <thead><tr><th>时间</th><th>位号</th><th>设备</th><th>状态切换</th><th>触发方式</th><th>置信度</th><th>触发规则摘要</th></tr></thead>
            <tbody>
              <tr v-for="c in rows" :key="c.id" @click="goDev(c.deviceId)">
                <td class="dim mono">{{ c.time }}</td>
                <td class="mono" style="color:#00d4ff">{{ c.tagNo }}</td>
                <td>{{ c.deviceName }}</td>
                <td>
                  <span class="st-tag" :class="windowCLS[c.from]" style="padding:1px 8px">{{ stLabel(c.from) }}</span>
                  <span class="dim" style="margin:0 4px">→</span>
                  <span class="st-tag" :class="windowCLS[c.to]" style="padding:1px 8px">{{ stLabel(c.to) }}</span>
                </td>
                <td>
                  <span :style="{ color: c.trigger === '自动判定' ? '#7fa3c9' : '#a08cf0' }">{{ c.trigger }}</span>
                </td>
                <td class="mono" :style="{ color: c.confidence < 70 ? '#ff9f27' : '#2ecc71' }">{{ c.confidence }}%</td>
                <td class="sub" style="max-width:380px;font-size:11px">{{ c.rule }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
    created() {
      this.windowCLS = {};
      Object.keys(window.MOCK.STATES).forEach((k) => { this.windowCLS[k] = window.MOCK.STATES[k].cls; });
    }
  });
})();
