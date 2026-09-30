/* ============================================================
   mock-data.js — 模拟数据引擎
   按设计文档 3.2 节规则生成五状态设备与波形数据
   ============================================================ */
(function () {
  const STATES = {
    normal:   { label: "正常",   cls: "st-normal",   color: "#2ecc71" },
    leak:     { label: "泄漏",   cls: "st-leak",     color: "#ff4d5e" },
    block:    { label: "阻塞",   cls: "st-block",    color: "#ff9f27" },
    stop:     { label: "停产",   cls: "st-stop",     color: "#8a97a8" },
    abnormal: { label: "数据异常", cls: "st-abnormal", color: "#a08cf0" }
  };
  const WORKSHOPS = [
    { id: "w1", name: "动力区域" },
    { id: "w2", name: "酿造区域" },
    { id: "w3", name: "包装区域" }
  ];
  const MODELS = ["FT44H-16C", "CS41H-16C", "STC-100", "TB3F-16C", "CS11H-16C"];
  const TYPES = ["浮球式", "倒立桶", "热力型"];
  const SUPPLIERS = ["斯派莎克", "阿姆斯壮", "艾默生", "台湾DSC", "国产联合"];
  const EQUIPS = ["蒸汽换热器", "烘筒干燥线", "夹套反应釜", "空气预热器", "硫化罐", "蒸发器", "采暖盘管"];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fmt2(n) { return (n < 10 ? "0" : "") + n; }
  const r1 = (v) => Math.round(v * 10) / 10;
  function timeLabel(d) {
    return fmt2(d.getMonth() + 1) + "-" + fmt2(d.getDate()) + " " + fmt2(d.getHours()) + ":" + fmt2(d.getMinutes());
  }

  /* ---------- 波形生成（i 为绝对步长，每步 5 分钟） ---------- */
  function wavePoint(status, i, phase, type, opt) {
    const n = () => rnd(-1.2, 1.2);
    let ts, tc;
    switch (status) {
      case "normal": {
        ts = 175 + 1.2 * Math.sin(i * 0.06 + phase) + n() * 0.7;
        if (type === "浮球式") {
          /* 连续排放型：无排放脉冲，仅小幅纹波（无稳定"非排水时间"） */
          tc = 116.5 + 1.6 * Math.sin(i * 0.06 + phase) + n() * 0.5;
        } else {
          /* 间歇排放型：非排水期平稳低位，周期末出现排放脉冲（冷凝水集中排出） */
          const P = 7;                              // 排放周期约 35 分钟（5min × 7）
          const ph = ((i % P) + P) % P;
          tc = ph === P - 1 ? 148 + n() : 116.5 + n() * 0.5;
        }
        break;
      }
      case "leak": {
        ts = 176 + 1.2 * Math.sin(i * 0.13 + phase) + n() * 0.5;
        if (type === "浮球式" && opt && opt.leakDt != null) {
          /* 浮球式为连续排放型：泄漏（漏汽）时进出口温差被压缩，压缩幅度随劣化阶段加深。
             按标定阶段生成（初期 ΔT≈41℃ → 落入基准 65%~75% 区间；严重 ΔT≈14.6℃ → 低于基准 65%）。
             倒立桶 / 热力型的泄漏波形保持原状，不做改动。 */
          tc = ts - opt.leakDt + n() * 0.8;
        } else {
          tc = 162 + n() * 0.8;
        }
        break;
      }
      case "block": {
        ts = 172 - 0.0025 * i + n() * 0.8;
        tc = Math.max(36, 82 - 0.007 * i) + n() * 0.6;
        break;
      }
      case "stop": {
        const base = Math.max(32, 96 - 0.012 * i);
        ts = base + n() * 0.5;
        tc = base - rnd(1, 4) + n() * 0.4;
        break;
      }
      default: { // abnormal 卡值
        ts = 47 + n() * 0.1;
        tc = 44 + n() * 0.1;
      }
    }
    return { ts: Math.round(ts * 10) / 10, tc: Math.round(tc * 10) / 10 };
  }

  /* ---------- 设备生成 ---------- */
  const STATUS_PLAN = [
    "normal","normal","normal","normal","leak","normal","block","normal","normal","stop",
    "normal","normal","leak","normal","normal","stop","normal","block","normal","normal",
    "leak","normal","normal","normal","normal","stop","normal","leak","normal","normal",
    "normal","normal","abnormal","normal","normal","normal","block","normal","normal","normal",
    "normal","leak","normal","normal","normal"
  ]; // 45 台：normal 32 / leak 5 / block 3 / stop 4 / abnormal 1

  const devices = [];
  const seriesMap = {}; // deviceId -> {times, ts, tc, dt}
  const NOW = new Date();
  const STEP_MIN = 5;
  const POINTS = 288; // 24h

  STATUS_PLAN.forEach((status, idx) => {
    const id = "D" + String(idx + 1).padStart(3, "0");
    const ws = WORKSHOPS[idx % 3];
    const type = TYPES[idx % TYPES.length];
    /* 泄漏劣化阶段标定（确定性，便于复现分级判据）：
       · 浮球式首台泄漏设备取「初期阶段」ΔT≈41℃ → 落入温差基准 65%~75% 区间（验证"连续 3 次 → 泄漏报警"）；
       · 其余泄漏设备取「严重阶段」ΔT≈14.6℃ → 低于温差基准 65%（验证"连续 2 次 → 严重报警"）。 */
    let leakDt = null;
    if (status === "leak") {
      leakDt = type === "浮球式" && !STATUS_PLAN.slice(0, idx).some((s, k) => s === "leak" && TYPES[k % TYPES.length] === "浮球式") ? 41 : 14.6;
    }
    const health =
      status === "normal" ? Math.round(rnd(88, 100)) :
      status === "leak" ? Math.round(rnd(28, 55)) :
      status === "block" ? Math.round(rnd(35, 60)) :
      status === "stop" ? Math.round(rnd(72, 86)) : 0;
    const d = {
      id,
      tagNo: "ST-2024-" + String(idx + 1).padStart(3, "0"),
      name: "疏水阀 " + String(idx + 1).padStart(2, "0") + "#",
      workshopId: ws.id,
      workshopName: ws.name,
      status,
      health,
      model: MODELS[idx % MODELS.length],
      type,
      leakDt,
      caliber: ["DN25", "DN40", "DN50"][idx % 3],
      steamPressure: (idx % 4) * 0.4 + 0.6,
      equip: EQUIPS[idx % EQUIPS.length],
      installDate: "2023-0" + ((idx % 9) + 1) + "-1" + (idx % 9),
      pipePos: ws.name + " " + ((idx % 6) + 1) + "# 管廊",
      supplier: SUPPLIERS[idx % SUPPLIERS.length],
      connect: ["法兰", "螺纹", "焊接"][idx % 3],
      terminalId: "CT-" + String(101 + idx),
      gatewayId: "GW-0" + ((idx % 5) + 1),
      sensorSteam: "SS-" + String(2001 + idx),
      sensorCond: "SC-" + String(2001 + idx),
      // 厂区图布点（viewBox 960x380）
      mx: 0, my: 0,
      sensorCheck: "正常"
    };
    devices.push(d);
  });

  // 布点：三个区域区块
  function layoutMap() {
    const regions = [
      { x: 20,  y: 34, cols: 6, rows: 3, dx: 44, dy: 62 },
      { x: 340, y: 34, cols: 6, rows: 3, dx: 44, dy: 62 },
      { x: 660, y: 34, cols: 6, rows: 3, dx: 42, dy: 62 }
    ];
    const counters = [0, 0, 0];
    devices.forEach((d) => {
      const r = regions[d.workshopId === "w1" ? 0 : d.workshopId === "w2" ? 1 : 2];
      const c = counters[Number(d.workshopId[1]) - 1];
      const col = c % r.cols, row = Math.floor(c / r.cols) % r.rows;
      d.mx = r.x + 50 + col * r.dx;
      d.my = r.y + 58 + row * r.dy;
      counters[Number(d.workshopId[1]) - 1]++;
    });
  }
  layoutMap();

  /* ---------- 序列生成 ---------- */
  /* ---------- 稳定生产窗口特征提取 ----------
     对应诊断策略 ①②：每个评估周期内，进口、出口双侧极差均 < 5℃ 的窗口
     才视为"生产稳定 · 非排水时间"；只有该窗口的均值才与基准比较。
     自最近时刻向前回溯 3 小时，取最近一个满足条件的 30 分钟窗口。 */
  const WIN_MIN = 30, WIN_PTS = Math.round(WIN_MIN / STEP_MIN), RANGE_LIMIT = 5;
  function winStat(id) {
    const s = seriesMap[id];
    const n = s.times.length;
    const rng = (a) => Math.max(...a) - Math.min(...a);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    let best = null;
    const jMin = Math.max(0, n - WIN_PTS - 36);
    for (let j = n - WIN_PTS; j >= jMin; j--) {
      const w = { ts: s.ts.slice(j, j + WIN_PTS), tc: s.tc.slice(j, j + WIN_PTS), dt: s.dt.slice(j, j + WIN_PTS) };
      const rS = rng(w.ts), rC = rng(w.tc);
      if (rS < RANGE_LIMIT && rC < RANGE_LIMIT) { best = Object.assign(w, { rS, rC, startIdx: j }); break; }
    }
    const w = best || { ts: s.ts.slice(n - WIN_PTS), tc: s.tc.slice(n - WIN_PTS), dt: s.dt.slice(n - WIN_PTS) };
    return {
      ok: !!best, spanMin: WIN_MIN,
      tsMean: r1(mean(w.ts)), tcMean: r1(mean(w.tc)), dtMean: r1(mean(w.dt)),
      tsRange: r1(rng(w.ts)), tcRange: r1(rng(w.tc))
    };
  }

  function genSeries(d) {
    const times = [], ts = [], tc = [], dt = [];
    const phase = Math.random() * 6.28;
    for (let k = POINTS - 1; k >= 0; k--) {
      const t = new Date(NOW.getTime() - k * STEP_MIN * 60000);
      const p = wavePoint(d.status, POINTS - 1 - k, phase, d.type, { leakDt: d.leakDt });
      times.push(timeLabel(t));
      ts.push(p.ts); tc.push(p.tc);
      dt.push(Math.round((p.ts - p.tc) * 10) / 10);
    }
    seriesMap[d.id] = { times, ts, tc, dt, phase, absStep: POINTS - 1 };
    const last = ts.length - 1;
    d.tsTemp = ts[last]; d.tcTemp = tc[last]; d.deltaT = dt[last];
    d.waveAmp = Math.round((Math.max(...tc.slice(-14)) - Math.min(...tc.slice(-14))) * 10) / 10;
    d.wavePeriod = d.status === "normal" ? 35 : 0;
    d.lastUpdate = times[last];
    d.win = winStat(d.id);
  }
  devices.forEach(genSeries);

  /* 推进一步（模拟时钟调用） */
  function tick() {
    const t = new Date();
    devices.forEach((d) => {
      const s = seriesMap[d.id];
      s.absStep++;
      const p = wavePoint(d.status, s.absStep, s.phase, d.type, { leakDt: d.leakDt });
      s.times.push(timeLabel(t)); s.ts.push(p.ts); s.tc.push(p.tc);
      s.dt.push(Math.round((p.ts - p.tc) * 10) / 10);
      s.times.shift(); s.ts.shift(); s.tc.shift(); s.dt.shift();
      const last = s.ts.length - 1;
      d.tsTemp = s.ts[last]; d.tcTemp = s.tc[last]; d.deltaT = s.dt[last];
      d.waveAmp = Math.round((Math.max(...s.tc.slice(-14)) - Math.min(...s.tc.slice(-14))) * 10) / 10;
      d.lastUpdate = s.times[last];
      d.win = winStat(d.id);
    });
    return t;
  }

  /* ---------- 诊断结论 ---------- */
  function ruleText(d) {
    const s = seriesMap[d.id];
    const N = 9; // 最近 45 分钟
    const dt = s.dt.slice(-N), amp = d.waveAmp;
    const avgDt = Math.round(dt.reduce((a, b) => a + b, 0) / dt.length);
    switch (d.status) {
      case "normal":
        return "ΔT=" + avgDt + "℃ ∈ [30,120]℃，波动幅度 Ac=" + amp + "℃ ≥ 8℃，呈周期性锯齿波（周期约 35 分钟）→ 判定正常";
      case "leak":
        return d.type === "浮球式"
          ? "ΔT=" + avgDt + "℃（连续排放型，ΔT 被漏汽压缩），Ac=" + amp + "℃ < 5℃，Tc=" + d.tcTemp + "℃ 随漏汽量持续偏高 → 判定泄漏（漏汽）；按温差比值分档：65%~75% 连续 3 次报警、<65% 连续 2 次严重报警"
          : "ΔT=" + avgDt + "℃ < 25℃ 且 Ac=" + amp + "℃ < 5℃，两侧温度趋同（Tc=" + d.tcTemp + "℃ 持续偏高）→ 判定泄漏（漏汽）";
      case "block":
        return "ΔT=" + avgDt + "℃ > 130℃ 且 Ac=" + amp + "℃ < 5℃，冷凝水侧温度持续走低（Tc=" + d.tcTemp + "℃）→ 判定阻塞（不排水）";
      case "stop":
        return "Ts=" + d.tsTemp + "℃ 与 Tc=" + d.tcTemp + "℃ 均低于 60℃ 且双双下降趋近环境温度 → 判定停产";
      default:
        return "传感器数据卡值/超量程，通道无有效波动，通讯超时 → 判定数据异常，请检查传感器";
    }
  }
  const diagResults = devices.map((d, i) => ({
    id: "DG" + String(i + 1).padStart(3, "0"),
    deviceId: d.id,
    time: d.lastUpdate,
    state: d.status,
    rule: ruleText(d),
    confidence: d.status === "abnormal" ? 95 : Math.round(rnd(62, 98)),
    manual: false, reviewer: "", reason: ""
  }));

  /* ---------- 状态变更记录 ---------- */
  const stateChanges = [];
  const CHG_TPL = [
    { from: "normal", to: "leak",  trigger: "自动判定", conf: 88 },
    { from: "leak",   to: "normal", trigger: "人工复核", conf: 92 },
    { from: "normal", to: "block", trigger: "自动判定", conf: 76 },
    { from: "normal", to: "stop",  trigger: "自动判定", conf: 96 },
    { from: "block",  to: "normal", trigger: "人工复核", conf: 81 },
    { from: "normal", to: "normal", trigger: "周期评估", conf: 99 }
  ];
  devices.forEach((d, i) => {
    if (i % 4 === 0) {
      const tpl = CHG_TPL[i % CHG_TPL.length];
      const t = new Date(NOW.getTime() - rnd(1, 40) * 3600000);
      stateChanges.push({
        id: "SC" + String(stateChanges.length + 1).padStart(3, "0"),
        deviceId: d.id, tagNo: d.tagNo, deviceName: d.name,
        from: tpl.from, to: d.status === tpl.to ? tpl.to : d.status,
        trigger: tpl.trigger, confidence: tpl.conf,
        time: timeLabel(t), rule: ruleText(d).slice(0, 44) + "…",
        pending: tpl.conf < 70
      });
    }
  });
  stateChanges.sort((a, b) => (a.time < b.time ? 1 : -1));

  /* ---------- 告警 ---------- */
  const alarms = [];
  const abnormalDevices = devices.filter((d) => ["leak", "block", "abnormal"].includes(d.status));
  abnormalDevices.forEach((d, i) => {
    const lv = d.status === "leak" ? (i % 2 ? 1 : 2) : d.status === "block" ? 2 : 3;
    const ages = [30, 65, 120, 200, 45, 320, 90, 500, 150, 700];
    const t = new Date(NOW.getTime() - ages[i % ages.length] * 60000);
    const states = ["待处理", "待处理", "处理中", "待处理", "已关闭", "处理中", "待处理", "已关闭", "待处理", "已关闭"];
    const st = states[i % states.length];
    alarms.push({
      id: "AL" + String(i + 1).padStart(3, "0"),
      deviceId: d.id, tagNo: d.tagNo, deviceName: d.name, workshop: d.workshopName,
      level: lv,
      content:
        d.status === "leak" ? "严重泄漏报警：出口温度高于出口基准 25℃ 以上 / 进出口温差低于温差基准 65%，连续 2 周期成立，蒸汽损失累计增加" :
        d.status === "block" ? "重度堵塞报警：进出口温差高于温差基准 35% 以上，冷凝水侧温度持续走低，存在积存与水击风险" :
        "传感器数据异常（双通道冻结/卡值），先校准后诊断，请现场检查",
      status: st,
      createdAt: timeLabel(t),
      claimedAt: st !== "待处理" ? timeLabel(new Date(t.getTime() + 12 * 60000)) : "",
      closedAt: st === "已关闭" ? timeLabel(new Date(t.getTime() + 85 * 60000)) : "",
      handler: st === "待处理" ? "" : ["张工", "李工", "王工"][i % 3],
      measure: st === "已关闭" ? "现场检修完成，更换阀芯后恢复正常" : ""
    });
  });
  // 补几条已关闭的历史告警
  for (let k = 0; k < 6; k++) {
    const d = devices[(k * 7) % devices.length];
    const t = new Date(NOW.getTime() - rnd(20, 200) * 3600000);
    alarms.push({
      id: "AL1" + String(10 + k),
      deviceId: d.id, tagNo: d.tagNo, deviceName: d.name, workshop: d.workshopName,
      level: (k % 3) + 1,
      content: ["数据中断超时（>15 分钟未上报）", "ΔT 越限告警", "温度跳变 >20℃/min"][k % 3],
      status: "已关闭",
      createdAt: timeLabel(t),
      claimedAt: timeLabel(new Date(t.getTime() + 9 * 60000)),
      closedAt: timeLabel(new Date(t.getTime() + 66 * 60000)),
      handler: ["张工", "李工", "王工"][k % 3],
      measure: "远程复位正常 / 现场确认误报，已关闭"
    });
  }
  alarms.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  /* ---------- 24h 状态趋势（小时级计数） ---------- */
  const trend24 = { hours: [], normal: [], leak: [], block: [], stop: [], abnormal: [] };
  const hNow = NOW.getHours();
  for (let h = 23; h >= 0; h--) {
    const hh = (hNow - h + 24) % 24;
    trend24.hours.push(fmt2(hh) + ":00");
    trend24.normal.push(30 + Math.round(rnd(0, 4)));
    trend24.leak.push(3 + Math.round(rnd(0, 3)));
    trend24.block.push(2 + Math.round(rnd(0, 2)));
    trend24.stop.push(3 + Math.round(rnd(0, 2)));
    trend24.abnormal.push(1);
  }

  /* ---------- 生命周期记录 ---------- */
  const LIFECYCLE_TPL = [
    { type: "安装", desc: "设备安装投运，完成传感器绑定与通汽自检", offsetDays: 900 },
    { type: "检修", desc: "季度例行检修，清洗过滤网，动作正常", offsetDays: 400 },
    { type: "更换阀芯", desc: "发现阀芯磨损漏汽，更换阀芯组件并验证", offsetDays: 240 },
    { type: "校验", desc: "温度通道现场校验，误差 0.5℃ 以内", offsetDays: 120 },
    { type: "检修", desc: "半年例行检修，浮球机构动作正常", offsetDays: 45 }
  ];
  const lifecycle = {};
  devices.forEach((d, i) => {
    const items = [];
    const count = 3 + (i % 3); // 3~5 条
    for (let k = 0; k < count; k++) {
      const tpl = LIFECYCLE_TPL[k % LIFECYCLE_TPL.length];
      const t = new Date(NOW.getTime() - tpl.offsetDays * 86400000 - (i % 7) * 86400000);
      items.push({
        type: tpl.type,
        desc: tpl.desc,
        operator: ["张工", "李工", "王工", "赵工"][(i + k) % 4],
        time: timeLabel(t).slice(0, 5) + " " + ["09:20", "10:45", "14:10", "16:30"][(i + k) % 4]
      });
    }
    items.sort((a, b) => (a.time < b.time ? 1 : -1));
    lifecycle[d.id] = items;
  });

  /* ---------- 泄漏诊断策略（倒立桶 / 热力型）与基线学习 ---------- */
  const leakStrategy = {
    scope: ["倒立桶", "热力型", "浮球式"],
    sensor: "PT100 热电阻 · 进出口管壁贴装 · 双通道 60s 同步采集",
    types: {
      "倒立桶": {
        periodMin: 20, dataMin: 30, rangeSteam: 5, rangeCond: 5,
        mildTcRise: 10, mildConsecutive: 3,
        severeTcRise: 25, severeDtRatio: 0.65, severeConsecutive: 2,
        blockMildRatio: 1.25, blockHeavyRatio: 1.35,
        blSamples: 200, blPhase: "生产稳定 · 非排水时间", blRecalcDays: 15, blConfirmRise: 3
      },
      "热力型": {
        periodMin: 20, dataMin: 30, rangeSteam: 5, rangeCond: 5,
        mildTcRise: 10, mildConsecutive: 3,
        severeTcRise: 25, severeDtRatio: 0.65, severeConsecutive: 2,
        blockMildRatio: 1.25, blockHeavyRatio: 1.35,
        blSamples: 200, blPhase: "生产稳定 · 非排水时间", blRecalcDays: 15, blConfirmRise: 3
      },
      /* 浮球式为连续排放型：无"生产稳定 · 非排水时间"窗口，出口温度基准本身偏高，
         故不使用「出口温升」判据，改用「进出口温差相对温差基准的比值」单判据分档：
         · 比值 ∈ (65%, 75%) 连续 3 次 → 泄漏报警（初期泄漏）
         · 比值 < 65%        连续 2 次 → 严重泄漏报警
         堵塞判据与其余阀型一致。 */
      "浮球式": {
        periodMin: 20, dataMin: 30,
        dtMildLow: 0.65, dtMildHigh: 0.75, mildConsecutive: 3,
        severeDtRatio: 0.65, severeConsecutive: 2,
        blockMildRatio: 1.25, blockHeavyRatio: 1.35,
        blSamples: 200, blPhase: "连续排放 · 生产稳定段", blRecalcDays: 15, blConfirmRise: 3
      }
    }
  };

  const baselineMap = {};        // deviceId -> 基线信息
  const baselineHistory = {};    // deviceId -> 基线变更记录
  /* 基准取值原则（与现场标定一致）：
     · 健康设备 —— 基准取自本机实测均值（正常工况 200 点学习），偏离度应接近 0；
     · 故障 / 停产设备 —— 无法自证健康，沿用同型号健康基准（上次正常工况实测或模板），
       于是"相对基准偏差"本身就成为故障指示量；
     · i % 7 === 3 的设备按"模板冷启动"处理，验证模板兜底链路。 */
  /* 基准统计口径与诊断口径一致：取窗口代表值（中位数 P50，对排放脉冲不敏感） */
  const p50 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const fleetMean = (key) => {
    const arr = devices.filter((d) => d.status === "normal").map((d) => p50(seriesMap[d.id][key]));
    return arr.reduce((x, y) => x + y, 0) / arr.length;
  };
  const FLEET_DT = fleetMean("dt"), FLEET_TC = fleetMean("tc");
  const jit = (i, k) => (((i * 7 + k * 3) % 5) - 2);      // 确定性抖动 -2 ~ +2
  devices.forEach((d, i) => {
    const own = (key) => p50(seriesMap[d.id][key]);
    const templ = i % 7 === 3;
    let dtBase, tcBase;
    if (d.status === "normal" && !templ) {           // 本机实测学习
      dtBase = r1(own("dt") + jit(i, 1) * 0.4);
      tcBase = r1(own("tc") + jit(i, 2) * 0.4);
    } else {                                          // 健康基准（模板 / 上次正常工况）
      dtBase = r1(FLEET_DT + jit(i, 1) * 1.2);
      tcBase = r1(FLEET_TC + jit(i, 2) * 1.0);
    }
    baselineMap[d.id] = {
      dtBase, tcBase,
      source: templ ? "模板（冷启动）" : d.status === "normal" ? "实测（200 点学习）" : "实测（上次正常工况 · 200 点）",
      sampleCnt: 200,
      /* 基线学习模式：auto = 每 15 天自动重算 + 人工标注均可；manual = 仅人工标注学习生效，自动重算暂停 */
      mode: i % 9 === 4 ? "manual" : "auto",
      /* 自动同步阈值（℃）：学习结果与原基线变化 < 阈值 → 自动生效；≥ 阈值 → 需人工确认 */
      autoTh: [2, 3, 5][i % 3],
      /* 超阈值处理策略（自动模式）：true = 需人工确认后方可生效（默认）；false = 无需确认，直接自动生效 */
      confirmNeeded: i % 7 !== 2,
      learnedAt: "2026-0" + ((i % 8) + 1) + "-1" + (i % 9) + " 10:" + String(10 + (i % 40)).padStart(2, "0"),
      nextAuto: "2026-09-" + String(16 + (i % 12)).padStart(2, "0"),
      cumRise: 0
    };
    baselineHistory[d.id] = [];
  });
  /* 演示：部分设备带基线变更历史（含待确认 / 已拒绝 / 趋势预警样本） */
  (function seedHistory() {
    const demo = [
      { i: 1, rows: [
        { time: "2026-08-18 10:32", trigger: "15天自动重算", tcOld: 112, tcNew: 113.2, dtOld: 56, dtNew: 55.4, operator: "系统自动", status: "已生效", note: "上升 1.2℃ < 3℃，自动生效" },
        { time: "2026-09-02 10:35", trigger: "手动学习", tcOld: 113.2, tcNew: 115.8, dtOld: 55.4, dtNew: 54.1, operator: "陈工", status: "已生效", note: "上升 2.6℃ < 3℃，自动生效" }
      ]},
      { i: 4, rows: [
        { time: "2026-08-30 09:12", trigger: "手动学习", tcOld: 118, tcNew: 121.6, dtOld: 52, dtNew: 47.5, operator: "陈工", status: "已拒绝", note: "上升 3.6℃ 且设备处于泄漏态，疑似基线污染，人工拒绝" },
        { time: "2026-09-10 14:20", trigger: "15天自动重算", tcOld: 118, tcNew: 123.4, dtOld: 52, dtNew: 44.8, operator: "系统自动", status: "待确认", note: "上升 5.4℃ ≥ 3℃，待人工确认" }
      ]},
      { i: 10, rows: [
        { time: "2026-09-01 11:05", trigger: "15天自动重算", tcOld: 118, tcNew: 116.4, dtOld: 56, dtNew: 57.1, operator: "系统自动", status: "已生效", note: "基准下降 1.6℃，自动生效" }
      ]},
      { i: 24, rows: [
        { time: "2026-08-20 10:12", trigger: "15天自动重算", tcOld: 115.8, tcNew: 117.0, dtOld: 57.2, dtNew: 56.6, operator: "系统自动", status: "已生效", note: "上升 1.2℃ < 3℃，自动生效" },
        { time: "2026-09-04 10:15", trigger: "15天自动重算", tcOld: 117.0, tcNew: 120.4, dtOld: 56.6, dtNew: 54.3, operator: "系统自动", status: "待确认", note: "上升 3.4℃ ≥ 自动同步阈值 ±2℃，待人工确认（累计 4.6℃ 未达趋势预警线）" }
      ]},
      { i: 16, rows: [
        { time: "2026-08-15 15:40", trigger: "手动学习", tcOld: 120, tcNew: 122.1, dtOld: 50, dtNew: 49.2, operator: "王工", status: "已生效", note: "检修后基线重建" },
        { time: "2026-09-08 09:25", trigger: "15天自动重算", tcOld: 122.1, tcNew: 125.9, dtOld: 49.2, dtNew: 46.7, operator: "系统自动", status: "待确认", note: "上升 3.8℃ ≥ 3℃，待人工确认；累计上升 5.9℃ 触发趋势预警" }
      ]}
    ];
    demo.forEach(({ i, rows }) => {
      const d = devices[i], b = baselineMap[d.id];
      baselineHistory[d.id] = rows.map((r) => Object.assign({ id: d.id + "-BH-" + r.time }, r));
      const eff = rows.filter((r) => r.status === "已生效");
      const base = eff.length ? eff[eff.length - 1] : rows[0];
      b.tcBase = base.tcNew; b.dtBase = base.dtNew;
      /* 累计上升幅度 = 最新一次计算值（含待确认）相对最早记录基线的整体抬升 */
      b.cumRise = Math.round((rows[rows.length - 1].tcNew - rows[0].tcOld) * 10) / 10;
      if (rows.some((r) => r.status === "待确认")) {
        b.pending = true;
        /* 挂起待确认的学习载荷：面板横幅可直接"确认生效 / 拒绝" */
        const p = rows.find((r) => r.status === "待确认");
        b.pendingLearn = {
          mode: "auto", tcOld: p.tcOld, dtOld: p.dtOld, tcNew: p.tcNew, dtNew: p.dtNew,
          tsNew: Math.round((p.tcNew + p.dtNew) * 10) / 10,
          rise: Math.round((p.tcNew - p.tcOld) * 10) / 10,
          th: b.autoTh || 3, points: 200
        };
      }
    });
  })();

  /* ============================================================
     人工标注学习
     · annoSeries  最近 4 小时 · 1 分钟步长的高分辨率时序（Ts / Tc / ΔT）
     · rangeStat   区间特征统计（均值、极差、稳定性判定）
     · baselineAnnot  deviceId -> 已确认的人工标注区间
     波形约定：倒立桶 / 热力型为间歇排放（周期约 90 分钟，排放脉冲 3 分钟，
     非排水时间为平稳平台段）；浮球式为连续排放（无排放脉冲，小幅纹波）。
     ============================================================ */
  const ANNO_POINTS = 240;      // 4 小时 × 1 分钟
  const ANNO_STEP_MIN = 1;
  const PULSE_P = 90;           // 排放周期（分钟）

  function annoPoint(type, status, i, phase) {
    const n = (a) => rnd(-a, a);
    const intermittent = type !== "浮球式";
    const ph = ((i % PULSE_P) + PULSE_P) % PULSE_P;
    const pulse = intermittent && ph >= PULSE_P - 3;   // 排放脉冲：3 分钟
    let ts, tc;
    switch (status) {
      case "normal": {
        ts = 175 + 1.2 * Math.sin(i * 0.012 + phase) + n(0.7);
        if (pulse) {
          const k = ph - (PULSE_P - 3);
          tc = 116.5 + [10, 31.5, 14][k] + n(1.2);
        } else {
          tc = 116.5 + (intermittent ? 0 : 1.6 * Math.sin(i * 0.06 + phase)) + n(0.5);
        }
        break;
      }
      case "leak": {
        ts = 176 + 1.0 * Math.sin(i * 0.012 + phase) + n(0.6);
        tc = 160 + n(0.7);                    // 两侧趋同、无周期性波动
        break;
      }
      case "block": {
        ts = 173 - 0.00035 * i + n(0.7);
        tc = Math.max(36, 84 - 0.0012 * i) + n(0.5);
        break;
      }
      case "stop": {
        const base = Math.max(31, 98 - 0.0022 * i);
        ts = base + n(0.5);
        tc = base - rnd(1.5, 4) + n(0.4);
        break;
      }
      default: { ts = 47 + n(0.08); tc = 44 + n(0.08); }   // 卡值 / 断链
    }
    return { ts: Math.round(ts * 10) / 10, tc: Math.round(tc * 10) / 10 };
  }

  const annoCache = {};
  function annoSeries(id) {
    if (annoCache[id]) return annoCache[id];
    const d = devices.find((x) => x.id === id) || devices[0];
    const phase = (seriesMap[id] && seriesMap[id].phase) || 1.3;
    const times = [], ts = [], tc = [], dt = [];
    for (let k = ANNO_POINTS - 1; k >= 0; k--) {
      const min = -k * ANNO_STEP_MIN;                       // 0 = 最新时刻
      const t = new Date(NOW.getTime() + min * 60000);
      const p = annoPoint(d.type, d.status, min, phase);
      times.push(timeLabel(t));
      ts.push(p.ts); tc.push(p.tc);
      dt.push(Math.round((p.ts - p.tc) * 10) / 10);
    }
    const res = { deviceId: d.id, times, ts, tc, dt, stepMin: ANNO_STEP_MIN, type: d.type, status: d.status };
    annoCache[id] = res;
    return res;
  }
  function annoReset(id) { if (id) delete annoCache[id]; else Object.keys(annoCache).forEach((k) => delete annoCache[k]); }

  function rangeStat(id, a, b) {
    const s = annoSeries(id);
    const n = s.times.length;
    a = Math.max(0, Math.min(a, n - 1));
    b = Math.max(a, Math.min(b, n - 1));
    const win = (arr) => arr.slice(a, b + 1);
    const mean = (arr) => { const v = win(arr); return v.reduce((x, y) => x + y, 0) / v.length; };
    const rng = (arr) => { const v = win(arr); return r1(Math.max(...v) - Math.min(...v)); };
    const tsRange = rng(s.ts), tcRange = rng(s.tc);
    return {
      startIdx: a, endIdx: b,
      startTime: s.times[a], endTime: s.times[b],
      count: b - a + 1,
      spanMin: (b - a) * ANNO_STEP_MIN,
      tsMean: r1(mean(s.ts)), tcMean: r1(mean(s.tc)), dtMean: r1(mean(s.dt)),
      tsRange, tcRange,
      stable: tsRange < 5 && tcRange < 5,     // 稳定性门控：双侧极差均 < 5℃
      pulse: tcRange >= 20                    // 含排放脉冲
    };
  }

  const baselineAnnot = {};                   // deviceId -> 已确认的标注区间
  devices.forEach((d) => { baselineAnnot[d.id] = []; });

  /* 演示：预置人工标注区间（打开「基线学习」即可看到黄色标注段与可学习样本） */
  (function seedAnnot() {
    const mk = (i, a, b, operator) => {
      const d = devices[i];
      return Object.assign({}, rangeStat(d.id, a, b), {
        id: d.id + "-MK-SEED" + a, deviceId: d.id, operator: operator, createdAt: "2026-09-15 09:20"
      });
    };
    baselineAnnot[devices[1].id].push(mk(1, 6, 36, "陈工"), mk(1, 100, 130, "陈工"));  // 两段稳定非排水窗口
    baselineAnnot[devices[2].id].push(mk(2, 46, 70, "王工"));                          // 含排放脉冲，演示剔除提示
  })();

  /* ============================================================
     基线服务层 —— 把「人工标注学习 → 基准值」贯通到全系统各页面
     · gateReason       诊断前置门控（停产 / 数据异常不在生产稳定态）
     · relDiag          相对基准诊断（唯一判定入口，全站复用）
     · baselineInfo     单台设备基线态势（列表 / 详情 / 驾驶舱）
     · baselineSummary  全厂基线健康度汇总（驾驶舱 / 诊断策略页）
     ============================================================ */
  const DEF_PS = { mildTcRise: 10, mildConsecutive: 3, severeTcRise: 25, severeDtRatio: 0.65, severeConsecutive: 2, blockMildRatio: 1.25, blockHeavyRatio: 1.35 };
  function psOf(type) { return Object.assign({}, DEF_PS, leakStrategy.types[type] || {}); }

  /* 前置门控：只有「生产稳定态」才开展相对基准诊断 */
  function gateReason(d) {
    if (d.status === "abnormal") return "数据异常（双通道冻结 / 跳变，先校准后诊断）";
    if (d.status === "stop") return "停产（非生产稳定态，不参与诊断）";
    return "";
  }

  function baselineInfo(d) {
    const b = baselineMap[d.id] || {};
    const pending = !!b.pending, cumRise = b.cumRise || 0, templ = /模板/.test(b.source || "");
    return {
      dtBase: b.dtBase, tcBase: b.tcBase, source: b.source,
      learnedAt: b.learnedAt, nextAuto: b.nextAuto, sampleCnt: b.sampleCnt || 200,
      mode: b.mode || "auto",
      autoTh: b.autoTh || 3,
      confirmNeeded: b.confirmNeeded !== false,
      cumRise, pending, templ, warnRise: 5,
      state: pending ? "待确认" : cumRise >= 5 ? "趋势预警" : templ ? "模板冷启动" : "已生效",
      annotCnt: (baselineAnnot[d.id] || []).length
    };
  }

  /** 相对基准诊断：列表 / 详情 / 诊断总览 / 驾驶舱统一调用本函数
      比较量一律取"稳定生产窗口均值"（d.win），不用瞬时采样值。 */
  function relDiag(d) {
    const info = baselineInfo(d);
    const ps = psOf(d.type);
    const w = d.win || { ok: false, spanMin: 30, tcMean: d.tcTemp, dtMean: d.deltaT, tsRange: 0, tcRange: 0 };
    const tcRise = r1(w.tcMean - info.tcBase);
    const dtRatio = info.dtBase ? w.dtMean / info.dtBase : 1;
    const dtPct = Math.round((dtRatio - 1) * 100);
    const isFloat = d.type === "浮球式";         // 连续排放型：无稳定非排水窗口，采用温差比值单判据
    const win = w.spanMin + "min窗口均值（Ts极差 " + w.tsRange + "℃ / Tc极差 " + w.tcRange + "℃）";
    const out = { info, ps, win: w, tcRise, dtRatio, dtPct, isFloat, applicable: true };
    const gate = gateReason(d);
    if (gate) return Object.assign(out, { key: "na", label: "不适用", cls: "st-stop", applicable: false, reason: gate });

    /* ① 堵塞：进出口温差相对基准抬升（全部阀型适用，判据一致） */
    if (dtRatio >= ps.blockHeavyRatio) return Object.assign(out, { key: "blockHeavy", label: "重度堵塞", cls: "st-block",
      reason: "温差 " + win + " " + w.dtMean + "℃ 高于温差基准 " + info.dtBase + "℃ 达 +" + dtPct + "%（≥" + Math.round((ps.blockHeavyRatio - 1) * 100) + "%）→ 重度堵塞" });
    if (dtRatio >= ps.blockMildRatio) return Object.assign(out, { key: "blockMild", label: "轻度堵塞", cls: "st-block",
      reason: "温差 " + win + " " + w.dtMean + "℃ 高于温差基准 " + info.dtBase + "℃ 达 +" + dtPct + "%（≥" + Math.round((ps.blockMildRatio - 1) * 100) + "%）→ 轻度堵塞（早期劣化）" });

    /* ② 浮球式泄漏：温差比值分档 + 连续评估次数（每 periodMin 评估一次，取最近 dataMin 的 ΔT 均值） */
    if (isFloat) {
      const fe = floatEval(d);
      const mildTxt = Math.round((ps.dtMildLow != null ? ps.dtMildLow : 0.65) * 100) + "%~" + Math.round((ps.dtMildHigh != null ? ps.dtMildHigh : 0.75) * 100) + "%";
      const rPct = Math.round(fe.last.ratio * 100);
      if (fe.consecSevere >= ps.severeConsecutive) return Object.assign(out, { key: "leakSevere", label: "严重泄漏", cls: "st-leak",
        consec: fe.consecSevere, floatEval: fe,
        reason: "温差 " + win + " ΔT 均值 " + fe.last.dtMean + "℃ 低于温差基准 " + info.dtBase + "℃ 的 " + rPct + "%（<" + Math.round(ps.severeDtRatio * 100) + "%），按每 " + ps.periodMin + "min 评估、连续 " + fe.consecSevere + " 次成立（≥" + ps.severeConsecutive + " 次）→ 严重泄漏报警" });
      if (fe.consecMild >= ps.mildConsecutive) return Object.assign(out, { key: "leakMild", label: "泄漏报警", cls: "st-leak",
        consec: fe.consecMild, floatEval: fe,
        reason: "温差 " + win + " ΔT 均值 " + fe.last.dtMean + "℃ 为温差基准 " + info.dtBase + "℃ 的 " + rPct + "%（" + mildTxt + "），按每 " + ps.periodMin + "min 评估、连续 " + fe.consecMild + " 次成立（≥" + ps.mildConsecutive + " 次）→ 泄漏报警" });
      if (fe.consecMild > 0 || fe.consecSevere > 0) {
        const c = Math.max(fe.consecMild, fe.consecSevere);
        return Object.assign(out, { key: "leakSuspect", label: "疑似泄漏", cls: "st-leak",
          consec: c, watch: true, floatEval: fe,
          reason: "温差 " + win + " ΔT 均值 " + fe.last.dtMean + "℃ 为温差基准的 " + rPct + "%，已连续 " + c + " 次落入预警区间但未达报警次数（轻度需 " + ps.mildConsecutive + " 次 / 严重需 " + ps.severeConsecutive + " 次）→ 列入观察序列，暂不告警" });
      }
      return Object.assign(out, { key: "ok", label: "正常", cls: "st-normal", consec: 0, floatEval: fe,
        reason: "温差 " + win + " ΔT 均值 " + fe.last.dtMean + "℃ 为温差基准 " + info.dtBase + "℃ 的 " + rPct + "%，位于正常带（≥" + mildTxt.split("~")[1] + "）→ 判定正常；浮球式按温差比值单判据评估" });
    }

    /* ③ 间歇排放型（倒立桶 / 热力型）泄漏：出口温升 + 温差缩水 双证据链 */
    if (tcRise >= ps.severeTcRise) return Object.assign(out, { key: "leakSevere", label: "严重泄漏", cls: "st-leak",
      reason: "温差 " + win + " 出口均值 " + w.tcMean + "℃ 高于出口基准 " + info.tcBase + "℃ 达 +" + tcRise + "℃（≥" + ps.severeTcRise + "℃），连续 " + ps.severeConsecutive + " 周期成立 → 严重泄漏报警" });
    if (dtRatio <= ps.severeDtRatio) return Object.assign(out, { key: "leakSevere", label: "严重泄漏", cls: "st-leak",
      reason: "温差 " + win + " " + w.dtMean + "℃ 低于温差基准 " + info.dtBase + "℃ 的 " + Math.round(ps.severeDtRatio * 100) + "%（" + r1(info.dtBase * ps.severeDtRatio) + "℃），连续 " + ps.severeConsecutive + " 周期成立 → 严重泄漏报警" });
    if (tcRise >= ps.mildTcRise) return Object.assign(out, { key: "leakMild", label: "泄漏报警", cls: "st-leak",
      reason: "温差 " + win + " 出口均值 " + w.tcMean + "℃ 高于出口基准 " + info.tcBase + "℃ 达 +" + tcRise + "℃（≥" + ps.mildTcRise + "℃），连续 " + ps.mildConsecutive + " 周期成立 → 泄漏报警" });
    /* ④ 基准带内 */
    return Object.assign(out, { key: "ok", label: "正常", cls: "st-normal",
      reason: "温差 " + win + " " + w.dtMean + "℃ 相对温差基准 " + info.dtBase + "℃ 偏离 " + (dtPct >= 0 ? "+" : "") + dtPct + "%，出口均值相对基准 " + (tcRise >= 0 ? "+" : "") + tcRise + "℃ → 位于基准带内，判定正常" });
  }

  /* ---------- 浮球式泄漏评估序列 ----------
     按「每 periodMin 评估一次、每次取最近 dataMin 的 ΔT 均值」回溯生成评估序列，
     并统计最近连续落入各判据区间的次数（命中 +1，未命中即断链）。
     判据区间：严重 = 比值 < 65%；轻度 = 65% ≤ 比值 < 75%。 */
  function floatEval(d) {
    const ps = psOf(d.type);
    const s = seriesMap[d.id];
    const base = (baselineMap[d.id] || {}).dtBase;
    const per = Math.max(1, Math.round(ps.periodMin / STEP_MIN));
    const w = Math.max(2, Math.round(ps.dataMin / STEP_MIN));
    const n = s.times.length;
    const list = [];
    for (let end = n - 1; end - w + 1 >= 0; end -= per) {
      const seg = s.dt.slice(end - w + 1, end + 1);
      const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
      list.push({ end, time: s.times[end], dtMean: r1(mean), ratio: base ? mean / base : 1 });
    }
    const run = (test) => { let c = 0; for (const e of list) { if (test(e)) c++; else break; } return c; };
    const mildLow = ps.dtMildLow != null ? ps.dtMildLow : 0.65;
    const mildHigh = ps.dtMildHigh != null ? ps.dtMildHigh : 0.75;
    const severeRatio = ps.severeDtRatio != null ? ps.severeDtRatio : 0.65;
    const consecSevere = run((e) => e.ratio < severeRatio);
    const consecMild = run((e) => e.ratio >= mildLow && e.ratio < mildHigh);
    const needMild = ps.mildConsecutive || 3, needSevere = ps.severeConsecutive || 2;
    return {
      base, periodMin: ps.periodMin, dataMin: ps.dataMin,
      list, points: list.length,
      last: list[0] || { dtMean: w && d.deltaT, ratio: 1, time: d.lastUpdate },
      mildLow, mildHigh, severeRatio, needMild, needSevere,
      consecMild, consecSevere,
      verdict: consecSevere >= needSevere ? "严重泄漏"
        : consecMild >= needMild ? "泄漏报警"
        : (consecMild > 0 || consecSevere > 0) ? "观察中" : "正常"
    };
  }

  const GRADE_ORDER = [
    { key: "ok", label: "正常", cls: "st-normal", color: "#2ecc71" },
    { key: "blockMild", label: "轻度堵塞", cls: "st-block", color: "#ff9f27" },
    { key: "blockHeavy", label: "重度堵塞", cls: "st-block", color: "#ff4d5e" },
    { key: "leakMild", label: "泄漏报警", cls: "st-leak", color: "#ff9f27" },
    { key: "leakSevere", label: "严重泄漏", cls: "st-leak", color: "#ff4d5e" },
    { key: "leakSuspect", label: "疑似泄漏", cls: "st-leak", color: "#f0997b" },
    { key: "na", label: "不适用", cls: "st-stop", color: "#8a97a8" }
  ];

  function baselineSummary() {
    const s = { total: devices.length, ok: 0, pending: 0, warn: 0, templ: 0, autoCnt: 0, manualCnt: 0, pendingList: [], warnList: [], grade: {} };
    devices.forEach((d) => {
      const i = baselineInfo(d);
      if (i.mode === "manual") s.manualCnt++; else s.autoCnt++;
      if (i.pending) { s.pending++; s.pendingList.push({ d, i }); }
      if (i.cumRise >= i.warnRise) { s.warn++; s.warnList.push({ d, i }); }
      if (i.templ) s.templ++;
      if (!i.pending && i.cumRise < i.warnRise && !i.templ) s.ok++;
      const g = relDiag(d).key;
      s.grade[g] = (s.grade[g] || 0) + 1;
    });
    const byRise = (a, b) => b.i.cumRise - a.i.cumRise;
    s.pendingList.sort(byRise); s.warnList.sort(byRise);
    s.gradeList = GRADE_ORDER.map((g) => Object.assign({}, g, { n: s.grade[g.key] || 0 }));
    return s;
  }

  /* 结论文案切换为「相对基准」表述（基线定义后回填，保证与诊断策略页一致） */
  diagResults.forEach((r) => {
    const d = devices.find((x) => x.id === r.deviceId);
    if (!d) return;
    const rd = relDiag(d);
    r.grade = rd.key;
    r.rule = rd.reason;
  });
  stateChanges.forEach((c) => {
    const d = devices.find((x) => x.id === c.deviceId);
    if (d) { const rd = relDiag(d); c.rule = rd.reason; c.grade = rd.key; }
  });

  /* ---------- 导出工具 ----------
     原型阶段直接在前端生成 CSV（带 UTF-8 BOM，Excel 双击不乱码），
     让「导出」按钮产生真实可用的文件，而不是只弹提示。 */
  function downloadCsv(name, rows) {
    if (!rows || !rows.length) { window.showToast && window.showToast("当前无数据可导出"); return; }
    const heads = Object.keys(rows[0]);
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [heads.join(",")].concat(rows.map((r) => heads.map((h) => esc(r[h])).join(","))).join("\r\n");
    const t = new Date(), f = (x) => (x < 10 ? "0" : "") + x;
    const stamp = t.getFullYear() + f(t.getMonth() + 1) + f(t.getDate()) + "_" + f(t.getHours()) + f(t.getMinutes());
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name + "_" + stamp + ".csv";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    window.showToast && window.showToast("已导出 " + rows.length + " 行 → " + a.download);
  }

  window.MOCK = {
    STATES, WORKSHOPS, devices, seriesMap, alarms, diagResults, stateChanges, trend24, lifecycle,
    leakStrategy, baselineMap, baselineHistory, baselineAnnot,
    ANNO_POINTS, PULSE_P,
    annoSeries, annoReset, rangeStat, downloadCsv, floatEval,
    baseline: { info: baselineInfo, diag: relDiag, summary: baselineSummary, gate: gateReason, ps: psOf, gradeOrder: GRADE_ORDER },
    tick, ruleText
  };
})();
