/**
 * Provider / 模型列表 HTTP API 封装
 */
import type { ModelsResponse, ProvidersResponse } from '@/lib/chat-types'

/** 拉取 Provider 列表*/
export async function fetchProviders(): Promise<ProvidersResponse> {
  const res = await fetch('/api/providers')
  if (!res.ok) throw new Error('加载提供商配置失败')
  return (await res.json()) as ProvidersResponse
}

/** 拉取 OpenAI 模型列表*/
export async function fetchOpenaiModels(): Promise<ModelsResponse> {
  const res = await fetch('/api/providers/openai/models')
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? '加载模型列表失败')
  }
  return (await res.json()) as ModelsResponse
}
