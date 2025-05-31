<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import AuthScreen from '@/components/AuthScreen.vue'
import MainPanel from '@/components/MainPanel.vue'
import { reactive } from 'vue'
import { makeArc14AuthHeader } from 'arc14'
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk, {
  Algodv2,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  SignedTransaction,
  type SuggestedParams,
} from 'algosdk'
import { useAppStore } from '@/stores/app'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

import { getArc200Client } from 'arc200-client'
import type { BoxIdentifier } from '@algorandfoundation/algokit-utils/types/app-manager'
import { useToast } from 'primevue/usetoast'
import { sendRawTransaction } from 'biatec-avm-gas-station'

const toast = useToast()

const state = reactive({
  validity: 1000000,
  submittingASA: false,
  processingASA: false,
  asaid: 0,
  tokenASA: '',

  ARC200_1_submitting: false,
  ARC200_1_processing: false,
  ARC200_1_tokenId: 0,
  ARC200_1_amount: 0,
  ARC200_1_receiver: '',
  ARC200_1_arc14: '',

  ARC200_2_submitting: false,
  ARC200_2_processing: false,
  ARC200_2_tokenId: 0,
  ARC200_2_amount: 0,
  ARC200_2_receiver: '',
  ARC200_2_arc14: '',
})

const store = useAppStore()

const { activeWallet, activeAccount, transactionSigner, signTransactions } = useWallet()

interface IPostTransactionsResponse {
  txId: string
}
function concatArrays(...arrs: ArrayLike<number>[]) {
  const size = arrs.reduce((sum, arr) => sum + arr.length, 0)
  const c = new Uint8Array(size)

  let offset = 0
  for (let i = 0; i < arrs.length; i++) {
    c.set(arrs[i], offset)
    offset += arrs[i].length
  }

  return c
}
function isByteArray(array: any): array is Uint8Array {
  return array && array.byteLength !== undefined
}

const optinASAClick = async () => {
  try {
    if (!activeAccount.value) throw Error('Address not found')
    var algod = new Algodv2(store.state.algodToken, store.state.algodHost, store.state.algodPort)
    const params = await algod.getTransactionParams().do()
    const tx = makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0,
      assetIndex: state.asaid,
      receiver: activeAccount.value.address,
      sender: activeAccount.value.address,
      suggestedParams: params,
      note: new Uint8Array(Buffer.from('Biatec Gas Station DEMO', 'ascii')),
    })
    state.submittingASA = true
    const signed = await signTransactions([tx])
    state.submittingASA = false
    state.processingASA = true
    if (signed?.length > 0 && signed[0]) {
      const ret = await sendRawTransaction(signed[0], state.tokenASA)
      console.log('ret', ret)
    }
    state.processingASA = false
  } catch (e: any) {
    console.error(e)
    toast.add({
      severity: 'error',
      detail: e.message ?? e,
      life: 10000,
    })
    state.processingASA = false
    state.submittingASA = false
  }
}

const ARC200_1_Click = async () => {
  try {
    if (!activeAccount.value) throw Error('Address not found')
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
    const client = getArc200Client({
      algorand: algorandClient,
      appId: BigInt(state.ARC200_1_tokenId),
      appName: undefined,
      approvalSourceMap: undefined,
      clearSourceMap: undefined,
      defaultSender: activeAccount.value.address,
      defaultSigner: transactionSigner,
    })
    let decimals = 6
    try {
      decimals = await client.arc200Decimals({ args: {} })
    } catch (e: any) {
      console.error(e)
      toast.add({
        severity: 'error',
        detail: 'Failed to fetch decimals. Using 6 as default. ' + (e.message ?? e),
        life: 10000,
      })
    }
    console.log('decimals', decimals)
    const box1: BoxIdentifier = new Uint8Array(
      Buffer.concat([
        Buffer.from('balances', 'ascii'),
        algosdk.decodeAddress(activeAccount.value.address).publicKey,
      ]),
    )
    const box2: BoxIdentifier = new Uint8Array(
      Buffer.concat([
        Buffer.from('balances', 'ascii'),
        algosdk.decodeAddress(state.ARC200_1_receiver).publicKey,
      ]),
    )

    console.log('box1', Buffer.from(box1).toString('hex'))
    console.log('box2', Buffer.from(box2).toString('hex'))

    const txs = await client.createTransaction.arc200Transfer({
      args: {
        to: state.ARC200_1_receiver,
        value: BigInt(state.ARC200_1_amount * 10 ** decimals),
      },
      boxReferences: [box1, box2],
    })

    console.log('txs', txs)
    state.ARC200_1_submitting = true
    const signed = await signTransactions(txs.transactions)
    state.ARC200_1_submitting = false
    state.ARC200_1_processing = true
    if (signed?.length > 0 && signed[0]) {
      const ret = await sendRawTransaction(signed[0], state.ARC200_1_arc14)
      console.log('ret', ret)
    }
    state.ARC200_1_processing = false
  } catch (e: any) {
    console.error(e)
    toast.add({
      severity: 'error',
      detail: e.message ?? e,
      life: 10000,
    })
    state.ARC200_1_submitting = false
    state.ARC200_1_processing = false
  }
}

