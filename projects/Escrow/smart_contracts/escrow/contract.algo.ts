import { Contract } from '@algorandfoundation/algorand-typescript'

export class Escrow extends Contract {
  public hello(name: string): string {
    return `Hello, ${name}`
  }
}
