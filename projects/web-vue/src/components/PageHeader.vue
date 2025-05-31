<script setup lang="ts">
import { useAppStore } from '../stores/app'
import MainButton from './MainButton.vue'
import { useWallet } from '@txnlab/use-wallet-vue'
import { useRoute, useRouter } from 'vue-router'
const store = useAppStore()
const { activeWallet } = useWallet()
const router = useRouter()
const route = useRoute()
const clickLogout = async () => {
  activeWallet.value?.disconnect()
  router.push('/')
}
</script>

<template>
  <nav class="container mx-auto px-6 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2 w-100">
        <div class="relative w-8 h-8">
          <i class="pi pi-objects-column absolute text-white !text-3xl"></i>
        </div>
        <RouterLink to="/">
          <span class="text-white text-xl font-bold"> Biatec HTLC</span>
        </RouterLink>
      </div>
      <div class="flex items-center space-x-4 w-100" v-if="store.state.boxData">
        <span class="text-white w-full">
          Balance: {{ Number(store.state.boxData?.balance) / 1000000 }}
          {{ store.state.tokenName }}
        </span>

        <RouterLink v-if="route.name == 'dashboard'" to="deposit" class="w-full">
          <MainButton class="px-4 py-2"> Deposit </MainButton>
        </RouterLink>
        <RouterLink v-else to="dashboard" class="w-full">
          <MainButton class="px-4 py-2"> Dashboard </MainButton>
        </RouterLink>
      </div>
      <div v-else>
        <MainButton @click="clickLogout" class="px-4 py-2"> Logout </MainButton>
      </div>
    </div>
  </nav>
</template>
