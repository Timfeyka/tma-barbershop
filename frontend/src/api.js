// API URL — относительный (фронтенд и бэкенд на одном домене в проде)
// В dev-режиме Vite проксирует /api на localhost:8000
const API = '/api'

export async function get(endpoint) {
  const res = await fetch(`${API}${endpoint}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function post(endpoint, data) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function put(endpoint, data) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function del(endpoint) {
  const res = await fetch(`${API}${endpoint}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
