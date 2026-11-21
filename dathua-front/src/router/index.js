import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import HomeView from '../views/HomeView.vue'
import AuthView from '../views/AuthView.vue'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import DashboardHomeView from '../views/dashboard/HomeView.vue'
import NodesView from '../views/dashboard/NodesView.vue'
import NodeDetailView from '../views/dashboard/NodeDetailView.vue'
import SitesView from '../views/dashboard/SitesView.vue'
import MetricsView from '../views/dashboard/MetricsView.vue'
import IncidentsView from '../views/dashboard/IncidentsView.vue'
import AiSentinelView from '../views/dashboard/AiSentinelView.vue'
import ReportsView from '../views/dashboard/ReportsView.vue'
import ProfileView from '../views/dashboard/ProfileView.vue'
import NotificationsHistoryView from '../views/dashboard/NotificationsHistoryView.vue'
import AgentInstallView from '../views/dashboard/AgentInstallView.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: AuthView },
    { path: '/register', name: 'register', component: AuthView },
    {
      path: '/dashboard',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardHomeView },
        { path: 'nodes', name: 'dashboard-nodes', component: NodesView },
        { path: 'nodes/:nodeId', name: 'dashboard-node-detail', component: NodeDetailView, props: true },
        { path: 'sites', name: 'dashboard-sites', component: SitesView },
        { path: 'metrics', name: 'dashboard-metrics', component: MetricsView },
        { path: 'incidents', name: 'dashboard-incidents', component: IncidentsView },
        { path: 'ai-analytics', name: 'dashboard-ai', component: AiSentinelView },
        { path: 'reports', name: 'dashboard-reports', component: ReportsView },
        { path: 'agent', name: 'dashboard-agent', component: AgentInstallView },
        { path: 'profile', name: 'dashboard-profile', component: ProfileView },
        { path: 'notifications', name: 'dashboard-notifications', component: NotificationsHistoryView },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if ((to.name === 'login' || to.name === 'register') && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
