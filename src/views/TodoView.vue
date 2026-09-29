<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DatabaseZap, FileChartColumn, Settings } from 'lucide-vue-next'
const route=useRoute()
const modules={collection:{name:'数据采集',icon:DatabaseZap,desc:'统一管理网关、采集通道与数据质量。',items:['采集网关','通道映射','数据质量监控']},report:{name:'报表统计',icon:FileChartColumn,desc:'沉淀能效、告警与维保分析报表。',items:['能效日报','告警月报','设备健康报告']},system:{name:'系统管理',icon:Settings,desc:'管理组织、用户、角色与审计日志。',items:['组织与用户','角色权限','操作审计']}}
const current=computed(()=>modules[route.params.module]||modules.system)
</script>
<template><div class="todo-page"><div class="todo-icon"><component :is="current.icon"/></div><span class="eyebrow">PLANNED MODULE</span><h2>{{current.name}}</h2><p>{{current.desc}}</p><div class="roadmap"><div v-for="(item,i) in current.items" :key="item"><b>0{{i+1}}</b><span>{{item}}<small>{{i===0?'需求梳理中':'已进入产品路线图'}}</small></span></div></div><RouterLink class="btn primary" to="/dashboard">返回驾驶舱</RouterLink></div></template>
