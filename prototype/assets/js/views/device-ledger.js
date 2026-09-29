/* ============================================================
   device-ledger.js — 设备台账 · 疏水阀档案管理
   列表 + 档案详情弹窗（基础信息 / 传感器绑定 / 基线学习 / 生命周期记录）
   基线学习：曲线标注（双游标卡尺选区 → 批量标注 → 由标注样本学习基准）
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  const GRID = { left: 56, right: 56, top: 34, bottom: 46 };

  window.VIEWS["view-device-ledger"] = defineComponent({
    name: "DeviceLedger",
    data() {
      return {
        ws: "", typeF: "", kw: "", modal: null, tab: "base",
        learning: 0, learnResult: null,
        anno: null,            // 标注用高分辨率时序
        annotList: [],         // 已确认的标注区间
        marking: false,        // 标记模式（显示游标卡尺）
        idxA: 0, idxB: 0,      // 游标卡尺索引
        dragging: null,        // 'a' | 'b' | 'band'
        dragFrom: null,        // 整段平移起点
        activeHandle: "b",     // 键盘微调作用的把手
        markContinuous: true,  // 确认后保持标记模式，便于批量连续标注
        selStat: null,         // 当前选区统计
        learnOnlyStable: true, // 学习时是否仅采用稳定窗口样本
        learnStat: null,       // 本次学习的样本统计明细
        wrapW: 900, wrapH: 300,
        chart: null
      };
    },
    computed: {
      store() { return window.Store; },
      typeStats() {
        const c = { "浮球式": 0, "倒立桶": 0, "热力型": 0 };
        this.store.devices.forEach((d) => { c[d.type] = (c[d.type] || 0) + 1; });
        return c;
      },
      rows() {
        const kw = this.kw.trim().toLowerCase();
        return this.store.devices.filter((d) =>
          (!this.ws || d.workshopId === this.ws) &&
          (!this.typeF || d.type === this.typeF) &&
          (!kw || d.tagNo.toLowerCase().includes(kw) || d.name.includes(kw) || d.equip.includes(kw) || d.supplier.includes(kw))
        );
      },
      annotPoints() {
        return this.annotList.reduce((a, s) => a + s.count, 0);
      },
      annotSegs() { return this.annotList.length; }
    },
    watch: {
      tab(v) { if (v === "baseline") this.enterBaseline(); },
      ws(v) { this.store.setPref("ledger.ws", v); },
      typeF(v) { this.store.setPref("ledger.type", v); },
      kw(v) { this.store.setPref("ledger.kw", v); },
      modal(v) {
        if (!v) {
          if (this.chart) { this.chart.dispose(); this.chart = null; }
          this.anno = null; this.annotList = []; this.marking = false;
          this.dragging = null; this.dragFrom = null; this.selStat = null;
          this.learning = 0; this.learnResult = null; this.learnStat = null;
          document.body.style.overflow = "";
        } else {
          /* 弹窗打开时锁定背景滚动，避免滚轮穿透 */
          document.body.style.overflow = "hidden";
          if (this.tab === "baseline") this.enterBaseline();
        }
      }
    },
    mounted() {
      /* 筛选条件持久化：切换页面 / 刷新后保持 */
      this.ws = this.store.pref("ledger.ws", "");
      this.typeF = this.store.pref("ledger.type", "");
      this.kw = this.store.pref("ledger.kw", "");
      /* 深链：二维码 / 链接直达设备档案页签（#/ledger/<设备ID或位号>/<页签>） */
      const p = window.Store.route.params;
      if (p && p.deviceId) {
        const d = this.store.devices.find((x) => x.id === p.deviceId || x.tagNo === p.deviceId);
        if (d) {
          const tabs = ["base", "sensor", "baseline", "life"];
          this.modal = d;
          this.tab = tabs.indexOf(p.tab) >= 0 ? p.tab : "base";
        }
      }
      this._onResize = () => {
        if (!this.$refs.wrap) return;
        this.measure();
        this.chart && this.chart.resize();
      };
      this._onMove = (e) => this.handleMove(e);
      this._onUp = () => { this.dragging = null; this.dragFrom = null; };
      /* 键盘：← → 微调当前把手（Shift 加速）；Esc 关闭弹窗 */
      this._onKey = (e) => {
        if (e.key === "Escape" && this.modal) { this.modal = null; return; }
        if (!this.marking) return;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const step = (e.shiftKey ? 5 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
        const n = this.anno.times.length;
        if (this.activeHandle === "a") this.idxA = Math.max(0, Math.min(this.idxA + step, this.idxB - 2));
        else this.idxB = Math.min(n - 1, Math.max(this.idxB + step, this.idxA + 2));
        this.updateSel();
      };
      window.addEventListener("resize", this._onResize);
      window.addEventListener("pointermove", this._onMove);
      window.addEventListener("pointerup", this._onUp);
      window.addEventListener("keydown", this._onKey);
    },
    beforeUnmount() {
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("pointermove", this._onMove);
      window.removeEventListener("pointerup", this._onUp);
      window.removeEventListener("keydown", this._onKey);
      document.body.style.overflow = "";
      if (this.chart) { this.chart.dispose(); this.chart = null; }
    },
    methods: {
      open(d) { this.modal = d; this.tab = "base"; this.learning = 0; this.learnResult = null; },
      openBaseline(d) { this.modal = d; this.tab = "baseline"; },
      stCls(s) { return window.MOCK.STATES[s].cls; },
      stLabel(s) { return window.MOCK.STATES[s].label; },
      hColor(h) { return h >= 85 ? "#2ecc71" : h >= 60 ? "#ff9f27" : "#ff4d5e"; },
      lcColor(t) { return t === "安装" ? "#2ecc71" : t === "检修" ? "#00d4ff" : t === "更换阀芯" ? "#ff9f27" : "#a08cf0"; },
      importCsv() { window.showToast("批量导入为原型占位功能（Excel 模板导入）"); },
      exportCsv() {
        window.MOCK.downloadCsv("设备台账", this.rows.map((d) => {
          const i = this.bl(d), r = window.MOCK.baseline.diag(d);
          return {
            "区域": d.workshopName, "位号": d.tagNo, "名称": d.name, "类型": d.type,
            "上游设备": d.equip, "管网位置": d.pipePos, "通径": d.caliber,
            "投运日期": d.installDate, "供应商": d.supplier, "型号": d.model,
            "出口基准Tc(℃)": i.tcBase, "温差基准ΔT(℃)": i.dtBase,
            "基准来源": i.source, "基准更新时间": i.learnedAt, "累计上升(℃)": i.cumRise,
            "相对基准诊断": r.label, "偏离(%)": r.applicable ? r.dtPct : "不适用",
            "现场状态": this.stLabel(d.status), "健康度": d.health
          };
        }));
      },
      addDev() { window.showToast("新增设备为原型占位功能"); },
      qrCode() { window.showToast("二维码生成：扫码可直达该设备监测详情（原型占位）"); },
      rebind() { window.showToast("重新绑定将启动「通汽自检」向导：通汽后蒸汽侧温度应明显高于冷凝水侧（原型占位）"); },

      /* ================= 基线学习 ================= */
      bl(d) { window.dataVer(); return window.MOCK.baselineMap[d.id]; },
      blHist(d) { return window.MOCK.baselineHistory[d.id] || []; },
      histCls(s) {
        return s === "已生效" ? "st-tag st-normal" : s === "待确认" ? "st-tag st-leak" : "st-tag st-stop";
      },
      enterBaseline() {
        const d = this.modal;
        if (!d) return;
        if (!this.anno || this.anno.deviceId !== d.id) {
          this.anno = window.MOCK.annoSeries(d.id);
          if (!window.MOCK.baselineAnnot[d.id]) window.MOCK.baselineAnnot[d.id] = [];
          this.annotList = window.MOCK.baselineAnnot[d.id];
        }
        this.marking = false; this.dragging = null; this.dragFrom = null; this.selStat = null;
        this.learning = 0; this.learnResult = null; this.learnStat = null;
        this.$nextTick(() => { this.measure(); this.renderChart(); });
      },
      refreshData() {
        window.MOCK.annoReset(this.modal.id);
        this.anno = window.MOCK.annoSeries(this.modal.id);
        this.renderChart();
        window.showToast("已重新拉取最近 4 小时时序数据");
      },

      /* ---- 坐标换算 ---- */
      measure() {
        const el = this.$refs.wrap;
        if (el) { this.wrapW = el.clientWidth; this.wrapH = el.clientHeight; }
      },
      plotW() { return Math.max(1, this.wrapW - GRID.left - GRID.right); },
      xOf(i) {
        const n = this.anno ? this.anno.times.length : 1;
        return GRID.left + (i / Math.max(1, n - 1)) * this.plotW();
      },
      idxOf(px) {
        const n = this.anno ? this.anno.times.length : 1;
        const i = Math.round(((px - GRID.left) / this.plotW()) * (n - 1));
        return Math.max(0, Math.min(n - 1, i));
      },
      bandStyle(a, b) {
        const x1 = this.xOf(a), x2 = this.xOf(b);
        return {
          left: x1 + "px", top: GRID.top + "px",
          height: Math.max(10, this.wrapH - GRID.top - GRID.bottom) + "px",
          width: Math.max(2, x2 - x1) + "px"
        };
      },

      /* ---- 游标卡尺交互（拖把手 / 整段平移 / 键盘微调 / 一键吸附） ---- */
      startMark() {
        if (!this.anno) return;
        const w = this.autoWindow(30);
        this.idxA = w.a; this.idxB = w.b;
        this.marking = true;
        this.activeHandle = "b";
        this.updateSel();
        window.showToast("已智能定位最平稳的 30 分钟窗口，可拖两侧卡尺 / 拖选区内平移，或按 ← → 微调");
      },
      cancelMark() { this.marking = false; this.dragging = null; this.dragFrom = null; this.selStat = null; },
      onHandleDown(which, e) {
        if (!this.marking) return;
        this.dragging = which;
        this.activeHandle = which;
        if (e && e.preventDefault) e.preventDefault();
      },
      /** 按住选区内部整段平移（保持区间宽度不变） */
      onBandDown(e) {
        if (!this.marking) return;
        this.dragging = "band";
        this.dragFrom = { idx: this.idxOf(e.clientX - this.$refs.wrap.getBoundingClientRect().left), a: this.idxA, b: this.idxB };
        if (e && e.preventDefault) e.preventDefault();
      },
      handleMove(e) {
        if (!this.dragging || !this.marking || !this.anno) return;
        const el = this.$refs.wrap;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const n = this.anno.times.length;
        const i = this.idxOf(e.clientX - rect.left);
        if (this.dragging === "band" && this.dragFrom) {
          const width = this.dragFrom.b - this.dragFrom.a;
          let a = this.dragFrom.a + (i - this.dragFrom.idx);
          a = Math.max(0, Math.min(a, n - 1 - width));
          this.idxA = a; this.idxB = a + width;
        } else if (this.dragging === "a") {
          this.idxA = Math.max(0, Math.min(i, this.idxB - 2));
          this.activeHandle = "a";
        } else {
          this.idxB = Math.min(n - 1, Math.max(i, this.idxA + 2));
          this.activeHandle = "b";
        }
        this.updateSel();
      },
      updateSel() { this.selStat = window.MOCK.rangeStat(this.modal.id, this.idxA, this.idxB); },
      /** 一键吸附：以当前选区中心为基准，就近寻找最平稳的同宽窗口 */
      snapWindow() {
        if (!this.marking || !this.anno) return;
        const s = this.anno, n = s.times.length;
        const width = Math.max(10, this.idxB - this.idxA);
        const center = Math.round((this.idxA + this.idxB) / 2);
        const from = Math.max(0, center - 30), to = Math.min(n - 1 - width, center + 30);
        let best = Math.max(0, Math.min(center - Math.round(width / 2), n - 1 - width)), bestScore = Infinity;
        for (let a = from; a <= to; a++) {
          const tc = s.tc.slice(a, a + width + 1), ts = s.ts.slice(a, a + width + 1);
          const sc = (Math.max.apply(null, tc) - Math.min.apply(null, tc)) +
                     (Math.max.apply(null, ts) - Math.min.apply(null, ts));
          if (sc < bestScore) { bestScore = sc; best = a; }
        }
        this.idxA = best; this.idxB = best + width;
        this.updateSel();
        window.showToast("已吸附到就近最平稳窗口（Ts/Tc 极差合计 " + Math.round(bestScore * 10) / 10 + "℃）");
      },
      /** 自动寻找最平稳的窗口（双侧极差最小），便于一键定位「非排水时间」 */
      autoWindow(win) {
        const s = this.anno, n = s.times.length;
        win = Math.min(win, n - 2);
        let best = 0, bestScore = Infinity;
        for (let a = 0; a + win <= n - 1; a++) {
          const b = a + win;
          const tc = s.tc.slice(a, b + 1), ts = s.ts.slice(a, b + 1);
          const sc = (Math.max.apply(null, tc) - Math.min.apply(null, tc)) +
                     (Math.max.apply(null, ts) - Math.min.apply(null, ts));
          if (sc < bestScore) { bestScore = sc; best = a; }
        }
        return { a: best, b: best + win };
      },
      nowStr() {
        const t = new Date(), f = (x) => (x < 10 ? "0" : "") + x;
        return t.getFullYear() + "-" + f(t.getMonth() + 1) + "-" + f(t.getDate()) + " " + f(t.getHours()) + ":" + f(t.getMinutes());
      },
      confirmMark() {
        if (!this.selStat) return;
        const seg = Object.assign({}, this.selStat, {
          id: this.modal.id + "-MK-" + Date.now(),
          deviceId: this.modal.id,
          operator: "陈工",
          createdAt: this.nowStr()
        });
        this.annotList.push(seg);
        const merged = this.mergeAnnot();
        this.dragging = null; this.dragFrom = null;
        /* 连续标注模式：保持标记状态，可接着框选下一段（批量标注） */
        if (this.markContinuous) {
          const w = this.autoWindow(30);
          this.idxA = w.a; this.idxB = w.b;
          this.updateSel();
        } else {
          this.marking = false;
          this.selStat = null;
        }
        this.renderChart();
        window.showToast("本区间已标注（曲线变黄）：" + seg.count + " 个采样点 · " +
          (seg.stable ? "稳定窗口，可纳入基准样本" : "非稳定窗口，建议剔除") +
          (merged ? "；与相邻区间合并后共 " + this.annotList.length + " 段" : "") +
          (this.markContinuous ? "；可继续框选下一段" : ""));
      },
      /** 重叠 / 相邻区间自动合并，避免样本重复计入（返回是否发生合并） */
      mergeAnnot() {
        const list = this.annotList.slice().sort((a, b) => a.startIdx - b.startIdx);
        const out = [];
        list.forEach((seg) => {
          const last = out[out.length - 1];
          if (last && seg.startIdx <= last.endIdx + 1) {
            const a = last.startIdx, b = Math.max(last.endIdx, seg.endIdx);
            out[out.length - 1] = Object.assign({}, window.MOCK.rangeStat(this.modal.id, a, b), {
              id: last.id, deviceId: last.deviceId, operator: last.operator,
              createdAt: last.createdAt, merged: true
            });
          } else out.push(seg);
        });
        const changed = out.length !== this.annotList.length;
        if (changed) this.annotList.splice(0, this.annotList.length, ...out);
        return changed;
      },
      removeMark(i) {
        this.annotList.splice(i, 1);
        this.renderChart();
        window.showToast("已删除该标注区间");
      },
      clearAllMark() {
        this.annotList.splice(0, this.annotList.length);
        this.marking = false; this.selStat = null;
        this.renderChart();
        window.showToast("已清空全部标注区间");
      },

      /* ---- 学习：按人工标注样本计算基准 ---- */
      runLearn(mode) {
        if (this.learning) return;
        if (mode !== "auto" && !this.annotList.length) {
          window.showToast("请先点击「开始数据标记」完成至少一段区间标注，再开始学习");
          return;
        }
        const d = this.modal, b = this.bl(d);
        this.learning = 1;
        this.learnStat = null;
        setTimeout(() => { this.learning = 2; }, 700);
        setTimeout(() => {
          const r1 = (v) => Math.round(v * 10) / 10;
          let tcNew, dtNew, tsNew, points, segs = 0, unstable = 0, excluded = 0;
          if (mode === "auto") {
            const polluted = d.status === "leak";
            tcNew = r1(polluted ? b.tcBase + (3.2 + Math.random() * 2.5) : b.tcBase + (Math.random() * 2 - 1));
            dtNew = r1(polluted ? b.dtBase - (2 + Math.random() * 3) : b.dtBase + (Math.random() * 2 - 1));
            tsNew = r1(tcNew + dtNew);
            points = 200;
          } else {
            const s = this.anno;
            const used = this.learnOnlyStable ? this.annotList.filter((x) => x.stable) : this.annotList.slice();
            if (!used.length) {
              this.learning = 0;
              window.showToast("全部标注区间均为非稳定窗口（含排放脉冲或波动偏大），请重新标注或关闭「仅用稳定窗口」");
              return;
            }
            const acc = { ts: [], tc: [], dt: [] };
            this.annotList.forEach((seg) => {
              segs++;
              if (!seg.stable) { unstable++; if (this.learnOnlyStable) excluded += seg.count; }
            });
            used.forEach((seg) => {
              for (let i = seg.startIdx; i <= seg.endIdx; i++) {
                acc.ts.push(s.ts[i]); acc.tc.push(s.tc[i]); acc.dt.push(s.dt[i]);
              }
            });
            const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
            const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
            points = acc.ts.length;
            tsNew = r1(mean(acc.ts)); tcNew = r1(mean(acc.tc)); dtNew = r1(mean(acc.dt));
            this.learnStat = {
              usedSegs: used.length, segs, points, excluded, unstable,
              tsMean: tsNew, tcMean: tcNew, dtMean: dtNew,
              tsRange: r1(Math.max.apply(null, acc.ts) - Math.min.apply(null, acc.ts)),
              tcRange: r1(Math.max.apply(null, acc.tc) - Math.min.apply(null, acc.tc)),
              dtRange: r1(Math.max.apply(null, acc.dt) - Math.min.apply(null, acc.dt)),
              tsStd: r1(std(acc.ts)), tcStd: r1(std(acc.tc)), dtStd: r1(std(acc.dt)),
              stableOnly: this.learnOnlyStable
            };
          }
          const rise = r1(tcNew - b.tcBase);
          const polluted = d.status === "leak";
          const base = "学习样本：" + (mode === "auto" ? "自动取稳定非排水窗口 200 点" : ("人工标注 " + (this.learnStat ? this.learnStat.usedSegs : segs) + " 段 · 共 " + points + " 个采样点" +
              (excluded ? "（已剔除非稳定 " + excluded + " 点）" : ""))) +
            "（Ts 均值 " + tsNew + "℃ / Tc 均值 " + tcNew + "℃ / ΔT 均值 " + dtNew + "℃）";
          const note = (polluted && rise >= 3
              ? "出口基准上升 " + rise + "℃ ≥ 3℃ 触发线，且该设备当前处于泄漏状态——疑似故障数据污染基线，建议先排除泄漏再重新学习"
              : rise >= 3
                ? "出口基准上升 " + rise + "℃ ≥ 3℃ 触发线，需人工确认后方可生效，原基线保持不变"
                : "变化 " + rise + "℃ < 3℃ 触发线，可直接生效")
            + (unstable && !this.learnOnlyStable ? "；其中 " + unstable + " 段为波动/含排放脉冲区间，建议剔除后重新学习" : "");
          this.learnResult = {
            mode, tcOld: b.tcBase, dtOld: b.dtBase,
            tsNew, tcNew, dtNew, rise, points, segs, unstable, excluded,
            needConfirm: rise >= 3, polluted, note, sampleNote: base
          };
          this.learning = 3;
          this.$forceUpdate();
        }, 1500);
      },
      applyLearn(ok) {
        const d = this.modal, b = this.bl(d), r = this.learnResult;
        b.tcBase = ok ? r.tcNew : b.tcBase;
        b.dtBase = ok ? r.dtNew : b.dtBase;
        b.pending = false;
        b.sampleCnt = r.mode === "auto" ? 200 : r.points;
        b.source = r.mode === "auto" ? "实测（200 点自动学习）" : "实测（人工标注 " + r.points + " 点）";
        b.learnedAt = this.nowStr();
        b.cumRise = Math.round((b.tcBase - (this.blHist(d)[0] ? this.blHist(d)[0].tcOld : b.tcBase)) * 10) / 10;
        this.blHist(d).unshift({
          time: this.nowStr(),
          trigger: r.mode === "auto" ? "自动学习" : "人工标注学习",
          tcOld: r.tcOld, tcNew: ok ? r.tcNew : r.tcOld,
          dtOld: r.dtOld, dtNew: ok ? r.dtNew : r.dtOld,
          operator: "陈工", status: ok ? "已生效" : "已拒绝",
          note: ok
            ? (r.needConfirm ? "人工确认后生效（" + r.points + " 点）" : "变化未超 3℃ 触发线，自动生效（" + r.points + " 点）")
            : "人工拒绝，保持原基线"
        });
        this.learnResult = null;
        /* 通知全站：基线已变更，各页面诊断结论需重算（列表 / 详情 / 驾驶舱 / 策略页同步生效） */
        window.Store.bump();
        this.$forceUpdate();
        window.showToast(ok ? "新基线已生效并同步至全站诊断，变更记录已留痕" : "已拒绝本次学习，保持原基线");
      },

      /* ================= 图表 ================= */
      renderChart() {
        const el = this.$refs.chart, s = this.anno;
        if (!el || !s) return;
        const n = s.times.length;
        const ax = window.chartUtil.baseAxis();
        const series = [
          { name: "进口温度 Ts", type: "line", showSymbol: false, smooth: true, data: s.ts,
            lineStyle: { color: "#ff9f27", width: 1.6 }, itemStyle: { color: "#ff9f27" } },
          { name: "出口温度 Tc", type: "line", showSymbol: false, smooth: true, data: s.tc,
            lineStyle: { color: "#00d4ff", width: 1.6 }, itemStyle: { color: "#00d4ff" } },
          { name: "进出口温差 ΔT", type: "line", showSymbol: false, smooth: true, yAxisIndex: 1, data: s.dt,
            lineStyle: { color: "#2ecc71", width: 1.3, type: "dashed" }, itemStyle: { color: "#2ecc71" } }
        ];
        /* 已标注区间 → 三条曲线同步变黄（Ts / Tc / ΔT） */
        const mTs = new Array(n).fill(null), mTc = new Array(n).fill(null), mDt = new Array(n).fill(null);
        let has = false;
        this.annotList.forEach((seg) => {
          for (let i = seg.startIdx; i <= seg.endIdx && i < n; i++) {
            mTs[i] = s.ts[i]; mTc[i] = s.tc[i]; mDt[i] = s.dt[i]; has = true;
          }
        });
        const YEL = "#ffd23f";
        if (has) {
          series.push(
            { name: "已标注区间", type: "line", showSymbol: false, connectNulls: false, silent: true,
              data: mTs, z: 8, lineStyle: { color: YEL, width: 3.2 }, itemStyle: { color: YEL } },
            { name: "已标注区间_Tc", type: "line", showSymbol: false, connectNulls: false, silent: true,
              data: mTc, z: 8, lineStyle: { color: YEL, width: 3.2 }, itemStyle: { color: YEL } },
            { name: "已标注区间_ΔT", type: "line", showSymbol: false, connectNulls: false, silent: true, yAxisIndex: 1,
              data: mDt, z: 8, lineStyle: { color: YEL, width: 3.2 }, itemStyle: { color: YEL } }
          );
        }
        const opt = {
          backgroundColor: "transparent",
          animation: false,
          tooltip: { trigger: "axis", backgroundColor: "#11244a", borderColor: "rgba(0,212,255,0.3)", textStyle: { color: "#d8ecff", fontSize: 11 } },
          legend: {
            top: 0, textStyle: { color: "#7fa3c9", fontSize: 10 }, itemWidth: 12, itemHeight: 6,
            data: ["进口温度 Ts", "出口温度 Tc", "进出口温差 ΔT", "已标注区间"]
          },
          grid: { left: GRID.left, right: GRID.right, top: GRID.top, bottom: GRID.bottom },
          xAxis: {
            type: "category", boundaryGap: false, data: s.times,
            axisLine: ax.axisLine, axisTick: { show: false },
            axisLabel: { color: "#7fa3c9", fontSize: 10, interval: Math.floor(n / 10) }
          },
          yAxis: [
            Object.assign({ type: "value", name: "温度 ℃", nameTextStyle: { color: "#4d6b8f", fontSize: 10 } }, ax),
            Object.assign({ type: "value", name: "ΔT ℃", position: "right" }, ax,
              { splitLine: { show: false }, nameTextStyle: { color: "#4d6b8f", fontSize: 10 } })
          ],
          series
        };
        if (!this.chart) this.chart = window.chartUtil.make(el, opt);
        else this.chart.setOption(opt, true);
      }
    },
    created() { this.windowLC = window.MOCK.lifecycle; },
    template: `
      <div>
        <!-- 统计条 -->
        <div class="kpi-row mb14">
          <div class="kpi-card"><div class="k-num" style="color:#00d4ff">{{ store.devices.length }}</div><div class="k-label">设备总数</div></div>
          <div class="kpi-card" v-for="(n, t) in typeStats" :key="t">
            <div class="k-num" style="color:#7fd8ff">{{ n }}</div><div class="k-label">{{ t }}</div>
          </div>
          <div class="kpi-card"><div class="k-num" style="color:#2ecc71">100%</div><div class="k-label">传感器绑定率（双通道）</div></div>
          <div class="kpi-card"><div class="k-num" style="color:#a08cf0">5</div><div class="k-label">网关接入数</div></div>
        </div>

        <div class="panel glow">
          <div class="filter-bar">
            <select class="sel" style="width:130px" v-model="ws">
              <option value="">全部区域</option>
              <option value="w1">动力区域</option>
              <option value="w2">酿造区域</option>
              <option value="w3">包装区域</option>
            </select>
            <select class="sel" style="width:120px" v-model="typeF">
              <option value="">全部类型</option>
              <option>浮球式</option><option>倒立桶</option><option>热力型</option>
            </select>
            <input class="inp" style="width:220px" v-model="kw" placeholder="搜索位号 / 名称 / 上游设备 / 供应商" />
            <span class="dim" style="font-size:11px">共 {{ rows.length }} 台</span>
            <span style="flex:1"></span>
            <button class="btn" @click="importCsv">批量导入</button>
            <button class="btn" @click="exportCsv">导出台账</button>
            <button class="btn primary" @click="addDev">+ 新增设备</button>
          </div>

          <div class="tbl-wrap bounded">
          <table class="tbl sticky">
            <thead><tr>
              <th>区域</th><th>位号</th><th>名称</th><th>型号</th><th>类型</th><th>口径</th>
              <th>安装位置</th><th>上游用汽设备</th><th>投运日期</th><th>供应商</th><th>运行状态</th><th>操作</th>
            </tr></thead>
            <tbody>
              <tr v-for="d in rows" :key="d.id">
                <td class="sub" style="white-space:nowrap">{{ d.workshopName }}</td>
                <td class="mono" style="color:#00d4ff">{{ d.tagNo }}</td>
                <td>{{ d.name }}</td>
                <td class="mono" style="font-size:11px">{{ d.model }}</td>
                <td><span class="st-tag" style="color:#7fa3c9;border-color:rgba(0,212,255,0.25);background:rgba(0,212,255,0.05)">{{ d.type }}</span></td>
                <td class="mono">{{ d.caliber }}</td>
                <td class="sub" style="font-size:11px">{{ d.pipePos }}</td>
                <td class="sub">{{ d.equip }}</td>
                <td class="dim mono">{{ d.installDate }}</td>
                <td class="sub">{{ d.supplier }}</td>
                <td><span class="st-tag" :class="stCls(d.status)"><i class="st-dot"></i>{{ stLabel(d.status) }}</span></td>
                <td @click.stop style="white-space:nowrap">
                  <button class="btn" style="padding:3px 10px" @click="openBaseline(d)">基线标注</button>
                  <button class="btn" style="padding:3px 10px;margin-left:6px" @click="open(d)">档案</button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <div v-if="!rows.length" class="tbl-empty">
            无匹配设备
            <div style="margin-top:10px"><button class="btn ghost" @click="ws='';typeF='';kw=''">重置筛选</button></div>
          </div>
        </div>

        <!-- 档案详情弹窗 -->
        <div class="modal-mask" v-if="modal" @click.self="modal = null">
          <div class="modal" :style="{ width: tab === 'baseline' ? '1100px' : '640px', maxWidth: '94vw' }">
            <h3 style="display:flex;align-items:center;gap:10px">
              <span class="mono" style="color:#00d4ff">{{ modal.tagNo }}</span> 设备档案
              <span class="st-tag" :class="stCls(modal.status)" style="margin-left:auto"><i class="st-dot"></i>{{ stLabel(modal.status) }}</span>
            </h3>

            <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid rgba(0,212,255,0.15);padding-bottom:10px">
              <span class="chip" :class="{ on: tab === 'base' }" @click="tab = 'base'">基础信息</span>
              <span class="chip" :class="{ on: tab === 'sensor' }" @click="tab = 'sensor'">传感器绑定</span>
              <span class="chip" :class="{ on: tab === 'baseline' }" @click="tab = 'baseline'">
                基线学习<span v-if="bl(modal) && bl(modal).pending" style="color:#ff4d5e"> ●</span>
              </span>
              <span class="chip" :class="{ on: tab === 'life' }" @click="tab = 'life'">生命周期记录</span>
              <span style="flex:1"></span>
              <span class="btn" style="padding:3px 10px" @click="qrCode">二维码</span>
            </div>

            <div v-if="tab === 'base'" style="max-height:380px;overflow-y:auto">
              <table class="tbl"><tbody>
                <tr><td class="dim" style="width:120px">设备名称</td><td>{{ modal.name }}</td><td class="dim" style="width:120px">型号</td><td class="mono">{{ modal.model }}</td></tr>
                <tr><td class="dim">类型 / 口径</td><td>{{ modal.type }} · {{ modal.caliber }}</td><td class="dim">连接方式</td><td>{{ modal.connect }}</td></tr>
                <tr><td class="dim">安装位置</td><td>{{ modal.pipePos }}</td><td class="dim">蒸汽压力</td><td class="mono">{{ modal.steamPressure }} MPa</td></tr>
                <tr><td class="dim">上游用汽设备</td><td>{{ modal.equip }}</td><td class="dim">投运日期</td><td class="mono">{{ modal.installDate }}</td></tr>
                <tr><td class="dim">供应商</td><td>{{ modal.supplier }}</td><td class="dim">健康度</td>
                  <td><span class="mono" :style="{ color: hColor(modal.health) }">{{ modal.health }}</span> / 100</td></tr>
                <tr><td class="dim">铭牌 / 照片</td><td colspan="3">
                  <span class="dim" style="display:inline-flex;width:150px;height:64px;border:1px dashed rgba(0,212,255,0.3);border-radius:6px;align-items:center;justify-content:center;font-size:11px">铭牌照片（原型占位）</span>
                </td></tr>
              </tbody></table>
            </div>

            <div v-if="tab === 'sensor'" style="max-height:380px;overflow-y:auto">
              <div class="dim" style="font-size:11px;margin-bottom:10px">绑定链路：疏水阀 ← 双温度传感器 ← 采集终端 ← 采集网关</div>
              <table class="tbl"><tbody>
                <tr><td class="dim" style="width:120px">蒸汽侧传感器</td><td class="mono">{{ modal.sensorSteam }}</td></tr>
                <tr><td class="dim">冷凝水侧传感器</td><td class="mono">{{ modal.sensorCond }}</td></tr>
                <tr><td class="dim">采集终端</td><td class="mono">{{ modal.terminalId }} <span class="dim" style="font-size:11px">（双通道同步采集 · 60s）</span></td></tr>
                <tr><td class="dim">所属网关</td><td class="mono">{{ modal.gatewayId }}</td></tr>
                <tr><td class="dim">通汽自检</td>
                  <td><span class="st-tag st-normal" style="padding:1px 10px"><i class="st-dot"></i>{{ modal.sensorCheck }}（蒸汽侧明显高于冷凝水侧，绑定方向正确）</span></td></tr>
              </tbody></table>
              <div style="margin-top:14px;text-align:right">
                <button class="btn" @click="rebind">重新绑定 / 通汽自检</button>
              </div>
            </div>

            <div v-if="tab === 'baseline'" style="max-height:68vh;overflow-y:auto;padding-right:4px">
              <!-- 基线卡片 -->
              <div style="display:flex;gap:10px;margin-bottom:12px">
                <div class="kpi-card" style="flex:1;padding:12px">
                  <div class="k-num" style="color:#00d4ff;font-size:22px">{{ bl(modal).tcBase }}<span style="font-size:12px"> ℃</span></div>
                  <div class="k-label">出口温度基准 Tc_base</div>
                </div>
                <div class="kpi-card" style="flex:1;padding:12px">
                  <div class="k-num" style="color:#7fd8ff;font-size:22px">{{ bl(modal).dtBase }}<span style="font-size:12px"> ℃</span></div>
                  <div class="k-label">进出口温差基准 ΔT_base</div>
                </div>
                <div class="kpi-card" style="flex:1;padding:12px">
                  <div class="k-num" :style="{ color: bl(modal).cumRise >= 5 ? '#ff4d5e' : '#2ecc71', fontSize: '22px' }">{{ bl(modal).cumRise > 0 ? '+' : '' }}{{ bl(modal).cumRise }}<span style="font-size:12px"> ℃</span></div>
                  <div class="k-label">累计上升幅度</div>
                </div>
              </div>

              <table class="tbl" style="margin-bottom:12px"><tbody>
                <tr><td class="dim" style="width:110px">基线来源</td><td>{{ bl(modal).source }}</td><td class="dim" style="width:110px">采样方式</td>
                  <td>PT100 双通道 · 生产稳定 / 非排水时间 · {{ bl(modal).sampleCnt }} 个采样点均值</td></tr>
                <tr><td class="dim">上次学习</td><td class="mono">{{ bl(modal).learnedAt }}</td><td class="dim">下次自动重算</td>
                  <td class="mono">{{ bl(modal).nextAuto }} <span class="dim" style="font-size:11px">（每 15 天自动同步重算）</span></td></tr>
              </tbody></table>

              <!-- 趋势预警 -->
              <div v-if="bl(modal).cumRise >= 5" class="panel" style="padding:10px 14px;margin-bottom:12px;border-color:rgba(255,77,94,0.5);background:rgba(255,77,94,0.06)">
                <span style="color:#ff4d5e;font-weight:bold">⚠ 基线趋势预警</span>
                <span class="sub" style="font-size:11px;margin-left:8px">出口基准累计上升 {{ bl(modal).cumRise }}℃（连续向上），疑似泄漏工况污染或工况漂移——建议先人工核查设备状态，再决定是否接受新基线。</span>
              </div>

              <!-- ===== 人工标注学习（曲线框选 → 批量标注 → 按标注样本学习基准） ===== -->
              <div style="border:1px solid rgba(0,212,255,0.25);border-radius:8px;padding:12px 14px;margin-bottom:12px">
                <div class="step-flow" style="margin-bottom:10px">
                  <span class="st-item" :class="{ on: marking && !annotList.length, done: !!annotList.length }"><i>1</i>开始数据标记</span>
                  <span class="st-arrow">›</span>
                  <span class="st-item" :class="{ on: marking, done: !!annotList.length }"><i>2</i>拖游标卡尺框选区间</span>
                  <span class="st-arrow">›</span>
                  <span class="st-item" :class="{ done: !!annotList.length }"><i>3</i>确认标注（曲线变黄）</span>
                  <span class="st-arrow">›</span>
                  <span class="st-item" :class="{ on: learning > 0 && learning < 3, done: learning === 3 }"><i>4</i>开始数据学习</span>
                  <span class="st-arrow">›</span>
                  <span class="st-item"><i>5</i>确认生效并留痕</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                  <span style="font-weight:bold">人工标注基线学习</span>
                  <span class="dim" style="font-size:11px">在曲线上框选「生产稳定 · 非排水时间」区间并批量标注 → 由标注样本计算出口温度基准与温差基准</span>
                  <span style="flex:1"></span>
                  <button class="btn" style="padding:3px 10px" @click="refreshData">刷新数据</button>
                  <button class="btn primary" style="padding:4px 14px" v-if="!marking" @click="startMark">▶ 开始数据标记</button>
                  <template v-else>
                    <button class="btn" style="padding:4px 12px" @click="snapWindow">⇥ 吸附最平稳窗口</button>
                    <button class="btn ghost" style="padding:4px 12px" @click="cancelMark">✕ 取消标记</button>
                    <button class="btn primary" style="padding:4px 14px" @click="confirmMark">✓ 确认标注本区间</button>
                  </template>
                  <span class="chip" :class="{ on: markContinuous }" title="确认后保持标记模式，可连续框选多段区间批量标注"
                        @click="markContinuous = !markContinuous">连续标注</span>
                  <span class="chip" :class="{ on: learnOnlyStable }" title="学习时仅采用稳定窗口（Ts/Tc 极差均 <5℃）的样本"
                        @click="learnOnlyStable = !learnOnlyStable">仅用稳定窗口</span>
                  <button class="btn primary" style="padding:4px 14px" :disabled="!!learning || !annotList.length" @click="runLearn('manual')">
                    {{ learning && learning !== 3 ? "学习中…" : "🧠 开始数据学习" }}
                  </button>
                </div>

                <!-- 图例 -->
                <div style="display:flex;gap:16px;align-items:center;font-size:11px;color:#7fa3c9;margin-bottom:6px;flex-wrap:wrap">
                  <span><i style="display:inline-block;width:14px;height:2px;background:#ff9f27;vertical-align:middle"></i> 进口温度 Ts</span>
                  <span><i style="display:inline-block;width:14px;height:2px;background:#00d4ff;vertical-align:middle"></i> 出口温度 Tc</span>
                  <span><i style="display:inline-block;width:14px;height:2px;background:#2ecc71;vertical-align:middle"></i> 进出口温差 ΔT（右轴）</span>
                  <span><i style="display:inline-block;width:14px;height:3px;background:#ffd23f;vertical-align:middle"></i> 已标注区间（Ts / Tc / ΔT 三曲线同步变黄）</span>
                  <span class="dim">| {{ modal.type }}（{{ anno && anno.type !== '浮球式' ? '间歇排放 · 周期约 90 分钟' : '连续排放' }}）· 最近 4 小时 / 1 分钟粒度 · {{ anno ? anno.times.length : 0 }} 点</span>
                </div>

                <!-- 曲线 + 游标卡尺 -->
                <div class="anno-wrap" ref="wrap" style="height:300px;border:1px solid rgba(0,212,255,0.15);border-radius:8px;overflow:hidden">
                  <div ref="chart" style="width:100%;height:100%"></div>
                  <div v-for="(seg,i) in annotList" :key="seg.id" class="anno-band marked" :style="bandStyle(seg.startIdx, seg.endIdx)">
                    <span class="ab-tag">已标注 {{ i + 1 }} · {{ seg.count }} 点 · {{ seg.spanMin }}min</span>
                    <span class="ab-size" v-if="seg.merged">已合并重叠区间</span>
                  </div>
                  <template v-if="marking">
                    <div class="anno-band cur" :class="{ dragging: dragging === 'band' }" :style="bandStyle(idxA, idxB)"
                         @pointerdown="onBandDown($event)" title="按住选区内可整段平移">
                      <span class="ab-size" v-if="selStat">{{ selStat.spanMin }} min · {{ selStat.count }} 点 · 拖此处平移</span>
                    </div>
                    <div class="caliper" :class="{ dragging: dragging === 'a' }" :style="{ left: xOf(idxA) + 'px' }"
                         @pointerdown="onHandleDown('a', $event)">
                      <div class="cal-jaw">{{ anno.times[idxA] }}</div>
                      <div class="cal-line"></div>
                      <div class="cal-grip"></div>
                    </div>
                    <div class="caliper" :class="{ dragging: dragging === 'b' }" :style="{ left: xOf(idxB) + 'px' }"
                         @pointerdown="onHandleDown('b', $event)">
                      <div class="cal-jaw">{{ anno.times[idxB] }}</div>
                      <div class="cal-line"></div>
                      <div class="cal-grip"></div>
                    </div>
                  </template>
                </div>

                <div class="mark-tip" style="margin-top:8px" v-if="marking">
                  <span>🖱 拖左右游标卡尺改区间边界 · 按住选区内可整段平移 · ← → 微调（Shift 加速 5min） · 选好后点「确认标注本区间」</span>
                  <span style="flex:1"></span>
                  <span>提示：排放脉冲段（Tc 冲高）与波动段请剔除，仅标注平稳非排水区间；开启「连续标注」可一次框选多段</span>
                </div>

                <!-- 选区统计 -->
                <table class="tbl" style="margin-top:10px" v-if="selStat">
                  <thead><tr>
                    <th>当前选区</th><th>时长</th><th>采样点</th><th>Ts 均值</th><th>Tc 均值</th><th>ΔT 均值</th>
                    <th>Ts 极差</th><th>Tc 极差</th><th>稳定性判定</th>
                  </tr></thead>
                  <tbody><tr>
                    <td class="mono" style="font-size:11px">{{ selStat.startTime }} → {{ selStat.endTime }}</td>
                    <td class="mono">{{ selStat.spanMin }} min</td>
                    <td class="mono">{{ selStat.count }}</td>
                    <td class="mono">{{ selStat.tsMean }}</td>
                    <td class="mono">{{ selStat.tcMean }}</td>
                    <td class="mono">{{ selStat.dtMean }}</td>
                    <td class="mono" :style="{ color: selStat.tsRange < 5 ? '#2ecc71' : '#ff4d5e' }">{{ selStat.tsRange }}</td>
                    <td class="mono" :style="{ color: selStat.tcRange < 5 ? '#2ecc71' : '#ff4d5e' }">{{ selStat.tcRange }}</td>
                    <td><span class="st-tag" :class="selStat.stable ? 'stable' : 'unstable'" style="padding:1px 8px">
                      {{ selStat.stable ? "✓ 稳定窗口（可作基准样本）" : (selStat.pulse ? "⚠ 含排放脉冲" : "⚠ 波动偏大") }}</span></td>
                  </tr></tbody>
                </table>

                <!-- 已标注区间清单 -->
                <div style="display:flex;align-items:center;gap:8px;margin:12px 0 6px">
                  <span style="font-weight:bold">已标注区间</span>
                  <span class="dim" style="font-size:11px">{{ annotSegs }} 段 · 共 {{ annotPoints }} 个采样点{{ annotPoints ? "（累计" + annotPoints + " 点）" : "" }}</span>
                  <span style="flex:1"></span>
                  <button class="btn ghost" style="padding:2px 10px" v-if="annotSegs" @click="clearAllMark">清空全部</button>
                </div>
                <table class="tbl">
                  <thead><tr><th>#</th><th>区间</th><th>时长</th><th>采样点</th><th>Ts 均值</th><th>Tc 均值</th><th>ΔT 均值</th><th>稳定性</th><th>标注人</th><th>操作</th></tr></thead>
                  <tbody>
                    <tr v-for="(seg,i) in annotList" :key="seg.id">
                      <td class="mono">{{ i + 1 }}</td>
                      <td class="mono dim" style="font-size:11px">{{ seg.startTime }} → {{ seg.endTime }}</td>
                      <td class="mono">{{ seg.spanMin }} min</td>
                      <td class="mono">{{ seg.count }}</td>
                      <td class="mono">{{ seg.tsMean }}</td>
                      <td class="mono" style="color:#00d4ff">{{ seg.tcMean }}</td>
                      <td class="mono" style="color:#2ecc71">{{ seg.dtMean }}</td>
                      <td><span class="st-tag" :class="seg.stable ? 'stable' : 'unstable'" style="padding:1px 8px">
                        {{ seg.stable ? "稳定" : (seg.pulse ? "含脉冲" : "波动") }}</span></td>
                      <td class="sub">{{ seg.operator }}</td>
                      <td><button class="btn danger" style="padding:1px 8px" @click="removeMark(i)">删除</button></td>
                    </tr>
                    <tr v-if="!annotList.length"><td colspan="10" class="dim" style="text-align:center;padding:18px 0">
                      暂无标注区间 —— 点「开始数据标记」，拖动游标卡尺框选稳定时段后确认标注（可多段累加）</td></tr>
                  </tbody>
                </table>

                <!-- 学习过程 / 结果 -->
                <div v-if="learning === 1" class="dim" style="font-size:12px;margin-top:10px">
                  ① {{ learnResult || !annotList.length ? "" : "" }}正在按标注区间批量取数（出口温度 / 进出口温差 / 进口温度）…
                </div>
                <div v-if="learning === 2" class="dim" style="font-size:12px;margin-top:10px">② 计算标注样本均值并与原基线比对…</div>
                <div v-if="learning === 3 && learnResult" style="font-size:12px;margin-top:10px">
                  <table class="tbl" style="margin:8px 0">
                    <thead><tr><th>指标</th><th>原基线</th><th>学习值</th><th>变化</th></tr></thead>
                    <tbody>
                      <tr><td>出口温度基准 Tc_base</td><td class="mono">{{ learnResult.tcOld }} ℃</td>
                        <td class="mono" style="color:#00d4ff">{{ learnResult.tcNew }} ℃</td>
                        <td class="mono" :style="{ color: learnResult.rise >= 3 ? '#ff4d5e' : '#2ecc71' }">{{ learnResult.rise > 0 ? '+' : '' }}{{ learnResult.rise }} ℃</td></tr>
                      <tr><td>进出口温差基准 ΔT_base</td><td class="mono">{{ learnResult.dtOld }} ℃</td>
                        <td class="mono" style="color:#00d4ff">{{ learnResult.dtNew }} ℃</td>
                        <td class="mono dim">{{ learnResult.dtNew - learnResult.dtOld > 0 ? '+' : '' }}{{ Math.round((learnResult.dtNew - learnResult.dtOld) * 10) / 10 }} ℃</td></tr>
                      <tr><td>进口温度均值 Ts（参考，不参与判定）</td><td class="mono dim">—</td>
                        <td class="mono">{{ learnResult.tsNew }} ℃</td>
                        <td class="mono dim">≈ 出口基准 + 温差基准</td></tr>
                    </tbody>
                  </table>
                  <div class="dim" style="margin-bottom:6px">{{ learnResult.sampleNote }}</div>
                  <table class="tbl" style="margin:8px 0" v-if="learnStat">
                    <thead><tr>
                      <th>标注样本统计</th><th>Ts 进口温度</th><th>Tc 出口温度</th><th>ΔT 进出口温差</th><th>极差（Ts / Tc / ΔT）</th><th>标准差（Ts / Tc / ΔT）</th>
                    </tr></thead>
                    <tbody><tr>
                      <td class="dim">{{ learnStat.usedSegs }} 段 · {{ learnStat.points }} 点{{ learnStat.excluded ? "（剔除 " + learnStat.excluded + " 点）" : "" }}</td>
                      <td class="mono">{{ learnStat.tsMean }} ℃</td>
                      <td class="mono" style="color:#00d4ff">{{ learnStat.tcMean }} ℃</td>
                      <td class="mono" style="color:#2ecc71">{{ learnStat.dtMean }} ℃</td>
                      <td class="mono">{{ learnStat.tsRange }} / {{ learnStat.tcRange }} / {{ learnStat.dtRange }}</td>
                      <td class="mono">{{ learnStat.tsStd }} / {{ learnStat.tcStd }} / {{ learnStat.dtStd }}</td>
                    </tr></tbody>
                  </table>
                  <div class="dim" style="font-size:11px;margin-bottom:6px">
                    样本口径：{{ learnStat && learnStat.stableOnly ? "仅采用稳定窗口样本（Ts / Tc 极差均 < 5℃，视为生产稳定·非排水时间）" : "采用全部标注区间样本（含非稳定段，样本噪声偏大）" }}
                  </div>
                  <div :style="{ color: learnResult.needConfirm ? '#ff9f27' : '#2ecc71', marginBottom: '8px' }">{{ learnResult.note }}</div>
                  <div v-if="learnResult.needConfirm" style="text-align:right">
                    <button class="btn" style="margin-right:8px" @click="applyLearn(false)">✕ 拒绝（保持原基线）</button>
                    <button class="btn primary" @click="applyLearn(true)">✓ 确认生效</button>
                  </div>
                  <div v-else style="text-align:right">
                    <button class="btn primary" @click="applyLearn(true)">✓ 生效并记录</button>
                  </div>
                </div>

                <!-- 备用：自动学习 -->
                <div class="mark-tip" style="margin-top:10px">
                  <span>备用方式：不标注，按「生产稳定 / 非排水窗口」自动取 200 点均值（冷启动或快速复算）</span>
                  <span style="flex:1"></span>
                  <button class="btn ghost" style="padding:2px 10px" :disabled="!!learning" @click="runLearn('auto')">自动学习 200 点</button>
                </div>
              </div>

              <!-- 变更趋势 -->
              <div style="font-weight:bold;margin-bottom:6px">基线变更趋势（每次更改留痕）</div>
              <table class="tbl">
                <thead><tr><th>时间</th><th>触发方式</th><th>出口基准</th><th>温差基准</th><th>操作人</th><th>状态</th><th>说明</th></tr></thead>
                <tbody>
                  <tr v-for="h in blHist(modal)" :key="h.time">
                    <td class="mono dim" style="font-size:11px">{{ h.time }}</td>
                    <td>{{ h.trigger }}</td>
                    <td class="mono">{{ h.tcOld }} → <span style="color:#00d4ff">{{ h.tcNew }}</span> ℃</td>
                    <td class="mono">{{ h.dtOld }} → {{ h.dtNew }} ℃</td>
                    <td class="sub">{{ h.operator }}</td>
                    <td><span :class="histCls(h.status)" style="padding:1px 10px">{{ h.status }}</span></td>
                    <td class="dim" style="font-size:11px">{{ h.note }}</td>
                  </tr>
                  <tr v-if="!blHist(modal).length"><td colspan="7" class="dim" style="text-align:center;padding:18px 0">暂无变更记录（初始基线）</td></tr>
                </tbody>
              </table>
            </div>

            <div v-if="tab === 'life'" style="max-height:380px;overflow-y:auto">
              <div class="tl">
                <div class="tl-item" v-for="(e, i) in (windowLC[modal.id] || [])" :key="i">
                  <div class="tl-time">{{ e.time }} · {{ e.operator }}</div>
                  <div class="tl-desc">
                    <span :style="{ color: lcColor(e.type), fontWeight: 'bold' }">【{{ e.type }}】</span>{{ e.desc }}
                  </div>
                </div>
              </div>
            </div>

            <div class="m-foot">
              <button class="btn ghost" @click="modal = null">关闭</button>
            </div>
          </div>
        </div>
      </div>
    `
  });
})();
