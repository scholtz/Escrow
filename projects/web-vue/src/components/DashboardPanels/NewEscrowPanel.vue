<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import { createEscrow } from 'algorand-htlc'
import algosdk from 'algosdk'
import { useToast } from 'primevue/usetoast'
import { computed, reactive } from 'vue'
import { useAppStore } from '../../stores/app'
const toast = useToast()
const store = useAppStore()
const { activeAddress, transactionSigner } = useWallet()
const state = reactive({
  useNative: true,
  tokenId: 0,
  deposit: 0,
  tokenType: 'native' as 'asa' | 'native',
  receiverRestriction: 'any' as 'any' | 'specific',
  receiverAddress: '',
  passwordMode: 'plain',
  password: '',
  showPassword: false,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  submitting: false,
})
const totalSeconds = computed(
  () => state.days * 86400 + state.hours * 3600 + state.minutes * 60 + state.seconds,
)

const passwordOptions = [
  { value: 'plain', label: 'Password' },
  { value: 'base64', label: 'Base64 Password' },
  { value: 'hex', label: 'Hex Password' },
  { value: 'base64-hash', label: 'Hash of password in Base64' },
  { value: 'hex-hash', label: 'Hash of password in Hex' },
]

const makeHash = (): Uint8Array => {
  return new Uint8Array(Buffer.from(state.password))
}
const makeTaker = (): string => {
  return algosdk.ALGORAND_ZERO_ADDRESS_STRING
}
const createClick = async () => {
  try {
    if (!activeAddress.value) throw Error('Active address not found')
    state.submitting = true
    await createEscrow({
      client: store.getClient(activeAddress.value.toString(), transactionSigner),
      deposit: BigInt(1),
      rescueDelay: BigInt(totalSeconds.value),
      secretHash: makeHash(),
      sender: activeAddress.value.toString(),
      taker: makeTaker(),
      tokenId: BigInt(state.tokenId),
      tokenType: state.tokenType,
    })
    toast.add({
      severity: 'info',
      detail: 'Escrow created',
      life: 10000,
    })
    state.submitting = false
  } catch (e: any) {
    console.error(e)
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
  <div class="space-y-4">
    <H1>Create new escrow</H1>
    <div class="space-y-4 text-teal-100">
      <label class="block text-teal-100 mb-2">Token type</label>
      <div class="flex gap-4 mb-2 text-white">
        <label class="flex items-center gap-2">
          <input type="radio" value="native" v-model="state.tokenType" class="accent-teal-400" />
          Native token ({{ store.state.tokenName }})
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" value="asa" v-model="state.tokenType" class="accent-teal-400" />
          ASA
        </label>
      </div>

      <!-- Conditional tokenId input -->
      <div v-if="state.tokenType === 'asa'">
        <label class="block text-teal-100 mb-2" for="tokenId"> ASA Token ID </label>
        <input
          id="tokenId"
          type="number"
          v-model="state.tokenId"
          class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
          placeholder="Enter ASA Token ID"
        />
      </div>
      <div>
        <label class="block text-teal-100 mb-2" for="deposit">
          Deposit amount ({{ store.state.tokenName }})
        </label>
        <input
          id="deposit"
          type="number"
          v-model="state.deposit"
          class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
          placeholder="Enter number of rounds"
        />
      </div>

      <div class="mb-6">
        <label class="block text-teal-100 mb-2">Duration (until claim expires)</label>
        <div class="grid grid-cols-4 gap-4 text-white mb-2">
          <div>
            <label class="block text-sm mb-1">Days</label>
            <input
              type="number"
              v-model.number="state.days"
              min="0"
              class="w-full bg-white bg-opacity-20 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <div>
            <label class="block text-sm mb-1">Hours</label>
            <input
              type="number"
              v-model.number="state.hours"
              min="0"
              max="23"
              class="w-full bg-white bg-opacity-20 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <div>
            <label class="block text-sm mb-1">Minutes</label>
            <input
              type="number"
              v-model.number="state.minutes"
              min="0"
              max="59"
              class="w-full bg-white bg-opacity-20 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <div>
            <label class="block text-sm mb-1">Seconds</label>
            <input
              type="number"
              v-model.number="state.seconds"
              min="0"
              max="59"
              class="w-full bg-white bg-opacity-20 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
        </div>

        <!-- Display total duration in seconds -->
        <div class="text-teal-200 text-sm">
          Total duration: <strong>{{ totalSeconds }}</strong> seconds
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-teal-100 mb-2">Receiver restriction</label>
        <div class="flex flex-col gap-2 text-white">
          <label class="flex items-center gap-2">
            <input
              type="radio"
              value="any"
              v-model="state.receiverRestriction"
              class="accent-teal-400"
            />
            Anybody can receive token if submits correct password
          </label>
          <label class="flex items-center gap-2">
            <input
              type="radio"
              value="specific"
              v-model="state.receiverRestriction"
              class="accent-teal-400"
            />
            Only specific address can receive tokens
          </label>
        </div>

        <!-- Show address input if 'specific' selected -->
        <div v-if="state.receiverRestriction === 'specific'" class="mt-3">
          <label class="block text-teal-100 mb-2" for="receiverAddress"> Receiver Address </label>
          <input
            id="receiverAddress"
            type="text"
            v-model="state.receiverAddress"
            class="w-full bg-white bg-opacity-20 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
            placeholder="Enter wallet address"
          />
        </div>
      </div>

      <div class="mb-6">
        <label class="block text-teal-100 mb-2">Password format</label>
        <div></div>
        <div class="flex flex-col gap-2 text-white mb-2">
          <label
            v-for="option in passwordOptions"
            :key="option.value"
            class="flex items-center gap-2"
          >
            <input
              type="radio"
              :value="option.value"
              v-model="state.passwordMode"
              class="accent-teal-400"
            />
            {{ option.label }}
          </label>
        </div>

        <!-- Warning for hash options -->
        <div v-if="state.passwordMode.includes('hash')" class="text-yellow-300 text-sm mb-2">
          ⚠️ The app cannot guarantee correctness of the submitted hash.
        </div>

        <!-- Password input -->
        <div class="relative">
          <label class="block text-teal-100 mb-2" for="passwordInput">
            {{ state.passwordMode.includes('hash') ? 'Hash' : 'Password' }}
          </label>
          <input
            :type="state.showPassword ? 'text' : 'password'"
            id="passwordInput"
            v-model="state.password"
            class="w-full bg-white bg-opacity-20 text-white p-3 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
            placeholder="Enter value"
          />
          <!-- Toggle button -->
          <button
            type="button"
            @click="state.showPassword = !state.showPassword"
            class="absolute top-2 right-3 text-sm text-teal-200 underline"
          >
            {{ state.showPassword ? 'Hide' : 'Show' }}
          </button>
        </div>
      </div>

      <Button @click="createClick">Create escrow</Button>
    </div>
  </div>
</template>
