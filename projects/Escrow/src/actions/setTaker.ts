import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { Address } from 'algosdk'
import { EscrowClient } from '../../smart_contracts/artifacts/escrow/EscrowClient'
import { getBoxNameD } from '../getBoxNameD'
import { getBoxNameD0 } from '../getBoxNameD0'
import { getBoxNameE } from '../getBoxNameE'

interface InputOptions {
  client: EscrowClient
  secretHash: Uint8Array
  sender: string | Address
  taker: string | Address
  tokenId: bigint
}
export const setTaker = async (input: InputOptions) => {
  const boxes = [getBoxNameD0(), getBoxNameE(input.secretHash)]

  let fee = 2000
  if (input.tokenId > 0) {
    boxes.push(getBoxNameD(input.tokenId))
    fee = 3000
  }

  return await input.client.send.setTaker({
    args: {
      secretHash: input.secretHash,
      taker: input.taker.toString(),
    },
    sender: input.sender,
    boxReferences: boxes,
    staticFee: AlgoAmount.MicroAlgos(fee),
  })
}
