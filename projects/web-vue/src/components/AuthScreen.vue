<script setup lang="ts">
import H2 from '@/components/H2.vue'
import { WalletId, useNetwork, useWallet, type Wallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'
import { onMounted, reactive, ref, watch } from 'vue'
import PageHeaderUnauthenticated from './PageHeaderUnauthenticated.vue'
import MainPanel from './MainPanel.vue'
import MainButton from './MainButton.vue'
import { useAppStore } from '@/stores/app'

const state = reactive({
  wallets: [] as Wallet[],
})
const { activeNetwork, setActiveNetwork, networkConfig } = useNetwork()
console.log('networkConfig', networkConfig)
onMounted(() => {
  selectChainClick(chains.find((c) => c.code == store.state.env))
})

const { algodClient, transactionSigner, wallets, activeAddress } = useWallet()
const isMagicLink = (wallet: Wallet) => wallet.id === WalletId.MAGIC
const getConnectArgs = (wallet: Wallet) => {
  if (isMagicLink(wallet)) {
    return { email: magicEmail.value }
  }
  return undefined
}
const isConnectDisabled = (wallet: Wallet) =>
  wallet.isConnected || (isMagicLink(wallet) && !isEmailValid())
const isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail.value)

const magicEmail = ref('')

const setActiveAccount = (event: Event, wallet: Wallet) => {
  const target = event.target as HTMLSelectElement
  wallet.setActiveAccount(target.value)
}

const setActiveWallet = async (wallet: Wallet) => {
  await wallet.setActive()
}

watch(
  () => wallets,
  () => {
    selectChainClick(chains.find((c) => c.code == store.state.env))
  },
)

