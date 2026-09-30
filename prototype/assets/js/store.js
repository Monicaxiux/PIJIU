/* ============================================================
   store.js — 全局响应式状态 + 模拟时钟 + hash 路由
   ============================================================ */
(function () {
  const { createApp, reactive } = Vue;

  const route = reactive({ path: "/dashboard", params: {} });

  function parseHash() {
    const h = location.hash.replace(/^#/, "") || "/dashboard";
    const parts = h.split("/").filter(Boolean);
    route.params = {};
    if (parts[0] === "monitor" && parts[1]) {
      route.path = "/monitor/detail"; route.params.id = parts[1];
    } else if (parts[0] === "ledger" && parts[1]) {
      /* 深链：设备台账 → 指定设备档案 / 页签（供巡检链接直达基线标注使用）
         #/ledger/<设备ID或位号>/<base|sensor|baseline|life>[/hist] */
      route.path = "/ledger";
      route.params.deviceId = decodeURIComponent(parts[1]);
      route.params.tab = parts[2] || "";
      route.params.extra = parts[3] || "";
    } else if (parts[0] === "diag" && parts[1] === "strategy" && parts[2]) {
      /* 深链：诊断策略 → 指定阀型页签（#/diag/strategy/<倒立桶|热力型|浮球式>） */
      route.path = "/diag/strategy";
      route.params.type = decodeURIComponent(parts[2]);
    } else if (parts[0] === "todo") {
      route.path = "/todo"; route.params.module = decodeURIComponent(parts[1] || "");
    } else {
      route.path = "/" + (parts.join("/") || "dashboard");
    }
  }
  window.addEventListener("hashchange", parseHash);

  const store = reactive({
    route,
    now: new Date(),
    simCount: 0,
    /* 数据版本号：每次模拟时钟推进 / 基线学习生效时 +1。
       各页面的 computed 只要读取它，就能在底层 MOCK 数据变化后正确重算
       （MOCK 数据本身非响应式，靠该信号驱动）。 */
    dataVer: 1,
    autoRefresh: true,
    toast: "",
    alarms: MOCK.alarms,
    devices: MOCK.devices,
    diagResults: MOCK.diagResults,
    stateChanges: MOCK.stateChanges,
    /* 视图状态持久化：筛选条件 / 排序 / 页签在页面切换与刷新后保留 */
    pref(key, def) {
      try {
        const raw = sessionStorage.getItem("stv:" + key);
        return raw === null ? def : JSON.parse(raw);
      } catch (e) { return def; }
    },
    setPref(key, val) {
      try { sessionStorage.setItem("stv:" + key, JSON.stringify(val)); } catch (e) {}
    },
    /* 数据变更信号（模拟时钟推进或基线学习生效后调用） */
    bump() { this.dataVer++; },
    pendingAlarms() { return this.alarms.filter((a) => a.status === "待处理").length; }
  });
  parseHash();

  /* 模拟时钟：现实 6 秒 = 平台 5 分钟 */
  setInterval(() => {
    if (!store.autoRefresh) return;
    /* 页面不可见时不做计算与渲染，回到前台立即补一帧 */
    if (typeof document !== "undefined" && document.hidden) return;
    MOCK.tick();
    store.now = new Date();
    store.simCount++;
    store.dataVer++;
    // 偶发新告警（每 ~40 个 tick 一条）
    if (store.simCount % 40 === 0) {
      const pool = store.devices.filter((d) => ["leak", "block"].includes(d.status));
      const d = pool[Math.floor(Math.random() * pool.length)];
      if (d) {
        const t = store.now;
        const two = (n) => (n < 10 ? "0" : "") + n;
        store.alarms.unshift({
          id: "AL" + Date.now(),
          deviceId: d.id, tagNo: d.tagNo, deviceName: d.name, workshop: d.workshopName,
          level: d.status === "leak" ? 1 : 2,
          content: d.status === "leak" ? "泄漏状态持续，蒸汽损失累计增加" : "阻塞状态持续，冷凝水积存风险上升",
          status: "待处理",
          createdAt: two(t.getHours()) + ":" + two(t.getMinutes()),
          claimedAt: "", closedAt: "", handler: "", measure: ""
        });
      }
    }
  }, 6000);

  window.Store = store;
  /* 供各页面 computed 声明「数据版本」依赖：MOCK 原始数据非响应式，
     组件只要调用一次 dataVer()，就能在模拟时钟推进或基线学习生效后正确重算。 */
  window.dataVer = function () { return store.dataVer; };
  window.showToast = function (msg) {
    store.toast = msg;
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { store.toast = ""; }, 2600);
  };
  /* ECharts 公共工具 */
  window.chartUtil = {
    make(el, option) {
      if (!el) return null;
      const c = echarts.init(el);
      c.setOption(option);
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => c.resize());
        ro.observe(el);
      }
      return c;
    },
    baseAxis() {
      return {
        axisLine: { lineStyle: { color: "rgba(0,212,255,0.3)" } },
        axisLabel: { color: "#7fa3c9", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(0,212,255,0.08)" } }
      };
    }
  };
  window.STORE_APP = { createApp };
})();
