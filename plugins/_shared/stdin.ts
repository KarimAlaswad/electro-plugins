import { createInterface } from "readline"

export type SendFn = (id: number | null, result?: any, error?: string) => void
export type Handler = (req: { id: number | null; method: string; params: any }, send: SendFn) => Promise<void> | void

export const createSend: () => SendFn = () => {
  return (id, result?, error?) => {
    const msg: any = { id }
    if (error) msg.error = error
    else msg.result = result
    process.stdout.write(JSON.stringify(msg) + "\n")
  }
}

export function startStdin(handler: Handler) {
  const send = createSend()
  const rl = createInterface({ input: process.stdin })
  const queue: string[] = []
  let busy = false
  rl.on("line", (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    queue.push(trimmed)
    if (!busy) processNext()
  })
  async function processNext() {
    busy = true
    while (queue.length > 0) {
      try {
        const req = JSON.parse(queue.shift()!)
        await handler(req, send)
      } catch (e: any) {
        send(null, null, e.message || "Parse error")
      }
    }
    busy = false
  }
}
