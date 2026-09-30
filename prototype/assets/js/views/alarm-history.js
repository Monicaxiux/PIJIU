/* ============================================================
   alarm-history.js — 告警管理 · 历史告警
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-alarm-history"] = defineComponent({
    name: "AlarmHistory",
    data() {
      const p = window.Store.pref("alarm-history", {}) || {};
      return { kw: p.kw || "", lvF: p.lvF || "", stF: p.stF || "" };
    },
    computed: {
      store() { return window.Store; },
      rows() {
        return this.store.alarms.filter((a) =>
          (!this.lvF || a.level === Number(this.lvF)) &&
          (!this.stF || a.status === this.stF) &&
          (!this.kw.trim() || a.tagNo.toLowerCase().includes(this.kw.trim().toLowerCase()) || a.content.includes(this.kw.trim()))
        );
      },
      stats() {
        const closed = this.store.alarms.filter((a) => a.status === "已关闭" && a.claimedAt && a.closedAt);
        const toMin = (s) => { const p = s.split(":"); return Number(p[0]) * 60 + Number(p[1]); };
        let resp = 0, close = 0, n = 0;
        closed.forEach((a) => {
          const cr = a.createdAt.split(" ");
          const ct = a.createdAt.length > 5 ? a.createdAt.slice(-5) : a.createdAt;
          resp += Math.max(0, toMin(a.claimedAt) - toMin(ct));
          close += Math.max(0, toMin(a.closedAt) - toMin(a.claimedAt));
          n++;
        });
        return {
          total: this.store.alarms.length,
          closed: closed.length,
          avgResp: n ? Math.round(resp / n) : 0,
          avgClose: n ? Math.round(close / n) : 0
        };
      }
    },
    created() {
      this.$watch(() => [this.kw, this.lvF, this.stF], () => {
        window.Store.setPref("alarm-history", { kw: this.kw, lvF: this.lvF, stF: this.stF });
      });
    },
    methods: {
      goDev(id) { location.hash = "#/monitor/" + id; },
      lvName(l) { return l === 1 ? "紧急" : l === 2 ? "重要" : "一般"; },
      lvCls(l) { return "lv-" + l; },
      resetFilter() { this.kw = ""; this.lvF = ""; this.stF = ""; window.showToast("筛选条件已重置"); },
      exportCsv() {
        window.MOCK.downloadCsv("历史告警", this.rows.map((a) => ({
          "告警编号": a.id, "位号": a.tagNo, "设备": a.deviceName, "区域": a.workshop,
          "级别": this.lvName(a.level), "告警内容": a.content, "产生时间": a.createdAt,
          "认领时间": a.claimedAt || "-", "关闭时间": a.closedAt || "-",
          "状态": a.status, "处理人": a.handler || "-", "处理措施": a.measure || "-"
        })));
      }
    },
    template: `
      <div>
        <div class="kpi-row mb14">
          <div class="kpi-card"><div class="k-num" style="color:#00d4ff">{{ stats.total }}</div><div class="k-label">告警总数</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#2ecc71">{{ stats.closed }}</div><div class="k-label">已关闭</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#ff9f27">{{ stats.avgResp }} 分钟</div><div class="k-label">平均响应时长（认领）</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#00d4ff">{{ stats.avgClose }} 分钟</div><div class="k-label">平均关闭时长</div></div>
        </div>

        <div class="panel glow">
          <div class="filter-bar">
            <input class="inp" style="width:200px" v-model="kw" placeholder="搜索位号 / 告警内容" />
            <select class="sel" style="width:120px" v-model="lvF">
              <option value="">全部级别</option>
              <option value="1">紧急</option><option value="2">重要</option><option value="3">一般</option>
            </select>
            <select class="sel" style="width:130px" v-model="stF">
              <option value="">全部状态</option>
              <option>待处理</option><option>处理中</option><option>已关闭</option>
            </select>
            <span style="flex:1"></span>
            <span class="dim" style="font-size:11px">共 {{ rows.length }} 条</span>
            <button class="btn ghost" @click="resetFilter">重置</button>
            <button class="btn" @click="exportCsv">导出</button>
          </div>
          <div class="tbl-wrap bounded">
          <table class="tbl sticky">
            <thead><tr>
              <th>告警编号</th><th>位号</th><th>级别</th><th>告警内容</th><th>产生时间</th>
              <th>认领时间</th><th>关闭时间</th><th>状态</th><th>处理人</th>
            </tr></thead>
            <tbody>
              <tr v-for="a in rows" :key="a.id" @click="goDev(a.deviceId)">
                <td class="dim mono">{{ a.id }}</td>
                <td class="mono" style="color:#00d4ff">{{ a.tagNo }}</td>
                <td><span class="al-lv" :class="lvCls(a.level)">{{ lvName(a.level) }}</span></td>
                <td class="sub" style="max-width:300px">{{ a.content }}</td>
                <td class="dim mono">{{ a.createdAt }}</td>
                <td class="dim mono">{{ a.claimedAt || "-" }}</td>
                <td class="dim mono">{{ a.closedAt || "-" }}</td>
                <td>
                  <span class="st-tag" :class="a.status === '已关闭' ? 'st-stop' : a.status === '处理中' ? 'st-block' : 'st-leak'">
                    <i class="st-dot"></i>{{ a.status }}
                  </span>
                </td>
                <td class="sub">{{ a.handler || "-" }}</td>
              </tr>
            </tbody>
          </table>
          </div>
          <div v-if="!rows.length" class="tbl-empty">无匹配告警记录</div>
        </div>
      </div>
    `
  });
})();
