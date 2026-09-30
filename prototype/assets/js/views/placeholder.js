/* ============================================================
   placeholder.js — 非核心模块占位页
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  const INFO = {
    "管网组态图": "按「区域 → 管系 → 疏水阀」三级分组的工艺流程可视化，设备图元按状态着色、异常闪烁，点击进入设备详情。",
    "诊断策略与基线配置": "按阀型的泄漏/堵塞判据阈值维护、评估窗口时长、基线学习采样口径、基线自动重算与趋势预警策略、设备组差异化下发。",
    "设备台账": "疏水阀主数据管理：位号、型号、口径、安装位置、上游用汽设备、二维码生成、批量导入、传感器绑定与通汽自检向导。",
    "数据采集": "采集网关在线状态、采集任务周期调度、通讯报文日志、数据中断补采。",
    "报表统计": "运行日报/周报/月报、故障类型分布与排名、健康度榜、泄漏蒸汽损失折算标煤与费用估算。",
    "系统管理": "用户 / 角色 / 权限（RBAC）、组织机构、数据字典、操作审计日志。"
  };

  window.VIEWS["view-placeholder"] = defineComponent({
    name: "Placeholder",
    computed: {
      store() { return window.Store; },
      name() { return this.store.route.params.module || "功能模块"; },
      desc() { return INFO[this.name] || "该模块按设计文档规划，将在后续原型阶段实现。"; }
    },
    methods: {
      goBack() { location.hash = "#/dashboard"; },
      goMonitor() { location.hash = "#/monitor"; }
    },
    template: `
      <div class="panel glow">
        <div class="ph-wrap">
          <div class="ph-icon" style="font-size:20px;font-weight:bold;color:#00d4ff">开发中</div>
          <div class="ph-title">{{ name }}</div>
          <div class="ph-sub" style="max-width:560px;text-align:center;line-height:1.9">{{ desc }}</div>
          <div class="st-tag st-stop" style="margin-bottom:26px"><i class="st-dot"></i>原型待开发（规划于设计文档第 6 章）</div>
          <div style="display:flex;gap:12px">
            <button class="btn" @click="goMonitor">先看设备监测</button>
            <button class="btn ghost" @click="goBack">返回驾驶舱</button>
          </div>
        </div>
      </div>
    `
  });
})();
