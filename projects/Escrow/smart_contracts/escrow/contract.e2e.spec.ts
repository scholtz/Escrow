import { Config } from '@algorandfoundation/algokit-utils'
import { registerDebugEventHandlers } from '@algorandfoundation/algokit-utils-debug'
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import { AlgorandTestAutomationContext } from '@algorandfoundation/algokit-utils/types/testing'
import algosdk, {
  Account,
  makeAssetCreateTxnWithSuggestedParamsFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
} from 'algosdk'
import { getBytes, keccak256 } from 'ethers'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { EscrowClient, EscrowFactory } from '../artifacts/escrow/EscrowClient'

import { claimFromEscrow, createEscrow, getBoxNameD, getBoxNameD0, getBoxNameE, rescueEscrow } from '../../src/index'

describe('Escrow contract', () => {
  const localnet = algorandFixture()
  beforeAll(() => {
    Config.configure({
      debug: true,
      // traceAll: true,
    })
    registerDebugEventHandlers()
  })
  beforeEach(localnet.newScope)
  const waitUntilTime = async (time: bigint, client: EscrowClient, context: AlgorandTestAutomationContext) => {
    while ((await client.latestTimestamp({ args: {} })) <= time) {
      // Your code here
      await context.generateAccount({ initialFunds: AlgoAmount.Algo(1) })
    }
  }
  const deploy = async (account: Account) => {
    const factory = localnet.algorand.client.getTypedAppFactory(EscrowFactory, {
      defaultSender: account.addr,
    })

    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
    })
    await appClient.send.optInToToken({
      args: {
        tokenId: 0n,
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 109_300n,
          receiver: appClient.appAddress,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          sender: account.addr,
        }),
      },
    })
    // // fund MBR for smart contract
    // await localnet.context.algod
    //   .sendRawTransaction(
    //     makePaymentTxnWithSuggestedParamsFromObject({
    //       amount: 5_000_000,
    //       receiver: appClient.appAddress,
    //       sender: account.addr,
    //       suggestedParams: await localnet.context.algod.getTransactionParams().do(),
    //     }).signTxn(account.sk),
    //   )
    //   .do()
    console.log(
      'deployer, appid, app address',
      account.addr.toString(),
      appClient.appId,
      appClient.appAddress.toString(),
    )
    return { client: appClient }
  }

  test('deploy contract', async () => {
    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    expect(client.appId).toBeGreaterThan(0)
  })

  test('should allow sender to create escrow', async () => {
    // call fund with correct hashlock and timelock
    // expect balance update and lock state

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = getBytes(keccak256(passwordBytes))
    console.log('passwordHash', passwordHash)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    const sent = await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 5,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })
    expect(sent.txIds.length).toBe(3)

    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    expect(escrow.tokenId).toBe(0n)
    expect(escrow.amount).toBe(1_000_000n)
    expect(escrow.creator).toBe(testAccount.addr.toString())
    expect(escrow.taker).toBe(algosdk.ALGORAND_ZERO_ADDRESS_STRING)
  })

  test('should prevent funding with zero value', async () => {
    // call fund with 0 value and expect revert or error

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)

    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = getBytes(keccak256(passwordBytes))
    console.log('passwordHash', passwordHash)
    await expect(
      client.send.create({
        args: {
          txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
            amount: 0,
            receiver: client.appAddress,
            sender: testAccount.addr,
            suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          }),
          txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
            amount: mbrAmount,
            receiver: client.appAddress,
            sender: testAccount.addr,
            suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          }),
          rescueDelay: 5,
          secretHash: passwordHash,
          taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
        },
        boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
      }),
    ).rejects.toThrowError()
  })

  test('should allow receiver to claim funds with correct secret before expiry - native token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 100,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do()).amount
    const redeem = await client.send.withdraw({
      args: {
        secret: passwordBytes,
        secretHash: passwordHash,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
      staticFee: AlgoAmount.MicroAlgo(2000),
    })
    expect(redeem.txIds.length).toBe(1)
    const myNewBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do()).amount
    expect(myNewBalance - myBalance).toBe(1_000_000n - 2000n + mbrAmount)
  })
  test('should allow receiver to claim funds with correct secret before expiry - ASA token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const tx = await localnet.context.algod
      .sendRawTransaction(
        makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: testAccount.addr,
          assetName: 'ASA',
          decimals: 6,
          total: 1_000_000_000_000_000n,
          unitName: 'ASA',
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(testAccount.sk),
      )
      .do()
    const confiramtion = await algosdk.waitForConfirmation(localnet.context.algod, tx.txid, 4)
    const asaId = BigInt(confiramtion.assetIndex ?? 0)
    expect(asaId).toBeGreaterThan(0n)
    // optin the escrow to this asa
    await client.send.optInToToken({
      args: {
        tokenId: asaId,
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 109_300n,
          receiver: client.appAddress,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          sender: testAccount.addr,
        }),
      },
      boxReferences: [getBoxNameD(asaId)],
      staticFee: AlgoAmount.MicroAlgo(2000),
    })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          assetIndex: asaId,
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 100,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0(), getBoxNameD(asaId)],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)
    const redeem = await client.send.withdraw({
      args: {
        secret: passwordBytes,
        secretHash: passwordHash,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0(), getBoxNameD(asaId)],
      staticFee: AlgoAmount.MicroAlgo(3000),
    })
    expect(redeem.txIds.length).toBe(1)
    const myNewBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(1_000_000n)
  })

  test('should not allow claim with incorrect secret', async () => {
    // fund contract
    // call claim with wrong secret
    // expect error

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const wrongPasswordBytes = new Uint8Array(50)
    crypto.getRandomValues(wrongPasswordBytes)
    const passwordHash = getBytes(keccak256(passwordBytes))
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 5,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })

    await expect(
      client.send.withdraw({
        args: {
          secret: passwordBytes,
          secretHash: wrongPasswordBytes,
        },
        boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
        staticFee: AlgoAmount.MicroAlgo(2000),
      }),
    ).rejects.toThrowError()
  })

  test('should not allow claim after timelock expires', async () => {
    // fund, increase time, try to claim
    // expect revert

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 1,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)

    await waitUntilTime(escrow.rescueTime, client, localnet.context)

    await expect(
      client.send.withdraw({
        args: {
          secret: passwordBytes,
          secretHash: passwordHash,
        },
        boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
        staticFee: AlgoAmount.MicroAlgo(2000),
      }),
    ).rejects.toThrowError()
  })
  test('should allow sender to refund after timelock expires', async () => {
    // fund, increase time past timelock
    // call refund
    // expect sender gets funds back

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 1,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do()).amount

    await waitUntilTime(escrow.rescueTime, client, localnet.context)

    await client.send.cancel({
      args: {
        secretHash: passwordHash,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
      staticFee: AlgoAmount.MicroAlgo(2000),
    })

    const myNewBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do()).amount
    expect(myNewBalance - myBalance).toBe(1_000_000n - 2000n + mbrAmount)
  })

  test('should not allow refund before timelock expires', async () => {
    // fund, call refund immediately
    // expect revert

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const wrongPasswordBytes = new Uint8Array(50)
    crypto.getRandomValues(wrongPasswordBytes)
    const passwordHash = getBytes(keccak256(passwordBytes))
    console.log('passwordHash', passwordHash)
    await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 20,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })

    await expect(
      client.send.cancel({
        args: {
          secretHash: wrongPasswordBytes,
        },
        boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
        staticFee: AlgoAmount.MicroAlgo(2000),
      }),
    ).rejects.toThrowError()
  })

  test('should not allow double claim or refund', async () => {
    // claim, then attempt second claim or refund
    // expect revert

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    expect(mbrAmount).toBe(70_100n)
    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 100,
        secretHash: passwordHash,
        taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do()).amount
    const redeem = await client.send.withdraw({
      args: {
        secret: passwordBytes,
        secretHash: passwordHash,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
      staticFee: AlgoAmount.MicroAlgo(2000),
    })
    expect(redeem.txIds.length).toBe(1)
    const myNewBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do()).amount
    expect(myNewBalance - myBalance).toBe(1_000_000n - 2000n + mbrAmount)
    await expect(
      client.getEscrow({
        args: {
          secretHash: passwordHash,
        },
        boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
        staticFee: AlgoAmount.MicroAlgo(2000),
      }),
    ).rejects.toThrowError()

    await expect(
      client.send.withdraw({
        args: {
          secret: passwordBytes,
          secretHash: passwordHash,
        },
        boxReferences: [getBoxNameE(passwordHash), getBoxNameD0()],
        staticFee: AlgoAmount.MicroAlgo(2000),
      }),
    ).rejects.toThrowError()
  })

  test('when taker is defined, withdrawal works to his address - ASA token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    const takerAccount = await localnet.context.generateAccount({ initialFunds: AlgoAmount.Algo(1) })
    // create token
    const tx = await localnet.context.algod
      .sendRawTransaction(
        makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: testAccount.addr,
          assetName: 'ASA',
          decimals: 6,
          total: 1_000_000_000_000_000n,
          unitName: 'ASA',
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(testAccount.sk),
      )
      .do()
    const confiramtion = await algosdk.waitForConfirmation(localnet.context.algod, tx.txid, 4)
    const asaId = BigInt(confiramtion.assetIndex ?? 0)
    expect(asaId).toBeGreaterThan(0n)

    // taker optin to the token
    const takerOptin = await localnet.context.algod
      .sendRawTransaction(
        makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: takerAccount.addr,
          amount: 0,
          assetIndex: asaId,
          receiver: takerAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(takerAccount.sk),
      )
      .do()
    expect(takerOptin.txid).toBeDefined()

    // optin the escrow to this asa
    await client.send.optInToToken({
      args: {
        tokenId: asaId,
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 109_300n,
          receiver: client.appAddress,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          sender: testAccount.addr,
        }),
      },
      boxReferences: [getBoxNameD(asaId)],
      staticFee: AlgoAmount.MicroAlgo(2000),
    })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          assetIndex: asaId,
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 100,
        secretHash: passwordHash,
        taker: takerAccount.addr.toString(),
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0(), getBoxNameD(asaId)],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)
    const redeem = await client.send.withdraw({
      args: {
        secret: passwordBytes,
        secretHash: passwordHash,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0(), getBoxNameD(asaId)],
      staticFee: AlgoAmount.MicroAlgo(3000),
      sender: takerAccount,
    })
    expect(redeem.txIds.length).toBe(1)
    const myNewBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(0n)
    const takerBalance =
      (await localnet.context.algod.accountInformation(takerAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(takerBalance).toBe(1_000_000n)
  })

  test('when taker is defined, withdrawal can be executed by others but taker receive funds - ASA token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    const takerAccount = await localnet.context.generateAccount({ initialFunds: AlgoAmount.Algo(1) })
    // create token
    const tx = await localnet.context.algod
      .sendRawTransaction(
        makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: testAccount.addr,
          assetName: 'ASA',
          decimals: 6,
          total: 1_000_000_000_000_000n,
          unitName: 'ASA',
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(testAccount.sk),
      )
      .do()
    const confiramtion = await algosdk.waitForConfirmation(localnet.context.algod, tx.txid, 4)
    const asaId = BigInt(confiramtion.assetIndex ?? 0)
    expect(asaId).toBeGreaterThan(0n)

    // taker optin to the token
    const takerOptin = await localnet.context.algod
      .sendRawTransaction(
        makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: takerAccount.addr,
          amount: 0,
          assetIndex: asaId,
          receiver: takerAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(takerAccount.sk),
      )
      .do()
    expect(takerOptin.txid).toBeDefined()

    // optin the escrow to this asa
    await client.send.optInToToken({
      args: {
        tokenId: asaId,
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 109_300n,
          receiver: client.appAddress,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          sender: testAccount.addr,
        }),
      },
      boxReferences: [getBoxNameD(asaId)],
      staticFee: AlgoAmount.MicroAlgo(2000),
    })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)
    const sent = await client.send.create({
      args: {
        txnDeposit: makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 1_000_000,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
          assetIndex: asaId,
        }),
        txnMbrDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: mbrAmount,
          receiver: client.appAddress,
          sender: testAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }),
        rescueDelay: 100,
        secretHash: passwordHash,
        taker: takerAccount.addr.toString(),
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0(), getBoxNameD(asaId)],
    })
    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)
    const redeem = await client.send.withdraw({
      args: {
        secret: passwordBytes,
        secretHash: passwordHash,
      },
      boxReferences: [getBoxNameE(passwordHash), getBoxNameD0(), getBoxNameD(asaId)],
      staticFee: AlgoAmount.MicroAlgo(3000),
      sender: testAccount,
    })
    expect(redeem.txIds.length).toBe(1)
    const myNewBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(0n)
    const takerBalance =
      (await localnet.context.algod.accountInformation(takerAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(takerBalance).toBe(1_000_000n)
  })

  test('test npm methods create, claim - native token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)

    const sent = await createEscrow({
      client: client,
      deposit: 2_000_000n,
      rescueDelay: 100n,
      secretHash: passwordHash,
      sender: testAccount.addr,
      taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      tokenId: 123n,
      tokenType: 'native',
    })

    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    expect(escrow.amount).toBe(2_000_000n)
    expect(escrow.tokenId).toBe(0n)
    expect(escrow.creator).toBe(testAccount.addr.toString())
    expect(Buffer.from(escrow.secretHash).toString('hex')).toBe(Buffer.from(passwordHash).toString('hex'))

    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do())?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)

    const redeem = await claimFromEscrow({
      client: client,
      secret: passwordBytes,
      secretHash: passwordHash,
      sender: testAccount.addr,
      tokenId: 0n,
    })

    expect(redeem.txIds.length).toBe(1)
    const myNewBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do())?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(2_000_000n + mbrAmount - 2000n)
  })

  test('test npm methods create, rescue - native token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)

    const sent = await createEscrow({
      client: client,
      deposit: 2_000_000n,
      rescueDelay: 100n,
      secretHash: passwordHash,
      sender: testAccount.addr,
      taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      tokenId: 0n,
      tokenType: 'native',
    })

    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    expect(escrow.amount).toBe(2_000_000n)
    expect(escrow.tokenId).toBe(0n)
    expect(escrow.creator).toBe(testAccount.addr.toString())
    expect(Buffer.from(escrow.secretHash).toString('hex')).toBe(Buffer.from(passwordHash).toString('hex'))

    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do())?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)

    await waitUntilTime(escrow.rescueTime, client, localnet.context)

    const redeem = await rescueEscrow({
      client: client,
      secretHash: passwordHash,
      sender: testAccount.addr,
      tokenId: 0n,
    })

    expect(redeem.txIds.length).toBe(1)
    const myNewBalance = (await localnet.context.algod.accountInformation(testAccount.addr).do())?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(2_000_000n + mbrAmount - 2000n)
  })

  test('test npm methods create, claim - ASA token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    const takerAccount = await localnet.context.generateAccount({ initialFunds: AlgoAmount.Algo(1) })
    // create token
    const tx = await localnet.context.algod
      .sendRawTransaction(
        makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: testAccount.addr,
          assetName: 'ASA',
          decimals: 6,
          total: 1_000_000_000_000_000n,
          unitName: 'ASA',
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(testAccount.sk),
      )
      .do()
    const confiramtion = await algosdk.waitForConfirmation(localnet.context.algod, tx.txid, 4)
    const asaId = BigInt(confiramtion.assetIndex ?? 0)
    expect(asaId).toBeGreaterThan(0n)

    // taker optin to the token
    const takerOptin = await localnet.context.algod
      .sendRawTransaction(
        makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: takerAccount.addr,
          amount: 0,
          assetIndex: asaId,
          receiver: takerAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(takerAccount.sk),
      )
      .do()
    expect(takerOptin.txid).toBeDefined()

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)

    const sent = await createEscrow({
      client: client,
      deposit: 2_000_000n,
      rescueDelay: 100n,
      secretHash: passwordHash,
      sender: testAccount.addr,
      taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      tokenId: asaId,
      tokenType: 'asa',
    })

    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    expect(escrow.amount).toBe(2_000_000n)
    expect(escrow.tokenId).toBe(asaId)
    expect(escrow.creator).toBe(testAccount.addr.toString())
    expect(Buffer.from(escrow.secretHash).toString('hex')).toBe(Buffer.from(passwordHash).toString('hex'))

    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)

    const redeem = await claimFromEscrow({
      client: client,
      secret: passwordBytes,
      secretHash: passwordHash,
      sender: testAccount.addr,
      tokenId: asaId,
    })

    expect(redeem.txIds.length).toBe(1)
    const myNewBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(2_000_000n)
  })

  test('test npm methods create, rescue - ASA token', async () => {
    // fund contract
    // call claim with correct secret
    // expect transfer and locked state to be cleared

    const { testAccount } = localnet.context
    const { client } = await deploy(testAccount)
    const mbrAmount = await client.getMbrDepositAmount({ args: {} })
    const takerAccount = await localnet.context.generateAccount({ initialFunds: AlgoAmount.Algo(1) })
    // create token
    const tx = await localnet.context.algod
      .sendRawTransaction(
        makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: testAccount.addr,
          assetName: 'ASA',
          decimals: 6,
          total: 1_000_000_000_000_000n,
          unitName: 'ASA',
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(testAccount.sk),
      )
      .do()
    const confiramtion = await algosdk.waitForConfirmation(localnet.context.algod, tx.txid, 4)
    const asaId = BigInt(confiramtion.assetIndex ?? 0)
    expect(asaId).toBeGreaterThan(0n)

    // taker optin to the token
    const takerOptin = await localnet.context.algod
      .sendRawTransaction(
        makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: takerAccount.addr,
          amount: 0,
          assetIndex: asaId,
          receiver: takerAccount.addr,
          suggestedParams: await localnet.context.algod.getTransactionParams().do(),
        }).signTxn(takerAccount.sk),
      )
      .do()
    expect(takerOptin.txid).toBeDefined()

    const passwordBytes = new Uint8Array(50)
    crypto.getRandomValues(passwordBytes)
    const passwordHash = await client.makeHash({ args: { secret: passwordBytes } })
    console.log('passwordHash', passwordHash)

    const sent = await createEscrow({
      client: client,
      deposit: 2_000_000n,
      rescueDelay: 100n,
      secretHash: passwordHash,
      sender: testAccount.addr,
      taker: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
      tokenId: asaId,
      tokenType: 'asa',
    })

    expect(sent.txIds.length).toBe(3)
    const escrow = await client.getEscrow({ args: { secretHash: passwordHash } })
    console.log('escrow', escrow)
    expect(escrow.amount).toBe(2_000_000n)
    expect(escrow.tokenId).toBe(asaId)
    expect(escrow.creator).toBe(testAccount.addr.toString())
    expect(Buffer.from(escrow.secretHash).toString('hex')).toBe(Buffer.from(passwordHash).toString('hex'))

    const balanceContract = (await localnet.context.algod.accountInformation(client.appAddress).do()).amount
    console.log('balance', client.appAddress.toString(), balanceContract)
    const myBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myBalance).toBeGreaterThan(0n)

    await waitUntilTime(escrow.rescueTime, client, localnet.context)

    const redeem = await rescueEscrow({
      client: client,
      secretHash: passwordHash,
      sender: testAccount.addr,
      tokenId: asaId,
    })

    expect(redeem.txIds.length).toBe(1)
    const myNewBalance =
      (await localnet.context.algod.accountInformation(testAccount.addr).do()).assets?.find((a) => a.assetId == asaId)
        ?.amount ?? 0n
    expect(myNewBalance - myBalance).toBe(2_000_000n)
  })
})
