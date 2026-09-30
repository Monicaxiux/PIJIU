/* ============================================================
   diag-trend.js — 诊断分析 · 温差趋势对比（多设备 ΔT 叠加）
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  /* 曲线配色：5 类曲线各占一色（同台设备 5 色互异）；多设备叠加时按设备分组换色相，
     组内顺序固定对应：Ts / Tc / ΔT / 出口温度基线 / 温差基准；线型仍保留区分（实/实/虚/点/点） */
  const COLOR_GROUPS = [
    ["#ff5d5d", "#ff9f27", "#ffd23f", "#00d4ff", "#2ecc71"],
    ["#e06cff", "#ff7ad9", "#9fd4ff", "#7a5cff", "#4de3c0"],
    ["#ff8f5d", "#f5e960", "#8aff80", "#5db8ff", "#c9f76f"],
    ["#ff4da6", "#ffb84d", "#66e0ff", "#a0ff5d", "#8f9bff"]
  ];

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
        /* 每台设备 5 条线、5 种颜色（组内固定语义：Ts 红 / Tc 橙 / ΔT 黄 / 出口基线 青 / 温差基准 绿，多设备时换组色相），
           线型同时保留：Ts/Tc 实线（左轴）、ΔT 虚线（右轴）、两条基线点线 */
        const mk = (name, data, color, yIdx, type, width, opacity) => ({
          name, type: "line", showSymbol: false, smooth: true,
          data, yAxisIndex: yIdx,
          lineStyle: { color, width, type, opacity },
          itemStyle: { color },
          emphasis: { focus: "series" }
        });
        const series = [];
        this.picked.forEach((id, i) => {
          const d = this.store.devices.find((x) => x.id === id);
          const s = window.MOCK.seriesMap[id];
          if (!s) return;
          const info = window.MOCK.baseline.info(d);
          const g = COLOR_GROUPS[i % COLOR_GROUPS.length];
          const tag = d.tagNo + "（" + window.MOCK.STATES[d.status].label + "）";
          series.push(
            mk(tag + " 蒸汽侧Ts", s.ts.slice(-n), g[0], 0, "solid", 1.6, 0.95),
            mk(tag + " 出口Tc", s.tc.slice(-n), g[1], 0, "solid", 1.6, 0.95),
            mk(tag + " 温差ΔT", s.dt.slice(-n), g[2], 1, "dashed", 1.4, 0.9),
            mk(tag + " 出口温度基线", new Array(n).fill(info.tcBase), g[3], 0, [2, 4], 1.2, 0.75),
            mk(tag + " 温差基准", new Array(n).fill(info.dtBase), g[4], 1, [2, 4], 1.2, 0.75)
          );
        });
        const first = window.MOCK.seriesMap[this.picked[0]];
        const times = first ? first.times.slice(-n) : [];
        const axis = window.chartUtil.baseAxis();
        const opt = {
          backgroundColor: "transparent",
          tooltip: { trigger: "axis", backgroundColor: "#11244a", borderColor: "rgba(0,212,255,0.3)", textStyle: { color: "#d8ecff", fontSize: 11 } },
          legend: { top: 0, type: "scroll", textStyle: { color: "#7fa3c9", fontSize: 10 }, itemWidth: 14, itemHeight: 6, pageIconColor: "#00d4ff", pageTextStyle: { color: "#7fa3c9" } },
          grid: { left: 46, right: 50, top: 56, bottom: 26 },
          xAxis: Object.assign({ type: "category", data: times, boundaryGap: false,
            axisLabel: { color: "#4d6b8f", fontSize: 10, interval: Math.floor(n / 8) } }, {}),
          yAxis: [
            Object.assign({ type: "value", name: "温度 ℃（Ts / Tc / 出口基线）", nameTextStyle: { color: "#4d6b8f", fontSize: 10 } }, axis),
            Object.assign({ type: "value", name: "温差 ℃（ΔT / 基准）", nameTextStyle: { color: "#4d6b8f", fontSize: 10 }, splitLine: { show: false } }, axis)
          ],
          series
        };
        if (!this.chart) this.chart = window.chartUtil.make(this.$refs.chart, opt);
        else this.chart.setOption(opt, true);
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
            <div class="panel-title">温度 / 温差叠加对比（每台设备 5 条线）
              <span class="pt-extra">
                <button class="btn ghost" v-for="r in ['2h','8h','24h']" :key="r"
                        :class="{ primary: range === r }" style="padding:3px 12px" @click="range = r">{{ r }}</button>
              </span>
            </div>
            <div ref="chart" style="width:100%;height:480px"></div>
            <div class="dim" style="font-size:11px;line-height:1.8">
              每台选中设备绘制 5 条线、5 种颜色：<b style="color:#ff5d5d">红</b> = 蒸汽侧温度 Ts（左轴）、<b style="color:#ff9f27">橙</b> = 出口温度 Tc（左轴）、<b style="color:#ffd23f">黄</b> = 进出口温差 ΔT（右轴虚线）、<b style="color:#00d4ff">青</b> = 出口温度基线 Tc_base（左轴点线）、<b style="color:#2ecc71">绿</b> = 进出口温差基准 ΔT_base（右轴点线），基线由人工标注学习得到。
              多设备叠加时按设备分组换色相（第 2 台紫系、第 3 台橙绿系…），线型不变。
              泄漏设备 ΔT 长期低于基准的 65%；堵塞设备 ΔT 高于基准 25%（轻度）/ 35%（重度）以上；正常设备应在基准带内随排放周期小幅波动。点击图例可隐藏/显示对应曲线，建议同时对比 1~3 台以免曲线过密。
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
