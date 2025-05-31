<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import { type EscrowInstance } from 'algorand-htlc'
import { onMounted, reactive } from 'vue'
import { useAppStore } from '../../stores/app'
const { activeAddress, transactionSigner } = useWallet()
const state = reactive({
  list: [] as EscrowInstance[],
})
onMounted(async () => {
  if (activeAddress.value && transactionSigner) {
    const store = useAppStore()
    const client = store.getClient(activeAddress.value.toString(), transactionSigner)
    const boxes = await client.state.box.escrows.getMap()
    for (let box of boxes) {
      state.list.push(box[1])
    }
  }
})
</script>
<template>
  <div class="space-y-4">
    <H1>List of escrows</H1>
    <div class="space-y-4 text-teal-100">
      {{ state.list }}
      <p>
        Please select in action menu what you want to do. You can create new escrow, claim escrow if
        you know the password, or rescue from the escrow.
      </p>
    </div>
  </div>
</template>
