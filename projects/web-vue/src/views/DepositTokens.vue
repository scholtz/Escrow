<script setup lang="ts">
import MainPanel from '@/components/MainPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageFooter from '@/components/PageFooter.vue'
import Text from '@/components/Text.vue'
import AuthScreen from '@/components/AuthScreen.vue'
import { reactive } from 'vue'
import { useAppStore } from '@/stores/app'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { createGasStationConfigurationV1, getGasStationClient } from 'biatec-avm-gas-station'
import {
  makePaymentTxnWithSuggestedParamsFromObject,
  Transaction,
  type TransactionSigner,
} from 'algosdk'
import { useWallet } from '@txnlab/use-wallet-vue'
import router from '@/router'
import { useToast } from 'primevue/usetoast'
const { activeWallet, activeAccount, transactionSigner } = useWallet()
const store = useAppStore()

const state = reactive({
  applications: '',
  tokens: '',
  addresses: '',
  initialDeposit: 10,
  submitting: false,
})
const saveConfigurationClick = async () => {
  try {
    var algorandClient = AlgorandClient.fromConfig({
      algodConfig: {
        server: store.state.algodHost,
        port: store.state.algodPort,
        token: store.state.algodToken,
      },
      indexerConfig: {
        server: store.state.indexerHost,
        port: store.state.indexerPort,
        token: store.state.indexerToken,
      },
    })
    var client = getGasStationClient(
      store.state.env,
      algorandClient,
      activeAccount.value?.address,
      transactionSigner,
    )
    const amount = BigInt(state.initialDeposit * 10 ** 6)
    const sender = activeAccount.value?.address
    if (!sender) throw Error('Address not found')
    state.submitting = true
    var params = await client.algorand.getSuggestedParams()
    params.lastValid = BigInt(params.firstValid) + 100n
    var ret = await client.send.deposit({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: amount,
          receiver: client.appAddress,
          sender: sender,
          suggestedParams: params,
        }),
      },

      sender: sender,
      signer: transactionSigner,
    })

    console.log('depositWithConfiguration', ret)
    state.submitting = false

    router.push({ name: 'dashboard' })
  } catch (e: any) {
    console.error(e)
    const toast = useToast()
    toast.add({
      severity: 'error',
      detail: e.message ?? e,
      life: 10000,
    })
    state.submitting = false
  }
}
</script>

<template>
  <AuthScreen class="min-h-screen flex flex-col">
    <PageHeader></PageHeader>
    <main class="container mx-auto px-6 py-8 flex-grow-1">
      <MainPanel class="container mx-auto px-6 py-8 flex-grow-1">
        <h2 class="text-2xl font-bold text-white mb-6">Deposit</h2>
        <Text class="mb-4">
          You can deposit more {{ store.state.tokenName }} here. The service fee is 5% of the
          deposit.
        </Text>
        <div class="space-y-4">
          <div>
            <label class="block text-teal-100 mb-2" for="initialDeposit">
              Deposit amount ({{ store.state.tokenName }})
            </label>
            <input
              id="initialDeposit"
              type="number"
              v-model="state.initialDeposit"
              class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Enter number of rounds"
            />
          </div>
          <div v-if="state.submitting">
            <button
              v-if="state.submitting"
              @click="state.submitting = false"
              class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
            >
              Please check your wallet to sign txs or click here to cancel
            </button>
          </div>
          <button
            v-else
            @click="saveConfigurationClick"
            class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
          >
            Do the deposit
          </button>
        </div>
      </MainPanel>
    </main>
    <PageFooter />
  </AuthScreen>
</template>
