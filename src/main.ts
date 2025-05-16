import { connectWebSocket } from "./network"
import { setupServer } from "./server"
import { handleTransaction } from "./transactionHandler"
import { walletHealthCheck } from "./walletManager"
import { WS_LIST } from "./config"

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
