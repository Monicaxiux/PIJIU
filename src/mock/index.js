import '../../prototype/assets/js/mock-data.js'

const engine = typeof window !== 'undefined' ? window.MOCK : null

export const statusMeta = {
  normal: { label: '正常', color: '#35d7a0' },
  leak: { label: '泄漏', color: '#ff5d6c' },
  block: { label: '阻塞', color: '#ffb547' },
  stop: { label: '停产', color: '#8c9bad' },
  abnormal: { label: '数据异常', color: '#a77bf3' }
}

export const decisionText = {
  normal: '周期内存在明显排放温降，温差波形与设备类型基线一致。',
  leak: '相对基准温差持续收窄或出口温度抬升，判定为疑似蒸汽直通泄漏。',
  block: '温差窗口均值高于设备温差基准，判定冷凝水排放受阻。',
  stop: 'Ts 与 Tc 同步下降至低温区间，结合产线状态判定为停产。',
  abnormal: '数据连续性不足或通道异常，当前结果不参与能耗核算。'
}

function assertEngine() {
  if (!engine) throw new Error('Prototype data engine is not available')
  return engine
}

function prototypeTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const match = String(value).match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/)
  if (match) {
    const now = new Date()
    now.setMonth(Number(match[1]) - 1, Number(match[2]))
    now.setHours(Number(match[3]), Number(match[4]), 0, 0)
    return now.getTime()
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeDevice(d) {
  const e = assertEngine()
  const b = e.baseline?.info?.(d) || {}
  const diag = e.baseline?.diag?.(d) || {}
  d.area = d.workshopName
  d.line = d.pipePos
  d.ts = d.tsTemp
  d.tc = d.tcTemp
  d.delta = d.deltaT
  d.pressure = Number(d.steamPressure || 0).toFixed(2)
  d.confidence = d.health || 0
  d.online = d.status !== 'abnormal'
  d.sensor = d.sensorSteam
  d.updated = Date.now()
  d.baseline = b
  d.relativeDiagnosis = diag
  return d
}

export function createDevices() {
  return assertEngine().devices.map(normalizeDevice)
}

export function refreshDevice(d) {
  return normalizeDevice(d)
}

export function makeHistory(device, points = 96) {
  const s = assertEngine().seriesMap[device.id]
  if (!s) return []
  const start = Math.max(0, s.times.length - points)
  return s.times.slice(start).map((time, i) => {
    const idx = start + i
    return { time, minute: i * 5, ts: s.ts[idx], tc: s.tc[idx], delta: s.dt[idx] }
  })
}

export function createAlarms(devices) {
  return assertEngine().alarms.map((a, i) => {
    const d = devices.find(x => x.id === a.deviceId)
    return {
      id: a.id,
      deviceId: a.deviceId,
      deviceName: d?.name || a.deviceId,
      area: d?.area || '',
      level: a.level === 1 ? 'critical' : a.level === 2 ? 'major' : 'minor',
      status: a.status === '已关闭' ? 'closed' : a.status === '处理中' ? 'processing' : 'pending',
      type: a.type || statusMeta[d?.status]?.label || '状态异常',
      message: a.content || a.message || a.desc || decisionText[d?.status] || '设备状态需要关注',
      time: prototypeTime(a.createdAt) || Date.now() - i * 26 * 60000,
      createdAt: a.createdAt,
      claimedAt: prototypeTime(a.claimedAt),
      closedAt: prototypeTime(a.closedAt),
      handler: a.handler || '',
      measure: a.measure || '',
      owner: a.owner || a.handler || ''
    }
  })
}

export function getEngine() { return assertEngine() }
