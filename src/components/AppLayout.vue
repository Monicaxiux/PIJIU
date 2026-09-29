<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Activity, AlertTriangle, BellRing, ChartNoAxesCombined, ChevronDown, Clock3, DatabaseZap, Factory, FileChartColumn, Gauge, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Radio, Settings2, SlidersHorizontal, UserRound, Warehouse, X } from 'lucide-vue-next'
import { useSystemStore } from '../stores/system'
import { clearSession, getCurrentUser } from '../utils/auth'

const route = useRoute()
const router = useRouter()
const store = useSystemStore()
const mobileOpen = ref(false)
const sidebarCollapsed = ref(readSidebarPreference())
const profileOpen = ref(false)
const logoutConfirm = ref(false)
const profileEl = ref()
const cancelLogoutButton = ref()
const currentUser = getCurrentUser()
const groups = [
  { code: '01', label: '驾驶舱', items: [{ label: '总览大屏', to: '/dashboard', icon: LayoutDashboard }] },
  { code: '02', label: '实时监测', items: [{ label: '设备监测列表', to: '/monitor', icon: Radio }] },
  { code: '03', label: '诊断分析', items: [{ label: '诊断结果总览', to: '/diag/results', icon: Activity }, { label: '温差趋势对比', to: '/diag/trend', icon: ChartNoAxesCombined }, { label: '诊断策略与基线配置', to: '/diag/strategy', icon: SlidersHorizontal }] },
  { code: '04', label: '告警管理', items: [{ label: '历史告警', to: '/alarm/history', icon: Warehouse }, { label: '告警规则配置', to: '/alarm/rule', icon: BellRing }] },
  { code: '05', label: '更多模块', items: [{ label: '设备台账', to: '/ledger', icon: Factory }, { label: '数据采集', to: '/todo/collection', icon: DatabaseZap }, { label: '报表统计', to: '/todo/report', icon: FileChartColumn }, { label: '系统管理', to: '/todo/system', icon: Settings2 }] }
]
const title = computed(() => route.meta.title || '管理平台')
const subtitle = computed(() => route.meta.subtitle || '')
const clockDate = computed(() => {
  const date = store.now
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
})
const clockWeekday = computed(() => `周${'日一二三四五六'[store.now.getDay()]}`)
const clockTime = computed(() => store.now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
function readSidebarPreference() {
  try {
    return localStorage.getItem('trapvision.sidebar.collapsed') === '1'
  } catch {
    return false
  }
}
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem('trapvision.sidebar.collapsed', sidebarCollapsed.value ? '1' : '0')
  } catch {
    // The layout still works when browser storage is unavailable.
  }
}
function active(to) { return route.path === to || (to === '/monitor' && route.path.startsWith('/monitor/')) }
function closeProfile(event) {
  if (!profileEl.value?.contains(event.target)) profileOpen.value = false
}
async function requestLogout() {
  profileOpen.value = false
  logoutConfirm.value = true
  await nextTick()
  cancelLogoutButton.value?.focus()
}
function cancelLogout() {
  logoutConfirm.value = false
}
function confirmLogout() {
  clearSession()
  logoutConfirm.value = false
  router.replace('/login')
}
function handleKeydown(event) {
  if (event.key === 'Escape' && logoutConfirm.value) cancelLogout()
}
onMounted(() => document.addEventListener('pointerdown', closeProfile))
onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeProfile)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-shell">
    <button v-if="mobileOpen" class="sidebar-mask" aria-label="关闭导航" @click="mobileOpen = false"></button>
    <aside id="primary-sidebar" class="sidebar" :class="{ open: mobileOpen, collapsed: sidebarCollapsed }">
      <div class="brand">
        <div class="brand-mark"><Factory :size="20" /><i></i></div>
        <div class="brand-copy"><strong>TRAP<span>VISION</span></strong><small>STEAM INTELLIGENCE</small></div>
        <button class="icon-btn close-nav" aria-label="关闭导航" @click="mobileOpen = false"><X :size="19" /></button>
      </div>
      <nav aria-label="主导航">
        <section v-for="group in groups" :key="group.label" class="nav-group">
          <div class="nav-section-title"><b>{{ group.code }}</b><p>{{ group.label }}</p></div>
          <div class="nav-group-items">
          <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" :class="{ active: active(item.to) }" :title="sidebarCollapsed ? item.label : undefined" :aria-label="sidebarCollapsed ? item.label : undefined" @click="mobileOpen = false">
            <component :is="item.icon" :size="17" /><span class="nav-label">{{ item.label }}</span><b v-if="item.badge === true && store.openAlarmCount">{{ store.openAlarmCount }}</b><b v-else-if="item.badge === 'baseline' && store.baselineTodoCount">{{ store.baselineTodoCount }}</b><i class="active-tick"></i>
          </RouterLink>
          </div>
        </section>
      </nav>
      <button class="sidebar-toggle" :aria-label="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'" :aria-expanded="!sidebarCollapsed" aria-controls="primary-sidebar" :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'" @click="toggleSidebar">
        <PanelLeftOpen v-if="sidebarCollapsed" :size="18" aria-hidden="true" />
        <PanelLeftClose v-else :size="18" aria-hidden="true" />
        <span>收起侧边栏</span>
      </button>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <button class="icon-btn menu-btn" aria-label="打开导航" @click="mobileOpen = true"><Menu :size="20" /></button>
        <div class="page-title"><h1>{{ title }}</h1><span>/</span><p>{{ subtitle }}</p></div>
        <div class="top-actions">
          <RouterLink v-if="store.baselineTodoCount" class="topbar-alert baseline" to="/diag/strategy" :aria-label="`${store.baselineTodoCount} 条基线待办`">
            <Gauge :size="16" /><span>基线待办</span><b>{{ store.baselineTodoCount }}</b>
          </RouterLink>
          <RouterLink class="topbar-alert" to="/alarm/realtime" :aria-label="`${store.openAlarmCount} 条实时告警`">
            <AlertTriangle :size="16" /><span>实时告警</span><b v-if="store.openAlarmCount">{{ store.openAlarmCount }}</b>
          </RouterLink>
          <div class="clock" aria-label="当前时间">
            <span class="clock-signal"><Clock3 :size="17" aria-hidden="true" /></span>
            <time :datetime="store.now.toISOString()"><small>{{ clockDate }} · {{ clockWeekday }}</small><strong>{{ clockTime }}</strong></time>
          </div>
          <div ref="profileEl" class="profile-wrap">
            <button class="profile" :class="{ open: profileOpen }" :aria-label="`用户菜单，当前账号 ${currentUser}`" :aria-expanded="profileOpen" aria-haspopup="menu" @click="profileOpen = !profileOpen">
              <span class="profile-avatar"><UserRound :size="17" aria-hidden="true" /></span>
              <span class="profile-copy"><strong>{{ currentUser }}</strong><small>运维管理员</small></span>
              <ChevronDown class="profile-chevron" :size="14" aria-hidden="true" />
            </button>
            <div v-if="profileOpen" class="profile-menu" role="menu">
              <div class="profile-menu-head">
                <span class="profile-menu-avatar"><UserRound :size="20" aria-hidden="true" /></span>
                <span><small>当前账号</small><strong>{{ currentUser }}</strong><em><i></i>运维管理员 · 在线</em></span>
              </div>
              <button role="menuitem" @click="requestLogout"><LogOut :size="15" />退出登录</button>
            </div>
          </div>
        </div>
      </header>
      <div class="page-content">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in"><component :is="Component" :key="route.path" /></Transition>
        </RouterView>
      </div>
    </main>
    <Teleport to="body">
      <div v-if="logoutConfirm" class="logout-backdrop" @click.self="cancelLogout">
        <section class="logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description">
          <div class="logout-dialog-icon"><AlertTriangle :size="22" aria-hidden="true" /></div>
          <div class="logout-dialog-copy">
            <span>SESSION / SIGN OUT</span>
            <h2 id="logout-title">确认退出登录？</h2>
            <p id="logout-description">账号“{{ currentUser }}”将结束当前会话，并返回登录页。</p>
          </div>
          <div class="logout-dialog-actions">
            <button ref="cancelLogoutButton" class="btn secondary" @click="cancelLogout">取消</button>
            <button class="btn danger" @click="confirmLogout"><LogOut :size="15" />确认退出</button>
          </div>
        </section>
      </div>
    </Teleport>
    <Transition name="fade"><div v-if="store.toast" class="app-toast" role="status" aria-live="polite">{{ store.toast }}</div></Transition>
  </div>
</template>
