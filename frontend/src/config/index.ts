// API 配置 - 从后端 /api/config 获取
export interface Config {
  backend: {
    url: string
  }
  ai: {
    api_key: string
    api_url: string
  }
}

let configCache: Config | null = null

// 获取后端 API 基础 URL
export async function getBackendUrl(): Promise<string> {
  if (configCache?.backend?.url) {
    return configCache.backend.url
  }

  try {
    // 首先尝试从当前域名获取（前后端同域）
    const response = await fetch(window.location.origin + '/api/config')
    if (response.ok) {
      const config = await response.json()
      configCache = config
      return config.backend.url
    }
  } catch (e) {
    console.warn('Failed to fetch config from origin:', e)
  }

  // 默认返回当前域名
  return window.location.origin
}

// 获取完整的 API URL（带路径）
export async function getApiUrl(): Promise<string> {
  const baseUrl = await getBackendUrl()
  return baseUrl
}

// 初始化配置
export async function initConfig(): Promise<void> {
  await getBackendUrl()
}
