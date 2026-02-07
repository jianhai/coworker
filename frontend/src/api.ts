// API 基础 URL 配置
let apiUrl: string | null = null

// 同步获取 API 基础 URL（使用缓存值，如果没有则返回默认值）
export function getApiUrlSync(): string {
  if (apiUrl) {
    return apiUrl
  }
  // 默认使用当前域名（开发时会被 vite proxy 转发）
  apiUrl = window.location.origin
  return apiUrl
}

// 异步获取 API 基础 URL（从后端配置）
export async function getApiUrl(): Promise<string> {
  if (apiUrl) {
    return apiUrl
  }

  try {
    // 从后端获取配置
    const response = await fetch('/api/config')
    if (response.ok) {
      const config = await response.json()
      const backendUrl = config.backend_url || window.location.origin
      apiUrl = backendUrl
      return backendUrl
    }
  } catch (e) {
    console.warn('Failed to fetch config:', e)
  }

  // 默认使用当前域名
  const defaultUrl = window.location.origin
  apiUrl = defaultUrl
  return defaultUrl
}

// 设置 API URL（用于测试或手动覆盖）
export function setApiUrl(url: string): void {
  apiUrl = url
}

// 获取完整的 API 端点 URL
export async function getEndpoint(endpoint: string): Promise<string> {
  const baseUrl = await getApiUrl()
  return `${baseUrl}${endpoint}`
}

// 同步获取完整端点 URL
export function getEndpointSync(endpoint: string): string {
  const baseUrl = getApiUrlSync()
  return `${baseUrl}${endpoint}`
}
