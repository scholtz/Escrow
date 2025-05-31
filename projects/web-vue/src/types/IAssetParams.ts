export interface IAssetParams {
  /**
   * The asset ID
   */
  id: bigint

  /**
   * The asset Type
   */
  type: 'native' | 'asa' | 'arc200' | 'other'
  /**
   * Chain id
   */
  chain:
    | 'mainnet-v1.0'
    | 'aramidmain-v1.0'
    | 'testnet-v1.0'
    | 'betanet-v1.0'
    | 'voimain-v1.0'
    | 'fnet-v1'
    | 'dockernet-v1'

  /**
   * The address that created this asset. This is the address where the parameters
   * for this asset can be found, and also the address where unwanted asset units can
   * be sent in the worst case.
   */
  creator: string
  /**
   * (dc) The number of digits to use after the decimal point when displaying this
   * asset. If 0, the asset is not divisible. If 1, the base unit of the asset is in
   * tenths. If 2, the base unit of the asset is in hundredths, and so on. This value
   * must be between 0 and 19 (inclusive).
   */
  decimals: number
  /**
   * (t) The total number of units of this asset.
   */
  total: bigint
  /**
   * (c) Address of account used to clawback holdings of this asset. If empty,
   * clawback is not permitted.
   */
  clawback?: string
  /**
   * (df) Whether holdings of this asset are frozen by default.
   */
  defaultFrozen?: boolean
  /**
   * (f) Address of account used to freeze holdings of this asset. If empty, freezing
   * is not permitted.
   */
  freeze?: string
  /**
   * (m) Address of account used to manage the keys of this asset and to destroy it.
   */
  manager?: string
  /**
   * (am) A commitment to some unspecified asset metadata. The format of this
   * metadata is up to the application.
   */
  metadataHash?: Uint8Array
  /**
   * (an) Name of this asset, as supplied by the creator. Included only when the
   * asset name is composed of printable utf-8 characters.
   */
  name?: string
  /**
   * Base64 encoded name of this asset, as supplied by the creator.
   */
  nameB64?: Uint8Array
  /**
   * (r) Address of account holding reserve (non-minted) units of this asset.
   */
  reserve?: string
  /**
   * (un) Name of a unit of this asset, as supplied by the creator. Included only
   * when the name of a unit of this asset is composed of printable utf-8 characters.
   */
  unitName?: string
  /**
   * Base64 encoded name of a unit of this asset, as supplied by the creator.
   */
  unitNameB64?: Uint8Array
  /**
   * (au) URL where more information about the asset can be retrieved. Included only
   * when the URL is composed of printable utf-8 characters.
   */
  url?: string
  /**
   * Base64 encoded URL where more information about the asset can be retrieved.
   */
  urlB64?: Uint8Array
}
