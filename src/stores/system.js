import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createAlarms, createDevices, getEngine, refreshDevice, statusMeta } from '../mock'

export const useSystemStore = defineStore('system', () => {
  const devices = ref(createDevices())
  const alarms = ref(createAlarms(devices.value))
  const stateChanges = ref(getEngine().stateChanges || [])
  const now = ref(new Date())
  const autoRefresh = ref(true)
  const dataVersion = ref(0)
  const toast = ref('')
  let timer
  let lastUpdate = 0
  let toastTimer

  const counts = computed(() => Object.fromEntries(Object.keys(statusMeta).map(key => [key, devices.value.filter(d => d.status === key).length])))
  const openAlarmCount = computed(() => alarms.value.filter(a => a.status !== 'closed').length)
  const baselineTodoCount = computed(() => devices.value.filter(d => d.baseline?.pending || (d.baseline?.cumRise || 0) >= (d.baseline?.warnRise || 5)).length)

  function syncFromEngine() {
    devices.value.forEach(refreshDevice)
    const engine = getEngine()
    engine.diagResults?.forEach(result => {
      const d = devices.value.find(x => x.id === result.deviceId)
      if (d) d.relativeDiagnosis = engine.baseline?.diag?.(d) || d.relativeDiagnosis
    })
    dataVersion.value++
  }

  function tick() {
    now.value = new Date()
    if (!autoRefresh.value || now.value.getTime() - lastUpdate < 5000) return
    lastUpdate = now.value.getTime()
    getEngine().tick()
    syncFromEngine()
  }

  function startClock() {
    if (timer) return
    now.value = new Date()
    lastUpdate = now.value.getTime() - 5000
    timer = setInterval(tick, 1000)
  }

  function stopClock() {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  function claimAlarm(id) {
    const alarm = alarms.value.find(a => a.id === id)
    if (alarm) Object.assign(alarm, { status: 'processing', owner: '当前用户', claimedAt: now.value.getTime() })
    notify('告警已认领，处置过程将持续留痕')
  }

  function closeAlarm(id, measure = '') {
    const alarm = alarms.value.find(a => a.id === id)
    if (alarm) Object.assign(alarm, { status: 'closed', measure, closedAt: now.value.getTime() })
    notify('告警已关闭，处理措施已记录')
  }

  function resetAlarm(id) {
    const alarm = alarms.value.find(a => a.id === id)
    if (alarm) Object.assign(alarm, { status: 'pending', owner: '' })
  }

  function notify(message) {
    toast.value = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.value = '' }, 2600)
  }

  function bumpData() {
    dataVersion.value++
    syncFromEngine()
  }

  function reviewDevice(id, status, reason = '') {
    const d = devices.value.find(x => x.id === id)
    if (!d) return
    const previous = d.status
    Object.assign(d, { status, confidence: 100, reviewed: true })
    const engineDevice = getEngine().devices.find(x => x.id === id)
    if (engineDevice) engineDevice.status = status
    refreshDevice(d)
    const changes = getEngine().stateChanges || stateChanges.value
    changes.forEach(change => {
      if (change.deviceId === d.id && change.pending) Object.assign(change, { pending: false, confidence: 100, trigger: '人工复核' })
    })
    changes.unshift({ id: `SC${Date.now()}`, deviceId: d.id, tagNo: d.id, deviceName: d.name, from: previous, to: status, trigger: '人工复核', confidence: 100, time: new Date().toLocaleString('zh-CN', { hour12: false }), rule: reason || '人工复核确认', pending: false })
    stateChanges.value = changes
    dataVersion.value++
    notify('人工复核完成，改判记录已留痕')
  }

  return { devices, alarms, stateChanges, now, autoRefresh, dataVersion, toast, counts, openAlarmCount, baselineTodoCount, startClock, stopClock, tick, claimAlarm, closeAlarm, resetAlarm, reviewDevice, bumpData, notify }
})
