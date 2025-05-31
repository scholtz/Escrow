import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { EscrowClient } from 'algorand-htlc'
import type { TransactionSigner } from 'algosdk'
import { defineStore } from 'pinia'
import { reactive } from 'vue'
//import {type UserStruct} from "biatec-avm-gas-station"

type UserStruct = {
  balance: bigint
  configuration: string
}

type GasStationConfigurationV1 = {
  assets: bigint[]
  apps: bigint[]
  addresses: string[]
  version: bigint
}

export interface IState {
  apiServer: string
  algodHost: string
  algodPort: number
  algodToken: string
  indexerHost: string
  indexerPort: number
  indexerToken: string
  env:
    | 'mainnet-v1.0'
    | 'aramidmain-v1.0'
    | 'testnet-v1.0'
    | 'betanet-v1.0'
    | 'voimain-v1.0'
    | 'fnet-v1'
  tokenName: string
  boxData: UserStruct | null
  configuration: GasStationConfigurationV1 | null
}
const defaultState: IState = {
  apiServer: 'https://gas-station-api.biatec.io',
  algodHost: 'https://mainnet-api.algonode.cloud',
  algodPort: 443,
  algodToken: '',
  indexerHost: 'https://mainnet-api.algonode.cloud',
  indexerPort: 443,
  indexerToken: '',
  env: 'mainnet-v1.0',
  tokenName: 'algo',
  boxData: null,
  configuration: null,
}
export const useAppStore = defineStore('app', () => {
  let lastTheme = localStorage.getItem('lastTheme')
  if (!lastTheme) lastTheme = 'lara-dark-teal'
  const initState = { ...defaultState }
  const state = reactive(initState)
  const getClient = (activeAddress: string, transactionSigner: TransactionSigner) => {
    if (!activeAddress) throw Error('Active address not found')
    if (!transactionSigner) throw Error('transactionSigner is missing')
    var algorandClient = AlgorandClient.fromConfig({
      algodConfig: {
        server: state.algodHost,
        port: state.algodPort,
        token: state.algodToken,
      },
      indexerConfig: {
        server: state.indexerHost,
        port: state.indexerPort,
        token: state.indexerToken,
      },
    })
    const client = new EscrowClient({
      algorand: algorandClient,
      appId: 4412n,
      defaultSender: activeAddress,
      defaultSigner: transactionSigner,
    })
    return client
  }
  return { state, getClient }
})

export const resetConfiguration = () => {
  localStorage.clear()
  const app = useAppStore()
  app.state = { ...defaultState }
}
