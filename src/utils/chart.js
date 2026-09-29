export const chartColors = ['#35d7a0', '#ff5d6c', '#ffb547', '#8c9bad', '#a77bf3', '#46d8ff', '#f47ca2', '#85c5a2']

export const temperatureSeriesMeta = {
  ts: { name: '进口温度 Ts', color: '#ffb547' },
  tc: { name: '出口温度 Tc', color: '#46d8ff' },
  dt: { name: '进出口温差 ΔT', color: '#35d7a0' }
}

export const baseGrid = { left: 48, right: 22, top: 44, bottom: 34, containLabel: false }

export function axisStyle() {
  return {
    axisLine: { lineStyle: { color: '#36506a', width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: '#91a8bb', fontFamily: 'Fira Code', fontSize: 10, margin: 12 },
    splitLine: { lineStyle: { color: 'rgba(80,113,139,.22)', type: 'dashed' } }
  }
}

export function tooltip() {
  return { trigger: 'axis', backgroundColor: '#0d1824', borderColor: '#3b617d', borderWidth: 1, padding: [10, 13], extraCssText: 'box-shadow: 0 12px 32px rgba(0,0,0,.42);', textStyle: { color: '#eaf2fb', fontFamily: 'Fira Sans', fontSize: 12 }, axisPointer: { type: 'line', lineStyle: { color: '#6187a2', type: 'dashed', width: 1 } } }
}
