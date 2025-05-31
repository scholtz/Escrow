import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk, { makePaymentTxnWithSuggestedParamsFromObject, Transaction, TransactionSigner } from 'algosdk'
import { EscrowFactory } from '../smart_contracts/artifacts/escrow/EscrowClient'
const deploy = async () => {
  // console.log('process', process)
  // console.log('process.env', process.env)
  // console.log('process.env.ALGOD_SERVER', process.env.ALGOD_SERVER)
  if (!process.env.ALGOD_SERVER) {
    throw Error('Algod Server is missing. Make sure you configure .env vars')
  }
  if (!process.env.INDEXER_SERVER) {
    throw Error('Algod Server is missing. Make sure you configure .env vars')
  }
  const signers: algosdk.Account[] = []
  if (process.env.DEPLOYER_MNEMONICS_1) {
    signers.push(algosdk.mnemonicToSecretKey(process.env.DEPLOYER_MNEMONICS_1))
  }
  if (process.env.DEPLOYER_MNEMONICS_2) {
    signers.push(algosdk.mnemonicToSecretKey(process.env.DEPLOYER_MNEMONICS_2))
  }
  if (process.env.DEPLOYER_MNEMONICS_3) {
    signers.push(algosdk.mnemonicToSecretKey(process.env.DEPLOYER_MNEMONICS_3))
  }
  if (process.env.DEPLOYER_MNEMONICS_4) {
    signers.push(algosdk.mnemonicToSecretKey(process.env.DEPLOYER_MNEMONICS_4))
  }
  if (process.env.DEPLOYER_MNEMONICS_5) {
    signers.push(algosdk.mnemonicToSecretKey(process.env.DEPLOYER_MNEMONICS_5))
  }
  const threshold = Number(process.env.DEPLOYER_MSIG_THRESHOLD)
  console.log('threshold', threshold)
  const deployerMsigParams: algosdk.MultisigMetadata = {
    addrs: signers.map((a) => a.addr),
    threshold: threshold > 0 ? threshold : 2,
    version: 1,
  }
  console.log('deployerMsigParams', deployerMsigParams)
  const msigAccount = algosdk.multisigAddress(deployerMsigParams)
  console.log('msigAccount', msigAccount)
  const msigAddress = algosdk.encodeAddress(msigAccount.publicKey)
  const senderAddress = process.env.deployerAddr ? process.env.deployerAddr : msigAddress
  console.log('Sender address:', senderAddress)
  console.log('Msig address:', msigAddress)

  const signer: TransactionSigner = async (txnGroup: Transaction[], indexesToSign: number[]) => {
    return txnGroup.map((tx) => {
      let msigObject = algosdk.createMultisigTransaction(tx, deployerMsigParams)
      for (const signer of signers) {
        console.log(`signing ${tx.txID()} from ${signer.addr}`)
        msigObject = algosdk.appendSignMultisigTransaction(msigObject, deployerMsigParams, signer.sk).blob
      }
      // console.log('decoded', algosdk.decodeSignedTransaction(msigObject).msig);
      return msigObject
    })
  }
  const appId = BigInt(process.env.APPID ?? '0')
  if (appId == 0n) {
    const avmClient = AlgorandClient.fromConfig({
      algodConfig: {
        server: process.env.ALGOD_SERVER,
        port: parseInt(process.env.ALGOD_PORT ?? '443'),
        token: process.env.ALGOD_TOKEN ?? '',
      },
      indexerConfig: {
        server: process.env.INDEXER_SERVER,
        port: parseInt(process.env.INDEXER_PORT ?? '443'),
        token: process.env.INDEXER_TOKEN ?? '',
      },
    })
    var factory = new EscrowFactory({
      algorand: avmClient,
      //updatable: true,
      defaultSender: senderAddress,
      defaultSigner: signer,
    })

    console.log(`Deploying app`)
    const { appClient } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
    })

    await appClient.send.optInToToken({
      args: {
        tokenId: 0,
        txnDeposit: makePaymentTxnWithSuggestedParamsFromObject({
          amount: 109_300n,
          receiver: appClient.appAddress,
          sender: senderAddress,
          suggestedParams: await avmClient.client.algod.getTransactionParams().do(),
        }),
      },
    })

    console.log('app deployed and funded with mbr', appClient.appId, appClient.appAddress.toString())
  } else {
    console.log(`Application update not allowed for this app ${appId}`)
    // // update application
    // var client = new EscrowClient({
    //   algorand: AlgorandClient.fromConfig({
    //     algodConfig: {
    //       server: process.env.ALGOD_SERVER,
    //     },
    //     indexerConfig: {
    //       server: process.env.INDEXER_SERVER,
    //     },
    //   }),
    //   appId: appId,
    //   defaultSender: msigAddress,
    //   defaultSigner: signer,
    // })

    // const result = await client.send.update.updateApplication({ args: { newVersion: 'BiatecEscrow#1' } })
  }
  console.log(`DONE`)
}

deploy()
