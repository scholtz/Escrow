<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import AuthScreen from '@/components/AuthScreen.vue'
import MainPanel from '@/components/MainPanel.vue'
import { reactive } from 'vue'
import { makeArc14AuthHeader } from 'arc14'
import { useWallet } from '@txnlab/use-wallet-vue'
import { Algodv2, makePaymentTxnWithSuggestedParamsFromObject, type SuggestedParams } from 'algosdk'
import { useAppStore } from '@/stores/app'
import { useToast } from 'primevue/usetoast'

const state = reactive({
  validity: 1000000,
  submitting: false,
  token: '',
})

const store = useAppStore()

const { activeWallet, activeAccount, transactionSigner, signTransactions } = useWallet()
const generateTokenClick = async () => {
  try {
    if (!activeAccount.value) throw Error('Address not found')
    var algod = new Algodv2(store.state.algodToken, store.state.algodHost, store.state.algodPort)
    const params = await algod.getTransactionParams().do()
    params.lastValid = BigInt(params.firstValid) + BigInt(state.validity)
    const tx = await makeArc14TxWithSuggestedParams(
      'BiatecGasStation',
      activeAccount.value.address,
      params,
    )
    state.submitting = true

    const signed = await signTransactions([tx])
    state.submitting = false
    if (signed.length > 0 && signed[0]) {
      state.token = makeArc14AuthHeader(signed[0])
    }
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

const makeArc14TxWithSuggestedParams = async (
  realm: string,
  authAddress: string,
  params: SuggestedParams,
) => {
  if (!realm.endsWith('#ARC14')) {
    realm = realm + '#ARC14'
  }
  params.fee = BigInt(0)
  params.minFee = BigInt(0)
  params.flatFee = true
  const tx = makePaymentTxnWithSuggestedParamsFromObject({
    amount: 0,
    sender: authAddress,
    receiver: authAddress,
    suggestedParams: params,
    note: new Uint8Array(Buffer.from(realm)),
  })
  return tx
}

const copyTokenClick = () => {
  navigator.clipboard
    .writeText(state.token)
    .then(() => console.log('Copied to clipboard!'))
    .catch((err) => console.error('Error copying to clipboard:', err))
}
</script>

<template>
  <AuthScreen class="min-h-screen flex flex-col">
    <PageHeader></PageHeader>
    <main class="container mx-auto px-6 py-8 flex-grow-1">
      <MainPanel class="container mx-auto px-6 py-8 flex-grow-1">
        <h2 class="text-2xl font-bold text-white mb-6">Create funding token</h2>
        <Text class="mb-4">
          Funding token is ARC14 signed transaction used for authentication of validity of the
          sender. You sign this transaction as proof that you are allowing users to be funded
          according to the configuration you provided.
        </Text>
        <div v-if="state.token">
          <textarea
            class="w-full my-8 text-teal-100 border-teal-500 rounded-2xl bg-teal-950 p-8"
            rows="5"
            v-model="state.token"
            disabled
          ></textarea>
          <button
            @click="copyTokenClick"
            class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
          >
            Copy
          </button>
        </div>
        <div class="space-y-4" v-else>
          <div>
            <label class="block text-teal-100 mb-2" for="validity"> Validity duration </label>
            <input
              id="validity"
              type="number"
              v-model="state.validity"
              class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="Enter number of rounds while this token will be valid"
              min="0"
              step="1"
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
            @click="generateTokenClick"
            class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
          >
            Generate token
          </button>
        </div>
      </MainPanel>
    </main>
  </AuthScreen>
</template>
