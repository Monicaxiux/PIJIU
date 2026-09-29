<script setup>
import { nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Activity, Eye, EyeOff, Factory, LockKeyhole, LogIn, Radio, ShieldCheck, UserRound, Waves } from 'lucide-vue-next'
import { createSession } from '../utils/auth'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)
const submitting = ref(false)
const errors = ref({})
const usernameInput = ref()
const passwordInput = ref()

function validateField(field) {
  if (field === 'username') {
    errors.value.username = username.value ? '' : '请输入账号'
  }
  if (field === 'password') {
    errors.value.password = !password.value
      ? '请输入密码'
      : password.value.length < 6
        ? '密码至少需要 6 个字符'
        : ''
  }
}

async function submit() {
  validateField('username')
  validateField('password')
  if (errors.value.username || errors.value.password) {
    await nextTick()
    ;(errors.value.username ? usernameInput : passwordInput).value?.focus()
    return
  }

  submitting.value = true
  await new Promise(resolve => setTimeout(resolve, 520))
  createSession(username.value.trim(), remember.value)
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//')
    ? route.query.redirect
    : '/dashboard'
  await router.replace(redirect)
}
</script>

<template>
  <main class="login-page">
    <section class="login-visual" aria-label="平台运行状态概览">
      <div class="login-grid" aria-hidden="true"></div>
      <header class="login-brand">
        <div class="login-brand-mark"><Factory :size="24" aria-hidden="true" /></div>
        <div><strong>TRAP<span>VISION</span></strong><small>STEAM INTELLIGENCE</small></div>
      </header>

      <div class="login-hero">
        <p class="eyebrow">INDUSTRIAL IOT / 24H ONLINE</p>
        <h1>蒸汽疏水阀<br />在线监测系统</h1>
        <p class="login-intro">持续感知管网运行状态，让异常定位、告警处置与设备管理保持在同一条数据链路上。</p>

        <div class="login-network" aria-hidden="true">
          <div class="network-source"><Waves :size="22" /><span>STEAM</span></div>
          <i class="network-line"></i>
          <div v-for="(area, index) in ['动力区域', '酿造区域', '包装区域']" :key="area" class="login-area" :class="`login-area-${index}`">
            <span>{{ area }}</span><i></i><i></i><i></i><i></i><i></i>
          </div>
        </div>
      </div>

      <footer class="login-system-status">
        <div><Radio :size="16" aria-hidden="true" /><span><b>45</b><small>接入设备</small></span></div>
        <div><Activity :size="16" aria-hidden="true" /><span><b>97.8%</b><small>链路可用率</small></span></div>
        <div><ShieldCheck :size="16" aria-hidden="true" /><span><b>3 / 3</b><small>边缘网关在线</small></span></div>
      </footer>
    </section>

    <section class="login-access">
      <div class="login-form-wrap">
        <div class="login-form-head">
          <span class="login-index">AUTH / 01</span>
          <h2>登录平台</h2>
          <p>使用已授权的运维账号进入监测工作台</p>
        </div>

        <form novalidate @submit.prevent="submit">
          <div class="login-field" :class="{ invalid: errors.username }">
            <label for="username">账号</label>
            <div class="login-input">
              <UserRound :size="18" aria-hidden="true" />
              <input id="username" ref="usernameInput" v-model.trim="username" type="text" autocomplete="username" placeholder="请输入账号" :aria-invalid="Boolean(errors.username)" aria-describedby="username-error" @blur="validateField('username')" />
            </div>
            <small id="username-error" class="field-error" aria-live="polite">{{ errors.username }}</small>
          </div>

          <div class="login-field" :class="{ invalid: errors.password }">
            <label for="password">密码</label>
            <div class="login-input">
              <LockKeyhole :size="18" aria-hidden="true" />
              <input id="password" ref="passwordInput" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" :aria-invalid="Boolean(errors.password)" aria-describedby="password-error" @blur="validateField('password')" />
              <button type="button" class="password-toggle" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </div>
            <small id="password-error" class="field-error" aria-live="polite">{{ errors.password }}</small>
          </div>

          <div class="login-options">
            <label class="remember-check"><input v-model="remember" type="checkbox" /><span aria-hidden="true"></span>记住登录状态</label>
            <button type="button" class="text-action">联系管理员</button>
          </div>

          <button class="login-submit" type="submit" :disabled="submitting">
            <span v-if="submitting" class="login-spinner" aria-hidden="true"></span>
            <LogIn v-else :size="18" aria-hidden="true" />
            {{ submitting ? '正在验证...' : '进入监测平台' }}
          </button>
        </form>

        <div class="login-security"><ShieldCheck :size="15" aria-hidden="true" /><span>访问过程已启用安全传输保护</span><b>SECURE</b></div>
      </div>
      <p class="login-copyright">TRAPVISION MONITORING PLATFORM · 2026</p>
    </section>
  </main>
</template>
