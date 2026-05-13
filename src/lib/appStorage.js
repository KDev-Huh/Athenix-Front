const STORAGE_KEYS = {
  session: 'athenix.session',
  currentMatchId: 'athenix.currentMatchId',
  highlightedMemoId: 'athenix.highlightedMemoId',
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '')
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin
  } catch {
    return window.location.origin
  }
})()

let refreshInFlightPromise = null

function safeRead(key, fallback) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function safeWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function buildRequestHeaders({ body, requiresAuth, responseType }) {
  const session = getSession()
  const headers = {}

  if (responseType !== 'blob') {
    headers.Accept = 'application/json'
  }

  if (body instanceof FormData) {
    // browser sets multipart boundary
  } else if (body != null) {
    headers['Content-Type'] = 'application/json'
  }

  if (requiresAuth && session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  return headers
}

async function refreshSession() {
  if (refreshInFlightPromise) {
    return refreshInFlightPromise
  }

  const session = getSession()
  const refreshToken = session?.refreshToken

  if (!refreshToken) {
    return false
  }

  refreshInFlightPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success || !json?.data?.accessToken) {
        clearSession()
        return false
      }

      safeWrite(STORAGE_KEYS.session, {
        ...(session ?? {}),
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken ?? refreshToken,
      })

      return true
    } catch {
      clearSession()
      return false
    }
  })()

  try {
    return await refreshInFlightPromise
  } finally {
    refreshInFlightPromise = null
  }
}

async function request(path, { method = 'GET', body, requiresAuth = false, responseType = 'json' } = {}, retryOnUnauthorized = true) {
  const headers = buildRequestHeaders({ body, requiresAuth, responseType })

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  })

  if ((response.status === 401 || response.status === 403) && requiresAuth && retryOnUnauthorized) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return request(path, { method, body, requiresAuth, responseType }, false)
    }
  }

  if (responseType === 'blob') {
    if (!response.ok) {
      const fallbackMessage = '요청 처리 중 오류가 발생했습니다.'
      throw new Error(fallbackMessage)
    }
    return response.blob()
  }

  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }

  return json.data
}

