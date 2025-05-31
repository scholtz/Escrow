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
import { Address, StaticBytes, UintN64 } from '@algorandfoundation/algorand-typescript/arc4'

export class EscrowInstance extends arc4.Struct<{
  createdTime: UintN64
  rescueTime: UintN64
  tokenId: UintN64
  amount: UintN64
  mbrAmount: UintN64
  creator: Address
  taker: Address
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
   * @param txnMBRDeposit The deposit of native token to cover MBR. This deposit is returned to creator on withdrawal or rescue operation
   * @param rescueDelay The number seconds from the current time after the tx can be canceled
   * @param secretHash Hash of the secret in keccak256
   * @param taker Creator of the escrow can set taker address. If taker address is set, with secret the funds can be routed only to this address. If the taker is zero address, anyone who claims with correct password, will receive the assets
   */
  @arc4.abimethod()
  public create(
    txnDeposit: gtxn.Transaction,
    txnMBRDeposit: gtxn.PaymentTxn,
    rescueDelay: uint64,
    secretHash: arc4.StaticBytes<32>,
    taker: Address,
  ): void {
    let tokenId: uint64 = 0
    let amount: uint64 = 0
    let depositIsValid: boolean = false
    const bytes = new StaticBytes<32>()
    assert(!secretHash.native.equals(bytes.native), 'Secret hash cannot be empty')
    const mbrAtStart = Global.currentApplicationAddress.minBalance
    assert(txnMBRDeposit.receiver === Global.currentApplicationAddress, 'MBR deposit must be send to the escrow app')
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

    if (tokenId === 0) {
      const tokenIdN = new UintN64(tokenId)
      let prevDeposits: uint64 = 0
      if (this.allDeposits(tokenIdN).exists) {
        prevDeposits = this.allDeposits(tokenIdN).value.native
      }
      this.allDeposits(tokenIdN).value = new UintN64(prevDeposits + amount + txnMBRDeposit.amount)
    } else {
      const tokenIdN = new UintN64(tokenId)
      let prevDeposits: uint64 = 0
      if (this.allDeposits(tokenIdN).exists) {
        prevDeposits = this.allDeposits(tokenIdN).value.native
      }
      this.allDeposits(tokenIdN).value = new UintN64(prevDeposits + amount)

      const tokenId0 = new UintN64(0)
      let prevDeposits0: uint64 = 0
      if (this.allDeposits(tokenId0).exists) {
        prevDeposits = this.allDeposits(tokenId0).value.native
      }
      this.allDeposits(tokenId0).value = new UintN64(prevDeposits0 + txnMBRDeposit.amount)
    }

    const escrow = new EscrowInstance({
      creator: new Address(Txn.sender),
      taker: taker,
      createdTime: new UintN64(Global.latestTimestamp),
      rescueTime: new UintN64(Global.latestTimestamp + rescueDelay),
      tokenId: new UintN64(tokenId),
      secretHash: secretHash,
      amount: new UintN64(amount),
      mbrAmount: new UintN64(txnMBRDeposit.amount),
    })

    this.escrows(secretHash).value = escrow.copy()

    const mbrAtEnd = Global.currentApplicationAddress.minBalance
    assert(mbrAtEnd - mbrAtStart === txnMBRDeposit.amount, 'MBR increment must equal mbr deposit tx amount')
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
   * Returns the amount to be deposited
   *
   * @param secretHash
   * @returns
   */
  @arc4.abimethod({ readonly: true })
  public getMBRDepositAmount(): uint64 {
    const bytes = new StaticBytes<32>()
    const n = new UintN64(Global.latestTimestamp)
    const address = new Address(Txn.sender)
    const mbrAtStart = Global.currentApplicationAddress.minBalance
    const sampleBox = new EscrowInstance({
      amount: n,
      createdTime: n,
      creator: address,
      mbrAmount: n,
      rescueTime: n,
      secretHash: bytes,
      taker: address,
      tokenId: n,
    })
    this.escrows(bytes).value = sampleBox.copy()
    const mbrAtEnd = Global.currentApplicationAddress.minBalance
    this.escrows(bytes).delete()
    return mbrAtEnd - mbrAtStart
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

    // cleanup box
    this.escrows(secretHash).delete()

    // send payment (this can be after cleanup as the tx is all or nothing on avm)
    let sendTo = escrow.taker
    if (sendTo === new Address()) {
      sendTo = new Address(Txn.sender)
    }
    if (escrow.tokenId.native === 0) {
      if (sendTo === escrow.creator) {
        this._send(sendTo, escrow.tokenId.native, escrow.amount.native + escrow.mbrAmount.native)
      } else {
        this._send(sendTo, escrow.tokenId.native, escrow.amount.native)
        this._send(escrow.creator, 0, escrow.mbrAmount.native)
      }
    } else {
      // asset transfer
      this._send(sendTo, escrow.tokenId.native, escrow.amount.native)
      this._send(escrow.creator, 0, escrow.mbrAmount.native)
    }
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

    // cleanup box
    this.escrows(secretHash).delete()

    // send payment (this can be after cleanup as the tx is all or nothing on avm)
    if (escrow.tokenId.native === 0) {
      this._send(escrow.creator, escrow.tokenId.native, escrow.amount.native + escrow.mbrAmount.native)
    } else {
      // asset transfer
      this._send(escrow.creator, escrow.tokenId.native, escrow.amount.native)
      this._send(escrow.creator, 0, escrow.mbrAmount.native)
    }
  }

  /**
   * Anyone can optin this contract to his ASA if he deposits MBR
   *
   * @param txnDeposit Deposit tx
   * @param assetId Assset id
   */
  @arc4.abimethod()
  public optInToToken(txnDeposit: gtxn.PaymentTxn, tokenId: UintN64) {
    assert(
      txnDeposit.receiver === Global.currentApplicationAddress,
      'Receiver of the optin fee must be the current smart contract',
    )
    if (tokenId.native === 0) {
      // this is bootstrap to fund MBR after deploy
      // assert(
      //   Global.currentApplicationAddress.balance === Global.currentApplicationAddress.minBalance,
      //   'Opt in to 0 is allowed to match MBR',
      // )
    } else {
      assert(txnDeposit.amount === 109_300, 'Opt in fee to cover MBR for asset and box to track all deposits')
      assert(Global.currentApplicationAddress.isOptedIn(Asset(tokenId.native)) === false, 'Asset is already opted in')

      itxn
        .assetTransfer({
          xferAsset: tokenId.native,
          assetAmount: 0,
          assetReceiver: Global.currentApplicationAddress,
          fee: 0,
        })
        .submit()
    }
    assert(!this.allDeposits(tokenId).exists, 'Box with all deposits must not exists when opting in')
    this.allDeposits(tokenId).value = new UintN64(0)
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
    assert(Txn.sender === Global.creatorAddress, 'Only deployer of this app can withdraw')
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
