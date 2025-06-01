export const getAppIdByChain = (chain: 'testnet-v1.0' | 'voimain-v1.0' | 'mainnet-v1.0' | 'dockernet-v1') => {
  switch (chain) {
    case 'mainnet-v1.0':
      return 3029851365n
    case 'voimain-v1.0':
      return 40109564n
    case 'testnet-v1.0':
      return 740405863n
    case 'dockernet-v1':
      return 5247n
  }
}
