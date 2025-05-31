import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { getArc200Client } from 'arc200-client'
import { type IAssetParams } from '../../types/IAssetParams'

interface INetworkAssetCache {
  [key: string]: IAssetCache
}
interface IAssetCache {
  [key: string]: IAssetParams
}

const cache: INetworkAssetCache = {}

export const getAssetAsync = async (
  assetId: string | number | bigint,
  avmClient: AlgorandClient,
): Promise<IAssetParams> => {
  const network = await avmClient.client.network()
  const assetBigInt = BigInt(assetId)
  const assetStr = assetBigInt.toString()
  if (cache[network.genesisId] && cache[network.genesisId][assetStr]) {
    return cache[network.genesisId][assetStr]
  }
  if (assetBigInt == 0n) {
    if (network.genesisId == 'mainnet-v1.0') {
      return {
        id: 0n,
        type: 'native',
        creator: '',
        decimals: 6,
        total: 10_000_000_000_000_000n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: 'Algorand',
        nameB64: new Uint8Array(Buffer.from('Algorand', 'ascii')),
        reserve: undefined,
        unitName: 'Algo',
        unitNameB64: new Uint8Array(Buffer.from('Algo', 'ascii')),
        url: 'https://www.algorand.com',
        urlB64: new Uint8Array(Buffer.from('https://www.algorand.com', 'ascii')),
        chain: network.genesisId,
      }
    } else if (network.genesisId == 'testnet-v1.0') {
      return {
        id: 0n,
        type: 'native',
        creator: '',
        decimals: 6,
        total: 10_000_000_000_000_000n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: 'Testnet',
        nameB64: new Uint8Array(Buffer.from('Testnet', 'ascii')),
        reserve: undefined,
        unitName: 'T',
        unitNameB64: new Uint8Array(Buffer.from('T', 'ascii')),
        url: 'https://www.algorand.com',
        urlB64: new Uint8Array(Buffer.from('https://www.algorand.com', 'ascii')),
        chain: network.genesisId,
      }
    } else if (network.genesisId == 'voimain-v1.0') {
      return {
        id: 0n,
        type: 'native',
        creator: '',
        decimals: 6,
        total: 10_000_000_000_000_000n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: 'Voi Chain',
        nameB64: new Uint8Array(Buffer.from('Voi Chain', 'ascii')),
        reserve: undefined,
        unitName: 'Voi',
        unitNameB64: new Uint8Array(Buffer.from('Voi', 'ascii')),
        url: 'https://www.voi.network',
        urlB64: new Uint8Array(Buffer.from('https://www.voi.network', 'ascii')),
        chain: network.genesisId,
      }
    } else if (network.genesisId == 'aramidmain-v1.0') {
      return {
        id: 0n,
        type: 'native',
        creator: '',
        decimals: 6,
        total: 10_000_000_000_000_000n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: 'Aramid Chain',
        nameB64: new Uint8Array(Buffer.from('Aramid Chain', 'ascii')),
        reserve: undefined,
        unitName: 'Aramid',
        unitNameB64: new Uint8Array(Buffer.from('Aramid', 'ascii')),
        url: 'https://aramid.finance',
        urlB64: new Uint8Array(Buffer.from('https://aramid.finance', 'ascii')),
        chain: network.genesisId,
      }
    } else if (network.genesisId == 'dockernet-v1') {
      return {
        id: 0n,
        type: 'native',
        creator: '',
        decimals: 6,
        total: 10_000_000_000_000_000n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: 'Local chain',
        nameB64: new Uint8Array(Buffer.from('Local chain', 'ascii')),
        reserve: undefined,
        unitName: 'Local',
        unitNameB64: new Uint8Array(Buffer.from('Local', 'ascii')),
        url: 'https://lora.algokit.io/localnet',
        urlB64: new Uint8Array(Buffer.from('https://lora.algokit.io/localnet', 'ascii')),
        chain: network.genesisId,
      }
    } else {
      console.error('requets for native token, but token genesis not identified', network)
    }
  }
  try {
    const assetInfo = await avmClient.client.algod.getAssetByID(assetBigInt).do()
    if (assetInfo?.params) {
      if (!cache[network.genesisId]) cache[network.genesisId] = {}
      cache[network.genesisId][assetStr] = {
        ...assetInfo.params,
        id: assetBigInt,
        type: 'asa',
        chain: network.genesisId as
          | 'mainnet-v1.0'
          | 'aramidmain-v1.0'
          | 'testnet-v1.0'
          | 'betanet-v1.0'
          | 'voimain-v1.0'
          | 'fnet-v1'
          | 'dockernet-v1',
      }
    }
  } catch {
    try {
      const app = await avmClient.client.algod.getApplicationByID(assetBigInt).do()
      const transactionSigner = async (
        txnGroup: algosdk.Transaction[],
        indexesToSign: number[],
      ): Promise<Uint8Array[]> => {
        console.log('transactionSigner', txnGroup, indexesToSign)
        return [] as Uint8Array[]
      }
      const arc200 = getArc200Client({
        algorand: avmClient,
        appId: assetBigInt,
        appName: undefined,
        approvalSourceMap: undefined,
        clearSourceMap: undefined,
        defaultSender: 'TESTNTTTJDHIF5PJZUBTTDYYSKLCLM6KXCTWIOOTZJX5HO7263DPPMM2SU',
        defaultSigner: transactionSigner,
      })
      const state = await arc200.state.global.getAll()
      const params: IAssetParams = {
        id: assetBigInt,
        type: 'arc200',
        creator: algosdk.encodeAddress(app.params.creator.publicKey),
        decimals: state.decimals ?? 0,
        total: state.totalSupply ?? 0n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: Buffer.from(state.name?.buffer ?? Buffer.from('ARC200', 'ascii')).toString('utf-8'),
        nameB64: new Uint8Array(Buffer.from(state.name?.buffer ?? Buffer.from('ARC200', 'ascii'))),
        reserve: undefined,
        unitName: Buffer.from(state.symbol?.buffer ?? Buffer.from('U', 'ascii')).toString('utf-8'),
        unitNameB64: new Uint8Array(Buffer.from(state.symbol?.buffer ?? Buffer.from('U', 'ascii'))),
        url: undefined,
        urlB64: undefined,
        chain: network.genesisId as
          | 'mainnet-v1.0'
          | 'aramidmain-v1.0'
          | 'testnet-v1.0'
          | 'betanet-v1.0'
          | 'voimain-v1.0'
          | 'fnet-v1'
          | 'dockernet-v1',
      }
      const nameBuf = await arc200.arc200Name({ args: {} })

      if (nameBuf) {
        let end = nameBuf.length
        while (end > 0 && nameBuf[end - 1] === 0x00) end--
        const trimmed = nameBuf.slice(0, end)

        const name = await Buffer.from(trimmed).toString('utf-8').trim()
        console.log('nameBuf', nameBuf, Buffer.from(nameBuf).toString('hex'), name)
        if (name) {
          params.name = name
          params.unitNameB64 = new Uint8Array(Buffer.from(params.name))
        }
      }
      const decimals = await arc200.arc200Decimals({ args: {} })

      params.decimals = decimals

      const symbolBuf = await arc200.arc200Symbol({ args: {} })
      if (symbolBuf) {
        let end = nameBuf.length
        while (end > 0 && nameBuf[end - 1] === 0x00) end--
        const trimmed = nameBuf.slice(0, end)

        const symbol = await Buffer.from(trimmed).toString('utf-8').trim()
        if (symbol) {
          params.unitName = symbol
          params.unitNameB64 = new Uint8Array(Buffer.from(params.unitName))
        }
      }

      if (!cache[network.genesisId]) cache[network.genesisId] = {}
      cache[network.genesisId][assetStr] = params
    } catch (e) {
      console.error('Could not fetch info about the asset asa ASA nor ARC200', assetBigInt, e)
      const params: IAssetParams = {
        id: assetBigInt,
        type: 'other',
        creator: '',
        decimals: 0,
        total: 0n,
        clawback: undefined,
        defaultFrozen: false,
        freeze: undefined,
        manager: undefined,
        metadataHash: undefined,
        name: Buffer.from(Buffer.from('Unknown', 'ascii')).toString('utf-8'),
        nameB64: new Uint8Array(Buffer.from(Buffer.from('Unknown', 'ascii'))),
        reserve: undefined,
        unitName: Buffer.from(Buffer.from('U', 'ascii')).toString('utf-8'),
        unitNameB64: new Uint8Array(Buffer.from(Buffer.from('U', 'ascii'))),
        url: undefined,
        urlB64: undefined,
        chain: network.genesisId as
          | 'mainnet-v1.0'
          | 'aramidmain-v1.0'
          | 'testnet-v1.0'
          | 'betanet-v1.0'
          | 'voimain-v1.0'
          | 'fnet-v1'
          | 'dockernet-v1',
      }
      return params
    }
  }
  // localStorage.setItem(
  //   `${network.genesisId}-${assetStr}`,
  //   JSON.stringify(cache[network.genesisId][assetStr], (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  // );
  return cache[network.genesisId][assetStr]
}
