// API URL — относительный (фронтенд и бэкенд на одном домене в проде)
// В dev-режиме Vite проксирует /api на localhost:8000
const API = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    try {
      const err = JSON.parse(body)
      throw new Error(err.detail || err.message || body)
    } catch {
      throw new Error(body || `HTTP ${res.status}`)
    }
  }
  return res.json()
}

export async function get<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint)
}

export async function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
}

export async function put<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
}

export async function del<T = { status: string }>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' })
}
