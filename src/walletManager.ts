import { ethers } from "ethers"
import { polygon_provider } from "./config"
import { PRIVATE_KEYS_STANDARD, PRIVATE_KEYS_EXPERIMENTAL } from "./config"
import { inject } from "./network"
import logger from "./logger"
import { getAllSeenTransactionHashes, getAllSeenUseropSignatures, trimTransactionHashes, trimUseropSignatures } from "./transactionHandler"

const PRIVATE_KEYS = PRIVATE_KEYS_STANDARD.concat(PRIVATE_KEYS_EXPERIMENTAL)

export const WALLETS = PRIVATE_KEYS.map((key) => new ethers.Wallet(key, polygon_provider))
export const OUR_PUBLIC_ADDRESSES = new Set(WALLETS.map((wallet) => wallet.address.toLowerCase()))

let regular_wallet_idx = 0
let experimental_wallet_idx = 0

export function getWallet(
  useExperimental: boolean,
  maxAttempts = WALLETS.length
): ethers.Wallet | undefined {
  let attempts = 0

  while (attempts < maxAttempts) {
    const idx = useExperimental
      ? (experimental_wallet_idx++ % PRIVATE_KEYS_EXPERIMENTAL.length) + PRIVATE_KEYS_STANDARD.length
      : regular_wallet_idx++ % PRIVATE_KEYS_STANDARD.length

    const wallet = WALLETS[idx]
    console.log('wallet_to_return', wallet.address)
    console.log('valid', VALID[wallet.address])

    const validity = VALID[wallet.address]
    if (validity === undefined) {
      return undefined
    }
    if (validity) {
      return wallet
    }

    attempts++
  }

  throw new Error(`No valid wallet found after ${maxAttempts} attempts`)
}

export function unstick(wallet: ethers.Wallet, curr_nonce: number, pending: number) {
  for (let i = curr_nonce; i < pending; i++) {
    (async () => {
      wallet.sendTransaction({
        nonce: i,
        to: wallet.address,
        value: 0
      }).then((tx) => {
        console.log("Unstuck", tx.hash)
        logger.info(JSON.stringify({
          msg: "unstuck",
          hash: tx.hash
        }))
      })
    })()
  }
}

let last_health_check = new Date("July 20, 69 20:17:40 GMT+00:00")
export let NONCES: Record<string, number> = {}
export let VALID: Record<string, boolean> = {}

export async function walletHealthCheck() {
  if (new Date().getTime() - last_health_check.getTime() < 5000) return
  last_health_check = new Date()
  console.log("Performing wallet health check")
  let new_NONCES: Record<string, number> = {}

  let nonces_promise = PRIVATE_KEYS.map(async (key) => {
    let wallet = new ethers.Wallet(key, polygon_provider)
    return Promise.all([wallet.getNonce(), wallet.getNonce("pending")])
  })

  await Promise.all(nonces_promise).then((values) => {
    for (let i = 0; i < values.length; i++) {
      let curr_nonce = values[i][0]
      let pending = values[i][1]
      if (pending - curr_nonce <= 1) {
        new_NONCES[WALLETS[i].address] = pending
        VALID[WALLETS[i].address] = true
      } else {
        console.log(`Invalidating ${PRIVATE_KEYS[i]} for invalid nonces`)
        VALID[WALLETS[i].address] = false
        unstick(WALLETS[i], curr_nonce, pending)
      }
    }
  }).then(() => {
    console.log("Performing sweep")
    WALLETS.forEach(async (wallet, index) => {
      if (!VALID[wallet.address]) return
      const balance = await polygon_provider.getBalance(wallet.address)
      console.log(balance, wallet.address)
      if (balance > ethers.parseUnits("12", "ether")) {
        let new_tx: Record<any, any> = await wallet.populateTransaction({
          nonce: NONCES[wallet.address],
          value: ethers.parseUnits("8", "ether"),
          to: "<public key>"
        })

        console.log("populate at", new Date().toISOString())

        new_tx.maxFeePerGas *= BigInt(120)
        new_tx.maxPriorityFeePerGas *= BigInt(120)
        new_tx.maxFeePerGas /= BigInt(100)
        new_tx.maxPriorityFeePerGas /= BigInt(100)

        let signed_tx = await wallet.signTransaction(new_tx)
        new_NONCES[wallet.address] += 1
        console.log("signed at", new Date().toISOString())

        inject(signed_tx)

        console.log(`Swept ${wallet.address}`)
      }
    })
  })
  NONCES = new_NONCES
  console.log("Wallet health check complete")

  if (getAllSeenTransactionHashes().size > 10000) {
    trimTransactionHashes()
  }
  if (Object.keys(getAllSeenUseropSignatures()).length > 10000) {
    trimUseropSignatures()
  }
  console.log("size of all_seen_userop_signatures", Object.keys(getAllSeenUseropSignatures()).length)
  console.log("size of all_seen_transaction_hashes", getAllSeenTransactionHashes().size)
}
