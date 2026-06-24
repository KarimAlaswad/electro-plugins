import { createInterface } from "readline" 

const rl = createInterface({ input: process.stdin }) 

function send(id: number | null, result?: any, error?: string) {
  const msg: any = { id }
  if (error) msg.error = error 
  else msg.result = result 
  process.stdout.write(JSON.stringify(msg) + "\n")
}

async function handleRequest(request: any) {
  const method = request.method 
  const params = request.params  || {}
  const reqId = request.id 

  try {
    if (method === "joke.random") {
      const res = await fetch("https://v2.jokeapi.dev/joke/Any?safe-mode")
      const data = await res.json()

      if (data.error) {
        send(reqId, null, data.message || "JokeAPI error")
        return
      }

      let text: string 
      if (data.type === "single") {
        text = data.joke 
      } else {
        text = data.setup + "\n\n" + data.delivery
      }
    
      send(reqId, {
        text,
        category: data.category,
        type: data.type,
      })
    } else {
      send(reqId, null, "Method not found: " + method)
    }
  } catch (e: any) {
    send(reqId, null, e.message)
  }
}

rl.on("line", (line) => {
  line = line.trim()
  if (!line) return
  try {
    handleRequest(JSON.parse(line))
  } catch {
    send(null, null, "Parse Error")
  }
})