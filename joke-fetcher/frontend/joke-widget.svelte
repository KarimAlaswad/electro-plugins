<svelte:options customElement="joke-widget" />

<script>
  let joke = $state(null)
  let loading = $state(false)
  let error = $state(null)

  async function fetchJoke() {
    loading = true
    error = null 
    joke = null 
    try {
      const res = await window.__pluginRpc("joke.random", {})
      joke = res.data || res 
    } catch (e) {
      error = e.message
    } finally {
      loading = false 
    }
  }

  fetchJoke()
</script>

<div class="container">
  <button onclick={fetchJoke} disabled={loading}>
    {loading ? "Loading..." : "New Joke"}
  </button>

  {#if error}
    <p class="error">{error}</p>
  {:else if joke}
    <div class="joke-text">
      {#each joke.text.split("\n\n") as line}
        <p>{line}</p>
      {/each}
    </div>
    <span class="badge">{joke.category}</span>
  {:else}
    <p class="hint">Click "New Joke" to fetch one!</p>
  {/if}
</div>


<style>
  .container {
    font-family: sans-serif;
    padding: 8px 0;
  }
  button {
    background: #ff3e00;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin-bottom: 12px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .joke-text p {
    margin: 4px 0;
    line-height: 1.5;
  }
  .badge {
    display: inline-block;
    background: #eee;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
    margin-top: 8px;
  }
  .error {
    color: #d32f2f;
  }
  .hint {
    color: #999;
    font-style: italic;
  }
</style>