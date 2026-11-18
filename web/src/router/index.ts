import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/utils/http'

const routes = [
  { path: '/login', component: () => import('@/views/login/LoginView.vue'), meta: { guest: true } },
  { path: '/t/:code', component: () => import('@/views/consumer/ConsumerTraceView.vue'), meta: { public: true } },
  { path: '/labels/:id', component: () => import('@/views/codes/LabelPrintView.vue'), meta: { title: '标签打印' } },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('@/views/dashboard/IndexView.vue'), meta: { title: '概览' } },
      { path: 'farm', component: () => import('@/views/farm/PlotListView.vue'), meta: { title: '地块' } },
      { path: 'produce', component: () => import('@/views/produce/ProduceView.vue'), meta: { title: '生产' } },
      { path: 'inputs', component: () => import('@/views/inputs/InputView.vue'), meta: { title: '农资' } },
      { path: 'warehouse', component: () => import('@/views/warehouse/WarehouseView.vue'), meta: { title: '仓储' } },
      { path: 'inspect', component: () => import('@/views/inspect/InspectView.vue'), meta: { title: '质检' } },
      { path: 'alerts', component: () => import('@/views/alerts/AlertsView.vue'), meta: { title: '预警' } },
      { path: 'codes', component: () => import('@/views/codes/CodesView.vue'), meta: { title: '赋码' } },
      { path: 'ship', component: () => import('@/views/ship/ShipView.vue'), meta: { title: '物流' } },
      { path: 'orders', component: () => import('@/views/orders/OrderView.vue'), meta: { title: '订单' } },
      { path: 'notifications', component: () => import('@/views/notifications/NotificationView.vue'), meta: { title: '通知' } },
      { path: 'sale', component: () => import('@/views/sale/SalesView.vue'), meta: { title: '销售' } },
      { path: 'trace', component: () => import('@/views/trace/TraceLogsView.vue'), meta: { title: '追溯' } },
      { path: 'trace/:code', component: () => import('@/views/trace/TraceView.vue'), meta: { title: '追溯' } },
      { path: 'batch/:id', component: () => import('@/views/batch/BatchDetailView.vue'), meta: { title: '批次' } },
      { path: 'sys', component: () => import('@/views/sys/SystemView.vue'), meta: { title: '系统' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({ history: createWebHistory('/'), routes })

router.beforeEach(to => {
  if (to.meta.public) return
  const authed = !!getToken()
  if (!to.meta.guest && !authed) return { path: '/login' }
  if (to.meta.guest && authed) return { path: '/dashboard' }
})

export default router