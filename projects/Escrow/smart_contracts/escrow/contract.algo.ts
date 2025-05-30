import {
  arc4,
  assert,
  Asset,
  BoxMap,
  bytes,
  Contract,
  Global,
  gtxn,
  itxn,
  op,
  TransactionType,
  Txn,
  uint64,
} from '@algorandfoundation/algorand-typescript'
import { Address, UintN64 } from '@algorandfoundation/algorand-typescript/arc4'

export class EscrowInstance extends arc4.Struct<{
  createdTime: UintN64
  rescueTime: UintN64
  tokenId: UintN64
  amount: UintN64
  account: Address
  secretHash: arc4.StaticBytes<32>
}> {}

export class Escrow extends Contract {
  /**
   * List of all escrows
   */
  public escrows = BoxMap<arc4.StaticBytes<32>, EscrowInstance>({ keyPrefix: 'e' })
  /**
   * All deposits of all escrows. Deployer of the contract can request any staking rewards accured to any of the assets excess of the all deposits
   */
  public allDeposits = BoxMap<UintN64, UintN64>({ keyPrefix: 'd' })

  /**
   * Creates the escrow. The deposit tx funds the escrow and creates HTLC to release the funds with password any time (withdraw method). After the time anyone can call cancel method.
   *
   * @param txnDeposit The deposit of the asset
   * @param rescueDelay The number seconds from the current time after the tx can be canceled
   * @param secretHash Hash of the secret in keccak256
   */
  @arc4.abimethod()
  public create(txnDeposit: gtxn.Transaction, rescueDelay: uint64, secretHash: arc4.StaticBytes<32>): void {
    let tokenId: uint64 = 0
    let amount: uint64 = 0
    let depositIsValid: boolean = false
    assert(this.escrows(secretHash).exists === false, 'Escrow with the same id already exists')
    if (txnDeposit.type === TransactionType.Payment) {
      assert(txnDeposit.receiver === Global.currentApplicationAddress, 'Receiver must be the escrow app')
      assert(txnDeposit.sender === Txn.sender, 'Sender of deposit must be the same as the sender of the app call')
      amount = txnDeposit.amount
      depositIsValid = true
    }
    if (txnDeposit.type === TransactionType.AssetTransfer) {
      assert(txnDeposit.assetReceiver === Global.currentApplicationAddress, 'Receiver must be the escrow app')
      amount = txnDeposit.assetAmount
      tokenId = txnDeposit.xferAsset.id
      depositIsValid = true
    }
    assert(amount > 0, 'Deposit should be positive number')
    assert(depositIsValid, 'Deposit must be asset transfer or payment')

    const tokenIdN = new UintN64(tokenId)
    let prevDeposits: uint64 = 0
    if (this.allDeposits(tokenIdN).exists) {
      prevDeposits = this.allDeposits(tokenIdN).value.native
    }
    this.allDeposits(tokenIdN).value = new UintN64(prevDeposits + amount)

    const escrow = new EscrowInstance({
      account: new Address(Txn.sender),
      createdTime: new UintN64(Global.latestTimestamp),
      rescueTime: new UintN64(Global.latestTimestamp + rescueDelay),
      tokenId: new UintN64(tokenId),
      secretHash: secretHash,
      amount: new UintN64(amount),
    })

    this.escrows(secretHash).value = escrow.copy()
  }
  /**
   * Return hash of the secret. Readonly method using the simulate method is for free.
   *
   * @param secret The secret
   * @returns Hash of the secret
   */
  @arc4.abimethod({ readonly: true })
  public makeHash(secret: arc4.DynamicBytes): bytes {
    return op.keccak256(secret.bytes)
  }

  /**
   * EscrowInstance by secret
   *
   * @param secretHash
   * @returns
   */
  @arc4.abimethod({ readonly: true })
  public getEscrow(secretHash: arc4.StaticBytes<32>): EscrowInstance {
    return this.escrows(secretHash).value
  }

  /**
   * Get current time
   *
   * @returns Time as blockchain sees it
   */
  @arc4.abimethod({ readonly: true })
  public latestTimestamp(): uint64 {
    return Global.latestTimestamp
  }

