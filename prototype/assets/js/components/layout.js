/* ============================================================
   layout.js — 侧边导航 + 顶栏 + 路由出口
   ============================================================ */
(function () {
  const { defineComponent } = Vue;

  const MENUS = [
    { group: "", items: [{ key: "/dashboard", icon: "◉", name: "驾驶舱 · 总览大屏" }] },
    {
      group: "实时监测",
      items: [
        { key: "/monitor", icon: "▤", name: "设备监测列表" }
      ]
    },
    {
      group: "诊断分析",
      items: [
        { key: "/diag/results", icon: "◎", name: "诊断结果总览" },
        { key: "/diag/trend", icon: "∠", name: "温差趋势对比" },
        { key: "/diag/strategy", icon: "⚙", name: "诊断策略与基线配置" }
      ]
    },
    {
      group: "告警管理",
      items: [
        { key: "/alarm/history", icon: "☰", name: "历史告警" },
        { key: "/alarm/rule", icon: "✎", name: "告警规则配置" }
      ]
    },
    {
      group: "更多模块",
      items: [
        { key: "/ledger", icon: "▦", name: "设备台账" },
        { key: "/todo/" + encodeURIComponent("数据采集"), icon: "↯", name: "数据采集" },
        { key: "/todo/" + encodeURIComponent("报表统计"), icon: "▥", name: "报表统计" },
        { key: "/todo/" + encodeURIComponent("系统管理"), icon: "⚒", name: "系统管理" }
      ]
    }
  ];

  const CRUMBS = {
    "/dashboard": ["驾驶舱", "全厂疏水阀运行总览"],
    "/monitor": ["实时监测", "设备监测列表"],
    "/monitor/detail": ["实时监测", "设备监测详情"],
    "/ledger": ["设备台账", "疏水阀档案管理"],
    "/diag/results": ["诊断分析", "诊断结果总览"],
    "/diag/trend": ["诊断分析", "温差趋势对比"],
    "/diag/strategy": ["诊断分析", "诊断策略与基线配置"],
    "/diag/state": ["诊断分析", "状态变更记录"],
    "/alarm/realtime": ["告警管理", "实时告警"],
    "/alarm/history": ["告警管理", "历史告警"],
    "/alarm/rule": ["告警管理", "告警规则配置"],
    "/todo": ["功能模块", "原型待开发"]
  };

  window.LayoutRoot = defineComponent({
    name: "LayoutRoot",
    data() {
      return { menus: MENUS, collapsed: false };
    },
    computed: {
      store() { return window.Store; },
      crumb() {
        const c = CRUMBS[this.store.route.path];
        if (this.store.route.path === "/monitor/detail") {
          const d = this.store.devices.find((x) => x.id === this.store.route.params.id);
          return ["实时监测", d ? d.tagNo + " · " + d.name : "设备监测详情"];
        }
        if (this.store.route.path === "/todo") return ["功能模块", this.store.route.params.module + " · 原型待开发"];
        return c || ["驾驶舱", ""];
      },
      clock() {
        const t = this.store.now;
        const two = (n) => (n < 10 ? "0" : "") + n;
        return t.getFullYear() + "-" + two(t.getMonth() + 1) + "-" + two(t.getDate()) + " " +
          two(t.getHours()) + ":" + two(t.getMinutes()) + ":" + two(t.getSeconds());
      },
      /* 基线待办数：待人工确认 + 趋势预警（与驾驶舱、策略页同源） */
      baselineTodo() {
        window.dataVer();
        const s = window.MOCK.baseline.summary();
        return s.pending + s.warn;
      }
    },
    methods: {
      go(key) { location.hash = "#" + key; },
      toggleAlarm() { this.go("/alarm/realtime"); },
      toggleBaseline() { this.go("/diag/strategy"); },
      isActive(item) {
        if (item.key === "/monitor") return this.store.route.path === "/monitor" || this.store.route.path === "/monitor/detail";
        return this.store.route.path === item.key;
      }
    },
    template: `
      <aside class="app-aside" :class="{ collapsed }">
        <div class="logo" @click="collapsed = !collapsed">
          <div class="logo-mark">汽</div>
          <span class="logo-text" v-if="!collapsed">疏水阀在线监测</span>
        </div>
        <nav class="menu">
          <template v-for="(g, gi) in menus" :key="gi">
            <div class="menu-group-title" v-if="g.group && !collapsed">{{ g.group }}</div>
            <div class="menu-item" v-for="m in g.items" :key="m.key"
                 :class="{ active: isActive(m), 'menu-sub': m.sub }" @click="go(m.key)">
              <i class="mi-icon">{{ m.iconText || m.icon }}</i>
              <span v-if="!collapsed">{{ m.name }}</span>
            </div>
          </template>
        </nav>
      </aside>
      <main class="app-main">
        <header class="topbar">
          <div class="crumb">{{ crumb[0] }}<small>{{ crumb[1] }}</small></div>
          <div class="spacer"></div>
          <span class="dim" style="font-size:11px">模拟时钟（1s≈50min）</span>
          <span class="sim-clock">{{ clock }}</span>
          <span class="chip" v-if="baselineTodo" style="margin-right:4px" @click="toggleBaseline"
                title="基线待人工确认 / 趋势预警（点击进入诊断策略与基线配置）">
            基线待办 <span class="chip-n">{{ baselineTodo }}</span>
          </span>
          <span class="bell" @click="toggleAlarm" title="实时告警">
            ⚿<span class="badge" v-if="store.pendingAlarms()">{{ store.pendingAlarms() }}</span>
          </span>
          <div class="avatar" title="能源管理工程师 · 陈工">陈</div>
        </header>
        <div class="page-body">
          <component :is="$root.currentView" />
        </div>
        <transition name="fade">
          <div v-if="store.toast" style="position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:200;
               background:rgba(0,212,255,0.12);border:1px solid var(--border-glow);color:var(--cyan);
               padding:9px 22px;border-radius:8px;font-size:13px;box-shadow:0 0 20px rgba(0,212,255,0.25)">
            {{ store.toast }}
          </div>
        </transition>
      </main>
    `
  });
})();
