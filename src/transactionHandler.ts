import { ethers } from "ethers"
import OLD_entrypointabi from "./entrypointabi.json"
import { polygon_provider } from "./config"
import { getWallet, WALLETS, OUR_PUBLIC_ADDRESSES } from "./walletManager"
import { inject } from "./network"
import logger from "./logger"
import { NONCES } from "./walletManager"

const iface_OLD = new ethers.Interface(OLD_entrypointabi)

let all_seen_transaction_hashes: Set<string> = new Set()
let all_seen_userop_signatures: Record<string, Array<[string, bigint]>> = {}
let our_sent_txs: Record<string, Array<[Record<any, any>, string]>> = {}

export function getAllSeenTransactionHashes(): Set<string> {
  return all_seen_transaction_hashes
}

export function getAllSeenUseropSignatures(): Record<string, Array<[string, bigint]>> {
  return all_seen_userop_signatures
}

export function trimTransactionHashes() {
  all_seen_transaction_hashes = new Set(Array.from(all_seen_transaction_hashes).slice(-100))
}

export function trimUseropSignatures() {
  all_seen_userop_signatures = {}
}

export async function handleTransaction(data: any, remoteAddress: string) {
  data = JSON.parse(data)

  console.log("New data", remoteAddress, data)

  if (data.hash) {
    if (all_seen_transaction_hashes.has(data.hash)) {
      console.log("GOT DUPLICATE FROM SENTRY", remoteAddress)
      return
    }
    all_seen_transaction_hashes.add(data.hash)

    let start_time = new Date()

    console.log("recieved at", new Date().toISOString())

    const tx = data
    console.log(tx)

    let rpc_tx_info = polygon_provider.getTransaction(tx.hash)
    let maxFeePerGas: bigint
    let maxPriorityFeePerGas: bigint

    if (tx.type == "2") {
      maxFeePerGas = BigInt(tx.max_fee_per_gas)
      maxPriorityFeePerGas = BigInt(tx.max_priority_fee_per_gas)
    } else {
      maxFeePerGas = BigInt(tx.gas_price)
      maxPriorityFeePerGas = BigInt(tx.gas_price)
    }

    let decoded = [...iface_OLD.decodeFunctionData("handleOps", tx.input)]

    let userOpMaxFeePerGas = BigInt(decoded[0][0][7])
    let userOpMaxPriorityFeePerGas = BigInt(decoded[0][0][8])

    decoded[0] = decoded[0].filter((userOp: Array<any>) => {
      let signature = userOp[userOp.length - 1]
      if (signature in all_seen_userop_signatures) {
        all_seen_userop_signatures[signature].push([tx.hash, maxPriorityFeePerGas])

        if (signature in our_sent_txs) {
          if (maxPriorityFeePerGas > our_sent_txs[signature][0][0].maxPriorityFeePerGas) {
            console.log("====================")
            console.log(our_sent_txs[signature])
            console.log(tx)
          }
        }

        logger.info(JSON.stringify({
          msg: "signature seen again",
          hashes: all_seen_userop_signatures[signature].map(([hash, fee]) => ({
            hash,
            fee: fee.toString()
          }))
        }))
        if (OUR_PUBLIC_ADDRESSES.has(tx.from.toLowerCase())) {
          console.log("OWN TX SEEN AT", new Date().toISOString())
        }
        return false
      } else {
        all_seen_userop_signatures[signature] = [[tx.hash, maxPriorityFeePerGas]]
        return true
      }
    })

    if (decoded[0].length == 0) {
      return
    }

    let use_experimental = false
    if ((maxPriorityFeePerGas * BigInt(982)) / BigInt(1000) >= userOpMaxPriorityFeePerGas) {
      if ((maxPriorityFeePerGas * BigInt(957)) / BigInt(1000) >= userOpMaxPriorityFeePerGas) {
        console.log(tx.hash, "not profitable enough")
        return
      }
      use_experimental = true
      console.log(tx.hash, "using experimental")
    }

    console.log("performed profitable check", new Date().toISOString())

    let competitiveMaxPriorityFeePerGas = maxPriorityFeePerGas + BigInt("1")
    let competitiveMaxFeePerGas = max(userOpMaxFeePerGas, maxFeePerGas + BigInt("1"))

    let gasLimit = tx.gas_limit

    if (gasLimit < 200000) {
      console.log("Not enough profit to be worth the risk of a failed transaction")
      return
    }

    let signing_wallet = getWallet(use_experimental)
    if (!signing_wallet) {
      console.log("No valid signing wallet available")
      return
    }

    let entrypoint_input = iface_OLD.encodeFunctionData("handleOps", [
      decoded[0],
      signing_wallet.address
    ])

    console.log(await rpc_tx_info)

    if ((await rpc_tx_info)?.blockNumber) {
      console.log("TRANSACTION ALREADY MINED")
      return
    }

    if (WALLETS.length == 0) {
      console.log("ALL ADDRESSES ARE BLOCKED")
      return
    }

    const chainId = 137

    let new_tx = {
      nonce: NONCES[signing_wallet.address]++,
      maxFeePerGas: competitiveMaxFeePerGas,
      maxPriorityFeePerGas: competitiveMaxPriorityFeePerGas,
      value: 0,
      from: signing_wallet.address,
      to: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      data: entrypoint_input,
      chainId,
      type: 2,
      gasLimit
    }

    console.log("new_tx", new_tx)

    let signed_tx = await signing_wallet.signTransaction(new_tx)
    console.log("signed at", new Date().toISOString())

    inject(signed_tx)

    let tx_hash = ethers.keccak256(signed_tx)

    for (let i = 0; i < decoded[0].length; i++) {
      let signature = decoded[0][i].at(-1)
      if (!(signature in our_sent_txs)) {
        our_sent_txs[signature] = []
      }
      our_sent_txs[signature].push([new_tx, tx_hash])
    }

    let end_time = new Date()

    console.log("total time", end_time.getTime() - start_time.getTime())

    all_seen_transaction_hashes.add(ethers.keccak256(signed_tx))

    logger.info(JSON.stringify({
      "timestamp": new Date().toISOString(),
      "from": tx.from,
      "nonce": tx.nonce,
      "frontrunning": tx.hash,
      "new_tx": ethers.keccak256(signed_tx),
      "time": end_time.getTime() - start_time.getTime(),
      "experimental": use_experimental
    }))
  } else {
    // console.log(data)
  }
}

const max = (a: bigint, b: bigint) => a > b ? a : b