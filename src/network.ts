import WebSocket from "ws"
import { WS_LIST, POLYGON_RPCS } from "./config"
import { connectedClients } from "./server"
import { walletHealthCheck } from "./walletManager"

export const WS_LOOKUP: Record<string, WebSocket> = {}

export function connectWebSocket(rpc: string, open_hook?: Function, message_hook?: Function, params?: Array<any>) {
  let ws = new WebSocket(rpc, params)

  ws.on("open", function open() {
    console.log(`${rpc} - WebSocket opened`)
    if (open_hook) open_hook(ws)
    heartbeat(ws, rpc)
  })

  ws.on("ping", () => heartbeat(ws, rpc))
  ws.on("pong", () => {
    console.log(`${rpc} - Received pong`)
    heartbeat(ws, rpc)
  })

  ws.on("message", function incoming(data: WebSocket.Data) {
    if (message_hook) {
      message_hook(data)
    } else {
      data = JSON.parse(data.toString())
      console.log(rpc, new Date().toISOString(), data)
    }
    heartbeat(ws, rpc)
  })

  ws.on("error", function error(err: any) {
    console.error("Error:", rpc, err)
  })

  ws.on("close", function close(code: any, reason: string) {
    clearTimeout((ws as any).pingTimeout)
    console.log(rpc, `Connection closed. Code: ${code}. Reason: ${reason}`)
    setTimeout(() => connectWebSocket(rpc, open_hook, message_hook), 500)
  })

  WS_LOOKUP[rpc] = ws
  return ws
}

function heartbeat(ws: WebSocket, rpc: string) {
  clearTimeout((ws as any).pingTimeout)
  clearTimeout((ws as any).pongTimeout)
  ;(ws as any).pingTimeout = setTimeout(() => {
    console.log(`${rpc} - Haven't heard something in 30 seconds. Let's send a ping.`)
    ws.ping()
  }, 30000)
  ;(ws as any).pongTimeout = setTimeout(() => {
    console.log(`${rpc} - No pong received. Terminating connection.`)
    ws.terminate()
  }, 32000)
}

export function inject(tx: string) {
  connectedClients.forEach((client) => {
    client.send(tx)
  })

  const stringify_payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_sendRawTransaction",
    params: [tx]
  })

  WS_LIST.forEach(async (rpc) => {
    WS_LOOKUP[rpc].send(stringify_payload)
  })

  const rpc_payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: stringify_payload
  }

  POLYGON_RPCS.forEach(async (rpc) => {
    fetch(rpc, rpc_payload).then((res) => {
      return res.json()
    }).then((data) => {
      console.log(rpc, new Date().toISOString(), data)
      if (data.error?.message?.includes("nonce too low")) {
        walletHealthCheck()
      }
    }).catch((err) => {
      console.error("Error:", rpc, err)
    })
  })
}