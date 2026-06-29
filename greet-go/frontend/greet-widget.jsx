import { useState } from "preact/hooks"

export default function GreetUI() {
  const [name, setName] = useState("World")
  const [result, setResult] = useState(null)

  async function call(method) {
    setResult("Loading...")
    try {
      const res = await window.__pluginRpc(method, { name })
      setResult(res)
    } catch (e) {
      setResult({ error: e.message })
    }
  }

  return (
    <div>
      <input
        type="text"
        value={name}
        onInput={e => setName(e.target.value)}
        placeholder="Enter name..."
      />
      <button onClick={() => call("greet.hello")}>Hello</button>
      <button onClick={() => call("greet.bye")}>Bye</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}
