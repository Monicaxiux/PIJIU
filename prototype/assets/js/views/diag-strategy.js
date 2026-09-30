/* ============================================================
   diag-strategy.js — 诊断分析 · 泄漏诊断策略配置
   倒立桶 / 热力型泄漏策略查看与参数维护 + 基线管理策略
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-diag-strategy"] = defineComponent({
    name: "DiagStrategy",
    data() {
      return {
        type: "倒立桶",
        ps: {},                 // 当前类型参数（可编辑副本）
        dirty: false
      };
    },
    computed: {
      store() { return window.Store; },
      strategy() { return window.MOCK.leakStrategy; },
      statsByType() {
        const c = {};
        this.store.devices.forEach((d) => { c[d.type] = (c[d.type] || 0) + 1; });
        return c;
      },
      /* 全厂基线健康度 + 待人工确认台账 */
      bl() { window.dataVer(); return window.MOCK.baseline.summary(); },
      gradeList() { return this.bl.gradeList; },
      /* 浮球式泄漏评估明细（与详情页/列表页同源，取最近一次评估结果） */
      floatRows() {
        window.dataVer();
        return this.store.devices
          .filter((d) => d.type === "浮球式")
          .map((d) => ({ d, fe: window.MOCK.floatEval(d), rd: window.MOCK.baseline.diag(d) }))
          .sort((a, b) => a.fe.last.ratio - b.fe.last.ratio);
      },
      floatSegs() { const r = this.floatRows; return r.length ? r[0].fe.points : 0; }
    },
    methods: {
      load(t) {
        this.type = t;
        this.ps = JSON.parse(JSON.stringify(window.MOCK.leakStrategy.types[t]));
        this.dirty = false;
      },
      save() {
        window.MOCK.leakStrategy.types[this.type] = JSON.parse(JSON.stringify(this.ps));
        window.Store.bump();
        this.dirty = false;
        window.showToast("【" + this.type + "】诊断策略已保存并下发采集终端（原型演示）");
      },
      reset() { this.load(this.type); window.showToast("已恢复为当前生效参数"); },
      info(d) { return window.MOCK.baseline.info(d); },
      stCls(s) { return window.MOCK.STATES[s].cls; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      /* 温差比值着色：<65% 严重 / 65%~75% 初期 / ≥75% 正常 */
      ratioColor(r) {
        const ps = this.ps;
        const high = ps.dtMildHigh != null ? ps.dtMildHigh : 0.75;
        const low = ps.dtMildLow != null ? ps.dtMildLow : 0.65;
        if (r < low) return "#ff4d5e";
        if (r < high) return "#ff9f27";
        return "#2ecc71";
      },
      gotBaseline(id) { location.hash = "#/ledger/" + id + "/baseline"; }
    },
    created() {
      /* 支持深链直达指定阀型页签：#/diag/strategy/<阀型> */
      const p = window.Store.route.params;
      const t = p && p.type && window.MOCK.leakStrategy.types[p.type] ? p.type : "倒立桶";
      this.load(t);
    },
    template: `
      <div>
        <div class="kpi-row mb14">
          <div class="kpi-card"><div class="k-num" style="color:#00d4ff">3</div><div class="k-label">泄漏策略适用阀型（倒立桶 / 热力型 / 浮球式）</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#7fd8ff">20<small> min</small></div><div class="k-label">监测周期 / 取 30min 窗口</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#2ecc71">200<small> 点</small></div><div class="k-label">基线学习采样点</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#a08cf0">15<small> 天</small></div><div class="k-label">基线自动重算周期</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#ff9f27">{{ bl.pending }}</div><div class="k-label">基线待人工确认</div></div>
          <div class="kpi-card"><div class="k-num" :style="{ color: bl.warn ? '#ff4d5e' : '#2ecc71' }">{{ bl.warn }}</div><div class="k-label">基线趋势预警</div></div>
        </div>

        <!-- 阀型切换 -->
        <div class="panel glow" style="margin-bottom:14px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="chip" :class="{ on: type === '倒立桶' }" @click="load('倒立桶')">倒立桶（{{ statsByType['倒立桶'] || 0 }} 台）· 间歇排放</span>
            <span class="chip" :class="{ on: type === '热力型' }" @click="load('热力型')">热力型（{{ statsByType['热力型'] || 0 }} 台）· 间歇排放</span>
            <span class="chip" :class="{ on: type === '浮球式' }" @click="load('浮球式')"
                  title="连续排放型：无稳定非排水窗口，泄漏判据改用「进出口温差相对温差基准的比值」分档评估">浮球式（{{ statsByType['浮球式'] || 0 }} 台）· 连续排放</span>
            <span class="dim" style="font-size:11px;margin-left:6px">{{ strategy.sensor }}</span>
          </div>
        </div>

        <!-- 泄漏判定逻辑：间歇排放型（倒立桶 / 热力型）—— 原有逻辑保持不变 -->
        <div class="panel glow mb14" v-if="type !== '浮球式'">
          <div class="panel-title">泄漏判定逻辑 · {{ type }}（生产稳定模式下周期评估）</div>
          <div style="display:flex;align-items:stretch;gap:0;margin-bottom:14px;flex-wrap:wrap">
            <div style="flex:1;min-width:150px;border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px">① 周期评估</div>
              <div class="dim" style="font-size:11px;margin-top:4px">每 <b style="color:#00d4ff">{{ ps.periodMin }}min</b> 监测一次<br>取最近 <b style="color:#00d4ff">{{ ps.dataMin }}min</b> 时序数据</div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:150px;border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px">② 稳定窗口判定</div>
              <div class="dim" style="font-size:11px;margin-top:4px">进口极差 &lt; <b style="color:#00d4ff">{{ ps.rangeSteam }}℃</b><br>且出口极差 &lt; <b style="color:#00d4ff">{{ ps.rangeCond }}℃</b></div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:150px;border:1px solid rgba(255,159,39,0.4);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px;color:#ff9f27">③ 泄漏报警（轻度）</div>
              <div class="dim" style="font-size:11px;margin-top:4px">出口温度 &gt; 出口基准 +<b style="color:#ff9f27">{{ ps.mildTcRise }}℃</b><br>连续 <b style="color:#ff9f27">{{ ps.mildConsecutive }}</b> 次</div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:170px;border:1px solid rgba(255,77,94,0.45);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px;color:#ff4d5e">④ 严重报警</div>
              <div class="dim" style="font-size:11px;margin-top:4px">出口均值 &gt; 基准 +<b style="color:#ff4d5e">{{ ps.severeTcRise }}℃</b><br>或 温差均值 &lt; 基准 × <b style="color:#ff4d5e">{{ Math.round(ps.severeDtRatio * 100) }}%</b>，连续 <b style="color:#ff4d5e">{{ ps.severeConsecutive }}</b> 次</div>
            </div>
          </div>
          <div class="dim" style="font-size:11px;line-height:1.9">
            · 判定对象为<b style="color:#7fd8ff">出口（冷凝水侧）温度</b>与<b style="color:#7fd8ff">进出口温差</b>两个特征：泄漏时蒸汽窜入冷凝水侧 → 出口温度异常升高、温差缩小，两条证据链互相印证；<br>
            · 极差 &lt; {{ ps.rangeSteam }}℃ 的稳定窗口用于排除排水脉冲期（间歇排放型排水时出口温度瞬时下降，非排水期出口温度平稳且处于低位——这正是间歇型可用"非排水期"做基线的原因）；<br>
            · 连续次数计数采用"异常 +1 / 正常清零"机制，未达连续次数前只计入观察序列，不告警。
          </div>
        </div>

        <!-- 泄漏判定逻辑：浮球式（连续排放型 · 温差比值单判据） -->
        <div class="panel glow mb14" v-else>
          <div class="panel-title">泄漏判定逻辑 · 浮球式（连续排放型 · 温差比值单判据）
            <span class="pt-extra st-tag st-block" style="padding:1px 10px;font-size:11px">判据依据：进出口温差相对温差基准的比值</span>
          </div>
          <div style="display:flex;align-items:stretch;gap:0;margin-bottom:14px;flex-wrap:wrap">
            <div style="flex:1;min-width:150px;border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px">① 周期评估</div>
              <div class="dim" style="font-size:11px;margin-top:4px">每 <b style="color:#00d4ff">{{ ps.periodMin }}min</b> 监测一次<br>取最近 <b style="color:#00d4ff">{{ ps.dataMin }}min</b> 的 ΔT 均值</div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:150px;border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px">② 温差基准线</div>
              <div class="dim" style="font-size:11px;margin-top:4px">ΔT<sub>base</sub> 由人工标注<br>「连续排放 · 生产稳定段」学习得到<br>计算比值 = ΔT / ΔT<sub>base</sub></div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:170px;border:1px solid rgba(255,159,39,0.4);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px;color:#ff9f27">③ 泄漏报警（初期）</div>
              <div class="dim" style="font-size:11px;margin-top:4px">比值 <b style="color:#ff9f27">&lt; {{ Math.round(ps.dtMildHigh * 100) }}%</b> 且 <b style="color:#ff9f27">&gt; {{ Math.round(ps.dtMildLow * 100) }}%</b><br>连续 <b style="color:#ff9f27">{{ ps.mildConsecutive }}</b> 次</div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:170px;border:1px solid rgba(255,77,94,0.45);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px;color:#ff4d5e">④ 严重报警</div>
              <div class="dim" style="font-size:11px;margin-top:4px">比值 <b style="color:#ff4d5e">&lt; {{ Math.round(ps.severeDtRatio * 100) }}%</b><br>连续 <b style="color:#ff4d5e">{{ ps.severeConsecutive }}</b> 次</div>
            </div>
          </div>
          <div class="dim" style="font-size:11px;line-height:1.9">
            · 浮球式为<b style="color:#7fd8ff">连续排放型</b>：排水口始终有冷凝水流出，出口温度不具备"非排水期低位平稳"特征，出口温度基准本身偏高，因此<b style="color:#ff9f27">不使用「出口温升」判据</b>，改用<b style="color:#7fd8ff">进出口温差 ΔT 相对温差基准的比值</b>单判据分档；<br>
            · 漏汽时高温蒸汽经排水口窜入冷凝水侧，ΔT 被压缩（出口温度抬升、与进口温度趋同），比值随劣化程度单调下降 → 天然适合做分档阈值；<br>
            · <b style="color:#2ecc71">{{ Math.round(ps.dtMildHigh * 100) }}% 以上</b>判正常；<b style="color:#ff9f27">{{ Math.round(ps.dtMildLow * 100) }}% ~ {{ Math.round(ps.dtMildHigh * 100) }}%</b> 为初期泄漏带（连续 {{ ps.mildConsecutive }} 次报警）；<b style="color:#ff4d5e">{{ Math.round(ps.severeDtRatio * 100) }}% 以下</b>为严重泄漏带（连续 {{ ps.severeConsecutive }} 次报警）；<br>
            · 连续次数按"命中 +1 / 未命中清零"统计，未达次数前仅在设备详情与本页明细中列出<b style="color:#f0997b">观察序列</b>，不产生告警；<br>
            · 阈值边界取「左闭右开」：比值恰为 {{ Math.round(ps.severeDtRatio * 100) }}% 计入初期泄漏带，恰为 {{ Math.round(ps.dtMildHigh * 100) }}% 计入正常带。
          </div>
          <div style="border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:10px 14px;margin-top:12px;background:rgba(0,212,255,0.04)">
            <span style="color:#00d4ff;font-weight:bold;font-size:12px">与间歇排放型（倒立桶 / 热力型）的差异</span>
            <table class="tbl" style="margin-top:8px">
              <thead><tr><th>对比项</th><th>倒立桶 / 热力型（间歇排放）</th><th>浮球式（连续排放）</th></tr></thead>
              <tbody>
                <tr><td>稳定窗口</td><td class="sub">进出口极差均 &lt; 5℃ 的"非排水时间"窗口</td><td class="sub">连续排放，无稳定非排水窗口 → 取 <b>30min 稳定段 ΔT 均值</b></td></tr>
                <tr><td>判据特征</td><td class="sub">出口温升 与 温差缩水 双证据链</td><td class="sub"><b style="color:#7fd8ff">仅温差比值</b>单判据（出口温度基准本身偏高，不作为判据）</td></tr>
                <tr><td>初期报警</td><td class="sub">出口 &gt; 基准 +{{ ps.mildTcRise || 10 }}℃，连续 {{ ps.mildConsecutive || 3 }} 次</td><td class="sub">ΔT 比值 &lt; {{ Math.round(ps.dtMildHigh * 100) }}% 且 &gt; {{ Math.round(ps.dtMildLow * 100) }}%，连续 {{ ps.mildConsecutive }} 次</td></tr>
                <tr><td>严重报警</td><td class="sub">出口 &gt; 基准 +{{ ps.severeTcRise || 25 }}℃ 或 ΔT &lt; 基准 × {{ Math.round((ps.severeDtRatio || 0.65) * 100) }}%，连续 2 次</td><td class="sub">ΔT 比值 &lt; {{ Math.round(ps.severeDtRatio * 100) }}%，连续 {{ ps.severeConsecutive }} 次</td></tr>
                <tr><td>堵塞判据</td><td class="sub" colspan="2">一致：ΔT &gt; 基准 × 1.25（轻度）/ × 1.35（重度）</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 浮球式泄漏评估台账：按最近一次评估结果排序 -->
        <div class="panel glow mb14" v-if="type === '浮球式'">
          <div class="panel-title">浮球式泄漏评估明细
            <span class="pt-extra dim" style="font-size:11px">
              每 {{ ps.periodMin }}min 一次评估 · 共 {{ floatSegs }} 个评估点 · 按 ΔT/ΔT<sub>base</sub> 比值升序（劣化最重在前）
            </span>
          </div>
          <div class="tbl-wrap bounded">
          <table class="tbl sticky">
            <thead><tr>
              <th>位号</th><th>区域</th><th>上游设备</th><th>现场状态</th>
              <th>ΔT 窗口均值(℃)</th><th>温差基准 ΔT<sub>base</sub>(℃)</th><th>比值</th>
              <th title="命中期数 / 所需期数">连续次数<br><span style="font-weight:normal">初期 · 严重</span></th>
              <th>相对基准结论</th><th>操作</th>
            </tr></thead>
            <tbody>
              <tr v-for="x in floatRows" :key="x.d.id" style="cursor:default">
                <td class="mono" style="color:#00d4ff">{{ x.d.tagNo }}</td>
                <td class="sub">{{ x.d.workshopName }}</td>
                <td class="sub" style="font-size:11px">{{ x.d.equip }}</td>
                <td><span class="st-tag" :class="stCls(x.d.status)"><i class="st-dot"></i>{{ stLabel(x.d.status) }}</span></td>
                <td class="mono">{{ x.fe.last.dtMean }}</td>
                <td class="mono dim">{{ x.fe.base }}</td>
                <td class="mono" :style="{ color: ratioColor(x.fe.last.ratio) }">
                  {{ Math.round(x.fe.last.ratio * 100) }}%
                  <span class="dim" style="font-size:10px">（{{ x.fe.last.ratio < x.fe.severeRatio ? "≪ 65%" : x.fe.last.ratio < x.fe.mildHigh ? "65%~75%" : "≥ 75%" }}）</span>
                </td>
                <td>
                  <span class="mono" :style="{ color: x.fe.consecMild >= x.fe.needMild ? '#ff9f27' : '#7fa3c9' }">{{ x.fe.consecMild }}/{{ x.fe.needMild }}</span>
                  <span class="dim"> · </span>
                  <span class="mono" :style="{ color: x.fe.consecSevere >= x.fe.needSevere ? '#ff4d5e' : '#7fa3c9' }">{{ x.fe.consecSevere }}/{{ x.fe.needSevere }}</span>
                </td>
                <td>
                  <span class="st-tag" :class="x.rd.cls" :title="x.rd.reason"><i class="st-dot"></i>{{ x.rd.label }}</span>
                  <span v-if="x.rd.watch" class="st-tag" style="color:#f0997b;border-color:rgba(240,153,123,0.45);background:rgba(240,153,123,0.08);padding:0 6px;font-size:10px;margin-left:4px">观察中</span>
                </td>
                <td style="white-space:nowrap">
                  <button class="btn ghost" style="padding:3px 10px" @click="gotBaseline(x.d.id)">基线标注</button>
                </td>
              </tr>
              <tr v-if="!floatRows.length">
                <td colspan="10" class="tbl-empty">暂无浮球式设备</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        <!-- 堵塞判定逻辑 -->
        <div class="panel glow mb14">
          <div class="panel-title">堵塞判定逻辑（全阀型适用 · 相对温差基准）</div>
          <div style="display:flex;align-items:stretch;gap:0;margin-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:180px;border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px">① 温差窗口均值</div>
              <div class="dim" style="font-size:11px;margin-top:4px">取 {{ ps.dataMin }}min 稳定窗口 ΔT 均值<br>与温差基准 ΔT<sub>base</sub> 比对</div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:180px;border:1px solid rgba(255,159,39,0.4);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px;color:#ff9f27">② 轻度堵塞</div>
              <div class="dim" style="font-size:11px;margin-top:4px">ΔT &gt; ΔT<sub>base</sub> × <b style="color:#ff9f27">{{ ps.blockMildRatio }}</b>（+{{ Math.round((ps.blockMildRatio - 1) * 100) }}%）<br>且 ≤ × {{ ps.blockHeavyRatio }}（早期劣化）</div>
            </div>
            <div style="align-self:center;color:#00d4ff;padding:0 6px">→</div>
            <div style="flex:1;min-width:180px;border:1px solid rgba(255,77,94,0.45);border-radius:8px;padding:10px;text-align:center">
              <div style="font-weight:bold;font-size:13px;color:#ff4d5e">③ 重度堵塞</div>
              <div class="dim" style="font-size:11px;margin-top:4px">ΔT &gt; ΔT<sub>base</sub> × <b style="color:#ff4d5e">{{ ps.blockHeavyRatio }}</b>（+{{ Math.round((ps.blockHeavyRatio - 1) * 100) }}%）<br>冷凝水积存、临水击风险</div>
            </div>
          </div>
          <div class="dim" style="font-size:11px;line-height:1.9">
            · 堵塞表现为"水排不出去"：蒸汽侧热量被积存的冷凝水持续带走，<b style="color:#7fd8ff">进出口温差被拉大</b>，因此用温差相对基准的抬升幅度分档；<br>
            · 与泄漏判据互斥（泄漏是温差缩水、出口温度抬升），同一时刻只可能命中一侧；<br>
            · <b style="color:#7fd8ff">浮球式（连续排放型）同样参与本堵塞判据</b>，阈值与其他阀型一致；其泄漏判据另按「温差比值分档」执行，见上方浮球式页签。
          </div>
        </div>

        <!-- 参数维护 -->
        <div class="panel glow mb14">
          <div class="panel-title">参数维护 · {{ type }}<span v-if="dirty" class="st-tag st-leak" style="margin-left:10px;padding:1px 10px"><i class="st-dot"></i>未保存修改</span></div>

          <!-- 间歇排放型（倒立桶 / 热力型）：原有参数项保持不变 -->
          <table class="tbl" v-if="type !== '浮球式'">
            <thead><tr><th style="width:180px">参数</th><th style="width:140px">当前值</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td>监测周期 (min)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.periodMin" @input="dirty = true"></td><td class="dim" style="font-size:11px">周期触发评估任务，与采集终端调度同步</td></tr>
              <tr><td>数据窗口 (min)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.dataMin" @input="dirty = true"></td><td class="dim" style="font-size:11px">每次评估取最近 N 分钟时序数据</td></tr>
              <tr><td>进口极差阈值 (℃)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.rangeSteam" @input="dirty = true"></td><td class="dim" style="font-size:11px">窗口内进口温度极差小于该值视为"稳定生产模式"</td></tr>
              <tr><td>出口极差阈值 (℃)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.rangeCond" @input="dirty = true"></td><td class="dim" style="font-size:11px">窗口内出口温度极差小于该值视为"非排水时间"</td></tr>
              <tr><td>轻度报警 · 出口温升 (℃)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.mildTcRise" @input="dirty = true"></td><td class="dim" style="font-size:11px">出口温度高于出口温度基准该值以上</td></tr>
              <tr><td>轻度报警 · 连续次数</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.mildConsecutive" @input="dirty = true"></td><td class="dim" style="font-size:11px">连续 N 个监测周期满足才报警（防抖）</td></tr>
              <tr><td>严重报警 · 出口温升 (℃)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.severeTcRise" @input="dirty = true"></td><td class="dim" style="font-size:11px">出口温度均值高于基准该值以上，直接进入严重判据</td></tr>
              <tr><td>严重报警 · 温差比</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.severeDtRatio" @input="dirty = true"></td><td class="dim" style="font-size:11px">进出口温差均值低于温差基准的该比例（0.65 = 65%）</td></tr>
              <tr><td>严重报警 · 连续次数</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.severeConsecutive" @input="dirty = true"></td><td class="dim" style="font-size:11px">两判据满足其一即计数，连续 N 次严重报警</td></tr>
              <tr><td>轻度堵塞 · 温差比</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.blockMildRatio" @input="dirty = true"></td><td class="dim" style="font-size:11px">温差窗口均值高于温差基准该比例（1.25 = 高出基准 25%）判轻度堵塞</td></tr>
              <tr><td>重度堵塞 · 温差比</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.blockHeavyRatio" @input="dirty = true"></td><td class="dim" style="font-size:11px">温差窗口均值高于温差基准该比例（1.35 = 高出基准 35%）判重度堵塞</td></tr>
            </tbody>
          </table>

          <!-- 浮球式（连续排放型）：温差比值单判据专属参数 -->
          <table class="tbl" v-else>
            <thead><tr><th style="width:200px">参数</th><th style="width:140px">当前值</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td>监测周期 (min)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.periodMin" @input="dirty = true"></td><td class="dim" style="font-size:11px">每 N 分钟触发一次泄漏评估（取最近数据窗口的 ΔT 均值）</td></tr>
              <tr><td>数据窗口 (min)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.dataMin" @input="dirty = true"></td><td class="dim" style="font-size:11px">每次评估取最近 N 分钟的进出口温差序列求均值</td></tr>
              <tr><td>初期泄漏 · 比值上限</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.dtMildHigh" @input="dirty = true"></td><td class="dim" style="font-size:11px">ΔT / ΔT<sub>base</sub> 低于该值即进入初期泄漏带（0.75 = 基准的 75%）</td></tr>
              <tr><td>初期泄漏 · 比值下限</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.dtMildLow" @input="dirty = true"></td><td class="dim" style="font-size:11px">比值下限（0.65 = 基准的 65%），低于此值转入严重判据</td></tr>
              <tr><td>初期泄漏 · 连续次数</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.mildConsecutive" @input="dirty = true"></td><td class="dim" style="font-size:11px">连续 N 次评估比值落在 (下限, 上限) 区间才报警（防抖，默认 3 次）</td></tr>
              <tr><td>严重报警 · 温差比</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.severeDtRatio" @input="dirty = true"></td><td class="dim" style="font-size:11px">ΔT / ΔT<sub>base</sub> 低于该比例判严重泄漏（0.65 = 基准的 65%）</td></tr>
              <tr><td>严重报警 · 连续次数</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.severeConsecutive" @input="dirty = true"></td><td class="dim" style="font-size:11px">连续 N 次评估比值低于严重阈值才报警（默认 2 次）</td></tr>
              <tr><td>轻度堵塞 · 温差比</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.blockMildRatio" @input="dirty = true"></td><td class="dim" style="font-size:11px">温差窗口均值高于温差基准该比例（1.25）判轻度堵塞</td></tr>
              <tr><td>重度堵塞 · 温差比</td><td><input class="inp" style="width:100px" type="number" step="0.01" v-model.number="ps.blockHeavyRatio" @input="dirty = true"></td><td class="dim" style="font-size:11px">温差窗口均值高于温差基准该比例（1.35）判重度堵塞</td></tr>
            </tbody>
          </table>
          <div class="dim" style="font-size:11px;line-height:1.8;margin-top:8px" v-if="type === '浮球式'">
            浮球式<b style="color:#7fd8ff">不具备出口温升判据</b>（连续排放型出口温度基准本身偏高），故本页不提供"出口温升 / 进出口极差阈值"参数；
            初期与严重两级以<b style="color:#7fd8ff">同一温差基准</b>的两个比值切分，边界取左闭右开。
          </div>
          <div style="text-align:right;margin-top:12px">
            <button class="btn" style="margin-right:8px" @click="reset">还原</button>
            <button class="btn primary" @click="save">保存并下发</button>
          </div>
        </div>

        <!-- 基线管理策略 -->
        <div class="panel glow">
          <div class="panel-title">基线管理策略 · PT100 双通道（出口基准 + 温差基准）</div>
          <table class="tbl" style="margin-bottom:12px">
            <thead><tr><th style="width:180px">策略项</th><th style="width:140px">当前值</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td>学习采样点数</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.blSamples" @input="dirty = true"></td><td class="dim" style="font-size:11px">生产稳定模式下「{{ ps.blPhase }}」窗口内采样的温度点数</td></tr>
              <tr><td>基线统计方式</td><td colspan="2">出口温度均值 + 进出口温差均值（支持在设备台账「基线学习」页签对单台设备<b style="color:#00d4ff">手动标注学习</b>）
                <span v-if="type === '浮球式'" class="dim">；浮球式泄漏判据<b style="color:#7fd8ff">仅使用其中的温差基准 ΔT<sub>base</sub></b>，出口基准用于堵塞与交叉印证</span></td></tr>
              <tr><td>自动重算周期 (天)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.blRecalcDays" @input="dirty = true"></td><td class="dim" style="font-size:11px">每 N 天自动同步重新计算基线</td></tr>
              <tr><td>人工确认触发线 (℃)</td><td><input class="inp" style="width:100px" type="number" v-model.number="ps.blConfirmRise" @input="dirty = true"></td><td class="dim" style="font-size:11px">新基线相对原基线上升超过该值 → 提示人工确认后才生效，否则自动生效；人工拒绝则保持原基线</td></tr>
            </tbody>
          </table>
          <div style="border:1px solid rgba(255,159,39,0.4);border-radius:8px;padding:10px 14px;background:rgba(255,159,39,0.05)">
            <span style="color:#ff9f27;font-weight:bold;font-size:13px">基线趋势预警</span>
            <div class="dim" style="font-size:11px;line-height:1.9;margin-top:6px">
              · 每次基线更改全部留痕（时间 / 触发方式 / 原值 → 新值 / 操作人 / 生效状态），在设备台账「基线学习」页签可查看完整趋势；<br>
              · 系统对基线上升的<b style="color:#7fd8ff">整体幅度做累计趋势分析</b>：连续向上累计 ≥5℃ 生成趋势预警，辅助人工审核——泄漏工况下学习会把故障数据学进基线（越学越高），此时应拒绝更改并先排除故障；<br>
              · 未通过人工确认的重算结果<b style="color:#ff4d5e">拒绝更改原有基线</b>，原基线继续用于诊断，避免诊断门槛被慢性漂移蚕食。
            </div>
          </div>
        </div>

        <!-- 基线台账 · 待人工确认 -->
        <div class="panel glow">
          <div class="panel-title">基线台账 · 待人工确认与趋势预警
            <span class="pt-extra dim" style="font-size:11px">全厂学习模式：自动 {{ bl.autoCnt }} 台 / 手动 {{ bl.manualCnt }} 台（在设备台账清单中逐台切换）· 点击「去处理」直达该设备基线标注学习页</span>
          </div>
          <table class="tbl" style="margin-bottom:12px">
            <thead><tr>
              <th>位号</th><th>阀型</th><th>区域</th><th>基线来源</th><th>学习模式</th><th>累计上升</th><th>状态</th><th>处理建议</th><th>操作</th>
            </tr></thead>
            <tbody>
              <tr v-for="x in bl.pendingList" :key="x.d.id" style="cursor:default">
                <td class="mono" style="color:#00d4ff">{{ x.d.tagNo }}</td>
                <td class="sub">{{ x.d.type }}</td>
                <td class="sub">{{ x.d.workshopName }}</td>
                <td class="dim" style="font-size:11px">{{ x.i.source }} · {{ x.i.learnedAt }}</td>
                <td><span class="st-tag" style="padding:1px 8px" :style="x.i.mode === 'manual'
                     ? 'color:#ff9f27;border-color:rgba(255,159,39,0.4);background:rgba(255,159,39,0.08)'
                     : 'color:#2ecc71;border-color:rgba(46,204,113,0.4);background:rgba(46,204,113,0.08)'">
                  {{ x.i.mode === "manual" ? "手动维护" : "自动学习" }}</span></td>
                <td class="mono" :style="{ color: x.i.cumRise >= 5 ? '#ff4d5e' : '#ff9f27' }">+{{ x.i.cumRise }} ℃</td>
                <td><span class="st-tag" :class="x.i.cumRise >= 5 ? 'st-leak' : 'st-block'" style="padding:1px 8px">
                  <i class="st-dot"></i>{{ x.i.cumRise >= 5 ? "趋势预警" : "待确认" }}</span></td>
                <td class="dim" style="font-size:11px">
                  {{ x.i.cumRise >= 5 ? "累计上升 ≥5℃，疑似故障数据污染基线，建议先排除泄漏/堵塞再学习" : "上升 ≥3℃，核对工况平稳后确认生效或拒绝" }}
                </td>
                <td><button class="btn" style="padding:3px 10px" @click="gotBaseline(x.d.id)">去处理</button></td>
              </tr>
              <tr v-if="!bl.pendingList.length">
                <td colspan="9" class="dim" style="text-align:center;padding:20px">当前无待确认基线（15 天自动重算周期内）</td>
              </tr>
            </tbody>
          </table>
          <div class="dim" style="font-size:11px;line-height:1.9;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">
            全厂基线状态：已生效 <b style="color:#2ecc71">{{ bl.ok }}</b> 台 ·
            待确认 <b style="color:#ff9f27">{{ bl.pending }}</b> 台 ·
            趋势预警 <b style="color:#ff4d5e">{{ bl.warn }}</b> 台 ·
            模板冷启动兜底 <b style="color:#a08cf0">{{ bl.templ }}</b> 台（样本不足，暂用同型号模板基线，降级运行）。
          </div>
        </div>
      </div>
    `
  });
})();