async function requestMultipartWithProgress(path, formData, { requiresAuth = false, onProgress, retryOnUnauthorized = true } = {}) {
  const session = getSession()

  const execute = () => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')

    if (requiresAuth && session?.accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${session.accessToken}`)
    }

    if (typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const ratio = event.total > 0 ? event.loaded / event.total : 0
        const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)))
        onProgress(percent)
      }
    }

    xhr.onerror = () => {
      reject(new Error('네트워크 오류가 발생했습니다.'))
    }

    xhr.onload = () => {
      const status = xhr.status
      let json = null
      try {
        json = JSON.parse(xhr.responseText || 'null')
      } catch {
        json = null
      }

      if (status >= 200 && status < 300 && json?.success) {
        resolve({ status, data: json.data })
        return
      }

      reject({
        status,
        message: json?.error?.message || '요청 처리 중 오류가 발생했습니다.',
      })
    }

    xhr.send(formData)
  })

  try {
    const result = await execute()
    return result.data
  } catch (error) {
    if (
      retryOnUnauthorized
      && requiresAuth
      && (error?.status === 401 || error?.status === 403)
    ) {
      const refreshed = await refreshSession()
      if (refreshed) {
        return requestMultipartWithProgress(path, formData, {
          requiresAuth,
          onProgress,
          retryOnUnauthorized: false,
        })
      }
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error(error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
}

function normalizeMatch(match) {
  if (!match) return null

  let thumbnailUrl = null
  if (match.thumbnailUrl) {
    const raw = String(match.thumbnailUrl)
    let filename = raw

    try {
      const parsed = raw.startsWith('http://') || raw.startsWith('https://')
        ? new URL(raw)
        : new URL(raw, API_ORIGIN)
      const pathnameParts = parsed.pathname.split('/').filter(Boolean)
      filename = pathnameParts[pathnameParts.length - 1] ?? raw
    } catch {
      const cleaned = raw.split('?')[0]
      const pathnameParts = cleaned.split('/').filter(Boolean)
      filename = pathnameParts[pathnameParts.length - 1] ?? raw
    }

    thumbnailUrl = `${API_ORIGIN}/api/v1/thumbnails/${filename}`
  }

  return {
    id: match.id,
    title: match.title ?? '',
    date: match.date ?? '',
    desc: match.description ?? match.desc ?? '',
    description: match.description ?? match.desc ?? '',
    opponentName: match.opponentName ?? '',
    teamName: match.teamName ?? '',
    position: match.position ?? '',
    jerseyNumber: match.jerseyNumber ?? '',
    thumbnailUrl,
    status: match.status ?? '임시 저장',
    createdAt: match.createdAt ?? null,
    updatedAt: match.updatedAt ?? null,
  }
}

function normalizeMemo(memo) {
  if (!memo) return null
  const formatTimeToSeconds = (value) => {
    const fallback = '00:00'
    if (!value) return fallback

    const parsed = String(value).match(/^(\d{1,2}):(\d{2})/)
    if (!parsed) return fallback

    const minutes = parsed[1].padStart(2, '0')
    const seconds = parsed[2]
    return `${minutes}:${seconds}`
  }

  const rawTimeLabel = memo.timeLabel ?? memo.time ?? '00:00'
  const timeLabel = formatTimeToSeconds(rawTimeLabel)

  return {
    id: memo.id,
    matchId: memo.matchId,
    timeMs: Number.isFinite(memo.timeMs) ? memo.timeMs : 0,
    timeLabel,
    time: formatTimeToSeconds(memo.time ?? timeLabel),
    label: memo.label ?? '메모',
    text: memo.text ?? '',
    createdAt: memo.createdAt ?? null,
    updatedAt: memo.updatedAt ?? null,
  }
}

function toQueryString(query = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '') return
    params.set(key, String(value))
  })
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export function getSession() {
  return safeRead(STORAGE_KEYS.session, null)
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session)
}

export async function loginUser({ email, password }) {
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    })

    const nextSession = {
      ...(data.session ?? {}),
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    }
    safeWrite(STORAGE_KEYS.session, nextSession)
    return { ok: true, session: nextSession }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '로그인에 실패했습니다.' }
  }
}

export async function registerUser({ name, position, email, password }) {
  try {
    await request('/auth/signup', {
      method: 'POST',
      body: {
        name: name.trim(),
        position: position.trim(),
        email: email.trim().toLowerCase(),
        password,
      },
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '회원가입에 실패했습니다.' }
  }
}

export async function logoutUser() {
  const session = getSession()
  const accessToken = session?.accessToken

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
  } catch {
    // ignore and continue clearing local session
  }

  clearSession()
}

export async function getMatches({ status, sort = 'latest', page, size } = {}) {
  const data = await request(`/matches${toQueryString({ status, sort, page, size })}`, {
    requiresAuth: true,
  })
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return items.map(normalizeMatch).filter(Boolean)
}

export async function getRecentMatches(limit = 3) {
  const data = await request(`/matches/recent${toQueryString({ limit })}`, {
    requiresAuth: true,
  })
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return items.map(normalizeMatch).filter(Boolean)
}

export async function getMatchById(matchId) {
  if (matchId == null || matchId === '') return null
  const data = await request(`/matches/${matchId}`, { requiresAuth: true })
  return normalizeMatch(data)
}

export async function addMatch(matchInput, onProgress) {
  const formData = new FormData()
  formData.append('file', matchInput.videoFile)
  formData.append('title', matchInput.title)
  formData.append('date', matchInput.date)
  if (matchInput.description) formData.append('description', matchInput.description)
  if (matchInput.opponentName) formData.append('opponentName', matchInput.opponentName)
  if (matchInput.teamName) formData.append('teamName', matchInput.teamName)
  if (matchInput.position) formData.append('position', matchInput.position)
  if (matchInput.jerseyNumber) formData.append('jerseyNumber', matchInput.jerseyNumber)

  const data = await requestMultipartWithProgress('/matches', formData, {
    requiresAuth: true,
    onProgress,
  })
  return normalizeMatch(data)
}

export async function updateMatchStatus(matchId, status) {
  await request(`/matches/${matchId}/status`, {
    method: 'PATCH',
    body: { status },
    requiresAuth: true,
  })
}

export async function deleteMatch(matchId) {
  await request(`/matches/${matchId}`, {
    method: 'DELETE',
    requiresAuth: true,
  })
  return true
}

export function setCurrentMatchId(matchId) {
  if (matchId == null || matchId === '') {
    localStorage.removeItem(STORAGE_KEYS.currentMatchId)
    return
  }
  localStorage.setItem(STORAGE_KEYS.currentMatchId, String(matchId))
}

export function getCurrentMatchId() {
  const matchId = localStorage.getItem(STORAGE_KEYS.currentMatchId)
  if (!matchId) return null
  return /^\d+$/.test(matchId) ? Number(matchId) : matchId
}

export async function getCurrentMatch() {
  const currentMatchId = getCurrentMatchId()
  if (currentMatchId != null) {
    const current = await getMatchById(currentMatchId)
    if (current) return current
  }

  const matches = await getMatches({ sort: 'latest', page: 1, size: 1 })
  return matches[0] ?? null
}

export async function getMemos({ page, size, sort = 'latest' } = {}) {
  const data = await request(`/memos${toQueryString({ page, size, sort })}`, {
    requiresAuth: true,
  })
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return items.map(normalizeMemo).filter(Boolean)
}

export async function getRecentMemos(limit = 2) {
  const data = await request(`/memos/recent${toQueryString({ limit })}`, {
    requiresAuth: true,
  })
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return items.map(normalizeMemo).filter(Boolean)
}

export async function getMemosByMatch(matchId) {
  if (matchId == null || matchId === '') return []
  const data = await request(`/matches/${matchId}/memos`, {
    requiresAuth: true,
  })
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return items.map(normalizeMemo).filter(Boolean)
}

export async function addMemo(text, label = '메모', matchId = null, timeMs = null) {
  if (matchId == null || matchId === '') {
    throw new Error('메모를 추가할 경기 정보를 찾을 수 없습니다.')
  }

  const data = await request(`/matches/${matchId}/memos`, {
    method: 'POST',
    body: {
      text,
      timeMs: Number.isFinite(timeMs) ? Math.max(0, Math.floor(timeMs)) : 0,
      label,
    },
    requiresAuth: true,
  })

  return normalizeMemo(data)
}

export async function updateMemoText(memoId, nextText) {
  const data = await request(`/memos/${memoId}`, {
    method: 'PATCH',
    body: { text: nextText.trim() },
    requiresAuth: true,
  })

  return normalizeMemo(data)
}

export async function deleteMemo(memoId) {
  await request(`/memos/${memoId}`, {
    method: 'DELETE',
    requiresAuth: true,
  })
  return true
}

export function setHighlightedMemoId(memoId) {
  if (!memoId) {
    localStorage.removeItem(STORAGE_KEYS.highlightedMemoId)
    return
  }
  localStorage.setItem(STORAGE_KEYS.highlightedMemoId, String(memoId))
}

export function getHighlightedMemoId() {
  const memoId = localStorage.getItem(STORAGE_KEYS.highlightedMemoId)
  if (!memoId) return null
  return /^\d+$/.test(memoId) ? Number(memoId) : memoId
}

export function clearHighlightedMemoId() {
  localStorage.removeItem(STORAGE_KEYS.highlightedMemoId)
}

export async function requestAiFeedback(matchId, timeMs, isRtl = false, context = '선수 움직임 분석 요청') {
  if (matchId == null || matchId === '') {
    throw new Error('AI 분석을 요청할 경기 정보가 없습니다.')
  }

  return request(`/matches/${matchId}/ai-feedback`, {
    method: 'POST',
    body: {
      timeMs: Number.isFinite(timeMs) ? Math.max(0, Math.floor(timeMs)) : 0,
      isRtl: Boolean(isRtl),
      context,
    },
    requiresAuth: true,
  })
}

export async function appendAiFeedbackMemo(matchId, feedbackId, label = 'AI 피드백') {
  if (matchId == null || matchId === '') {
    throw new Error('AI 피드백 메모 추가를 위한 경기 정보가 없습니다.')
  }

  const data = await request(`/matches/${matchId}/ai-feedback/memo`, {
    method: 'POST',
    body: { feedbackId, label },
    requiresAuth: true,
  })

  return normalizeMemo(data)
}

export async function getTodayTip() {
  return request('/tips/today', { requiresAuth: true })
}

export function getPersistentMatchVideoUrl(matchId) {
  if (matchId == null || matchId === '') return Promise.resolve(null)
  return Promise.resolve(`${API_BASE_URL}/matches/${matchId}/video`)
}

export function getMatchVideoUrl() {
  return null
}

export async function saveMatchVideo() {
  // server upload API already handles storage
}
