import { ethers } from "ethers"

export const WS_SERVER_PORT = 9001
export const AUTH_TOKEN = "meow"

export const POLYGON_PROVIDER_RPCS = [
  "https://polygon-mainnet.infura.io/v3/<INFURA_KEY_1>",
  "https://polygon-mainnet.infura.io/v3/<INFURA_KEY_2>",
  "https://polygon-mainnet.infura.io/v3/<INFURA_KEY_3>",
  // 50 more infura endpoints like this...
]

export const polygon_provider = new ethers.FallbackProvider(
  POLYGON_PROVIDER_RPCS.map((url, idx) => {
    let provider = new ethers.JsonRpcProvider(url, undefined, {
      staticNetwork: ethers.Network.from(137)
    })
    provider.on("debug", (info) => {
      console.log("provider", idx, info)
    })
    return provider
  }).map((provider) => ({
    provider,
    stallTimeout: 200
  })), undefined, {
    quorum: 1
  }
)

export const POLYGON_RPCS = [
  "https://polygon-rpc.com",
  "https://polygon-mainnet.rpcfast.com?api_key=<RPCFAST_KEY_1>",
  "https://polygon-mainnet.infura.io/v3/<INFURA_KEY_1>",
  "https://polygon.llamarpc.com",
  "https://rpc-mainnet.matic.quiknode.pro",
  "https://polygon-mainnet.g.alchemy.com/v2/<ALCHEMY_KEY_1>",
  "https://1rpc.io/matic",
  "https://polygon.meowrpc.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon.lava.build",
  "https://polygon.rpc.subquery.network/public",
  "https://polygon-mainnet.core.chainstack.com/<CHAINSTACK_KEY_1>",
  "https://0xrpc.io/pol",
  "https://go.getblock.io/<GETBLOCK_KEY_1>",
  "https://polygon-pokt.nodies.app",
  "https://gateway.tenderly.co/public/polygon",
]

export const WS_LIST = [
  "wss://txs.merkle.io/rpc/<MERKLE_KEY_1>/polygon",
  "wss://mempool.merkle.io/rpc/ws/polygon/<MERKLE_KEY_2>",
  "wss://rpc.merkle.io/137/<MERKLE_KEY_2>",
  "wss://polygon-bor-rpc.publicnode.com",
  "wss://polygon-mainnet.public.blastapi.io",
  "wss://polygon.drpc.org",
]

export { PRIVATE_KEYS_STANDARD, PRIVATE_KEYS_EXPERIMENTAL } from "./private_keys.json"
