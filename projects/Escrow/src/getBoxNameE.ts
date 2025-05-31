import { Buffer } from 'buffer'

export const getBoxNameE = (passwordHash: Uint8Array) => {
  return new Uint8Array(Buffer.from([...Buffer.from('e', 'ascii'), ...passwordHash]))
}
