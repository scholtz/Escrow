<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import { useRoute, useRouter } from 'vue-router'
import AuthScreen from '../components/AuthScreen.vue'
import InfoPanel from '../components/DashboardPanels/InfoPanel.vue'
import NewEscrowPanel from '../components/DashboardPanels/NewEscrowPanel.vue'

import ClaimPanel from '../components/DashboardPanels/ClaimPanel.vue'
import ListPanel from '../components/DashboardPanels/ListPanel.vue'
import RescuePanel from '../components/DashboardPanels/RescuePanel.vue'
import H2 from '../components/H2.vue'
import MainButton from '../components/MainButton.vue'
import PageHeader from '../components/PageHeader.vue'
import { useAppStore } from '../stores/app'

const { activeWallet } = useWallet()
const router = useRouter()
const route = useRoute()
const clickLogout = async () => {
  store.state.boxData = null
  store.state.configuration = null
  activeWallet.value?.disconnect()
  router.push('/')
}

const store = useAppStore()
</script>

<template>
  <AuthScreen>
    <div class="min-h-screen flex flex-col">
      <PageHeader />
      <main class="container mx-auto px-6 py-8 flex-grow-1">
        <div class="grid md:grid-cols-3 gap-8">
          <div class="bg-teal-900 bg-opacity-50 p-6 rounded-xl backdrop-blur-lg">
            <H2>Select the action</H2>
            <RouterLink to="/dashboard/create">
              <MainButton class="mb-4"> Create HTLC Escrow </MainButton>
            </RouterLink>

            <RouterLink to="/dashboard/claim">
              <MainButton class="mb-4"> Claim HTLC Escrow </MainButton>
            </RouterLink>

            <RouterLink to="/dashboard/rescue">
              <MainButton class="mb-4"> Rescue HTLC Escrow </MainButton>
            </RouterLink>

            <RouterLink to="/dashboard/list">
              <MainButton class="mb-4"> List live escrows </MainButton>
            </RouterLink>

            <MainButton @click="clickLogout"> Logout </MainButton>
          </div>
          <div class="bg-teal-900 bg-opacity-50 p-6 rounded-xl backdrop-blur-lg col-span-2">
            <InfoPanel v-if="route.name == 'dashboard'"></InfoPanel>
            <NewEscrowPanel v-if="route.name == 'dashboard-create'"></NewEscrowPanel>
            <ClaimPanel v-if="route.name == 'dashboard-claim'"></ClaimPanel>
            <RescuePanel v-if="route.name == 'dashboard-rescue'"></RescuePanel>
            <ListPanel v-if="route.name == 'dashboard-list'"></ListPanel>
          </div>
        </div>
      </main>
    </div>
  </AuthScreen>
</template>
