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
import { MatchAnalysisOverlayMode } from './MatchAnalysisOverlayMode'

const DETECTION_MODEL_URL = '/models/soccana_detection_v1_web_model/model.json'
const DETECTION_INPUT_SIZE = 640
const DETECTION_SCORE_THRESHOLD = 0.35
const DETECTION_NMS_THRESHOLD = 0.45
const DETECTION_MAX_RESULTS = 30
const DETECTION_INTERVAL_MS = 120
const DETECTION_LABELS = ['Player', 'Ball', 'Referee']
const BBOX_COLOR_PRESETS = {
  green: {
    label: '그린',
    stroke: '#66d99d',
    fill: 'rgba(127, 227, 167, 0.1)',
    text: '#d7ffe9',
    textStroke: 'rgba(5, 6, 7, 0.9)',
  },
  red: {
    label: '레드',
    stroke: '#ff7b7b',
    fill: 'rgba(255, 123, 123, 0.12)',
    text: '#ffe3e3',
    textStroke: 'rgba(45, 8, 8, 0.9)',
  },
  blue: {
    label: '블루',
    stroke: '#6eb7ff',
    fill: 'rgba(110, 183, 255, 0.12)',
    text: '#e6f3ff',
    textStroke: 'rgba(8, 23, 45, 0.9)',
  },
  yellow: {
    label: '옐로우',
    stroke: '#ffd76a',
    fill: 'rgba(255, 215, 106, 0.12)',
    text: '#fff9df',
    textStroke: 'rgba(48, 37, 6, 0.9)',
  },
}

function getIoU(boxA, boxB) {
  const xLeft = Math.max(boxA.x1, boxB.x1)
  const yTop = Math.max(boxA.y1, boxB.y1)
  const xRight = Math.min(boxA.x2, boxB.x2)
  const yBottom = Math.min(boxA.y2, boxB.y2)

  const intersectionWidth = Math.max(0, xRight - xLeft)
  const intersectionHeight = Math.max(0, yBottom - yTop)
  const intersection = intersectionWidth * intersectionHeight
  if (intersection <= 0) return 0

  const areaA = Math.max(0, boxA.x2 - boxA.x1) * Math.max(0, boxA.y2 - boxA.y1)
  const areaB = Math.max(0, boxB.x2 - boxB.x1) * Math.max(0, boxB.y2 - boxB.y1)
  const union = areaA + areaB - intersection
  if (union <= 0) return 0

  return intersection / union
}

function runNms(boxes, iouThreshold) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score)
  const selected = []

  while (sorted.length > 0) {
    const current = sorted.shift()
    if (!current) break
    selected.push(current)

    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      if (sorted[index].classId !== current.classId) continue
      const iou = getIoU(current, sorted[index])
      if (iou > iouThreshold) {
        sorted.splice(index, 1)
      }
    }
  }

  return selected
}

function decodeDetectionOutput(outputTensor) {
  const shape = outputTensor?.shape ?? []
  if (shape.length !== 3 || shape[0] !== 1) return []

  const channels = shape[1]
  const numPredictions = shape[2]
  if (channels < 5 || numPredictions < 1) return []

  const data = outputTensor.dataSync()
  const boxes = []

  for (let index = 0; index < numPredictions; index += 1) {
    const rawCx = data[index]
    const rawCy = data[numPredictions + index]
    const rawWidth = data[numPredictions * 2 + index]
    const rawHeight = data[numPredictions * 3 + index]

    const coordScale = Math.max(Math.abs(rawCx), Math.abs(rawCy), Math.abs(rawWidth), Math.abs(rawHeight)) <= 2
      ? DETECTION_INPUT_SIZE
      : 1

    const cx = rawCx * coordScale
    const cy = rawCy * coordScale
    const width = rawWidth * coordScale
    const height = rawHeight * coordScale

    let bestScore = 0
    let classId = -1

    for (let classIndex = 4; classIndex < channels; classIndex += 1) {
      const classScore = data[numPredictions * classIndex + index]
      if (classScore > bestScore) {
        bestScore = classScore
        classId = classIndex - 4
      }
    }

    if (bestScore < DETECTION_SCORE_THRESHOLD || classId < 0) continue

    boxes.push({
      x1: cx - width / 2,
      y1: cy - height / 2,
      x2: cx + width / 2,
      y2: cy + height / 2,
      score: bestScore,
      classId,
      label: DETECTION_LABELS[classId] ?? `Class ${classId}`,
    })
  }

  return runNms(boxes, DETECTION_NMS_THRESHOLD).slice(0, DETECTION_MAX_RESULTS)
}