const store = useAppStore()
const selectChainClick = (chain: any) => {
  for (const networkId in networkConfig) {
    if (networkConfig[networkId].genesisId == chain.code) {
      setActiveNetwork(networkId)
    }
  }

  store.state.algodHost = chain.algodHost
  store.state.algodPort = chain.algodPort
  store.state.algodToken = chain.algodToken
  store.state.indexerHost = chain.indexerHost
  store.state.indexerPort = chain.indexerPort
  store.state.indexerToken = chain.indexerToken
  store.state.env = chain.code
  store.state.tokenName = chain.tokenName
  const newWallets: Wallet[] = []
  console.log('chain.wallets', chain.wallets, wallets.value)
  for (let walletId of chain.wallets) {
    const w = wallets.value.find((w) => w.id == walletId)
    console.log('w', w)
    if (w) {
      newWallets.push(w)
    }
  }
  state.wallets = newWallets
}
const chains = [
  {
    name: 'Algorand Mainnet',
    code: 'mainnet-v1.0',
    algodHost: 'https://mainnet-api.4160.nodely.dev',
    algodPort: 443,
    algodToken: '',
    indexerHost: 'https://mainnet-idx.4160.nodely.dev',
    indexerPort: 443,
    indexerToken: '',
    tokenName: 'algo',
    wallets: [
      WalletId.BIATEC,
      WalletId.DEFLY,
      WalletId.EXODUS,
      WalletId.PERA,
      WalletId.KIBISIS,
      WalletId.WALLETCONNECT,
    ],
  },
  {
    name: 'Voi Mainnet',
    code: 'voimain-v1.0',
    algodHost: 'https://mainnet-api.voi.nodely.dev',
    algodPort: 443,
    algodToken: '',
    indexerHost: 'https://mainnet-idx.voi.nodely.dev',
    indexerPort: 443,
    indexerToken: '',
    tokenName: 'voi',
    wallets: [WalletId.BIATEC, WalletId.KIBISIS, WalletId.DEFLY, WalletId.WALLETCONNECT],
  },
  {
    name: 'Aramid Mainnet',
    code: 'aramidmain-v1.0',
    algodHost: 'https://algod.aramidmain.a-wallet.net',
    algodPort: 443,
    algodToken: '',
    indexerHost: 'https://aramidindexer.de-k1.a-wallet.net',
    indexerPort: 443,
    indexerToken: '',
    tokenName: 'aalgo',
    wallets: [WalletId.BIATEC, WalletId.DEFLY, WalletId.WALLETCONNECT],
  },
  {
    name: 'Algorand Testnet',
    code: 'testnet-v1.0',
    algodHost: 'https://testnet-api.4160.nodely.dev',
    algodPort: 443,
    algodToken: '',
    indexerHost: 'https://testnet-idx.4160.nodely.dev',
    indexerPort: 443,
    indexerToken: '',
    tokenName: 'testa',
    wallets: [WalletId.BIATEC, WalletId.DEFLY, WalletId.PERA, WalletId.WALLETCONNECT],
  },
  // {
  //   name: 'Localnet',
  //   code: 'dockernet-v1',
  //   algodHost: 'http://localhost',
  //   algodPort: 4001,
  //   algodToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  //   indexerHost: 'http://localhost',
  //   indexerPort: 8980,
  //   indexerToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  //   tokenName: 'local',
  //   wallets: [
  //     WalletId.BIATEC,
  //     WalletId.KIBISIS,
  //     WalletId.DEFLY,
  //     WalletId.PERA,
  //     WalletId.WALLETCONNECT,
  //   ],
  // },
]
</script>
<template>
  <div v-if="activeAddress">
    <slot />
  </div>
  <div v-else class="flex flex-col items-center justify-center min-h-screen w-full">
    <PageHeaderUnauthenticated />
    <div class="flex-1">
      <MainPanel class="w-200 text-white m-8">
        <H2>Blockchain selection {{ store.state.env }}</H2>
        <MainButton
          v-for="chain in chains"
          :class="
            store?.state?.env == chain.code ? 'bg-teal-800  hover:bg-teal-700 !text-teal-100' : ''
          "
          class="mb-4 flex justify-center items-center"
          @click="selectChainClick(chain)"
        >
          {{ chain.name }}
        </MainButton>

        <H2>Wallet selection</H2>
        <div>
          <div v-for="wallet in state.wallets" :key="wallet.id" class="wallet-group">
            <MainButton
              class="mb-4 flex justify-center items-center"
              v-if="!wallet.isActive && wallet.isConnected"
              @click="setActiveWallet(wallet)"
              :disabled="!wallet.isConnected || wallet.isActive"
            >
              <img :src="wallet.metadata.icon" width="40" height="40" class="rounded mx-2" />
              {{ wallet.metadata.name }} Set Active
            </MainButton>
            <MainButton
              v-else
              class="mb-4 flex justify-center items-center"
              @click="wallet.connect(getConnectArgs(wallet))"
              :disabled="isConnectDisabled(wallet)"
            >
              <img :src="wallet.metadata.icon" width="40" height="40" class="rounded mx-2" />
              Connect {{ wallet.metadata.name }} <span v-if="wallet.isActive">[active]</span>
            </MainButton>
            <MainButton
              class="mb-4 flex justify-center items-center"
              @click="wallet.disconnect()"
              :disabled="!wallet.isConnected"
              v-if="wallet.isConnected"
            >
              <img :src="wallet.metadata.icon" width="40" height="40" class="rounded mx-2" />
              {{ wallet.metadata.name }} Disconnect <span v-if="wallet.isActive">[active]</span>
            </MainButton>
            <!-- <button v-else @click="sendTransaction(wallet)" :disabled="isSending">
            {{ isSending ? 'Sending Transaction...' : 'Send Transaction' }}
          </button> -->

            <div v-if="isMagicLink(wallet)" class="input-group">
              <label for="magic-email">Email:</label>
              <input
                id="magic-email"
                type="email"
                v-model="magicEmail"
                placeholder="Enter email to connect..."
                :disabled="wallet.isConnected"
              />
            </div>

            <div v-if="wallet.isActive && wallet.accounts.length > 0">
              <select @change="(event) => setActiveAccount(event, wallet)">
                <option
                  v-for="account in wallet.accounts"
                  :key="account.address"
                  :value="account.address"
                >
                  {{ account.address }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </MainPanel>
    </div>
  </div>
</template>
