/* ============================================================
   monitor-detail.js — 实时监测 · 设备监测详情（核心页）
   Ts/Tc/ΔT 曲线 + 判定依据 + 状态时间线 + 人工复核
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-monitor-detail"] = defineComponent({
    name: "MonitorDetail",
    data() { return { range: "8h", chart: null, showReview: false, revState: "", revReason: "", confirmStep: false }; },
    computed: {
      store() { return window.Store; },
      dev() {
        const d = this.store.devices.find((x) => x.id === this.store.route.params.id) || this.store.devices[0];
        return d;
      },
      diag() { return this.store.diagResults.find((r) => r.deviceId === this.dev.id); },
      /* 基线态势与相对基准诊断（与列表 / 诊断总览 / 驾驶舱同源） */
      bi() { window.dataVer(); return window.MOCK.baseline.info(this.dev); },
      rd() { window.dataVer(); return window.MOCK.baseline.diag(this.dev); },
      changes() {
        return this.store.stateChanges.filter((c) => c.deviceId === this.dev.id).slice(0, 6);
      },
      devAlarms() { return this.store.alarms.filter((a) => a.deviceId === this.dev.id); },
      rangePoints() { return this.range === "2h" ? 24 : this.range === "8h" ? 96 : 288; },
      /* 浮球式专属：泄漏评估序列（其他阀型返回 null） */
      fe() { window.dataVer(); return this.dev.type === "浮球式" ? window.MOCK.floatEval(this.dev) : null; }
    },
    watch: {
      range() { this.renderChart(); },
      "store.simCount"() { this.renderChart(); }
    },
    mounted() { this.renderChart(); },
    beforeUnmount() { this.chart && this.chart.dispose(); },
    methods: {
      stCls(s) { return window.MOCK.STATES[s].cls; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      /* 温差比值着色与落档（浮球式判据区间） */
      ratioColor(r) {
        const ps = this.rd.ps || {};
        const hi = ps.dtMildHigh != null ? ps.dtMildHigh : 0.75;
        const lo = ps.dtMildLow != null ? ps.dtMildLow : 0.65;
        if (r < lo) return "#ff4d5e";
        if (r < hi) return "#ff9f27";
        return "#2ecc71";
      },
      bandOf(r) {
        const ps = this.rd.ps || {};
        const hi = ps.dtMildHigh != null ? ps.dtMildHigh : 0.75;
        const lo = ps.dtMildLow != null ? ps.dtMildLow : 0.65;
        return r < lo ? "严重泄漏带" : r < hi ? "初期泄漏带" : "正常带";
      },
      renderChart() {
        const s = window.MOCK.seriesMap[this.dev.id];
        const n = this.rangePoints;
        const times = s.times.slice(-n), ts = s.ts.slice(-n), tc = s.tc.slice(-n), dt = s.dt.slice(-n);
        const axis = window.chartUtil.baseAxis();
        const bi = this.bi;
        const isF = this.rd.isFloat;                        // 浮球式：连续排放型，判据换为温差比值分档
        const mildLine = Math.round(bi.dtBase * (isF ? 0.75 : 0.65));
        const dtLo = Math.round(bi.dtBase * 0.65), dtHi = Math.round(bi.dtBase * 1.35);
        const markLabel = { color: "#7fa3c9", fontSize: 10, backgroundColor: "rgba(14,29,56,0.85)", padding: [2, 4], borderRadius: 3 };
        const mkLine = (y, txt, color) => ({
          silent: true, symbol: "none", lineStyle: { color, type: "dashed", width: 1 },
          label: { show: true, position: "insideEndTop", formatter: txt, color, fontSize: 10, backgroundColor: "rgba(14,29,56,0.85)", padding: [2, 4], borderRadius: 3 },
          data: [{ yAxis: y }]
        });
        /* 浮球式：正常带 [75%×基准, 1.35×基准]，初期泄漏带 [65%, 75%]，其下为严重泄漏带 */
        const areas = isF
          ? [[{ name: "正常带 ≥ " + mildLine + "℃（基准 75%）", yAxis: mildLine }, { yAxis: dtHi }],
             [{ name: "初期泄漏带 [" + dtLo + ", " + mildLine + "]℃（基准 65%~75%）", yAxis: dtLo }, { yAxis: mildLine }]]
          : [[{ name: "温差基准带 [" + dtLo + ", " + dtHi + "]℃（基准 " + bi.dtBase + "℃ × 0.65 ~ 1.35）", yAxis: dtLo }, { yAxis: dtHi }]];
        const dtMarks = [
          { yAxis: bi.dtBase, lineStyle: { color: "rgba(46,204,113,0.9)", type: "dashed", width: 1 },
            label: Object.assign({ formatter: "温差基准 " + bi.dtBase + "℃", position: "insideEndTop" }, markLabel) },
          { yAxis: Math.round(bi.dtBase * 0.65), lineStyle: { color: "rgba(255,77,94,0.8)", type: "dotted", width: 1 },
            label: Object.assign({ formatter: "严重泄漏线 " + Math.round(bi.dtBase * 0.65) + "℃", position: "insideEndBottom" }, markLabel) }
        ];
        if (isF) dtMarks.push({
          yAxis: mildLine, lineStyle: { color: "rgba(255,159,39,0.85)", type: "dotted", width: 1 },
          label: Object.assign({ formatter: "初期泄漏线 " + mildLine + "℃（基准 75%）", position: "insideEndTop" }, markLabel)
        });
        const opt = {
          backgroundColor: "transparent",
          tooltip: { trigger: "axis", backgroundColor: "#11244a", borderColor: "rgba(0,212,255,0.3)", textStyle: { color: "#d8ecff", fontSize: 11 } },
          legend: { top: 0, textStyle: { color: "#7fa3c9", fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
          grid: { left: 42, right: 16, top: 30, bottom: 26 },
          xAxis: Object.assign({ type: "category", data: times, boundaryGap: false,
            axisLabel: { color: "#4d6b8f", fontSize: 10, interval: Math.floor(n / 8) } }, {}),
          yAxis: Object.assign({ type: "value", name: "℃", nameTextStyle: { color: "#4d6b8f" } }, axis),
          series: [
            {
              name: "蒸汽侧 Ts", type: "line", data: ts, showSymbol: false, smooth: true,
              lineStyle: { color: "#00d4ff", width: 1.6, shadowColor: "rgba(0,212,255,0.5)", shadowBlur: 8 },
              itemStyle: { color: "#00d4ff" }
            },
            {
              name: "冷凝水侧 Tc", type: "line", data: tc, showSymbol: false, smooth: true,
              lineStyle: { color: "#1d9e75", width: 1.6, shadowColor: "rgba(29,158,117,0.5)", shadowBlur: 8 },
              itemStyle: { color: "#1d9e75" },
              markLine: mkLine(bi.tcBase, "出口基准 " + bi.tcBase + "℃", "rgba(29,158,117,0.9)")
            },
            {
              name: "温差 ΔT", type: "line", data: dt, showSymbol: false, smooth: true,
              lineStyle: { color: "#ff9f27", width: 1.2, type: "dashed" },
              itemStyle: { color: "#ff9f27" },
              markArea: {
                silent: true,
                itemStyle: { color: "rgba(46,204,113,0.07)" },
                label: { show: true, position: "insideTop", color: "rgba(46,204,113,0.7)", fontSize: 10 },
                data: areas
              },
              markLine: { silent: true, symbol: "none", data: dtMarks }
            }
          ]
        };
        if (!this.chart) this.chart = window.chartUtil.make(this.$refs.main, opt);
        else this.chart.setOption(opt);
      },
      openReview() {
        this.revState = ""; this.revReason = ""; this.confirmStep = false; this.showReview = true;
      },
      doReview() {
        if (!this.revState) { window.showToast("请选择改判后的状态"); return; }
        if (!this.revReason.trim()) { window.showToast("请填写复核理由"); return; }
        if (!this.confirmStep) { this.confirmStep = true; return; }
        const oldStatus = this.dev.status;
        this.dev.status = this.revState;
        if (this.diag) {
          diagApply(this.diag, this.revState, this.revReason);
        }
        this.store.stateChanges.unshift({
          id: "SC" + Date.now(), deviceId: this.dev.id, tagNo: this.dev.tagNo, deviceName: this.dev.name,
          from: oldStatus,
          to: this.revState, trigger: "人工复核", confidence: 100,
          time: this.dev.lastUpdate, rule: "人工复核改判：" + this.revReason, pending: false
        });
        this.showReview = false;
        window.showToast("人工复核完成，改判记录已留痕");
      },
      lvName(l) { return l === 1 ? "紧急" : l === 2 ? "重要" : "一般"; },
      lvCls(l) { return "lv-" + l; },
      gotBaseline() { location.hash = "#/ledger/" + this.dev.id + "/baseline"; },
      exportData() { window.showToast("历史数据导出为原型占位功能"); }
    },
    template: `
      <div>
        <div class="panel glow mb14" style="display:flex;align-items:center;gap:16px">
          <div>
            <span class="mono" style="font-size:17px;color:#00d4ff;font-weight:bold">{{ dev.tagNo }}</span>
            <span style="font-size:15px;margin-left:10px">{{ dev.name }}</span>
            <span class="st-tag" :class="stCls(dev.status)" style="margin-left:12px"><i class="st-dot"></i>{{ stLabel(dev.status) }}</span>
            <span v-if="diag && diag.manual" class="st-tag st-abnormal" style="margin-left:8px">已人工复核</span>
          </div>
          <div class="dim" style="font-size:12px">{{ dev.workshopName }} · {{ dev.pipePos }}</div>
          <span style="flex:1"></span>
          <div class="big-num" style="color:#00d4ff">{{ dev.health }}</div>
          <div class="dim" style="font-size:11px">健康度</div>
          <button class="btn" @click="exportData">导出数据</button>
          <button class="btn primary" @click="openReview">人工复核改判</button>
        </div>

        <div class="grid-21">
          <div>
            <div class="panel mb14">
              <div class="panel-title">基础信息</div>
              <table class="tbl"><tbody>
                <tr><td class="dim">型号 / 类型</td><td>{{ dev.model }} · {{ dev.type }}</td></tr>
                <tr><td class="dim">口径 / 蒸汽压力</td><td>{{ dev.caliber }} · {{ dev.steamPressure }} MPa</td></tr>
                <tr><td class="dim">上游用汽设备</td><td>{{ dev.equip }}</td></tr>
                <tr><td class="dim">投运日期</td><td class="mono">{{ dev.installDate }}</td></tr>
                <tr><td class="dim">传感器绑定</td><td>蒸汽侧 + 冷凝水侧 · <span style="color:#2ecc71">{{ dev.sensorCheck }}</span></td></tr>
                <tr><td class="dim">采集周期</td><td class="mono">60s</td></tr>
              </tbody></table>
            </div>

            <div class="panel mb14">
              <div class="panel-title">相对基准诊断结论
                <span class="pt-extra"><span class="st-tag" :class="rd.cls">{{ rd.label }}</span></span>
              </div>
              <div class="dim" style="font-size:11px;margin-bottom:8px">
                诊断口径：{{ rd.win.spanMin }} 分钟稳定生产窗口均值（进口极差 {{ rd.win.tsRange }}℃ / 出口极差 {{ rd.win.tcRange }}℃，两者需均 &lt; 5℃）
              </div>
              <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
                <div><div class="dim" style="font-size:11px">温差窗口均值</div>
                  <div class="big-num" :style="{ color: rd.applicable ? '#ff9f27' : '#8a97a8' }">{{ rd.win.dtMean }}℃</div>
                  <div class="dim" style="font-size:10px">基准 {{ bi.dtBase }}℃ · 偏离 {{ rd.dtPct >= 0 ? "+" : "" }}{{ rd.dtPct }}%</div></div>
                <div><div class="dim" style="font-size:11px">出口温度窗口均值</div>
                  <div class="big-num" style="color:#1d9e75">{{ rd.win.tcMean }}℃</div>
                  <div class="dim" style="font-size:10px">基准 {{ bi.tcBase }}℃ · 偏离 {{ rd.tcRise >= 0 ? "+" : "" }}{{ rd.tcRise }}℃</div></div>
                <div><div class="dim" style="font-size:11px">波动幅度 Ac</div><div class="big-num" style="color:#00d4ff">{{ dev.waveAmp }}℃</div></div>
                <div><div class="dim" style="font-size:11px">置信度</div>
                  <div class="big-num" :style="{ color: diag && diag.confidence < 70 ? '#ff9f27' : '#2ecc71' }">{{ diag ? diag.confidence : "-" }}%</div></div>
              </div>
              <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:8px;padding:10px;font-size:12px;line-height:1.8">
                {{ rd.reason }}
              </div>
            </div>

            <!-- 浮球式专属：泄漏评估序列（每 20min 一次评估 + 连续次数统计） -->
            <div class="panel mb14" v-if="fe">
              <div class="panel-title">浮球式泄漏评估序列
                <span class="pt-extra dim" style="font-size:11px">
                  每 {{ fe.periodMin }}min 评估一次 · 每次取最近 {{ fe.dataMin }}min 的 ΔT 均值 · 命中 +1 / 未命中清零
                </span>
              </div>
              <div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">
                <div style="min-width:210px">
                  <div class="dim" style="font-size:11px">初期泄漏 · 连续次数（需 ≥ {{ fe.needMild }} 次）</div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                    <div class="hbar"><i :style="{ width: Math.min(100, fe.consecMild / fe.needMild * 100) + '%',
                          background: fe.consecMild >= fe.needMild ? '#ff9f27' : 'rgba(255,159,39,0.55)' }"></i></div>
                    <span class="mono" :style="{ color: fe.consecMild >= fe.needMild ? '#ff9f27' : '#7fa3c9' }">{{ fe.consecMild }}/{{ fe.needMild }}</span>
                  </div>
                  <div class="dim" style="font-size:10px;margin-top:2px">判据：ΔT / ΔT<sub>base</sub> ∈ ({{ Math.round(fe.mildLow * 100) }}%, {{ Math.round(fe.mildHigh * 100) }}%)</div>
                </div>
                <div style="min-width:210px">
                  <div class="dim" style="font-size:11px">严重泄漏 · 连续次数（需 ≥ {{ fe.needSevere }} 次）</div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                    <div class="hbar"><i :style="{ width: Math.min(100, fe.consecSevere / fe.needSevere * 100) + '%',
                          background: fe.consecSevere >= fe.needSevere ? '#ff4d5e' : 'rgba(255,77,94,0.55)' }"></i></div>
                    <span class="mono" :style="{ color: fe.consecSevere >= fe.needSevere ? '#ff4d5e' : '#7fa3c9' }">{{ fe.consecSevere }}/{{ fe.needSevere }}</span>
                  </div>
                  <div class="dim" style="font-size:10px;margin-top:2px">判据：ΔT / ΔT<sub>base</sub> &lt; {{ Math.round(fe.severeRatio * 100) }}%</div>
                </div>
                <div style="min-width:180px">
                  <div class="dim" style="font-size:11px">最近一次评估（{{ fe.last.time }}）</div>
                  <div class="big-num" :style="{ color: ratioColor(fe.last.ratio) }">
                    {{ Math.round(fe.last.ratio * 100) }}<span style="font-size:12px">%</span>
                  </div>
                  <div class="dim" style="font-size:10px">ΔT {{ fe.last.dtMean }}℃ / 基准 {{ fe.base }}℃</div>
                </div>
              </div>
              <table class="tbl" style="margin-bottom:8px">
                <thead><tr><th>评估时刻</th><th>ΔT 均值 (℃)</th><th>ΔT<sub>base</sub> (℃)</th><th>比值</th><th>落档</th><th>本次判定</th></tr></thead>
                <tbody>
                  <tr v-for="(e, i) in fe.list.slice(0, 8)" :key="e.end" :style="{ background: i === 0 ? 'rgba(0,212,255,0.05)' : 'transparent' }">
                    <td class="dim mono">{{ e.time }}{{ i === 0 ? "（最近）" : "" }}</td>
                    <td class="mono">{{ e.dtMean }}</td>
                    <td class="mono dim">{{ fe.base }}</td>
                    <td class="mono" :style="{ color: ratioColor(e.ratio) }">{{ Math.round(e.ratio * 100) }}%</td>
                    <td class="sub" style="font-size:11px">{{ bandOf(e.ratio) }}</td>
                    <td>
                      <span v-if="e.ratio < fe.severeRatio" style="color:#ff4d5e;font-size:11px">命中严重判据</span>
                      <span v-else-if="e.ratio < fe.mildHigh" style="color:#ff9f27;font-size:11px">命中初期判据</span>
                      <span v-else class="dim" style="font-size:11px">未命中（正常带）</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="dim" style="font-size:11px;line-height:1.8">
                共 {{ fe.points }} 个评估点（覆盖最近约 {{ Math.round(fe.points * fe.periodMin / 60) }} 小时）。
                浮球式为连续排放型，无"生产稳定 · 非排水时间"窗口，出口温度基准本身偏高，故泄漏判定不采用出口温升，
                而以<b style="color:#7fd8ff">进出口温差相对温差基准的比值</b>单判据分档：比值落入 {{ Math.round(fe.mildLow * 100) }}%~{{ Math.round(fe.mildHigh * 100) }}% 连续 {{ fe.needMild }} 次为<b style="color:#ff9f27">泄漏报警</b>；
                低于 {{ Math.round(fe.severeRatio * 100) }}% 连续 {{ fe.needSevere }} 次为<b style="color:#ff4d5e">严重泄漏报警</b>。当前判定：<b>{{ fe.verdict }}</b>。
              </div>
            </div>

            <div class="panel mb14">
              <div class="panel-title">基线（人工标注学习）态势
                <span class="pt-extra">
                  <span class="st-tag" :class="bi.pending ? 'st-block' : (bi.cumRise >= 5 ? 'st-leak' : 'st-normal')" style="padding:1px 10px">
                    <i class="st-dot"></i>{{ bi.state }}
                  </span>
                  <button class="btn" style="padding:3px 10px" @click="gotBaseline">基线标注与学习</button>
                </span>
              </div>
              <table class="tbl"><tbody>
                <tr><td class="dim">出口温度基准</td><td class="mono">{{ bi.tcBase }} ℃</td>
                    <td class="dim">温差基准</td><td class="mono">{{ bi.dtBase }} ℃</td></tr>
                <tr><td class="dim">基线来源</td><td colspan="3">{{ bi.source }} · {{ bi.sampleCnt }} 点 · 学习于 {{ bi.learnedAt }}</td></tr>
                <tr><td class="dim">下次自动重算</td><td class="mono">{{ bi.nextAuto }}</td>
                    <td class="dim">累计上升</td>
                    <td class="mono" :style="{ color: bi.cumRise >= 5 ? '#ff4d5e' : bi.cumRise >= 3 ? '#ff9f27' : '#2ecc71' }">{{ bi.cumRise }} ℃</td></tr>
                <tr><td class="dim">已标注区间</td><td class="mono">{{ bi.annotCnt }} 段</td>
                    <td class="dim">判据适用性</td>
                    <td><span v-if="!rd.applicable" style="color:#8a97a8">不适用（{{ rd.reason }}）</span>
                        <span v-else-if="rd.isFloat" style="color:#ff9f27">温差比值单判据（浮球式为连续排放型，不适用出口温升判据）</span>
                        <span v-else style="color:#2ecc71">出口温升 + 温差缩水 双判据均适用</span></td></tr>
              </tbody></table>
            </div>

            <div class="panel">
              <div class="panel-title">状态变更时间线</div>
              <div class="tl">
                <div class="tl-item" v-for="c in changes" :key="c.id">
                  <div class="tl-time">{{ c.time }} · {{ c.trigger }} · 置信度 {{ c.confidence }}%</div>
                  <div class="tl-desc">
                    {{ stLabel(c.from) }} → <span :style="{ color: '#00d4ff' }">{{ stLabel(c.to) }}</span>
                    <span v-if="c.trigger === '人工复核'" style="color:#a08cf0;font-size:11px">（复核留痕）</span>
                  </div>
                </div>
                <div v-if="!changes.length" class="dim" style="padding:6px 0">评估期内无状态切换</div>
              </div>
            </div>
          </div>

          <div>
            <div class="panel mb14">
              <div class="panel-title">温度实时趋势
                <span class="pt-extra">
                  <button class="btn ghost" v-for="r in ['2h','8h','24h']" :key="r"
                          :class="{ primary: range === r }" style="padding:3px 12px" @click="range = r">{{ r }}</button>
                </span>
              </div>
              <div ref="main" style="width:100%;height:400px"></div>
              <div class="dim" style="font-size:11px;margin-top:4px;line-height:1.8">
                <template v-if="rd.isFloat">
                  阴影带 = 正常带（基准 × 0.75 ~ × 1.35）与初期泄漏带（基准 × 0.65 ~ × 0.75）；绿色虚线 = 温差基准，
                  橙色点线 = 初期泄漏线（基准 75%），红色点线 = 严重泄漏线（基准 65%）；冷凝水侧绿色虚线 = 出口温度基准。
                  浮球式为连续排放型，判据<b style="color:#7fd8ff">仅取进出口温差 ΔT 相对温差基准的比值</b>：
                  比值落入 65%~75% <b style="color:#ff9f27">连续 3 次</b>为泄漏报警；低于 65% <b style="color:#ff4d5e">连续 2 次</b>为严重泄漏报警。
                </template>
                <template v-else>
                  阴影带 = 温差基准带（基准 × 0.65 ~ × 1.35）；绿色虚线 = 温差基准，红色点线 = 严重泄漏线；
                  冷凝水侧绿色虚线 = 出口温度基准。判据：出口均值 ≥ 基准 +10℃（连续 3 周期）为泄漏报警，
                  ≥ +25℃ 或温差 ≤ 基准 65%（连续 2 周期）为严重报警；温差 ≥ 基准 25% / 35% 为轻度 / 重度堵塞。
                </template>
              </div>
            </div>

            <div class="panel">
              <div class="panel-title">关联告警记录</div>
              <table class="tbl">
                <thead><tr><th>级别</th><th>内容</th><th>时间</th><th>状态</th><th>处理人</th></tr></thead>
                <tbody>
                  <tr v-for="a in devAlarms" :key="a.id" style="cursor:default">
                    <td><span class="al-lv" :class="lvCls(a.level)">{{ lvName(a.level) }}</span></td>
                    <td class="sub">{{ a.content }}</td>
                    <td class="dim mono">{{ a.createdAt }}</td>
                    <td>
                      <span class="st-tag" :class="a.status === '已关闭' ? 'st-stop' : a.status === '处理中' ? 'st-block' : 'st-leak'">
                        <i class="st-dot"></i>{{ a.status }}
                      </span>
                    </td>
                    <td class="sub">{{ a.handler || "-" }}</td>
                  </tr>
                  <tr v-if="!devAlarms.length"><td colspan="5" class="dim" style="text-align:center;padding:16px">该设备暂无告警记录</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 人工复核弹窗 -->
        <div class="modal-mask" v-if="showReview" @click.self="showReview = false">
          <div class="modal">
            <h3>人工复核改判 — {{ dev.tagNo }}</h3>
            <div class="m-row">
              <label>当前自动判定：{{ stLabel(dev.status) }}（置信度 {{ diag ? diag.confidence : "-" }}%）</label>
              <label>改判为：</label>
              <select v-model="revState">
                <option value="">请选择状态</option>
                <option v-for="(v, k) in windowSTATES" :key="k" :value="k">{{ v }}</option>
              </select>
            </div>
            <div class="m-row">
              <label>复核理由（必填，将随记录留痕）：</label>
              <textarea rows="3" v-model="revReason" placeholder="例：现场听诊确认持续漏汽，与自动判定一致，予以确认"></textarea>
            </div>
            <div class="m-foot">
              <button class="btn ghost" @click="showReview = false">取消</button>
              <button class="btn primary" @click="doReview">{{ confirmStep ? "再次确认提交" : "提交改判" }}</button>
            </div>
          </div>
        </div>
      </div>
    `,
    created() {
      this.windowSTATES = {};
      Object.keys(window.MOCK.STATES).forEach((k) => { this.windowSTATES[k] = window.MOCK.STATES[k].label; });
    }
  });

  function diagApply(diag, state, reason) {
    diag.manual = true;
    diag.reviewer = "陈工";
    diag.state = state;
    diag.reason = reason;
    diag.rule = "人工复核改判 → " + window.MOCK.STATES[state].label + "；理由：" + reason;
    diag.confidence = 100;
  }
})();
