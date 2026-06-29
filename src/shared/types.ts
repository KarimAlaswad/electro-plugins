export interface PluginInfo {
  name: string
  alive: boolean
  methods: string[]
}

export interface PluginRequestParams {
  method: string
  params: any
}

export interface PluginRequestResults {
  success: boolean
  data?: any
  error?: string
}

export interface FeedContrib {
  type: string    // e.g. "video", "post", "image"
  method: string  // RPC method to call, e.g. "youtube.feed"
  card?: string   // WC tag, e.g. "yt-video-card" - path derived
}

export interface PluginManifest {
  name: string
  version?: string 
  description?: string 
  author?: string 
  run?: string 
  methods?: string[] 
  ui?: string           // tag name for main-UI WC (only feed plugin)
  feeds?: FeedContrib
}
