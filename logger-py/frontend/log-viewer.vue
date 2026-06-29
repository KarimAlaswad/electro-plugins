<template>
  <div>
    <button @click="refresh">Refresh</button>
    <p v-if="entries === null">Click Refresh to load logs.</p>
    <ul v-else-if="Array.isArray(entries)">
      <li v-if="entries.length === 0">No log entries yet.</li>
      <li v-for="(e, i) in entries" :key="i">{{ e }}</li>
    </ul>
    <pre v-else>{{ typeof entries === 'string' ? entries : JSON.stringify(entries, null, 2) }}</pre>
  </div>
</template>

<script setup>
import { ref } from "vue"

const entries = ref(null)

async function refresh() {
  entries.value = "Loading..."
  try {
    const res = await window.__pluginRpc("log.list", {})
    entries.value = res.data || res
  } catch (e) {
    entries.value = [{ error: e.message }]
  }
}
</script>