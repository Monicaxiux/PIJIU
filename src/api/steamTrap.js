import { request } from './request'

const statusMap = {
  normal: 'normal',
  leak: 'leak',
  block: 'block',
  stop: 'stop',
  abnormal: 'abnormal',
  '正常': 'normal',
  '泄漏': 'leak',
  '阻塞': 'block',
  '停产': 'stop',
  '数据异常': 'abnormal'
}

function normalizeStatus(value) {
  if (typeof value === 'string' && statusMap[value]) return statusMap[value]
  if (value === 0 || value === 1) return 'normal'
  if (value === 2) return 'leak'
  if (value === 3) return 'block'
  if (value === 4) return 'stop'
  return 'normal'
}

function dateOnly(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10)
}

export function normalizeSteamTrap(record, index) {
  return {
    id: String(record.id ?? record.trapNo ?? `api-${index}`),
    workshopId: String(record.regionLevel ?? record.regionId ?? ''),
    workshopName: record.regionLevel ?? record.regionName ?? '-',
    tagNo: record.trapNo ?? record.tagNo ?? '-',
    name: record.name ?? record.trapName ?? record.trapNo ?? '-',
    model: record.model ?? record.manufacturer ?? '-',
    type: record.trapType ?? record.type ?? '-',
    caliber: record.pipeDiameter ?? record.caliber ?? '-',
    pipePos: record.installAddress ?? record.pipePos ?? '-',
    equip: record.useDevice ?? record.equip ?? '-',
    installDate: dateOnly(record.installTime ?? record.installDate),
    supplier: record.supplier ?? '-',
    status: normalizeStatus(record.runstatus ?? record.status),
    health: Number(record.health ?? 100),
    sensorSteam: record.inletTempSensorNo ?? record.sensorSteam ?? '-',
    sensorCond: record.outletTempSensorNo ?? record.sensorCond ?? '-',
    terminalId: record.terminalId ?? '-',
    gatewayId: record.gatewayId ?? '-',
    connect: record.connect ?? '-',
    steamPressure: record.steamPressure ?? '-',
    sensorCheck: record.sensorCheck ?? '-',
    sourceRecord: record
  }
}

function extractPage(payload) {
  const page = payload?.data && !Array.isArray(payload.data) ? payload.data : payload
  const records = page?.records ?? page?.list ?? page?.rows ?? (Array.isArray(page) ? page : [])
  return {
    records: Array.isArray(records) ? records : [],
    total: Number(page?.total) > 0 ? Number(page.total) : records.length,
    current: Number(page?.current) > 0 ? Number(page.current) : 1,
    pages: Number(page?.pages) > 0 ? Number(page.pages) : 1
  }
}

export async function getSteamTrapConfigPage(params = {}) {
  const query = {
    current: params.current ?? 1,
    size: params.size ?? 10,
    regionLevel: params.regionLevel,
    trapNo: params.trapNo,
    supplier: params.supplier,
    useDevice: params.useDevice
  }
  const payload = await request.get('/api/steam-trap-config/page', { params: query })
  const page = extractPage(payload)
  return {
    ...page,
    current: Number(page.current) > 0 ? page.current : query.current,
    records: page.records.map(normalizeSteamTrap)
  }
}
