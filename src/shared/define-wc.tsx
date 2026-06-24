import { createRoot, type Root } from "react-dom/client"
import type { ReactNode } from "react"

export function defineWC(tag: string, Component: () => ReactNode) {
  customElements.define(tag, class extends HTMLElement {
    root: Root | null = null

    connectedCallback() {
      this.root = createRoot(this)
      this.root.render(<Component />)
    }

    disconnectedCallback() {
      this.root?.unmount()
      this.root = null
    }
  })

}