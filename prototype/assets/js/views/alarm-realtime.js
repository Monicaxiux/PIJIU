/* ============================================================
   alarm-realtime.js — 告警管理 · 实时告警看板（认领→处理→关闭）
   ============================================================ */
(function () {
  const { defineComponent } = Vue;
  window.VIEWS = window.VIEWS || {};

  window.VIEWS["view-alarm-realtime"] = defineComponent({
    name: "AlarmRealtime",
    data() { return { modal: null, measure: "", step2: false }; },
    computed: {
      store() { return window.Store; },
      cols() {
        const mk = (lv, title, color) => ({
          title, color,
          list: this.store.alarms.filter((a) => a.level === lv && a.status !== "已关闭")
        });
        return [mk(1, "紧急", "#ff4d5e"), mk(2, "重要", "#ff9f27"), mk(3, "一般", "#00d4ff")];
      }
    },
    methods: {
      lvName(l) { return l === 1 ? "紧急" : l === 2 ? "重要" : "一般"; },
      lvCls(l) { return "lv-" + l; },
      goDev(id) { location.hash = "#/monitor/" + id; },
      claim(a) {
        a.status = "处理中";
        a.handler = "陈工";
        const t = this.store.now;
        const two = (n) => (n < 10 ? "0" : "") + n;
        a.claimedAt = two(t.getHours()) + ":" + two(t.getMinutes());
        window.showToast(a.tagNo + " 告警已认领，处理人：陈工");
      },
      openClose(a) { this.modal = a; this.measure = a.measure || ""; this.step2 = false; },
      doClose() {
        if (!this.measure.trim()) { window.showToast("请填写处理措施后才能关闭告警"); return; }
        if (!this.step2) { this.step2 = true; return; }
        const t = this.store.now;
        const two = (n) => (n < 10 ? "0" : "") + n;
        this.modal.status = "已关闭";
        this.modal.closedAt = two(t.getHours()) + ":" + two(t.getMinutes());
        this.modal.measure = this.measure;
        window.showToast(this.modal.tagNo + " 告警已关闭，全流程记录留痕");
        this.modal = null;
      }
    },
    template: `
      <div>
        <div class="panel glow mb14" style="display:flex;align-items:center;gap:18px">
          <span class="sub" style="font-size:12px">处理流程：</span>
          <span class="chip on">① 认领</span><span class="dim">→</span>
          <span class="chip on">② 处理（填写措施）</span><span class="dim">→</span>
          <span class="chip on">③ 验证关闭（留痕）</span>
          <span style="flex:1"></span>
          <span class="dim" style="font-size:11px">待处理 {{ store.alarms.filter(a=>a.status==='待处理').length }} 条 · 处理中 {{ store.alarms.filter(a=>a.status==='处理中').length }} 条</span>
        </div>

        <div class="grid-3">
          <div class="panel" v-for="col in cols" :key="col.title">
            <div class="panel-title">
              <span :style="{ color: col.color }">{{ col.title }}</span>
              <span class="pt-extra dim">{{ col.list.length }} 条</span>
            </div>
            <div class="scroll-list" style="max-height:560px">
              <div v-for="a in col.list" :key="a.id" class="al-card">
                <div class="al-head">
                  <span class="al-lv" :class="lvCls(a.level)">{{ lvName(a.level) }}</span>
                  <span class="al-title mono" style="cursor:pointer;color:#00d4ff" @click="goDev(a.deviceId)">{{ a.tagNo }}</span>
                  <span class="dim" style="margin-left:auto;font-size:11px">{{ a.createdAt }}</span>
                </div>
                <div class="al-meta">
                  {{ a.content }}<br/>
                  <span class="dim">{{ a.workshop }} ·
                    <span :style="{ color: a.status === '待处理' ? '#ff4d5e' : '#ff9f27' }">{{ a.status }}</span>
                    <template v-if="a.handler"> · {{ a.handler }}</template>
                  </span>
                </div>
                <div style="margin-top:8px;display:flex;gap:8px">
                  <button v-if="a.status === '待处理'" class="btn primary" style="padding:4px 14px" @click="claim(a)">认领</button>
                  <template v-if="a.status === '处理中'">
                    <button class="btn" style="padding:4px 14px" @click="openClose(a)">处理并关闭</button>
                  </template>
                </div>
              </div>
              <div v-if="!col.list.length" class="dim" style="text-align:center;padding:36px 0">该级别暂无告警</div>
            </div>
          </div>
        </div>

        <div class="modal-mask" v-if="modal" @click.self="modal = null">
          <div class="modal">
            <h3>处理告警 — {{ modal.tagNo }}</h3>
            <div class="al-meta" style="margin-bottom:12px">{{ modal.content }}</div>
            <div class="m-row">
              <label>处理措施（必填）：</label>
              <textarea rows="3" v-model="measure" placeholder="例：现场检查发现阀芯磨损，已更换阀芯并通汽验证，疏水正常"></textarea>
            </div>
            <div class="m-foot">
              <button class="btn ghost" @click="modal = null">取消</button>
              <button class="btn primary" @click="doClose">{{ step2 ? "再次确认关闭" : "验证并关闭告警" }}</button>
            </div>
          </div>
        </div>
      </div>
    `
  });
})();
