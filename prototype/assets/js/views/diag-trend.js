/* ============================================================
   diag-trend.js — 诊断分析 · 温差趋势对比（多设备 ΔT 叠加）
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  const PALETTE = ["#00d4ff", "#ff4d5e", "#ff9f27", "#2ecc71", "#a08cf0", "#1d9e75", "#f0997b", "#85b7eb"];

  window.VIEWS["view-diag-trend"] = defineComponent({
    name: "DiagTrend",
    data() { return { picked: [], range: "8h", chart: null }; },
    computed: {
      store() { return window.Store; },
      rangePoints() { return this.range === "2h" ? 24 : this.range === "8h" ? 96 : 288; }
    },
    mounted() {
      // 默认选中 2 台正常 + 1 泄漏 + 1 阻塞，便于对比
      const p = [];
      const normal = this.store.devices.find((d) => d.status === "normal");
      const leak = this.store.devices.find((d) => d.status === "leak");
      const block = this.store.devices.find((d) => d.status === "block");
      if (normal) p.push(normal.id);
      if (leak) p.push(leak.id);
      if (block) p.push(block.id);
      this.picked = p;
      this.render();
    },
    beforeUnmount() { this.chart && this.chart.dispose(); },
    watch: {
      picked() { this.render(); },
      range() { this.render(); },
      "store.dataVer"() { this.render(); }
    },
    methods: {
      rd(d) { window.dataVer(); return window.MOCK.baseline.diag(d); },
      toggle(id) {
        const i = this.picked.indexOf(id);
        if (i >= 0) this.picked.splice(i, 1);
        else if (this.picked.length >= 8) { window.showToast("最多同时叠加 8 台设备"); return; }
        else this.picked.push(id);
      },
      render() {
        const n = this.rangePoints;
        const series = this.picked.map((id, i) => {
          const d = this.store.devices.find((x) => x.id === id);
          const s = window.MOCK.seriesMap[id];
          const color = PALETTE[i % PALETTE.length];
          const base = window.MOCK.baseline.info(d).dtBase;
          return {
            name: d.tagNo + "（" + window.MOCK.STATES[d.status].label + "）",
            type: "line", showSymbol: false, smooth: true,
            data: s.dt.slice(-n),
            lineStyle: { color, width: 1.5 },
            itemStyle: { color },
            markLine: {
              silent: true, symbol: "none",
              data: [{
                yAxis: base, lineStyle: { color, type: "dashed", width: 1, opacity: 0.5 },
                label: { show: true, position: "insideEndTop", formatter: d.tagNo.slice(-3) + " 基准 " + base, color, fontSize: 9 }
              }]
            }
          };
        });
        const times = window.MOCK.seriesMap[this.picked[0]] ? window.MOCK.seriesMap[this.picked[0]].times.slice(-n) : [];
        const axis = window.chartUtil.baseAxis();
        const opt = {
          backgroundColor: "transparent",
          tooltip: { trigger: "axis", backgroundColor: "#11244a", borderColor: "rgba(0,212,255,0.3)", textStyle: { color: "#d8ecff", fontSize: 11 } },
          legend: { top: 0, textStyle: { color: "#7fa3c9", fontSize: 10 }, itemWidth: 12, itemHeight: 6 },
          grid: { left: 42, right: 16, top: 40, bottom: 26 },
          xAxis: Object.assign({ type: "category", data: times, boundaryGap: false,
            axisLabel: { color: "#4d6b8f", fontSize: 10, interval: Math.floor(n / 8) } }, {}),
          yAxis: Object.assign({ type: "value", name: "ΔT ℃", nameTextStyle: { color: "#4d6b8f" } }, axis),
          series
        };
        if (!this.chart) this.chart = window.chartUtil.make(this.$refs.chart, opt);
        else this.chart.setOption(opt);
      }
    },
    template: `
      <div class="grid-21">
        <div class="panel glow" style="align-self:start">
          <div class="panel-title">选择对比设备
            <span class="pt-extra dim" style="font-size:11px">已选 {{ picked.length }}/8</span>
          </div>
          <div class="scroll-list" style="max-height:480px">
            <div v-for="d in store.devices" :key="d.id" @click="toggle(d.id)"
                 style="display:flex;align-items:center;gap:8px;padding:7px 6px;cursor:pointer;border-radius:6px"
                 :style="{ background: picked.includes(d.id) ? 'rgba(0,212,255,0.08)' : 'transparent' }">
              <span style="width:14px;height:14px;border:1px solid rgba(0,212,255,0.4);border-radius:3px;
                    display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#00d4ff">
                {{ picked.includes(d.id) ? "✓" : "" }}
              </span>
              <span class="mono" style="width:84px;font-size:12px">{{ d.tagNo }}</span>
              <span class="sub" style="font-size:11px;flex:1">{{ d.workshopName }}</span>
              <span class="mono" style="font-size:10px"
                    :style="{ color: Math.abs(rd(d).dtPct) > 25 ? '#ff4d5e' : '#7fa3c9' }">{{ rd(d).dtPct >= 0 ? "+" : "" }}{{ rd(d).dtPct }}%</span>
              <span class="st-tag" :class="windowCLS[d.status]" style="padding:1px 7px;font-size:10px">{{ windowLBL[d.status] }}</span>
            </div>
          </div>
        </div>
        <div>
          <div class="panel glow">
            <div class="panel-title">ΔT 温差叠加对比
              <span class="pt-extra">
                <button class="btn ghost" v-for="r in ['2h','8h','24h']" :key="r"
                        :class="{ primary: range === r }" style="padding:3px 12px" @click="range = r">{{ r }}</button>
              </span>
            </div>
            <div ref="chart" style="width:100%;height:480px"></div>
            <div class="dim" style="font-size:11px;line-height:1.8">
              同色虚线 = 该设备经人工标注学习得到的温差基准（左列表显示其相对基准偏离百分比）。
              泄漏设备 ΔT 长期低于基准的 65%；堵塞设备 ΔT 高于基准 25%（轻度）/ 35%（重度）以上；正常设备应在基准带内随排放周期小幅波动。
            </div>
          </div>
        </div>
      </div>
    `,
    created() {
      this.windowCLS = {}; this.windowLBL = {};
      Object.keys(window.MOCK.STATES).forEach((k) => {
        this.windowCLS[k] = window.MOCK.STATES[k].cls;
        this.windowLBL[k] = window.MOCK.STATES[k].label;
      });
    }
  });
})();
