<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'

const { activeWallet, activeAccount } = useWallet()
</script>
<template>
  <MainPanel class="text-center text-teal-100 mt-8 rounded-none" v-if="activeAccount?.address">
    {{ activeAccount?.address }}
  </MainPanel>
</template>