function mapDetectionBoxToVideo(box, metrics) {
  const displayWidth = metrics.width
  const displayHeight = metrics.height
  if (!(displayWidth > 0 && displayHeight > 0)) return null

  const sourceWidth = metrics.videoWidth > 0 ? metrics.videoWidth : displayWidth
  const sourceHeight = metrics.videoHeight > 0 ? metrics.videoHeight : displayHeight

  const modelScaleX = sourceWidth / DETECTION_INPUT_SIZE
  const modelScaleY = sourceHeight / DETECTION_INPUT_SIZE

  const videoX1 = box.x1 * modelScaleX
  const videoY1 = box.y1 * modelScaleY
  const videoX2 = box.x2 * modelScaleX
  const videoY2 = box.y2 * modelScaleY

  const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale
  const offsetX = (displayWidth - renderedWidth) / 2
  const offsetY = (displayHeight - renderedHeight) / 2

  const mappedX = videoX1 * scale + offsetX
  const mappedY = videoY1 * scale + offsetY
  const mappedWidth = Math.max(1, (videoX2 - videoX1) * scale)
  const mappedHeight = Math.max(1, (videoY2 - videoY1) * scale)

  const clippedX = Math.max(0, mappedX)
  const clippedY = Math.max(0, mappedY)
  const clippedWidth = Math.max(1, Math.min(displayWidth - clippedX, mappedWidth))
  const clippedHeight = Math.max(1, Math.min(displayHeight - clippedY, mappedHeight))

  return {
    x: clippedX,
    y: clippedY,
    width: clippedWidth,
    height: clippedHeight,
    label: box.label,
    score: box.score,
    classId: box.classId,
  }
}

function toFiniteNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function getPointFromPayload(point) {
  if (!point || typeof point !== 'object') return null
  const x = toFiniteNumber(point.x)
  const y = toFiniteNumber(point.y)
  if (x == null || y == null) return null
  return { x, y }
}

function extractArrowGuide(feedback) {
  if (!feedback || typeof feedback !== 'object') return null

  const playGuide = feedback.playGuide ?? feedback.play_guide ?? null
  const normalizedCandidates = [
    {
      startX: toFiniteNumber(playGuide?.start_x),
      startY: toFiniteNumber(playGuide?.start_y),
      endX: toFiniteNumber(playGuide?.end_x),
      endY: toFiniteNumber(playGuide?.end_y),
    },
    {
      startX: toFiniteNumber(feedback.start_x),
      startY: toFiniteNumber(feedback.start_y),
      endX: toFiniteNumber(feedback.end_x),
      endY: toFiniteNumber(feedback.end_y),
    },
  ]

  const normalized = normalizedCandidates.find((candidate) => (
    candidate.startX != null
    && candidate.startY != null
    && candidate.endX != null
    && candidate.endY != null
  ))

  if (normalized) {
    return {
      type: 'normalized',
      startX: normalized.startX,
      startY: normalized.startY,
      endX: normalized.endX,
      endY: normalized.endY,
      message: playGuide?.message ?? '',
    }
  }

  const startPixel = getPointFromPayload(
    feedback.start_pixel
    ?? feedback.startPixel
    ?? playGuide?.start_pixel
    ?? playGuide?.startPixel,
  )
  const endPixel = getPointFromPayload(
    feedback.end_pixel
    ?? feedback.endPixel
    ?? playGuide?.end_pixel
    ?? playGuide?.endPixel,
  )

  if (startPixel && endPixel) {
    return {
      type: 'pixel',
      startX: startPixel.x,
      startY: startPixel.y,
      endX: endPixel.x,
      endY: endPixel.y,
      frameWidth: toFiniteNumber(
        feedback.frame_width
        ?? feedback.frameWidth
        ?? feedback.image_width
        ?? feedback.imageWidth
        ?? playGuide?.frame_width
        ?? playGuide?.frameWidth
        ?? playGuide?.image_width
        ?? playGuide?.imageWidth,
      ),
      frameHeight: toFiniteNumber(
        feedback.frame_height
        ?? feedback.frameHeight
        ?? feedback.image_height
        ?? feedback.imageHeight
        ?? playGuide?.frame_height
        ?? playGuide?.frameHeight
        ?? playGuide?.image_height
        ?? playGuide?.imageHeight,
      ),
      message: playGuide?.message ?? '',
    }
  }

  return null
}

