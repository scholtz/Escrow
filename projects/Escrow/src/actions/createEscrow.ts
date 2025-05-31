import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import {
  Address,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
} from 'algosdk'
import { EscrowClient } from '../../smart_contracts/artifacts/escrow/EscrowClient'
import { getBoxNameD } from '../getBoxNameD'
import { getBoxNameD0 } from '../getBoxNameD0'
import { getBoxNameE } from '../getBoxNameE'

interface InputOptions {
  client: EscrowClient
  rescueDelay: bigint
  secretHash: Uint8Array
  taker: string
  tokenType: 'asa' | 'native'
  tokenId: bigint
  deposit: bigint
  sender: string | Address
  destinationSetter: string | Address
  memo: Uint8Array
}

const concatTo256 = (arrays: Uint8Array[]) => {
  const result = new Uint8Array(256)
  let offset = 0
  for (const arr of arrays) {
    if (offset + arr.length > 256) {
      throw new Error('Total length exceeds 256 bytes')
    }
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

export const createEscrow = async (input: InputOptions) => {
  const params = await input.client.algorand.client.algod.getTransactionParams().do()
  const depositTx =
    input.tokenType == 'native'
      ? makePaymentTxnWithSuggestedParamsFromObject({
          amount: input.deposit,
          receiver: input.client.appAddress,
          sender: input.sender,
          suggestedParams: params,
        })
      : makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: input.deposit,
          assetIndex: input.tokenId,
          receiver: input.client.appAddress,
          sender: input.sender,
          suggestedParams: params,
        })
  const boxes = [getBoxNameD0(), getBoxNameE(input.secretHash)]
  if (input.tokenType == 'asa') boxes.push(getBoxNameD(input.tokenId))
  const mbrAmount = await input.client.getMbrDepositAmount({ args: {}, boxReferences: boxes })
  const mbrDeposit = makePaymentTxnWithSuggestedParamsFromObject({
    amount: mbrAmount,
    receiver: input.client.appAddress,
    sender: input.sender,
    suggestedParams: params,
  })
  if (input.tokenType == 'asa') {
    // check if the contract is already opted in to this asset. if not, opt in first
    const contractInfo = await input.client.algorand.client.algod.accountInformation(input.client.appAddress).do()
    if (!contractInfo.assets?.find((a) => a.assetId == input.tokenId)) {
      // optin the escrow to this asa
      await input.client.send.optInToToken({
        args: {
          tokenId: input.tokenId,
          txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
            amount: 109_300n,
            receiver: input.client.appAddress,
            suggestedParams: params,
            sender: input.sender,
          }),
        },
        boxReferences: boxes,
        staticFee: AlgoAmount.MicroAlgo(2000),
      })
    }
  }
  const memoUint256 = concatTo256([input.memo])
  return await input.client.send.create({
    args: {
      rescueDelay: input.rescueDelay,
      secretHash: input.secretHash,
      taker: input.taker,
      txnDeposit: depositTx,
      txnMbrDeposit: mbrDeposit,
      memo: memoUint256,
      destinationSetter: input.destinationSetter.toString(),
    },
    sender: input.sender,
    boxReferences: boxes,
  })
}