  /**
   * Withdraw from escrow with known password
   *
   * @param secretHash Hash of the secret in keccak256
   * @param secret Secret
   */
  @arc4.abimethod()
  public withdraw(secretHash: arc4.StaticBytes<32>, secret: arc4.DynamicBytes) {
    assert(this.escrows(secretHash).exists, 'The escrow does not exists')
    assert(op.keccak256(secret.bytes) === secretHash.bytes, 'The password is not correct')

    const escrow = this.escrows(secretHash).value.copy()
    assert(
      Global.latestTimestamp < escrow.rescueTime.native,
      'Escrow can be redeemed with password up to the rescue time',
    )

    this._send(new Address(Txn.sender), escrow.tokenId.native, escrow.amount.native)

    // cleanup box
    this.escrows(secretHash).delete()
  }
  /**
   * After the time has passed, anyone can call this method to return funds to the original sender of the escrow account
   *
   * @param secretHash Hash of the secret in keccak256
   */
  @arc4.abimethod()
  public cancel(secretHash: arc4.StaticBytes<32>) {
    assert(this.escrows(secretHash).exists, 'The escrow does not exists')
    const escrow = this.escrows(secretHash).value.copy()
    assert(escrow.rescueTime.native < Global.latestTimestamp, 'The escrow cannot be canceled yet')

    this._send(escrow.account, escrow.tokenId.native, escrow.amount.native)

    // cleanup box
    this.escrows(secretHash).delete()
  }

  /**
   * Anyone can optin this contract to his ASA if he deposits MBR
   *
   * @param txnDeposit Deposit tx
   * @param assetId Assset id
   */
  @arc4.abimethod()
  public optInToASA(txnDeposit: gtxn.PaymentTxn, assetId: UintN64) {
    assert(
      txnDeposit.receiver === Global.currentApplicationAddress,
      'Receiver of the optin fee must be the current smart contract',
    )
    assert(txnDeposit.amount === 100_000, 'Opt in fee to cover MBR')
    assert(Global.currentApplicationAddress.isOptedIn(Asset(assetId.native)) === false, 'Asset is already opted in')
    itxn
      .assetTransfer({
        xferAsset: assetId.native,
        assetAmount: 0,
        assetReceiver: Global.currentApplicationAddress,
        fee: 0,
      })
      .submit()
  }

  /**
   * Shows the current withdrawable amount for the admin
   *
   * @param assetId Asset
   * @returns Withdrawable amount
   */
  @arc4.abimethod({ readonly: true })
  public adminWithdrawable(assetId: uint64): uint64 {
    const assetIdN = new UintN64(assetId)
    if (assetId === 0) {
      return (
        Global.currentApplicationAddress.balance -
        Global.currentApplicationAddress.minBalance -
        this.allDeposits(assetIdN).value.native
      )
    } else {
      return Asset(assetId).balance(Global.currentApplicationAddress) - this.allDeposits(assetIdN).value.native
    }
  }

  /**
   * Method to exctract excess assets from smart contract address by the admin
   *
   * @param assetId Asset
   * @param isArc200Token True if asset is arc200
   * @returns
   */
  @arc4.abimethod({ readonly: true })
  public adminWithdraw(assetId: uint64): uint64 {
    assert(Txn.sender == Global.creatorAddress, 'Only deployer of this app can withdraw')
    const assetIdN = new UintN64(assetId)
    if (assetId === 0) {
      return (
        Global.currentApplicationAddress.balance -
        Global.currentApplicationAddress.minBalance -
        this.allDeposits(assetIdN).value.native
      )
    } else {
      return Asset(assetId).balance(Global.currentApplicationAddress) - this.allDeposits(assetIdN).value.native
    }
  }

  /**
   * Creator can perfom key registration for this escrow contract, so that he can receive staking rewards
   */
  @arc4.abimethod()
  public sendOnlineKeyRegistration(
    voteKey: bytes,
    selectionKey: bytes,
    stateProofKey: bytes,
    voteFirst: uint64,
    voteLast: uint64,
    voteKeyDilution: uint64,
    fee: uint64,
  ): bytes {
    assert(Global.creatorAddress === Txn.sender, 'Only creator can use this method')
    const itxnResult = itxn
      .keyRegistration({
        selectionKey: selectionKey,
        stateProofKey: stateProofKey,
        voteFirst: voteFirst,
        voteKeyDilution: voteKeyDilution,
        voteLast: voteLast,
        voteKey: voteKey,
        fee: fee,
      })
      .submit()
    return itxnResult.txnId
  }
  /**
   * Internal method to send assets or native token and reduce the tracked deposits
   */
  private _send(receiver: Address, assetId: uint64, amount: uint64): void {
    let prevDeposits: uint64 = 0
    const tokenIdN = new UintN64(assetId)

    if (this.allDeposits(tokenIdN).exists) {
      prevDeposits = this.allDeposits(tokenIdN).value.native
    }
    this.allDeposits(tokenIdN).value = new UintN64(prevDeposits - amount)

    if (assetId === 0) {
      itxn
        .payment({
          amount: amount,
          fee: 0,
          receiver: receiver.bytes,
        })
        .submit()
    } else {
      itxn
        .assetTransfer({
          assetAmount: amount,
          fee: 0,
          assetReceiver: receiver.bytes,
          xferAsset: assetId,
        })
        .submit()
    }
  }
}