const ARC200_2_Click = async () => {
  try {
    if (!activeAccount.value) throw Error('Address not found')
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
    const client = getArc200Client({
      algorand: algorandClient,
      appId: BigInt(state.ARC200_2_tokenId),
      appName: undefined,
      approvalSourceMap: undefined,
      clearSourceMap: undefined,
      defaultSender: activeAccount.value.address,
      defaultSigner: transactionSigner,
    })
    let decimals = 6
    try {
      decimals = await client.arc200Decimals({ args: {} })
    } catch (e: any) {
      console.error(e)
      toast.add({
        severity: 'error',
        detail: 'Failed to fetch decimals. Using 6 as default. ' + (e.message ?? e),
        life: 10000,
      })
    }
    console.log('decimals', decimals)
    const box1: BoxIdentifier = new Uint8Array(
      Buffer.concat([
        Buffer.from('balances', 'ascii'),
        algosdk.decodeAddress(activeAccount.value.address).publicKey,
      ]),
    )
    const box2: BoxIdentifier = new Uint8Array(
      Buffer.concat([
        Buffer.from('balances', 'ascii'),
        algosdk.decodeAddress(state.ARC200_2_receiver).publicKey,
      ]),
    )

    console.log('box1', Buffer.from(box1).toString('hex'))
    console.log('box2', Buffer.from(box2).toString('hex'))

    const txs = await client.createTransaction.arc200Transfer({
      args: {
        to: state.ARC200_2_receiver,
        value: BigInt(state.ARC200_2_amount * 10 ** decimals),
      },
      boxReferences: [box1, box2],
    })

    console.log('txs', txs)
    state.ARC200_2_submitting = true
    const signed = await signTransactions(txs.transactions)
    state.ARC200_2_submitting = false
    state.ARC200_2_processing = true
    if (signed?.length > 0 && signed[0]) {
      const ret = await sendRawTransaction(signed[0], state.ARC200_2_arc14)
      console.log('ret', ret)
    }
    state.ARC200_2_processing = false
  } catch (e: any) {
    console.error(e)
    toast.add({
      severity: 'error',
      detail: e.message ?? e,
      life: 10000,
    })
    state.ARC200_2_submitting = false
    state.ARC200_2_processing = false
  }
}
</script>

