import React from 'react'
import {
  addMemo,
  appendAiFeedbackMemo,
  clearHighlightedMemoId,
  deleteMemo,
  getCurrentMatch,
  getHighlightedMemoId,
  getMemosByMatch,
  getPersistentMatchVideoUrl,
  requestAiFeedback,
  updateMemoText,
} from '../lib/appStorage'

function parseTimeLabelToMs(timeText) {
  if (!timeText) return null
  const match = timeText.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (!match) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  const milliseconds = Number((match[3] ?? '0').padEnd(3, '0'))
  if ([minutes, seconds, milliseconds].some((value) => Number.isNaN(value))) return null
  return (minutes * 60 + seconds) * 1000 + milliseconds
}

function getMemoTimeMs(memo) {
  if (!memo) return null
  if (Number.isFinite(memo.timeMs)) return memo.timeMs
  return parseTimeLabelToMs(memo.timeLabel || memo.time)
}

const memoNavigationInitialState = {
  selectedMemoId: null,
}

function memoNavigationReducer(state, action) {
  switch (action.type) {
    case 'select': {
      if (!action.memoId) return state
      return { selectedMemoId: action.memoId }
    }
    case 'remove': {
      const nextSelectedMemoId = state.selectedMemoId === action.memoId
        ? action.fallbackMemoId ?? null
        : state.selectedMemoId
      return { selectedMemoId: nextSelectedMemoId }
    }
    case 'reset':
      return memoNavigationInitialState
    default:
      return state
  }
}

