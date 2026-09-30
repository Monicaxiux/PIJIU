/* ============================================================
   diag-results.js — 诊断分析 · 诊断结果总览
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-diag-results"] = defineComponent({
    name: "DiagResults",
    data() { return { stateF: "", gradeF: "", kw: "" }; },
    computed: {
      store() { return window.Store; },
      gradeOpts() { window.dataVer(); return window.MOCK.baseline.gradeOrder; },
      rows() {
        window.dataVer();
        return this.store.diagResults.map((r) => {
          const d = this.store.devices.find((x) => x.id === r.deviceId);
          return { r, d, rd: window.MOCK.baseline.diag(d) };
        }).filter((x) =>
          (!this.stateF || x.r.state === this.stateF) &&
          (!this.gradeF || x.rd.key === this.gradeF) &&
          (!this.kw.trim() || x.d.tagNo.toLowerCase().includes(this.kw.trim().toLowerCase()))
        );
      }
    },
    watch: {
      stateF(v) { this.store.setPref("dg.state", v); },
      gradeF(v) { this.store.setPref("dg.grade", v); },
      kw(v) { this.store.setPref("dg.kw", v); }
    },
    mounted() {
      this.stateF = this.store.pref("dg.state", "");
      this.gradeF = this.store.pref("dg.grade", "");
      this.kw = this.store.pref("dg.kw", "");
    },
    methods: {
      goDev(id) { location.hash = "#/monitor/" + id; },
      gotBaseline(id, e) { e.stopPropagation(); location.hash = "#/ledger/" + id + "/baseline"; },
      stCls(s) { return window.MOCK.STATES[s].cls; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      cColor(c) { return c >= 85 ? "#2ecc71" : c >= 70 ? "#00d4ff" : "#ff9f27"; },
      devColor(rd) {
        if (!rd.applicable) return "#8a97a8";
        return Math.abs(rd.dtPct) > 35 ? "#ff4d5e" : Math.abs(rd.dtPct) > 25 ? "#ff9f27" : "#2ecc71";
      },
      exportCsv() {
        window.MOCK.downloadCsv("诊断结果清单", this.rows.map((x) => ({
          "位号": x.d.tagNo, "设备": x.d.name, "类型": x.d.type, "区域": x.d.workshopName,
          "评价窗口": x.rd.win.spanMin + "min",
          "ΔT窗口均值(℃)": x.rd.win.dtMean, "ΔT基准(℃)": x.rd.info.dtBase,
          "偏离(%)": x.rd.applicable ? x.rd.dtPct : "不适用",
          "Tc窗口均值(℃)": x.rd.win.tcMean, "Tc基准(℃)": x.rd.info.tcBase,
          "相对基准档位": x.rd.label, "现场状态": this.stLabel(x.r.state),
          "诊断时间": x.r.time, "判定依据": x.rd.reason,
          "置信度(%)": x.r.confidence,
          "复核状态": x.r.manual ? "人工复核 · " + x.r.reviewer : "自动判定"
        })));
      },
      resetFilter() { this.stateF = ""; this.gradeF = ""; this.kw = ""; window.showToast("筛选条件已重置"); }
    },
    template: `
      <div class="panel glow">
        <div class="filter-bar">
          <select class="sel" style="width:150px" v-model="stateF">
            <option value="">全部诊断结论</option>
            <option value="normal">正常</option><option value="leak">泄漏</option>
            <option value="block">阻塞</option><option value="stop">停产</option>
            <option value="abnormal">数据异常</option>
          </select>
          <select class="sel" style="width:150px" v-model="gradeF">
            <option value="">全部相对基准档位</option>
            <option v-for="g in gradeOpts" :key="g.key" :value="g.key">{{ g.label }}</option>
          </select>
          <input class="inp" style="width:180px" v-model="kw" placeholder="搜索设备位号" />
          <span class="dim" style="font-size:11px">共 {{ rows.length }} 条最新诊断结论 · 判定基准取「30 分钟稳定生产窗口均值 vs 人工学习基线」</span>
          <span style="flex:1"></span>
          <button class="btn ghost" @click="resetFilter">重置</button>
          <button class="btn" @click="exportCsv">导出清单</button>
        </div>
        <div class="tbl-wrap bounded">
        <table class="tbl sticky">
          <thead><tr>
            <th>位号</th><th>设备</th><th>口径</th><th>温差窗口均值 / 基准</th><th>相对基准档位</th><th>现场状态</th><th>诊断时间</th><th>判定依据</th><th>置信度</th><th>复核状态</th>
          </tr></thead>
          <tbody>
            <tr v-for="x in rows" :key="x.r.id" @click="goDev(x.d.id)">
              <td class="mono" style="color:#00d4ff">{{ x.d.tagNo }}</td>
              <td>{{ x.d.name }}<span class="dim" style="margin-left:6px;font-size:11px">{{ x.d.type }}</span></td>
              <td class="dim mono" style="font-size:11px">{{ x.rd.win.spanMin }}min 窗口</td>
              <td class="mono">
                {{ x.rd.win.dtMean }} / <span class="dim">{{ x.rd.info.dtBase }}</span>
                <span style="font-size:10px;margin-left:4px" :style="{ color: devColor(x.rd) }">{{ x.rd.dtPct >= 0 ? "+" : "" }}{{ x.rd.dtPct }}%</span>
              </td>
              <td>
                <span class="st-tag" :class="x.rd.cls" :title="x.rd.reason"><i class="st-dot"></i>{{ x.rd.label }}</span>
                <button class="btn ghost" style="padding:1px 8px;margin-left:6px;font-size:11px" @click="gotBaseline(x.d.id, $event)">基线</button>
              </td>
              <td><span class="st-tag" :class="stCls(x.r.state)"><i class="st-dot"></i>{{ stLabel(x.r.state) }}</span></td>
              <td class="dim mono">{{ x.r.time }}</td>
              <td class="sub" style="max-width:360px;font-size:11px">{{ x.rd.reason }}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="hbar"><i :style="{ width: x.r.confidence + '%', background: cColor(x.r.confidence) }"></i></div>
                  <span class="mono" :style="{ color: cColor(x.r.confidence) }">{{ x.r.confidence }}%</span>
                </div>
              </td>
              <td>
                <span v-if="x.r.manual" style="color:#a08cf0;font-size:11px">人工复核 · {{ x.r.reviewer }}</span>
                <span v-else class="dim" style="font-size:11px">自动判定</span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        <div v-if="!rows.length" class="tbl-empty">
          无匹配诊断结论，请调整筛选条件
          <div style="margin-top:10px"><button class="btn ghost" @click="resetFilter">重置筛选</button></div>
        </div>
      </div>
    `
  });
})();
