import WebSocket, { WebSocketServer } from "ws"
import { IncomingMessage } from "http"
import { AUTH_TOKEN, WS_SERVER_PORT } from "./config"

export const connectedClients = new Set<WebSocket>()

export function setupServer(message_hook?: Function) {
  const mempool_wss = new WebSocketServer({ port: WS_SERVER_PORT })

  mempool_wss.on("connection", function connection(ws: any, request: IncomingMessage) {
    console.log(`Incoming connection from ${request.connection.remoteAddress}`)

    const token = request.headers["authorization"]

    if (token !== AUTH_TOKEN) {
      ws.close(1008, "Invalid authentication token")
      return
    }

    console.log("Auth successful, client connected")
    connectedClients.add(ws)

    ws.on("pong", () => {
      ws.isAlive = true
    })

    ws.on("message", function incoming(data: WebSocket.Data) {
      if (message_hook) {
        message_hook(data, request.connection.remoteAddress)
      } else {
        console.log("Received:", data)
      }
    })

    ws.on("close", () => {
      console.log(`Client ${request.connection.remoteAddress} disconnected`)
      connectedClients.delete(ws)
    })

    ws.on("error", (error: any) => {
      console.error("WebSocket error:", error)
      connectedClients.delete(ws)
    })
  })

  console.log(`WebSocket server running on port ${WS_SERVER_PORT}`)
}