export function MatchAnalysisPage({ onBack }) {
  const [selected, setSelected] = React.useState(false)
  const [currentMatch, setCurrentMatch] = React.useState(null)
  const [memos, setMemos] = React.useState([])
  const [memoNavigation, dispatchMemoNavigation] = React.useReducer(
    memoNavigationReducer,
    memoNavigationInitialState,
  )
  const [memoInput, setMemoInput] = React.useState('')
  const [editingMemoId, setEditingMemoId] = React.useState(null)
  const [editingMemoText, setEditingMemoText] = React.useState('')
  const [seekHistory, setSeekHistory] = React.useState([])
  const [seekHistoryIndex, setSeekHistoryIndex] = React.useState(-1)
  const [aiStatus, setAiStatus] = React.useState('대기 중')
  const [lastFeedbackId, setLastFeedbackId] = React.useState(null)
  const [resolvedVideoUrl, setResolvedVideoUrl] = React.useState(null)
  const [videoLoadFailed, setVideoLoadFailed] = React.useState(false)
  const [coachContent, setCoachContent] = React.useState({
    situation: 'AI 분석 요청 전입니다. 요청 후 현재 상황 분석이 표시됩니다.',
    movement: 'AI 분석 요청 전입니다. 요청 후 추천 플레이가 표시됩니다.',
  })

  const videoRef = React.useRef(null)

  React.useEffect(() => {
    let isMounted = true

    getCurrentMatch().then((match) => {
      if (!isMounted) return
      setCurrentMatch(match)
    }).catch(() => {
      if (!isMounted) return
      setCurrentMatch(null)
    })

    return () => {
      isMounted = false
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true

    if (!currentMatch?.id) {
      setMemos([])
      return () => {
        isMounted = false
      }
    }

    getMemosByMatch(currentMatch.id).then((items) => {
      if (!isMounted) return
      setMemos(items)
    }).catch(() => {
      if (!isMounted) return
      setMemos([])
    })

    return () => {
      isMounted = false
    }
  }, [currentMatch?.id])

  React.useEffect(() => {
    let isMounted = true
    let temporaryUrl = null

    setVideoLoadFailed(false)
    setResolvedVideoUrl(null)

    if (!currentMatch?.id) {
      return () => {
        isMounted = false
      }
    }

    getPersistentMatchVideoUrl(currentMatch.id).then((url) => {
      if (!isMounted) return
      if (!url) {
        setVideoLoadFailed(true)
        return
      }
      temporaryUrl = url
      setResolvedVideoUrl(url)
    }).catch(() => {
      if (!isMounted) return
      setVideoLoadFailed(true)
    })

    return () => {
      isMounted = false
      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl)
      }
    }
  }, [currentMatch?.id])

  const highlightedMemoId = React.useMemo(() => getHighlightedMemoId(), [])
  const selectedMemoId = memoNavigation.selectedMemoId

  React.useEffect(() => {
    if (memos.length === 0) {
      dispatchMemoNavigation({ type: 'reset' })
      return
    }

    if (highlightedMemoId) {
      const highlightedMemo = memos.find((memo) => memo.id === highlightedMemoId)
      if (highlightedMemo) {
        dispatchMemoNavigation({ type: 'select', memoId: highlightedMemo.id })
        clearHighlightedMemoId()
        return
      }
    }

    // Only validate existing selection, don't auto-select first memo
    if (selectedMemoId && memos.some((memo) => memo.id === selectedMemoId)) {
      return
    }
    
    // If no valid selection and no highlight, clear selection
    if (!selectedMemoId) {
      return
    }
  }, [highlightedMemoId, memos, selectedMemoId])

  const selectedMemo = React.useMemo(
    () => memos.find((memo) => memo.id === selectedMemoId) ?? null,
    [memos, selectedMemoId],
  )

  React.useEffect(() => {
    if (!editingMemoId || editingMemoId === selectedMemoId) return
    setEditingMemoId(null)
    setEditingMemoText('')
  }, [editingMemoId, selectedMemoId])

  const getCurrentVideoTimeMs = React.useCallback(() => {
    const currentTime = videoRef.current?.currentTime ?? 0
    return Math.max(0, Math.floor(currentTime * 1000))
  }, [])

  const seekVideoTo = React.useCallback((targetMs) => {
    if (!videoRef.current || !Number.isFinite(targetMs)) return

    const videoElement = videoRef.current
    const applySeek = () => {
      const targetSeconds = targetMs / 1000
      const clampedTime = Number.isFinite(videoElement.duration)
        ? Math.min(targetSeconds, Math.max(0, videoElement.duration - 0.1))
        : targetSeconds
      videoElement.currentTime = Math.max(0, clampedTime)
    }

    if (videoElement.readyState >= 1) {
      applySeek()
      return
    }

    videoElement.addEventListener('loadedmetadata', applySeek, { once: true })
  }, [])

  React.useEffect(() => {
    setSeekHistory([])
    setSeekHistoryIndex(-1)
  }, [currentMatch?.id])

  React.useEffect(() => {
    if (!selectedMemoId || !selectedMemo || !videoRef.current) return

    const targetMs = getMemoTimeMs(selectedMemo)
    if (targetMs == null) return
    seekVideoTo(targetMs)
  }, [seekVideoTo, selectedMemo, selectedMemoId, resolvedVideoUrl])

  const handleMemoCreate = React.useCallback(async () => {
    if (!memoInput.trim() || !currentMatch?.id) return

    try {
      const nextMemo = await addMemo(
        memoInput.trim(),
        '메모',
        currentMatch.id,
        getCurrentVideoTimeMs(),
      )
      setMemos((current) => [nextMemo, ...current])
      dispatchMemoNavigation({ type: 'select', memoId: nextMemo.id })
      setMemoInput('')
    } catch {
      // keep current input on failure
    }
  }, [currentMatch?.id, getCurrentVideoTimeMs, memoInput])

  const handleEditStart = React.useCallback((memo) => {
    dispatchMemoNavigation({ type: 'select', memoId: memo.id })
    setEditingMemoId(memo.id)
    setEditingMemoText(memo.text)
  }, [])

  const handleEditCancel = React.useCallback(() => {
    setEditingMemoId(null)
    setEditingMemoText('')
  }, [])

  const handleEditSave = React.useCallback(async (memoId) => {
    const trimmed = editingMemoText.trim()
    if (!trimmed) return

    try {
      const updatedMemo = await updateMemoText(memoId, trimmed)
      setMemos((current) => current.map((memo) => (
        memo.id === memoId ? updatedMemo : memo
      )))
      setEditingMemoId(null)
      setEditingMemoText('')
    } catch {
      // keep editing state on failure
    }
  }, [editingMemoText])

  const handleDeleteMemo = React.useCallback(async (memoId) => {
    try {
      await deleteMemo(memoId)
      setMemos((current) => current.filter((memo) => memo.id !== memoId))
      const nextVisible = memos.filter((memo) => memo.id !== memoId)
      dispatchMemoNavigation({
        type: 'remove',
        memoId,
        fallbackMemoId: nextVisible[0]?.id ?? null,
      })
      if (editingMemoId === memoId) {
        setEditingMemoId(null)
        setEditingMemoText('')
      }
    } catch {
      // keep current state on failure
    }
  }, [editingMemoId, memos])

  const handleAiRequest = React.useCallback(async () => {
    if (!currentMatch?.id) return

    setAiStatus('분석 중')
    try {
      const feedback = await requestAiFeedback(currentMatch.id, getCurrentVideoTimeMs())
      setLastFeedbackId(feedback?.feedbackId ?? null)
      setCoachContent({
        situation: feedback?.situation ?? '현재 상황 분석 결과가 없습니다.',
        movement: feedback?.movement ?? '추천 플레이 결과가 없습니다.',
      })
      setAiStatus('완료')
    } catch {
      setAiStatus('대기 중')
    }
  }, [currentMatch?.id, getCurrentVideoTimeMs])

  const handleAppendFeedbackMemo = React.useCallback(async () => {
    if (!currentMatch?.id) return

    try {
      if (lastFeedbackId) {
        const nextMemo = await appendAiFeedbackMemo(currentMatch.id, lastFeedbackId, 'AI 피드백')
        setMemos((current) => [nextMemo, ...current])
        dispatchMemoNavigation({ type: 'select', memoId: nextMemo.id })
        return
      }

      const summary = `[AI 피드백] ${coachContent.movement}`
      const nextMemo = await addMemo(summary, 'AI 피드백', currentMatch.id, getCurrentVideoTimeMs())
      setMemos((current) => [nextMemo, ...current])
      dispatchMemoNavigation({ type: 'select', memoId: nextMemo.id })
    } catch {
      // keep state on failure
    }
  }, [coachContent.movement, currentMatch?.id, getCurrentVideoTimeMs, lastFeedbackId])

  const handleSelectMemo = React.useCallback((memo) => {
    const targetMs = getMemoTimeMs(memo)
    
    // Always seek to the memo time if valid
    if (targetMs != null) {
      seekVideoTo(targetMs)
    }
    
    // Track navigation history only if changing memo
    if (videoRef.current && memo.id !== selectedMemoId && targetMs != null) {
      const fromMs = Math.max(0, Math.floor((videoRef.current.currentTime ?? 0) * 1000))
      setSeekHistory((current) => {
        const trimmed = current.slice(0, seekHistoryIndex + 1)
        return [...trimmed, { fromMs, toMs: targetMs, memoId: memo.id }]
      })
      setSeekHistoryIndex((index) => index + 1)
    }

    dispatchMemoNavigation({ type: 'select', memoId: memo.id })
  }, [seekHistoryIndex, selectedMemoId, seekVideoTo])

  const handleHistoryBack = React.useCallback(() => {
    if (seekHistoryIndex < 0) return
    const current = seekHistory[seekHistoryIndex]
    if (!current) return
    dispatchMemoNavigation({ type: 'select', memoId: current.memoId })
    seekVideoTo(current.fromMs)
    setSeekHistoryIndex((index) => index - 1)
  }, [seekHistory, seekHistoryIndex, seekVideoTo])

  const handleHistoryForward = React.useCallback(() => {
    const nextIndex = seekHistoryIndex + 1
    if (nextIndex >= seekHistory.length) return

    const next = seekHistory[nextIndex]
    if (!next) return
    dispatchMemoNavigation({ type: 'select', memoId: next.memoId })
    seekVideoTo(next.toMs)
    setSeekHistoryIndex(nextIndex)
  }, [seekHistory, seekHistoryIndex, seekVideoTo])

  const aiStatusClass = aiStatus === '완료'
    ? 'status-pill status-pill--complete'
    : aiStatus === '분석 중'
      ? 'status-pill status-pill--processing'
      : 'status-pill status-pill--warning'

  const hasAiFeedback = aiStatus === '완료'
  const isVideoReady = Boolean(resolvedVideoUrl) && !videoLoadFailed
  const matchInfoText = currentMatch
    ? `${currentMatch.date} · ${currentMatch.teamName || '-'} vs ${currentMatch.opponentName || '-'}`
    : '경기 선택 정보 없음'

  return (
    <div className="analysis-layout">
      <aside className="analysis-left">
        <button className="button button--ghost button--small" onClick={onBack} type="button">
          ← 뒤로 가기
        </button>
        <div className="memo-panel">
          <span className="sidebar__label">메모 목록</span>
          {memos.map((memo) => (
            <div
              className={`memo-item ${memo.id === selectedMemoId ? 'is-selected' : ''}`}
              key={memo.id}
              onClick={() => handleSelectMemo(memo)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleSelectMemo(memo)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <strong className="memo-item__time">{memo.time}</strong>
              <p>{memo.text}</p>
            </div>
          ))}
        </div>
      </aside>

      <section className="analysis-center">
        <div className="video-section">
          <div className="video-section__title">
            <span>{matchInfoText}</span>
          </div>
          <div className="video-player">
            {isVideoReady ? (
              <video controls onError={() => setVideoLoadFailed(true)} ref={videoRef} src={resolvedVideoUrl} />
            ) : (
              <div className="video-player__fallback" role="status">
                <strong>{videoLoadFailed ? '영상을 불러오는데 실패했습니다.' : '업로드된 영상을 불러오는 중입니다.'}</strong>
                <p>{videoLoadFailed ? '영상 조회 API 응답을 확인한 뒤 다시 시도해주세요.' : '경기 영상 조회 요청을 보내는 중입니다.'}</p>
              </div>
            )}
            {isVideoReady ? (
              <>
                <div className="video-highlight" />
                <div className="video-arrow" />
                <button
                  className="button button--ghost button--small video-player__select"
                  onClick={() => setSelected((prev) => !prev)}
                  type="button"
                >
                  {selected ? '취소하기' : '나 선택하기'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="analysis-title-row">
          <button className="button button--ghost button--small" onClick={onBack} type="button">
            ← 뒤로 가기
          </button>
          <h1>경기 분석</h1>
        </div>

        <article className="selected-note">
          <span>선택된 메모</span>
          <strong>{selectedMemo?.time ?? '-'}</strong>
          {editingMemoId === selectedMemo?.id ? (
            <textarea
              className="selected-note__editor"
              onChange={(event) => setEditingMemoText(event.target.value)}
              value={editingMemoText}
            />
          ) : (
            <p>{selectedMemo?.text ?? '선택된 메모가 없습니다.'}</p>
          )}
          <div className="selected-note__actions">
            {selectedMemo ? (
              editingMemoId === selectedMemo.id ? (
                <>
                  <button className="button button--primary button--tiny" onClick={() => handleEditSave(selectedMemo.id)} type="button">저장</button>
                  <button className="button button--ghost button--tiny" onClick={handleEditCancel} type="button">취소</button>
                </>
              ) : (
                <>
                  <button className="button button--ghost button--tiny" onClick={() => handleEditStart(selectedMemo)} type="button">수정</button>
                  <button className="button button--ghost button--tiny" onClick={() => handleDeleteMemo(selectedMemo.id)} type="button">삭제</button>
                </>
              )
            ) : null}
          </div>
        </article>

        <article className="memo-compose">
          <div className="memo-compose__head">
            <span>메모 추가</span>
            <p>현재 장면에 메모를 남기면 타임라인에 추가됩니다.</p>
          </div>
          <textarea
            className="memo-compose__editor"
            onChange={(event) => setMemoInput(event.target.value)}
            placeholder="여기에 메모를 입력하세요."
            value={memoInput}
          />
          <button className="button button--primary" onClick={handleMemoCreate} type="button">메모 생성</button>
        </article>
      </section>

      <aside className="analysis-right">
        <div className="coach-card">
          <div className="coach-card__head">
            <span>AI 코치 피드백</span>
            <div className={aiStatusClass}>{aiStatus}</div>
          </div>
          <div className="coach-card__notice">
            <strong>AI 분석 안내</strong>
            <p>AI 분석은 "AI 분석 요청"을 눌러야 시작됩니다. 기본 상태는 미분석입니다.</p>
          </div>
          <button className="button button--primary button--block" onClick={handleAiRequest} type="button">AI 분석 요청</button>
          {hasAiFeedback ? (
            <>
              <article className="coach-section">
                <strong>현재 상황</strong>
                <p>{coachContent.situation}</p>
              </article>
              <article className="coach-section">
                <strong>추천 플레이</strong>
                <p>{coachContent.movement}</p>
              </article>
              <button className="button button--primary button--block" onClick={handleAppendFeedbackMemo} type="button">피드백을 메모에 추가</button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
