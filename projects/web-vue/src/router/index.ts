import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/dashboard/create',
      name: 'dashboard-create',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/dashboard/claim',
      name: 'dashboard-claim',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/dashboard/rescue',
      name: 'dashboard-rescue',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/dashboard/list',
      name: 'dashboard-list',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/initial-deposit',
      name: 'initial-deposit',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/InitialDeposit.vue'),
    },
    {
      path: '/deposit',
      name: 'deposit',
      component: () => import('../views/DepositTokens.vue'),
    },
    {
      path: '/configuration-change',
      name: 'configuration-change',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/ConfigurationChange.vue'),
    },
    {
      path: '/funding-token',
      name: 'funding-token',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/FundingToken.vue'),
    },
    {
      path: '/try-it-out',
      name: 'try-it-out',
      component: () => import('../views/TryItOut.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: '404',
      component: () => import('../views/Error404.vue'),
    },
  ],
})

export default router
