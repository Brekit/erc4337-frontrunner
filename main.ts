import { connectWebSocket } from "./src/network"
import { setupServer } from "./src/server"
import { handleTransaction } from "./src/transactionHandler"
import { walletHealthCheck } from "./src/walletManager"
import { WS_LIST } from "./src/config"

WS_LIST.forEach((rpc) => {
  connectWebSocket(rpc)
})

setupServer((data: any, remoteAddress: string) => {
  handleTransaction(data, remoteAddress)
})

walletHealthCheck()

setInterval(() => {
  walletHealthCheck()
}, 120000)

process.on("uncaughtException", function (err) {
  console.error(err)
  console.log("Node NOT Exiting...")
})