function mapArrowGuideToVideo(guide, metrics) {
  if (!guide) return null

  const displayWidth = metrics.width
  const displayHeight = metrics.height
  if (!(displayWidth > 0 && displayHeight > 0)) return null

  const fallbackSourceWidth = metrics.videoWidth > 0 ? metrics.videoWidth : displayWidth
  const fallbackSourceHeight = metrics.videoHeight > 0 ? metrics.videoHeight : displayHeight

  let sourceWidth = fallbackSourceWidth
  let sourceHeight = fallbackSourceHeight

  if (guide.type === 'pixel' && guide.frameWidth > 0 && guide.frameHeight > 0) {
    sourceWidth = guide.frameWidth
    sourceHeight = guide.frameHeight
  }

  if (!(sourceWidth > 0 && sourceHeight > 0)) return null

  let startX = guide.startX
  let startY = guide.startY
  let endX = guide.endX
  let endY = guide.endY

  if (guide.type === 'normalized') {
    const maxValue = Math.max(Math.abs(startX), Math.abs(startY), Math.abs(endX), Math.abs(endY))
    const ratioBase = maxValue <= 1 ? 1 : 100
    startX = (startX / ratioBase) * sourceWidth
    startY = (startY / ratioBase) * sourceHeight
    endX = (endX / ratioBase) * sourceWidth
    endY = (endY / ratioBase) * sourceHeight
  }

  const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale
  const offsetX = (displayWidth - renderedWidth) / 2
  const offsetY = (displayHeight - renderedHeight) / 2

  return {
    startX: startX * scale + offsetX,
    startY: startY * scale + offsetY,
    endX: endX * scale + offsetX,
    endY: endY * scale + offsetY,
    message: guide.message,
  }
}

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
  const [bboxEnabled, setBboxEnabled] = React.useState(false)
  const [bboxColorKey, setBboxColorKey] = React.useState('green')
  const [bboxMenuOpen, setBboxMenuOpen] = React.useState(false)
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
  const [isRtl, setIsRtl] = React.useState(false)
  const [aiStatus, setAiStatus] = React.useState('대기 중')
  const [lastFeedbackId, setLastFeedbackId] = React.useState(null)
  const [resolvedVideoUrl, setResolvedVideoUrl] = React.useState(null)
  const [videoLoadFailed, setVideoLoadFailed] = React.useState(false)
  const [arrowGuide, setArrowGuide] = React.useState(null)
  const [videoPaused, setVideoPaused] = React.useState(false)
  const [showArrowOnPause, setShowArrowOnPause] = React.useState(false)
  const [detectionStatus, setDetectionStatus] = React.useState('모델 로딩 중')
  const [detectionResults, setDetectionResults] = React.useState([])
  const [videoMetrics, setVideoMetrics] = React.useState({
    width: 0,
    height: 0,
    videoWidth: 0,
    videoHeight: 0,
  })
  const [coachContent, setCoachContent] = React.useState({
    situation: 'AI 분석 요청 전입니다. 요청 후 현재 상황 분석이 표시됩니다.',
    movement: 'AI 분석 요청 전입니다. 요청 후 추천 플레이가 표시됩니다.',
  })
  const [errorModal, setErrorModal] = React.useState(null)
  const [overlayMode, setOverlayMode] = React.useState(false)

  const videoRef = React.useRef(null)
  const tfRef = React.useRef(null)
  const detectionModelRef = React.useRef(null)
  const detectionLoopRef = React.useRef(null)
  const detectionCanvasRef = React.useRef(null)
  const lastDetectionAtRef = React.useRef(0)

  const syncVideoMetrics = React.useCallback(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const nextMetrics = {
      width: videoElement.clientWidth,
      height: videoElement.clientHeight,
      videoWidth: Number(videoElement.videoWidth) || 0,
      videoHeight: Number(videoElement.videoHeight) || 0,
    }

    setVideoMetrics((prev) => {
      if (
        prev.width === nextMetrics.width
        && prev.height === nextMetrics.height
        && prev.videoWidth === nextMetrics.videoWidth
        && prev.videoHeight === nextMetrics.videoHeight
      ) {
        return prev
      }
      return nextMetrics
    })
  }, [])

  React.useEffect(() => {
    let isMounted = true

    const loadDetectionModel = async () => {
      setDetectionStatus('모델 로딩 중')
      try {
        const tf = await import('@tensorflow/tfjs')
        await tf.ready()
        const model = await tf.loadGraphModel(DETECTION_MODEL_URL)

        if (!isMounted) {
          model.dispose()
          return
        }

        tfRef.current = tf
        detectionModelRef.current = model
        setDetectionStatus('실시간 감지 준비')
      } catch {
        if (!isMounted) return
        setDetectionStatus('감지 모델 로드 실패')
      }
    }

    loadDetectionModel()

    return () => {
      isMounted = false
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current)
        detectionLoopRef.current = null
      }
      if (detectionModelRef.current) {
        detectionModelRef.current.dispose()
        detectionModelRef.current = null
      }
    }
  }, [])

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

    setVideoLoadFailed(false)
    setResolvedVideoUrl(null)
    setArrowGuide(null)
    setShowArrowOnPause(false)
    setVideoPaused(false)
    setDetectionResults([])

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
      setResolvedVideoUrl(url)
    }).catch(() => {
      if (!isMounted) return
      setVideoLoadFailed(true)
    })

    return () => {
      isMounted = false
    }
  }, [currentMatch?.id])

  React.useEffect(() => {
    const videoElement = videoRef.current
    const tf = tfRef.current
    const model = detectionModelRef.current
    const readyForDetection = Boolean(resolvedVideoUrl) && !videoLoadFailed

    if (!videoElement || !tf || !model || !readyForDetection || videoPaused || !bboxEnabled) {
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current)
        detectionLoopRef.current = null
      }
      if (!bboxEnabled) {
        setDetectionResults([])
        setDetectionStatus('실시간 감지 준비')
      }
      return undefined
    }

    const runDetectionLoop = () => {
      detectionLoopRef.current = requestAnimationFrame(runDetectionLoop)

      const now = performance.now()
      if (now - lastDetectionAtRef.current < DETECTION_INTERVAL_MS) return
      lastDetectionAtRef.current = now

      if (videoElement.readyState < 2 || videoElement.paused || videoElement.ended) return

      const canvas = detectionCanvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d', { willReadFrequently: false })
      if (!ctx) return

      canvas.width = DETECTION_INPUT_SIZE
      canvas.height = DETECTION_INPUT_SIZE
      ctx.drawImage(videoElement, 0, 0, DETECTION_INPUT_SIZE, DETECTION_INPUT_SIZE)

      const boxes = tf.tidy(() => {
        const imageTensor = tf.browser.fromPixels(canvas)
        const inputTensor = imageTensor.expandDims(0).toFloat().div(255)
        const output = model.predict(inputTensor)
        const outputTensor = Array.isArray(output) ? output[0] : output
        return decodeDetectionOutput(outputTensor)
          .filter((box) => box.classId === 0 || box.classId === 1)
      })

      setDetectionResults(boxes)
      setDetectionStatus('실시간 감지 On')
    }

    runDetectionLoop()

    return () => {
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current)
        detectionLoopRef.current = null
      }
    }
  }, [resolvedVideoUrl, videoLoadFailed, videoPaused, bboxEnabled])

  React.useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return undefined

    const handleMetricsSync = () => {
      syncVideoMetrics()
    }

    handleMetricsSync()

    videoElement.addEventListener('loadedmetadata', handleMetricsSync)
    videoElement.addEventListener('loadeddata', handleMetricsSync)

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(handleMetricsSync)
      : null

    if (observer) {
      observer.observe(videoElement)
    } else {
      window.addEventListener('resize', handleMetricsSync)
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleMetricsSync)
      videoElement.removeEventListener('loadeddata', handleMetricsSync)
      if (observer) {
        observer.disconnect()
      } else {
        window.removeEventListener('resize', handleMetricsSync)
      }
    }
  }, [resolvedVideoUrl, syncVideoMetrics])

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

    if (videoRef.current) {
      videoRef.current.pause()
      setVideoPaused(true)
    }

    setAiStatus('분석 중')
    try {
      const feedback = await requestAiFeedback(currentMatch.id, getCurrentVideoTimeMs(), isRtl)
      setLastFeedbackId(feedback?.feedbackId ?? null)
      const nextArrowGuide = extractArrowGuide(feedback)
      setArrowGuide(nextArrowGuide)
      setShowArrowOnPause(Boolean(nextArrowGuide))
      setCoachContent({
        situation: feedback?.situation ?? '현재 상황 분석 결과가 없습니다.',
        movement: feedback?.movement ?? feedback?.playGuide?.message ?? '추천 플레이 결과가 없습니다.',
      })
      setAiStatus('완료')
    } catch (error) {
      setAiStatus('대기 중')
      setArrowGuide(null)
      setShowArrowOnPause(false)
      setErrorModal(error instanceof Error ? error.message : 'AI 분석 요청 중 오류가 발생했습니다.')
    }
  }, [currentMatch?.id, getCurrentVideoTimeMs, isRtl])

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

  const handleVideoError = React.useCallback(() => setVideoLoadFailed(true), [])
  const handleVideoPause = React.useCallback(() => setVideoPaused(true), [])
  const handleVideoPlay = React.useCallback(() => {
    setVideoPaused(false)
    setShowArrowOnPause(false)
  }, [])
  const handleVideoSeeking = React.useCallback(() => setShowArrowOnPause(false), [])

  const aiStatusClass = aiStatus === '완료'
    ? 'status-pill status-pill--complete'
    : aiStatus === '분석 중'
      ? 'status-pill status-pill--processing'
      : 'status-pill status-pill--warning'

  const hasAiFeedback = aiStatus === '완료'
  const isVideoReady = Boolean(resolvedVideoUrl) && !videoLoadFailed
  const mappedArrowGuide = React.useMemo(
    () => mapArrowGuideToVideo(arrowGuide, videoMetrics),
    [arrowGuide, videoMetrics],
  )
  const renderedArrowGuide = React.useMemo(() => {
    if (!mappedArrowGuide) return null
    const dx = mappedArrowGuide.endX - mappedArrowGuide.startX
    const dy = mappedArrowGuide.endY - mappedArrowGuide.startY
    const distance = Math.hypot(dx, dy)
    if (distance < 1) return mappedArrowGuide

    const trimLength = 6
    const ratio = Math.max(0, (distance - trimLength) / distance)
    return {
      ...mappedArrowGuide,
      endX: mappedArrowGuide.startX + dx * ratio,
      endY: mappedArrowGuide.startY + dy * ratio,
    }
  }, [mappedArrowGuide])
  const shouldShowArrowOverlay = Boolean(renderedArrowGuide) && showArrowOnPause && videoPaused
  const mappedDetections = React.useMemo(
    () => detectionResults
      .map((box) => mapDetectionBoxToVideo(box, videoMetrics))
      .filter(Boolean),
    [detectionResults, videoMetrics],
  )
  const playerCount = React.useMemo(
    () => detectionResults.filter((box) => box.classId === 0).length,
    [detectionResults],
  )
  const ballCount = React.useMemo(
    () => detectionResults.filter((box) => box.classId === 1).length,
    [detectionResults],
  )
  const bboxColorPreset = BBOX_COLOR_PRESETS[bboxColorKey] ?? BBOX_COLOR_PRESETS.green
  const matchInfoText = currentMatch
    ? `${currentMatch.date} · ${currentMatch.teamName || '-'} vs ${currentMatch.opponentName || '-'}`
    : '경기 선택 정보 없음'

  if (overlayMode) {
    return (
      <MatchAnalysisOverlayMode
        aiStatus={aiStatus}
        ballCount={ballCount}
        bboxColorKey={bboxColorKey}
        bboxColorPreset={bboxColorPreset}
        bboxEnabled={bboxEnabled}
        bboxMenuOpen={bboxMenuOpen}
        coachContent={coachContent}
        detectionCanvasRef={detectionCanvasRef}
        editingMemoId={editingMemoId}
        editingMemoText={editingMemoText}
        errorModal={errorModal}
        hasAiFeedback={hasAiFeedback}
        isRtl={isRtl}
        isVideoReady={isVideoReady}
        mappedDetections={mappedDetections}
        matchInfoText={matchInfoText}
        memoInput={memoInput}
        memos={memos}
        onAiRequest={handleAiRequest}
        onAppendFeedbackMemo={handleAppendFeedbackMemo}
        onBack={onBack}
        onDeleteMemo={handleDeleteMemo}
        onEditCancel={handleEditCancel}
        onEditSave={handleEditSave}
        onEditStart={handleEditStart}
        onExitOverlay={() => setOverlayMode(false)}
        onMemoCreate={handleMemoCreate}
        onSelectMemo={handleSelectMemo}
        onVideoError={handleVideoError}
        onVideoPause={handleVideoPause}
        onVideoPlay={handleVideoPlay}
        onVideoSeeking={handleVideoSeeking}
        playerCount={playerCount}
        renderedArrowGuide={renderedArrowGuide}
        resolvedVideoUrl={resolvedVideoUrl}
        selectedMemo={selectedMemo}
        selectedMemoId={selectedMemoId}
        setBboxColorKey={setBboxColorKey}
        setBboxEnabled={setBboxEnabled}
        setBboxMenuOpen={setBboxMenuOpen}
        setEditingMemoText={setEditingMemoText}
        setErrorModal={setErrorModal}
        setIsRtl={setIsRtl}
        setMemoInput={setMemoInput}
        shouldShowArrowOverlay={shouldShowArrowOverlay}
        syncVideoMetrics={syncVideoMetrics}
        videoPaused={videoPaused}
        videoLoadFailed={videoLoadFailed}
        videoMetrics={videoMetrics}
        videoRef={videoRef}
      />
    )
  }

  return (
    <div className="analysis-layout">
      {errorModal ? (
        <div
          className="error-modal-backdrop"
          onClick={() => setErrorModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && setErrorModal(null)}
          role="presentation"
        >
          <div
            className="error-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-modal-title"
          >
            <div className="error-modal__header">
              <span className="status-pill status-pill--error" id="error-modal-title">오류 발생</span>
            </div>
            <p className="error-modal__message">{errorModal}</p>
            <button
              className="button button--primary button--block"
              onClick={() => setErrorModal(null)}
              type="button"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
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
              <video
                controls
                onError={handleVideoError}
                onLoadedData={syncVideoMetrics}
                onLoadedMetadata={syncVideoMetrics}
                onPause={handleVideoPause}
                onPlay={handleVideoPlay}
                onSeeking={handleVideoSeeking}
                ref={videoRef}
                src={resolvedVideoUrl}
              />
            ) : (
              <div className="video-player__fallback" role="status">
                <strong>{videoLoadFailed ? '영상을 불러오는데 실패했습니다.' : '업로드된 영상을 불러오는 중입니다.'}</strong>
                <p>{videoLoadFailed ? '영상 조회 API 응답을 확인한 뒤 다시 시도해주세요.' : '경기 영상 조회 요청을 보내는 중입니다.'}</p>
              </div>
            )}
            {isVideoReady ? (
              <>
                <canvas className="video-player__inference-buffer" ref={detectionCanvasRef} />
                {bboxEnabled ? (
                  <svg className="video-player__detection-overlay" preserveAspectRatio="none" viewBox={`0 0 ${videoMetrics.width || 1} ${videoMetrics.height || 1}`}>
                    {mappedDetections.map((box, index) => (
                      <g key={`${box.classId}-${index}`}>
                        <rect
                          className="video-player__detection-box"
                          height={box.height}
                          style={{
                            fill: bboxColorPreset.fill,
                            stroke: bboxColorPreset.stroke,
                          }}
                          width={box.width}
                          x={box.x}
                          y={box.y}
                        />
                        <text
                          className="video-player__detection-text"
                          style={{
                            fill: bboxColorPreset.text,
                            stroke: bboxColorPreset.textStroke,
                          }}
                          x={box.x + 4}
                          y={Math.max(14, box.y - 4)}
                        >
                          {`${box.label} ${(box.score * 100).toFixed(0)}%`}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : null}
                {shouldShowArrowOverlay ? (
                  <svg className="video-player__overlay" preserveAspectRatio="none" viewBox={`0 0 ${videoMetrics.width || 1} ${videoMetrics.height || 1}`}>
                    <defs>
                      <marker
                        id="video-player-arrow-head"
                        markerHeight="8"
                        markerUnits="userSpaceOnUse"
                        markerWidth="8"
                        orient="auto"
                        refX="8"
                        refY="4"
                      >
                        <path className="video-player__arrow-head" d="M0,0 L8,4 L0,8 z" />
                      </marker>
                    </defs>
                    <line
                      className="video-player__arrow-line"
                      markerEnd="url(#video-player-arrow-head)"
                      x1={renderedArrowGuide.startX}
                      x2={renderedArrowGuide.endX}
                      y1={renderedArrowGuide.startY}
                      y2={renderedArrowGuide.endY}
                    />
                  </svg>
                ) : null}
                <div className="video-player__bbox-control">
                  <button
                    className="video-player__bbox-trigger"
                    onClick={() => setBboxMenuOpen((prev) => !prev)}
                    type="button"
                  >
                    <span>bbox</span>
                    <span
                      aria-hidden="true"
                      className={`video-player__bbox-caret ${bboxMenuOpen ? 'is-open' : ''}`}
                    >
                      ▾
                    </span>
                  </button>
                  {bboxMenuOpen ? (
                    <div className="video-player__bbox-menu" role="menu">
                      <label className="video-player__bbox-label" htmlFor="bbox-toggle-select">상태</label>
                      <select
                        className="video-player__bbox-select"
                        id="bbox-toggle-select"
                        onChange={(event) => setBboxEnabled(event.target.value === 'on')}
                        value={bboxEnabled ? 'on' : 'off'}
                      >
                        <option value="off">비활성화</option>
                        <option value="on">활성화</option>
                      </select>

                      <label className="video-player__bbox-label" htmlFor="bbox-color-select">색상</label>
                      <select
                        className="video-player__bbox-select"
                        disabled={!bboxEnabled}
                        id="bbox-color-select"
                        onChange={(event) => setBboxColorKey(event.target.value)}
                        value={bboxColorKey}
                      >
                        {Object.entries(BBOX_COLOR_PRESETS).map(([key, preset]) => (
                          <option key={key} value={key}>{preset.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                {bboxEnabled ? (
                  <div className="video-player__detection-status">{`인원수 ${playerCount}명 · 공 ${ballCount}개`}</div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="analysis-title-row">
          <button className="button button--ghost button--small" onClick={onBack} type="button">
            ← 뒤로 가기
          </button>
          <h1>경기 분석</h1>
          <button
            className="overlay-mode-btn"
            onClick={() => setOverlayMode(true)}
            type="button"
          >
            ⊞ 오버레이 모드
          </button>
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
          {aiStatus === '분석 중' ? (
            <div className="coach-card__loading-overlay" aria-live="polite">
              <span className="coach-card__loading-spinner" />
              <span className="coach-card__loading-label">AI 분석 중...</span>
            </div>
          ) : null}
          <div className="coach-card__head">
            <span>AI 코치 피드백</span>
            <div className={aiStatusClass}>{aiStatus}</div>
          </div>
          <div className="coach-card__notice">
            <strong>AI 분석 안내</strong>
            <p>AI 분석은 "AI 분석 요청"을 눌러야 시작됩니다. 기본 상태는 미분석입니다.</p>
          </div>
          <div className="coach-card__direction">
            <span className="coach-card__direction-label">공격 방향</span>
            <div className="coach-card__direction-buttons">
              <button
                className={`button button--small ${!isRtl ? 'button--primary' : 'button--ghost'}`}
                onClick={() => setIsRtl(false)}
                type="button"
              >
                → 왼쪽에서 오른쪽
              </button>
              <button
                className={`button button--small ${isRtl ? 'button--primary' : 'button--ghost'}`}
                onClick={() => setIsRtl(true)}
                type="button"
              >
                ← 오른쪽에서 왼쪽
              </button>
            </div>
          </div>
          <button
            className="button button--primary button--block"
            disabled={aiStatus === '분석 중'}
            onClick={handleAiRequest}
            type="button"
          >
            AI 분석 요청
          </button>
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