<template>
  <AuthScreen class="min-h-screen flex flex-col">
    <PageHeader></PageHeader>
    <main class="container mx-auto px-6 py-8 flex-grow-1">
      <div class="grid md:grid-cols-3 gap-8">
        <MainPanel class="container mx-auto px-6 py-8 flex-grow-1">
          <h2 class="text-2xl font-bold text-white mb-6">Opt in to the asset</h2>
          <Text class="mb-4">
            Please provide the authorization token from the funder, and ASA id to which you want to
            opt in. If you opt in with the new account, the gas station will fund you 200 micro
            {{ store.state.tokenName }} as minimum account balance and the gas fees.
          </Text>
          <div class="space-y-4">
            <div>
              <label class="block text-teal-100 mb-2" for="token"> Funder's ARC14 Token </label>
              <input
                id="token"
                v-model="state.tokenASA"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Past here token from funder. Token will start with prefix SigTx"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="asaid"> ASA id </label>
              <input
                id="asaid"
                type="number"
                v-model="state.asaid"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter asset ID"
                min="0"
                step="1"
              />
            </div>
            <div v-if="state.submittingASA">
              <button
                v-if="state.submittingASA"
                @click="state.submittingASA = false"
                class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
              >
                Please check your wallet to sign txs or click here to cancel
              </button>
            </div>
            <div v-else-if="state.processingASA">
              <button
                v-if="state.processingASA"
                @click="state.processingASA = false"
                class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
              >
                Processing the tx at the gas station..
              </button>
            </div>
            <button
              v-else
              @click="optinASAClick"
              class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
            >
              Sign transaction
            </button>
          </div>
        </MainPanel>
        <MainPanel class="container mx-auto px-6 py-8 flex-grow-1">
          <h2 class="text-2xl font-bold text-white mb-6">Send ARC200 to new account</h2>
          <Text class="mb-4">
            If you do not want to fund MBR for the arc200 smart contract for the user you want to
            send the ARC200 token and the third party decided to fund the MBR balance using the gas
            station, the gas station will fund the contract with the minimum balance before the
            transaction is sent to the chain.
          </Text>
          <div class="space-y-4">
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_1_arc14">
                Funder's ARC14 Token
              </label>
              <input
                id="ARC200_1_arc14"
                v-model="state.ARC200_1_arc14"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Past here token from funder. Token will start with prefix SigTx"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_1_tokenId"> ARC200 app id </label>
              <input
                id="ARC200_1_tokenId"
                type="number"
                v-model="state.ARC200_1_tokenId"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter arc200 app ID"
                min="0"
                step="1"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_1_amount"> Amount to send </label>
              <input
                id="ARC200_1_amount"
                type="number"
                v-model="state.ARC200_1_amount"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter amount to send"
                min="0"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_1_receiver"> Receiver </label>
              <input
                id="ARC200_1_receiver"
                v-model="state.ARC200_1_receiver"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter whom to send the assets"
              />
            </div>
            <div v-if="state.ARC200_1_submitting">
              <button
                v-if="state.ARC200_1_submitting"
                @click="state.ARC200_1_submitting = false"
                class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
              >
                Please check your wallet to sign txs or click here to cancel
              </button>
            </div>
            <div v-else-if="state.ARC200_1_processing">
              <button
                v-if="state.ARC200_1_processing"
                @click="state.ARC200_1_processing = false"
                class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
              >
                Processing the tx at the gas station..
              </button>
            </div>
            <button
              v-else
              @click="ARC200_1_Click"
              class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
            >
              Sign transaction
            </button>
          </div>
        </MainPanel>
        <MainPanel class="container mx-auto px-6 py-8 flex-grow-1">
          <h2 class="text-2xl font-bold text-white mb-6">Send ARC200 from empty account</h2>
          <Text class="mb-4">
            If user receives the ARC200 token and he does not have any algos on his account, he can
            send the assets only after he funds his MBR and pays for the gas fee for the transfer
            out tx. Funder can fund his MBR and tx fee, so that the user has no bad onboarding
            experience.
          </Text>
          <div class="space-y-4">
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_1_arc14">
                Funder's ARC14 Token
              </label>
              <input
                id="ARC200_2_arc14"
                v-model="state.ARC200_2_arc14"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Past here token from funder. Token will start with prefix SigTx"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_2_tokenId"> ARC200 app id </label>
              <input
                id="ARC200_2_tokenId"
                type="number"
                v-model="state.ARC200_2_tokenId"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter arc200 app ID"
                min="0"
                step="1"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_2_amount"> Amount to send </label>
              <input
                id="ARC200_2_amount"
                type="number"
                v-model="state.ARC200_2_amount"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter amount to send"
                min="0"
              />
            </div>
            <div>
              <label class="block text-teal-100 mb-2" for="ARC200_2_receiver"> Receiver </label>
              <input
                id="ARC200_2_receiver"
                v-model="state.ARC200_2_receiver"
                class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Enter whom to send the assets"
              />
            </div>
            <div v-if="state.ARC200_2_submitting">
              <button
                v-if="state.ARC200_2_submitting"
                @click="state.ARC200_2_submitting = false"
                class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
              >
                Please check your wallet to sign txs or click here to cancel
              </button>
            </div>
            <div v-else-if="state.ARC200_2_processing">
              <button
                v-if="state.ARC200_2_processing"
                @click="state.ARC200_2_processing = false"
                class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
              >
                Processing the tx at the gas station..
              </button>
            </div>
            <button
              v-else
              @click="ARC200_2_Click"
              class="w-full bg-teal-500 text-white py-3 rounded-lg font-semibold hover:bg-teal-600 transition-all"
            >
              Sign transaction
            </button>
          </div>
        </MainPanel>
      </div>
    </main>
  </AuthScreen>
</template>
