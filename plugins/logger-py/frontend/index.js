import { createApp } from "vue"
import LogViewer from "./log-viewer.vue" 

customElements.define("log-viewer", class extends HTMLElement {
  connectedCallback() {
    createApp(LogViewer).mount(this)
  }
})