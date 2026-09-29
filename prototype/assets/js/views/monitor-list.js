/* ============================================================
   monitor-list.js — 实时监测 · 设备监测列表
   刷新节拍由全局模拟时钟统一驱动（store.dataVer）；
   本页不再自建计时器，避免与全局节拍叠加导致双倍推进。
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-monitor-list"] = defineComponent({
    name: "MonitorList",
    data() {
      const p = window.Store.pref("monitor-list", {}) || {};
      return {
        ws: p.ws || "", kw: p.kw || "", statusOn: p.statusOn || [], basOn: !!p.basOn,
        sortKey: p.sortKey || "health", sortDir: p.sortDir || "asc"
      };
    },
    computed: {
      store() { return window.Store; },
      statusCounts() {
        window.dataVer();
        const c = {};
        Object.keys(window.MOCK.STATES).forEach((k) => { c[k] = 0; });
        this.store.devices.forEach((d) => { c[d.status]++; });
        return c;
      },
      /* 基线待人工确认 / 趋势预警 的设备数（与驾驶舱、策略页同源） */
      baselineTodo() {
        window.dataVer();
        return this.store.devices.filter((d) => {
          const i = window.MOCK.baseline.info(d);
          return i.pending || i.cumRise >= i.warnRise;
        }).length;
      },
      filtered() {
        window.dataVer();
        const kw = this.kw.trim().toLowerCase();
        const rows = this.store.devices.filter((d) => {
          const i = window.MOCK.baseline.info(d);
          return (!this.ws || d.workshopId === this.ws) &&
            (!this.statusOn.length || this.statusOn.includes(d.status)) &&
            (!this.basOn || i.pending || i.cumRise >= i.warnRise) &&
            (!kw || d.tagNo.toLowerCase().includes(kw) || d.name.includes(kw) || d.equip.includes(kw));
        });
        return this.sortRows(rows);
      },
      gradeRank() {
        const m = {};
        window.MOCK.baseline.gradeOrder.forEach((g, i) => { m[g.key] = i; });
        return m;
      }
    },
    created() {
      this.$watch(
        () => [this.ws, this.kw, this.statusOn, this.basOn, this.sortKey, this.sortDir],
        () => window.Store.setPref("monitor-list", {
          ws: this.ws, kw: this.kw, statusOn: this.statusOn, basOn: this.basOn,
          sortKey: this.sortKey, sortDir: this.sortDir
        }),
        { deep: true }
      );
    },
    methods: {
      goDev(id) { location.hash = "#/monitor/" + id; },
      toggleSt(k) {
        const i = this.statusOn.indexOf(k);
        if (i >= 0) this.statusOn.splice(i, 1); else this.statusOn.push(k);
      },
      stCls(s) { return window.MOCK.STATES[s].cls; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      hColor(h) { return h >= 85 ? "#2ecc71" : h >= 60 ? "#ff9f27" : "#ff4d5e"; },
      rd(d) { window.dataVer(); return window.MOCK.baseline.diag(d); },
      bi(d) { window.dataVer(); return window.MOCK.baseline.info(d); },
      /* 温差偏离基准的着色：越限即按档位着色 */
      devColor(d) {
        const r = this.rd(d);
        if (!r.applicable) return "#8a97a8";
        if (Math.abs(r.dtPct) > 35) return "#ff4d5e";
        if (Math.abs(r.dtPct) > 25) return "#ff9f27";
        return "#2ecc71";
      },
      gotBaseline(id, e) { e.stopPropagation(); location.hash = "#/ledger/" + id + "/baseline"; },
      /* 表头排序：同列再点切换升降序 */
      sortBy(k) {
        if (this.sortKey === k) this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
        else { this.sortKey = k; this.sortDir = k === "health" || k === "dtPct" || k === "rank" ? "asc" : "asc"; }
      },
      sortMark(k) { return this.sortKey === k ? (this.sortDir === "asc" ? " ▲" : " ▼") : ""; },
      /* 取排序值；数值型按数值、文本按 localeCompare */
      sortRows(rows) {
        const k = this.sortKey, dir = this.sortDir === "asc" ? 1 : -1;
        const val = (d) => {
          switch (k) {
            case "workshop": return d.workshopName;
            case "tagNo": return d.tagNo;
            case "type": return d.type;
            case "ts": return this.rd(d).win.tsMean;
            case "tc": return this.rd(d).win.tcMean;
            case "dt": return this.rd(d).win.dtMean;
            case "dtPct": return this.rd(d).applicable ? this.rd(d).dtPct : 9999;
            case "rank": return this.gradeRank[this.rd(d).key] === undefined ? 99 : this.gradeRank[this.rd(d).key];
            case "status": return this.gradeRank[d.status] === undefined ? d.status : this.gradeRank[this.rd(d).key];
            case "health": return d.health;
            case "lastUpdate": return d.lastUpdate;
            default: return d.health;
          }
        };
        return rows.slice().sort((a, b) => {
          const va = val(a), vb = val(b);
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
          return String(va).localeCompare(String(vb), "zh-Hans-CN") * dir;
        });
      },
      pauseToggle() {
        this.store.autoRefresh = !this.store.autoRefresh;
        window.showToast(this.store.autoRefresh ? "已恢复自动刷新" : "已暂停自动刷新（图表冻结）");
      },
      resetFilter() {
        this.ws = ""; this.kw = ""; this.statusOn = []; this.basOn = false;
        this.sortKey = "health"; this.sortDir = "asc";
        window.showToast("筛选与排序已重置");
      },
      exportCsv() {
        window.MOCK.downloadCsv("设备监测列表", this.filtered.map((d) => {
          const r = this.rd(d), i = this.bi(d);
          return {
            "区域": d.workshopName, "位号": d.tagNo, "名称": d.name, "类型": d.type,
            "Ts窗口均值(℃)": r.win.tsMean, "Tc窗口均值(℃)": r.win.tcMean,
            "ΔT窗口均值(℃)": r.win.dtMean, "ΔT基准(℃)": i.dtBase, "偏离(%)": r.applicable ? r.dtPct : "不适用",
            "相对基准诊断": r.label, "现场状态": this.stLabel(d.status), "健康度": d.health, "最近更新": d.lastUpdate
          };
        }));
      }
    },
    template: `
      <div>
        <div class="panel glow">
          <div class="filter-bar">
            <select class="sel" v-model="ws">
              <option value="">全部区域</option>
              <option value="w1">动力区域</option>
              <option value="w2">酿造区域</option>
              <option value="w3">包装区域</option>
            </select>
            <input class="inp" style="width:200px" v-model="kw" placeholder="搜索位号 / 名称 / 上游设备" />
            <span class="dim" style="font-size:11px">状态筛选：</span>
            <span class="chip" :class="{ on: statusOn.includes(k) }" v-for="(v, k) in statusCounts" :key="k" @click="toggleSt(k)">
              {{ stLabel(k) }} <span class="chip-n">{{ v }}</span>
            </span>
            <span style="flex:1"></span>
            <span class="chip" :class="{ on: basOn }" :title="'基线待确认或累计上升 ≥5℃ 的设备'"
                  @click="basOn = !basOn">基线待办 <span class="chip-n">{{ baselineTodo }}</span></span>
            <span class="dim" style="font-size:11px">6s 自动刷新</span>
            <button class="btn ghost" @click="pauseToggle">{{ store.autoRefresh ? "刷新中" : "已暂停" }}</button>
            <button class="btn ghost" @click="resetFilter">重置</button>
            <button class="btn" @click="exportCsv">导出 Excel</button>
          </div>

          <div style="margin-bottom:10px;color:#7fa3c9;font-size:12px">
            共 <span class="mono" style="color:#00d4ff">{{ filtered.length }}</span> 台设备
            <span class="dim">（点击行进入设备监测详情；Ts/Tc/ΔT 三列均为「30 分钟生产稳定窗口均值」，与人工学习基线比对得出「相对基准诊断」，与「现场状态」列可交叉印证。点击表头可排序）</span>
          </div>

          <div class="tbl-wrap bounded">
          <table class="tbl sticky">
            <thead>
              <tr>
                <th class="th-sort" @click="sortBy('workshop')">区域{{ sortMark('workshop') }}</th>
                <th class="th-sort" @click="sortBy('tagNo')">位号{{ sortMark('tagNo') }}</th>
                <th>名称</th>
                <th class="th-sort" @click="sortBy('type')">类型{{ sortMark('type') }}</th>
                <th class="th-sort" @click="sortBy('ts')" title="30 分钟稳定窗口蒸汽侧均值">蒸汽侧 Ts(℃){{ sortMark('ts') }}</th>
                <th class="th-sort" @click="sortBy('tc')" title="30 分钟稳定窗口冷凝水侧均值">冷凝水侧 Tc(℃){{ sortMark('tc') }}</th>
                <th class="th-sort" @click="sortBy('dt')" title="30 分钟稳定窗口进出口温差均值 / 该设备人工学习温差基准">温差 ΔT / 基准(℃){{ sortMark('dt') }}</th>
                <th class="th-sort" @click="sortBy('rank')">相对基准诊断{{ sortMark('rank') }}</th>
                <th class="th-sort" @click="sortBy('status')">现场状态{{ sortMark('status') }}</th>
                <th class="th-sort" @click="sortBy('health')">健康度{{ sortMark('health') }}</th>
                <th class="th-sort" @click="sortBy('lastUpdate')">最近更新{{ sortMark('lastUpdate') }}</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in filtered" :key="d.id" @click="goDev(d.id)">
                <td class="sub" style="white-space:nowrap">{{ d.workshopName }}</td>
                <td class="mono" style="color:#00d4ff">{{ d.tagNo }}</td>
                <td>{{ d.name }}<span class="dim" style="margin-left:6px;font-size:11px">{{ d.equip }}</span></td>
                <td><span class="st-tag" style="color:#7fa3c9;border-color:rgba(0,212,255,0.25);background:rgba(0,212,255,0.05)">{{ d.type }}</span></td>
                <td class="mono" :title="'实时瞬时值 ' + d.tsTemp.toFixed(1) + ' ℃；窗口极差 ' + rd(d).win.tsRange + ' ℃'">
                  {{ rd(d).win.tsMean }}<span class="dim" style="font-size:10px"> / {{ d.tsTemp.toFixed(0) }}</span>
                </td>
                <td class="mono" :title="'实时瞬时值 ' + d.tcTemp.toFixed(1) + ' ℃；窗口极差 ' + rd(d).win.tcRange + ' ℃'">
                  {{ rd(d).win.tcMean }}<span class="dim" style="font-size:10px"> / {{ d.tcTemp.toFixed(0) }}</span>
                </td>
                <td class="mono" :style="{ color: devColor(d) }">
                  {{ rd(d).win.dtMean }}<span class="dim" style="font-size:10px"> / {{ bi(d).dtBase }}</span>
                </td>
                <td>
                  <span class="st-tag" :class="rd(d).cls" :title="rd(d).reason"><i class="st-dot"></i>{{ rd(d).label }}</span>
                  <span class="mono" style="font-size:10px;margin-left:6px" :style="{ color: devColor(d) }">
                    {{ rd(d).applicable ? (rd(d).dtPct >= 0 ? "+" : "") + rd(d).dtPct + "%" : "—" }}
                  </span>
                  <span v-if="rd(d).isFloat && rd(d).consec" class="mono" style="font-size:10px;margin-left:4px"
                        :style="{ color: rd(d).key === 'leakSevere' ? '#ff4d5e' : rd(d).key === 'leakMild' ? '#ff9f27' : '#f0997b' }"
                        :title="'浮球式：ΔT/ΔT基准 连续命中评估次数（每 20min 一次）'">连续 {{ rd(d).consec }} 次</span>
                  <span v-if="bi(d).pending" class="st-tag st-block" style="padding:0 6px;font-size:10px;margin-left:4px" title="基线已重算，上升 ≥3℃ 待人工确认">基线待确认</span>
                  <span v-else-if="bi(d).cumRise >= bi(d).warnRise" class="st-tag st-leak" style="padding:0 6px;font-size:10px;margin-left:4px" title="基线累计上升 ≥5℃，疑似故障数据污染基线">趋势预警</span>
                </td>
                <td><span class="st-tag" :class="stCls(d.status)"><i class="st-dot"></i>{{ stLabel(d.status) }}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="hbar"><i :style="{ width: d.health + '%', background: hColor(d.health) }"></i></div>
                    <span class="mono" :style="{ color: hColor(d.health) }">{{ d.health }}</span>
                  </div>
                </td>
                <td class="dim mono">{{ d.lastUpdate }}</td>
                <td @click.stop style="white-space:nowrap">
                  <button class="btn" style="padding:3px 10px" @click="goDev(d.id)">详情</button>
                  <button class="btn ghost" style="padding:3px 10px;margin-left:6px" @click="gotBaseline(d.id, $event)">基线</button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <div v-if="!filtered.length" class="tbl-empty">
            无匹配设备，请调整筛选条件
            <div style="margin-top:10px"><button class="btn ghost" @click="resetFilter">重置筛选</button></div>
          </div>
        </div>
      </div>
    `
  });
})();
