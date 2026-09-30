/* ============================================================
   dashboard.js — 驾驶舱 · 总览大屏
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-dashboard"] = defineComponent({
    name: "Dashboard",
    data() { return { rings: null, areas: null }; },
    computed: {
      store() { return window.Store; },
      kpis() {
        const d = this.store.devices;
        const cnt = (s) => d.filter((x) => x.status === s).length;
        const online = d.length - cnt("abnormal");
        return [
          { label: "设备总数", num: d.length, color: "#00d4ff", trend: "较上周 +3", cls: "down" },
          { label: "在线率", num: Math.round(online / d.length * 100) + "%", color: "#00d4ff", trend: "↑ 0.5%", cls: "up" },
          { label: "正常", num: cnt("normal"), color: "#2ecc71", trend: "↑ 2", cls: "down" },
          { label: "泄漏", num: cnt("leak"), color: "#ff4d5e", trend: "↑ 1", cls: "up" },
          { label: "阻塞", num: cnt("block"), color: "#ff9f27", trend: "持平", cls: "" },
          { label: "停产", num: cnt("stop"), color: "#8a97a8", trend: "↑ 1", cls: "up" },
          { label: "今日新增告警", num: this.store.alarms.filter((a) => a.status !== "已关闭").length, color: "#ff4d5e", trend: "↑ 2", cls: "up" },
          { label: "基线待确认", num: this.bl.pending, color: this.bl.pending ? "#ff9f27" : "#2ecc71", trend: this.bl.warn ? "趋势预警 " + this.bl.warn + " 台" : "无趋势预警", cls: this.bl.warn ? "up" : "down", to: "/diag/strategy" }
        ];
      },
      /* 基线健康度与相对基准诊断档位（与设备台账、策略页同源） */
      bl() { window.dataVer(); return window.MOCK.baseline.summary(); },
      gradeList() { return this.bl.gradeList; },
      /* 基线累计上升 TOP5（趋势预警优先） */
      riseTop() {
        window.dataVer();
        return this.store.devices
          .map((d) => ({ d, i: window.MOCK.baseline.info(d) }))
          .filter((x) => x.i.cumRise > 0)
          .sort((a, b) => b.i.cumRise - a.i.cumRise)
          .slice(0, 5);
      },
      alarmList() { return this.store.alarms.filter((a) => a.status !== "已关闭").slice(0, 12); },
      top10() {
        return [...this.store.devices].sort((a, b) => a.health - b.health).slice(0, 10);
      }
    },
    mounted() {
      this.$nextTick(() => {
        const S = window.MOCK.STATES;
        const data = ["normal", "leak", "block", "stop", "abnormal"].map((k) => ({
          name: S[k].label, value: this.store.devices.filter((d) => d.status === k).length,
          itemStyle: { color: S[k].color }
        }));
        this.rings = window.chartUtil.make(this.$refs.ring, {
          backgroundColor: "transparent",
          tooltip: { trigger: "item" },
          legend: { bottom: 0, textStyle: { color: "#7fa3c9", fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
          series: [{
            type: "pie", radius: ["52%", "74%"], center: ["50%", "44%"],
            label: { show: true, position: "center", formatter: () => this.store.devices.length + "\n总设备",
              color: "#00d4ff", fontSize: 16, fontWeight: "bold", lineHeight: 20 },
            itemStyle: { borderColor: "#0e1d38", borderWidth: 2 },
            data
          }]
        });
        const T = window.MOCK.trend24;
        const mk = (name, arr, color) => ({
          name, type: "line", stack: "total", smooth: true, showSymbol: false,
          areaStyle: { color: color + "55", opacity: 0.5 }, lineStyle: { width: 1, color }, data: arr,
          itemStyle: { color }
        });
        this.areas = window.chartUtil.make(this.$refs.area, {
          backgroundColor: "transparent",
          tooltip: { trigger: "axis" },
          legend: { bottom: 0, textStyle: { color: "#7fa3c9", fontSize: 10 }, itemWidth: 10, itemHeight: 8 },
          grid: { left: 34, right: 10, top: 8, bottom: 34 },
          xAxis: Object.assign({ type: "category", data: T.hours, boundaryGap: false }, window.chartUtil.baseAxis()),
          yAxis: Object.assign({ type: "value" }, window.chartUtil.baseAxis()),
          series: [
            mk("正常", T.normal, "#2ecc71"), mk("泄漏", T.leak, "#ff4d5e"),
            mk("阻塞", T.block, "#ff9f27"), mk("停产", T.stop, "#8a97a8"),
            mk("数据异常", T.abnormal, "#a08cf0")
          ]
        });
      });
    },
    beforeUnmount() {
      this.rings && this.rings.dispose();
      this.areas && this.areas.dispose();
    },
    methods: {
      goDev(id) { location.hash = "#/monitor/" + id; },
      go(k) { if (k) location.hash = "#" + k; },
      gotBaseline(id) { location.hash = "#/ledger/" + id + "/baseline"; },
      stCls(s) { return window.MOCK.STATES[s].cls; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      lvName(l) { return l === 1 ? "紧急" : l === 2 ? "重要" : "一般"; },
      lvCls(l) { return "lv-" + l; },
      hColor(h) { return h >= 85 ? "#2ecc71" : h >= 60 ? "#ff9f27" : "#ff4d5e"; }
    },
    template: `
      <div>
        <div class="kpi-row">
          <div class="kpi-card" v-for="k in kpis" :key="k.label" @click="go(k.to)">
            <div class="k-num" :style="{ color: k.color }">{{ k.num }}</div>
            <div class="k-label">{{ k.label }}</div>
            <div class="k-trend" :class="k.cls">{{ k.trend }}</div>
          </div>
        </div>

        <div class="panel glow mb14">
          <div class="panel-title">各区域疏水阀矩阵图
            <span class="pt-extra dim" style="font-size:11px">点击设备圆点进入详情 · 异常设备闪烁提示</span>
          </div>
          <svg class="plant-map" viewBox="0 0 960 290">
            <rect x="20" y="34" width="300" height="240" rx="10" fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.2)" stroke-width="1"/>
            <rect x="340" y="34" width="300" height="240" rx="10" fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.2)" stroke-width="1"/>
            <rect x="660" y="34" width="290" height="240" rx="10" fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.2)" stroke-width="1"/>
            <text x="170" y="26" text-anchor="middle" fill="#7fa3c9" font-size="12">动力区域</text>
            <text x="490" y="26" text-anchor="middle" fill="#7fa3c9" font-size="12">酿造区域</text>
            <text x="805" y="26" text-anchor="middle" fill="#7fa3c9" font-size="12">包装区域</text>
            <path d="M20 60 L950 60" stroke="rgba(0,212,255,0.35)" stroke-width="2" stroke-dasharray="6 4" fill="none"/>
            <text x="470" y="54" text-anchor="middle" fill="#4d6b8f" font-size="10">蒸汽主管网 DN200 · 1.0MPa</text>
            <g v-for="d in store.devices" :key="d.id" class="dev-dot" @click="goDev(d.id)">
              <title>{{ d.tagNo }} · {{ stLabel(d.status) }} · Ts {{ d.tsTemp }}℃ / Tc {{ d.tcTemp }}℃</title>
              <circle class="core" :cx="d.mx" :cy="d.my" r="8"
                :fill="windowMOCK[d.status]" opacity="0.9"
                :class="{ blinking: d.status === 'leak' || d.status === 'abnormal' || d.status === 'block' }"/>
              <circle :cx="d.mx" :cy="d.my" r="12" fill="none" :stroke="windowMOCK[d.status]" stroke-width="0.6" opacity="0.4"/>
            </g>
          </svg>
        </div>

        <div class="grid-3">
          <div class="panel">
            <div class="panel-title">实时告警</div>
            <div class="scroll-list" style="max-height:220px">
              <div v-for="a in alarmList" :key="a.id" class="al-card" style="margin-bottom:8px">
                <div class="al-head">
                  <span class="al-lv" :class="lvCls(a.level)">{{ lvName(a.level) }}</span>
                  <span class="al-title mono">{{ a.tagNo }}</span>
                  <span class="dim" style="margin-left:auto;font-size:11px">{{ a.createdAt }}</span>
                </div>
                <div class="al-meta">{{ a.content }}</div>
              </div>
              <div v-if="!alarmList.length" class="dim" style="text-align:center;padding:40px 0">暂无待处理告警</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">状态分布 / 24h 趋势</div>
            <div ref="ring" style="width:100%;height:120px"></div>
            <div ref="area" style="width:100%;height:120px"></div>
          </div>
          <div class="panel">
            <div class="panel-title">健康度最低 TOP10</div>
            <div class="scroll-list" style="max-height:236px">
              <div v-for="(d, i) in top10" :key="d.id" @click="goDev(d.id)"
                   style="display:flex;align-items:center;gap:10px;padding:7px 4px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)">
                <span class="dim mono" style="width:18px">{{ i + 1 }}</span>
                <span class="mono" style="width:86px">{{ d.tagNo }}</span>
                <span class="sub" style="flex:1;font-size:11px">{{ d.workshopName }}</span>
                <span class="st-tag" :class="stCls(d.status)" style="padding:1px 8px">{{ stLabel(d.status) }}</span>
                <div class="hbar"><i :style="{ width: d.health + '%', background: hColor(d.health) }"></i></div>
                <span class="mono" :style="{ color: hColor(d.health), width: '26px', textAlign: 'right' }">{{ d.health }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid-2" style="margin-top:14px">
          <div class="panel">
            <div class="panel-title">基线健康度 · 人工标注学习
              <span class="pt-extra dim" style="font-size:11px">基准失效将直接污染全部诊断结论</span>
            </div>
            <div class="kpi-row" style="margin-bottom:10px">
              <div class="kpi-card" style="padding:8px 12px"><div class="k-num" style="font-size:20px;color:#2ecc71">{{ bl.ok }}</div><div class="k-label">已生效</div></div>
              <div class="kpi-card" style="padding:8px 12px"><div class="k-num" style="font-size:20px;color:#ff9f27">{{ bl.pending }}</div><div class="k-label">待人工确认</div></div>
              <div class="kpi-card" style="padding:8px 12px"><div class="k-num" style="font-size:20px;color:#ff4d5e">{{ bl.warn }}</div><div class="k-label">趋势预警（累计≥5℃）</div></div>
              <div class="kpi-card" style="padding:8px 12px"><div class="k-num" style="font-size:20px;color:#a08cf0">{{ bl.templ }}</div><div class="k-label">模板冷启动兜底</div></div>
            </div>
            <div v-if="riseTop.length" class="scroll-list" style="max-height:150px">
              <div v-for="x in riseTop" :key="x.d.id" @click="gotBaseline(x.d.id)"
                   style="display:flex;align-items:center;gap:10px;padding:6px 4px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)">
                <span class="mono" style="width:86px">{{ x.d.tagNo }}</span>
                <span class="sub" style="flex:1;font-size:11px">{{ x.d.type }} · {{ x.i.source }}</span>
                <span class="mono" :style="{ color: x.i.cumRise >= 5 ? '#ff4d5e' : '#ff9f27' }">+{{ x.i.cumRise }}℃</span>
                <span class="st-tag" :class="x.i.pending ? 'st-block' : 'st-leak'" style="padding:0 8px;font-size:10px">{{ x.i.state }}</span>
                <span class="btn ghost" style="padding:2px 8px">处理</span>
              </div>
            </div>
            <div v-else class="dim" style="text-align:center;padding:24px 0">全厂基线稳定，无待办事项</div>
          </div>

          <div class="panel">
            <div class="panel-title">相对基准诊断档位分布
              <span class="pt-extra dim" style="font-size:11px">30min 稳定窗口均值 vs 人工学习基线</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
              <div v-for="g in gradeList" :key="g.key" style="display:flex;align-items:center;gap:10px">
                <span class="st-tag" :class="g.cls" style="width:96px;justify-content:center;padding:1px 8px">{{ g.label }}</span>
                <div class="hbar" style="flex:1;width:auto">
                  <i :style="{ width: (bl.total ? g.n / bl.total * 100 : 0) + '%', background: g.color }"></i>
                </div>
                <span class="mono" :style="{ color: g.color, width: '30px', textAlign: 'right' }">{{ g.n }}</span>
              </div>
            </div>
            <div class="dim" style="font-size:11px;line-height:1.9;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">
              判据：出口均值 ≥ 基准 <b style="color:#7fd8ff">+10℃</b>（连续 3 周期）→ 泄漏报警；≥ <b style="color:#7fd8ff">+25℃</b> 或 温差 ≤ 基准 <b style="color:#7fd8ff">65%</b>（连续 2 周期）→ 严重报警；
              温差 ≥ 基准 <b style="color:#7fd8ff">25% / 35%</b> → 轻度 / 重度堵塞；停产与数据异常不参与诊断。
            </div>
          </div>
        </div>
      </div>
    `,
    created() {
      this.windowMOCK = {};
      const S = window.MOCK.STATES;
      ["normal", "leak", "block", "stop", "abnormal"].forEach((k) => { this.windowMOCK[k] = S[k].color; });
    }
  });
})();
