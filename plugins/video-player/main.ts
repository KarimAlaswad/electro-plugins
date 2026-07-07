import { createInterface } from "readline"
const rl = createInterface({ input: process.stdin })
rl.on("line", (line) => {
  const req = JSON.parse(line)
  if (req.method === "load") {
    process.stdout.write(JSON.stringify({ id: req.id, result: "ok" }) + "\n")
  }
})