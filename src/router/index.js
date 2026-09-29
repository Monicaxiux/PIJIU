import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { isAuthenticated } from '../utils/auth'

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true, title: '登录' } },
  { path: '/', component: AppLayout, meta: { requiresAuth: true }, children: [
  { path: '', redirect: '/dashboard' },
  { path: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '驾驶舱', subtitle: '全厂运行态势与风险总览' } },
  { path: 'monitor', component: () => import('../views/MonitorView.vue'), meta: { title: '设备监测', subtitle: '45 台设备实时运行参数' } },
  { path: 'monitor/:id', component: () => import('../views/DeviceDetailView.vue'), meta: { title: '设备详情', subtitle: '诊断曲线与判定依据' } },
  { path: 'diag/results', component: () => import('../views/DiagResultsView.vue'), meta: { title: '诊断结果', subtitle: '状态分布与区域风险画像' } },
  { path: 'diag/strategy', component: () => import('../views/DiagStrategyView.vue'), meta: { title: '诊断策略与基线配置', subtitle: '泄漏、堵塞判定与基线管理' } },
  { path: 'diag/strategy/:type', component: () => import('../views/DiagStrategyView.vue'), meta: { title: '诊断策略与基线配置', subtitle: '按阀型维护判定策略' } },
  { path: 'diag/trend', component: () => import('../views/TrendView.vue'), meta: { title: '温差趋势对比', subtitle: '多设备 ΔT 叠加分析' } },
  { path: 'diag/state', component: () => import('../views/StateView.vue'), meta: { title: '状态变更记录', subtitle: '追踪诊断变化与人工复核' } },
  { path: 'alarm/realtime', component: () => import('../views/AlarmRealtimeView.vue'), meta: { title: '实时告警', subtitle: '分级处置与闭环跟踪' } },
  { path: 'alarm/history', component: () => import('../views/AlarmHistoryView.vue'), meta: { title: '历史告警', subtitle: '处理记录与时效统计' } },
  { path: 'alarm/rule', component: () => import('../views/AlarmRuleView.vue'), meta: { title: '告警规则', subtitle: '分级阈值与通知策略' } },
  { path: 'ledger', component: () => import('../views/LedgerView.vue'), meta: { title: '设备台账', subtitle: '疏水阀资产与生命周期档案' } },
  { path: 'todo/:module', component: () => import('../views/TodoView.vue'), meta: { title: '模块规划', subtitle: '能力建设路线图' } }
  ] }
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach(to => {
  const authenticated = isAuthenticated()
  if (to.meta.public && authenticated) return '/dashboard'
  if (to.matched.some(record => record.meta.requiresAuth) && !authenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
