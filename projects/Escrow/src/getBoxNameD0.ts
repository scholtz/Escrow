import algosdk from 'algosdk'
import { Buffer } from 'buffer'

export const getBoxNameD0 = () => {
  return new Uint8Array(Buffer.from([...Buffer.from('d', 'ascii'), ...algosdk.encodeUint64(0)]))
}
