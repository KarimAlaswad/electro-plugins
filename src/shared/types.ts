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

export interface PluginManifest {
  name: string
  version: string 
  description: string 
  author: string 
  command?: string 
  args?: string[] 
  methods?: string[] 
  frontendComponent?: string 
  frontendFile?: string 
  frontendSlot?: string 
}
