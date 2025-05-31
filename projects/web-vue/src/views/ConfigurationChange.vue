<script setup lang="ts">
import MainPanel from '@/components/MainPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageFooter from '@/components/PageFooter.vue'
import Text from '@/components/Text.vue'
import AuthScreen from '@/components/AuthScreen.vue'
import { onMounted, reactive } from 'vue'
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

onMounted(() => {
  if (!store.state.configuration) return
  state.applications = store.state.configuration.apps.map((m) => m.toString()).join(',')
  state.tokens = store.state.configuration.assets.map((m) => m.toString()).join(',')
  state.addresses = store.state.configuration.addresses.map((m) => m.toString()).join(',')
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
    const assets: bigint[] = state.tokens.trim()
      ? state.tokens.split(',').map((s) => BigInt(s.trim()))
      : []
    const apps: bigint[] = state.applications.trim()
      ? state.applications.split(',').map((s) => BigInt(s.trim()))
      : []
    const addresses: string[] = state.addresses.trim()
      ? state.addresses.split(',').map((s) => s.trim())
      : []
    const nextConfiguration = createGasStationConfigurationV1(assets, apps, addresses)
    console.log('nextConfiguration', nextConfiguration)
    const amount = BigInt(state.initialDeposit * 10 ** 6)
    const sender = activeAccount.value?.address
    if (!sender) throw Error('Address not found')
    state.submitting = true
    var params = await client.algorand.getSuggestedParams()
    params.lastValid = BigInt(params.firstValid) + 100n
    var ret = await client.send.changeConfiguration({
      args: {
        configuration: nextConfiguration,
      },
      sender: sender,
      signer: transactionSigner,
    })

    console.log('depositWithConfiguration', ret)
    state.submitting = false

    await router.push('/dashboard')
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
        <h2 class="text-2xl font-bold text-white mb-6">Configuration change</h2>
        <Text class="mb-4">
          You can setup the configuration when the submittion of the transaction fails on the
          specific application call, specific token or address the system will execute the funding
          of the failed tx and will submit the tx once again to the chain. If you want to allow only
          specific token transactions to be funded fill in the ASA id to the token id field and
          leave all other fields empty. This will allow gas station to fund the MBR for the account
          which is trying to opt in to your asset and fund the gas fees for this transaction.
        </Text>
        <div class="space-y-4">
          <div>
            <label class="block text-teal-100 mb-2" for="applications">Application IDs</label>
            <input
              id="applications"
              type="text"
              v-model="state.applications"
              class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Enter comma-separated App IDs"
            />
          </div>
          <div>
            <label class="block text-teal-100 mb-2" for="tokens">Token IDs</label>
            <input
              id="tokens"
              type="text"
              v-model="state.tokens"
              class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Enter comma-separated Token IDs"
            />
          </div>
          <div>
            <label class="block text-teal-100 mb-2" for="addresses">Authorized Addresses</label>
            <input
              id="addresses"
              type="text"
              v-model="state.addresses"
              class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Enter comma-separated addresses"
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
            Save Configuration
          </button>
        </div>
      </MainPanel>
    </main>
    <PageFooter />
  </AuthScreen>
</template>
