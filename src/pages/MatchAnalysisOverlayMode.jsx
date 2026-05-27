import React from 'react'


export function MatchAnalysisOverlayMode({
  matchInfoText,
  videoRef,
  detectionCanvasRef,
  resolvedVideoUrl,
  videoLoadFailed,
  syncVideoMetrics,
  onVideoError,
  onVideoPause,
  onVideoPlay,
  onVideoSeeking,
  videoPaused,
  videoMetrics,
  bboxEnabled,
  setBboxEnabled,
  bboxColorKey,
  setBboxColorKey,
  bboxMenuOpen,
  setBboxMenuOpen,
  bboxColorPreset,
  mappedDetections,
  playerCount,
  ballCount,
  memos,
  selectedMemoId,
  selectedMemo,
  editingMemoId,
  editingMemoText,
  memoInput,
  setMemoInput,
  setEditingMemoText,
  onMemoCreate,
  onSelectMemo,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDeleteMemo,
  aiStatus,
  coachContent,
  isRtl,
  setIsRtl,
  hasAiFeedback,
  onAiRequest,
  onAppendFeedbackMemo,
  shouldShowArrowOverlay,
  renderedArrowGuide,
  errorModal,
  setErrorModal,
  onBack,
  onExitOverlay,
}) {
  const [memoOpen, setMemoOpen] = React.useState(false)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [memoOpacity, setMemoOpacity] = React.useState(1)
  const [aiOpacity, setAiOpacity] = React.useState(1)
  const [videoCurrentTime, setVideoCurrentTime] = React.useState(0)
  const [videoDuration, setVideoDuration] = React.useState(0)
  const [videoVolume, setVideoVolume] = React.useState(1)
  const [videoMuted, setVideoMuted] = React.useState(false)
  const [videoFit, setVideoFit] = React.useState('contain')
  const [playFeedback, setPlayFeedback] = React.useState(null)
  const playFeedbackCountRef = React.useRef(0)
  const playFeedbackTimerRef = React.useRef(null)
  const [controlsVisible, setControlsVisible] = React.useState(false)
  const controlsTimerRef = React.useRef(null)

  const handleStageMouseMove = React.useCallback(() => {
    setControlsVisible(true)
    clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  const handleStageMouseLeave = React.useCallback(() => {
    clearTimeout(controlsTimerRef.current)
    setControlsVisible(false)
  }, [])

  React.useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (v.duration) setVideoDuration(v.duration)
    const onDuration = () => setVideoDuration(videoRef.current?.duration || 0)
    v.addEventListener('durationchange', onDuration)
    return () => v.removeEventListener('durationchange', onDuration)
  }, [])

  const handleOvPlayPause = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const willPlay = v.paused
    if (willPlay) v.play()
    else v.pause()
    clearTimeout(playFeedbackTimerRef.current)
    playFeedbackCountRef.current += 1
    setPlayFeedback({ type: willPlay ? 'play' : 'pause', id: playFeedbackCountRef.current })
    playFeedbackTimerRef.current = setTimeout(() => setPlayFeedback(null), 700)
  }, [])
  const handleOvSeek = React.useCallback((e) => {
    const v = videoRef.current
    if (!v) return
    const t = Number(e.target.value)
    v.currentTime = t
    setVideoCurrentTime(t)
  }, [])
  const handleOvVolumeChange = React.useCallback((e) => {
    const v = videoRef.current
    if (!v) return
    const vol = Number(e.target.value)
    v.volume = vol
    v.muted = vol === 0
    setVideoVolume(vol)
    setVideoMuted(vol === 0)
  }, [])
  const handleOvMuteToggle = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const next = !v.muted
    v.muted = next
    setVideoMuted(next)
  }, [])

  const [memoPos, setMemoPos] = React.useState(() => ({ x: Math.max(0, window.innerWidth - 718), y: 68 }))
  const [memoSize, setMemoSize] = React.useState({ w: 340, h: 500 })
  const [aiPos, setAiPos] = React.useState(() => ({ x: window.innerWidth - 358, y: 68 }))
  const [aiSize, setAiSize] = React.useState({ w: 340, h: 500 })

  const memoPosRef = React.useRef(memoPos)
  const memoSizeRef = React.useRef(memoSize)
  const aiPosRef = React.useRef(aiPos)
  const aiSizeRef = React.useRef(aiSize)
  React.useEffect(() => { memoPosRef.current = memoPos }, [memoPos])
  React.useEffect(() => { memoSizeRef.current = memoSize }, [memoSize])
  React.useEffect(() => { aiPosRef.current = aiPos }, [aiPos])
  React.useEffect(() => { aiSizeRef.current = aiSize }, [aiSize])

  const handleMemoDragStart = React.useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX - memoPosRef.current.x
    const startY = e.clientY - memoPosRef.current.y
    const onMove = (ev) => {
      setMemoPos({
        x: Math.max(0, Math.min(window.innerWidth - memoSizeRef.current.w, ev.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - startY)),
      })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleMemoResizeStart = React.useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = memoSizeRef.current.w
    const startH = memoSizeRef.current.h
    const onMove = (ev) => {
      setMemoSize({ w: Math.max(260, startW + ev.clientX - startX), h: Math.max(180, startH + ev.clientY - startY) })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleAiDragStart = React.useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX - aiPosRef.current.x
    const startY = e.clientY - aiPosRef.current.y
    const onMove = (ev) => {
      setAiPos({
        x: Math.max(0, Math.min(window.innerWidth - aiSizeRef.current.w, ev.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - startY)),
      })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleAiResizeStart = React.useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = aiSizeRef.current.w
    const startH = aiSizeRef.current.h
    const onMove = (ev) => {
      setAiSize({ w: Math.max(260, startW + ev.clientX - startX), h: Math.max(180, startH + ev.clientY - startY) })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const isVideoReady = Boolean(resolvedVideoUrl) && !videoLoadFailed

  const overlaySvgStyle = videoFit === 'contain' && videoMetrics.width && videoMetrics.height
    ? {
        inset: 'auto',
        width: videoMetrics.width,
        height: videoMetrics.height,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }
    : {}

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const [datePart, teamsPart] = matchInfoText.includes(' · ')
    ? matchInfoText.split(' · ')
    : [null, matchInfoText]

  const handleVideoClick = React.useCallback(() => {
    handleOvPlayPause()
  }, [handleOvPlayPause])

  const aiTagStatus = aiStatus === '완료' ? 'done' : aiStatus === '분석 중' ? 'loading' : 'idle'

  return (
    <div className="ov-stage" data-fit={videoFit} onMouseLeave={handleStageMouseLeave} onMouseMove={handleStageMouseMove}>
      <canvas className="ov-inference-canvas" ref={detectionCanvasRef} />

      {isVideoReady ? (
        <video
          className="ov-stage__video"
          onClick={handleVideoClick}
          onError={onVideoError}
          onLoadedData={syncVideoMetrics}
          onLoadedMetadata={syncVideoMetrics}
          onPause={onVideoPause}
          onPlay={onVideoPlay}
          onSeeking={onVideoSeeking}
          onTimeUpdate={(e) => setVideoCurrentTime(e.target.currentTime)}
          ref={videoRef}
          src={resolvedVideoUrl}
        />
      ) : (
        <div className="ov-stage__fallback">
          <strong>
            {videoLoadFailed ? '영상을 불러오는데 실패했습니다.' : '영상을 불러오는 중...'}
          </strong>
        </div>
      )}

      <div className="ov-vignette" aria-hidden="true" />

      {playFeedback ? (
        <div className="play-feedback play-feedback--overlay" key={playFeedback.id}>
          {playFeedback.type === 'play'
            ? <svg fill="white" height="48" viewBox="0 0 16 16" width="48"><path d="M3 2l10 6-10 6V2z"/></svg>
            : <svg fill="white" height="48" viewBox="0 0 16 16" width="48"><rect height="12" rx="1.5" width="4" x="2" y="2"/><rect height="12" rx="1.5" width="4" x="10" y="2"/></svg>
          }
        </div>
      ) : null}

      {isVideoReady && bboxEnabled ? (
        <svg
          className="ov-overlay-svg"
          preserveAspectRatio="none"
          style={overlaySvgStyle}
          viewBox={`0 0 ${videoMetrics.width || 1} ${videoMetrics.height || 1}`}
        >
          {mappedDetections.map((box, index) => (
            <g key={`${box.classId}-${index}`}>
              <rect
                fill={bboxColorPreset.fill}
                height={box.height}
                rx="2"
                stroke={bboxColorPreset.stroke}
                strokeWidth="1.5"
                width={box.width}
                x={box.x}
                y={box.y}
              />
              <text
                fill={bboxColorPreset.text}
                fontSize="11"
                paintOrder="stroke"
                stroke={bboxColorPreset.textStroke}
                strokeWidth="3"
                x={box.x + 4}
                y={Math.max(14, box.y - 4)}
              >
                {`${box.label} ${(box.score * 100).toFixed(0)}%`}
              </text>
            </g>
          ))}
        </svg>
      ) : null}

      {isVideoReady && shouldShowArrowOverlay ? (
        <svg
          className="ov-overlay-svg"
          preserveAspectRatio="none"
          style={overlaySvgStyle}
          viewBox={`0 0 ${videoMetrics.width || 1} ${videoMetrics.height || 1}`}
        >
          <defs>
            <marker
              id="ov-arrowhead"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              markerWidth="8"
              orient="auto"
              refX="8"
              refY="4"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="#2ed17f" />
            </marker>
          </defs>
          <line
            filter="drop-shadow(0 2px 8px rgba(46,209,127,0.6))"
            markerEnd="url(#ov-arrowhead)"
            stroke="#2ed17f"
            strokeLinecap="round"
            strokeWidth="4"
            x1={renderedArrowGuide.startX}
            x2={renderedArrowGuide.endX}
            y1={renderedArrowGuide.startY}
            y2={renderedArrowGuide.endY}
          />
        </svg>
      ) : null}


      <div className="ov-topbar">
        <div className="ov-match-pill">
          <button className="ov-match-pill__back" onClick={onBack} type="button">
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 16 16" width="14">
              <path d="M10 4L6 8l4 4" />
            </svg>
          </button>
          {datePart ? (
            <>
              <span className="ov-match-pill__date">{datePart}</span>
              <span className="ov-match-pill__sep" aria-hidden="true" />
            </>
          ) : null}
          <span className="ov-match-pill__teams">{teamsPart}</span>
          <span className="ov-match-pill__clock">{formatTime(videoCurrentTime)}</span>
        </div>

        <div className="ov-topbar__spacer" />

        <div className="ov-topbar__cluster">
          <div className="ov-bbox-wrap">
            <button
              className="ov-action-pill"
              data-active={bboxMenuOpen ? 'true' : 'false'}
              onClick={() => setBboxMenuOpen((p) => !p)}
              type="button"
            >
              <svg fill="none" height="16" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
                <rect height="12" rx="1" width="12" x="2" y="2" />
                <rect height="6" rx="0.5" width="6" x="5" y="5" />
              </svg>
              bbox
              {bboxEnabled ? (
                <span className="ov-action-pill__badge">{playerCount + ballCount}</span>
              ) : null}
            </button>

            {bboxMenuOpen ? (
              <div className="video-player__bbox-menu" role="menu">
                <label className="video-player__bbox-label" htmlFor="ov-bbox-status">상태</label>
                <select
                  className="video-player__bbox-select"
                  id="ov-bbox-status"
                  onChange={(e) => setBboxEnabled(e.target.value === 'on')}
                  value={bboxEnabled ? 'on' : 'off'}
                >
                  <option value="off">비활성화</option>
                  <option value="on">활성화</option>
                </select>
                <label className="video-player__bbox-label" htmlFor="ov-bbox-color">색상</label>
                <select
                  className="video-player__bbox-select"
                  disabled={!bboxEnabled}
                  id="ov-bbox-color"
                  onChange={(e) => setBboxColorKey(e.target.value)}
                  value={bboxColorKey}
                >
                  <option value="green">그린</option>
                  <option value="red">레드</option>
                  <option value="blue">블루</option>
                  <option value="yellow">옐로우</option>
                </select>
              </div>
            ) : null}
          </div>

          <button
            className="ov-action-pill"
            data-active={videoFit === 'cover' ? 'true' : 'false'}
            onClick={() => setVideoFit((f) => f === 'contain' ? 'cover' : 'contain')}
            type="button"
          >
            {videoFit === 'contain' ? (
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
                <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
              </svg>
            ) : (
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
                <path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2" />
              </svg>
            )}
            {videoFit === 'contain' ? '화면 채우기' : '화면 맞추기'}
          </button>

          <button
            className="ov-action-pill"
            data-active={memoOpen ? 'true' : 'false'}
            onClick={() => setMemoOpen((p) => !p)}
            type="button"
          >
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
              <path d="M3 4h10M3 8h7M3 12h5" />
            </svg>
            메모
            {memos.length > 0 ? (
              <span className="ov-action-pill__badge">{memos.length}</span>
            ) : null}
          </button>

          <button
            className="ov-action-pill"
            data-active={aiOpen ? 'true' : 'false'}
            onClick={() => setAiOpen((p) => !p)}
            type="button"
          >
            <svg fill="none" height="16" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16" width="16">
              <circle cx="8" cy="8" r="5" />
              <path d="M8 5v3l2 1" strokeLinecap="round" />
            </svg>
            AI 코치
            <span className="ov-coach-tag" data-status={aiTagStatus}>{aiStatus}</span>
          </button>

        </div>
      </div>

<div
        className="ov-drawer"
        data-open={memoOpen ? 'true' : 'false'}
        style={{ left: memoPos.x, top: memoPos.y, width: memoSize.w, height: memoSize.h, ...(memoOpen ? { opacity: memoOpacity } : {}) }}
      >
        <div className="ov-drawer__head" onMouseDown={handleMemoDragStart}>
          <span className="ov-drawer__title">메모</span>
          <input
            className="ov-drawer__opacity"
            max="1"
            min="0.1"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setMemoOpacity(Number(e.target.value))}
            step="0.05"
            type="range"
            value={memoOpacity}
          />
          <span className="ov-drawer__count">{memos.length}개</span>
          <button className="ov-drawer__close" onClick={() => setMemoOpen(false)} type="button">✕</button>
        </div>
        <div className="ov-drawer__body">
          {memos.map((memo) => {
            const isSelected = memo.id === selectedMemoId
            const isEditing = editingMemoId === memo.id
            return (
              <div
                className="ov-memo-card"
                data-selected={isSelected ? 'true' : 'false'}
                key={memo.id}
                onClick={isSelected ? undefined : () => onSelectMemo(memo)}
                onKeyDown={isSelected ? undefined : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectMemo(memo)
                  }
                }}
                role={isSelected ? undefined : 'button'}
                tabIndex={isSelected ? undefined : 0}
              >
                <span className="ov-memo-card__time">{memo.time}</span>
                {isEditing ? (
                  <>
                    <textarea
                      className="ov-memo-card__editor"
                      onChange={(e) => setEditingMemoText(e.target.value)}
                      value={editingMemoText}
                    />
                    <div className="ov-memo-card__actions">
                      <button className="ov-memo-card__btn ov-memo-card__btn--primary" onClick={() => onEditSave(memo.id)} type="button">저장</button>
                      <button className="ov-memo-card__btn" onClick={onEditCancel} type="button">취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="ov-memo-card__text">{memo.text}</p>
                    {isSelected ? (
                      <div className="ov-memo-card__actions">
                        <button className="ov-memo-card__btn" onClick={() => onEditStart(memo)} type="button">수정</button>
                        <button className="ov-memo-card__btn ov-memo-card__btn--danger" onClick={() => onDeleteMemo(memo.id)} type="button">삭제</button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
        </div>
        <div className="ov-memo-compose">
          <div className="ov-memo-compose__head">현재 장면에 메모 추가</div>
          <textarea
            onChange={(e) => setMemoInput(e.target.value)}
            placeholder="여기에 메모를 입력하세요."
            value={memoInput}
          />
          <button
            className="ov-memo-compose__submit"
            disabled={!memoInput.trim()}
            onClick={onMemoCreate}
            type="button"
          >
            메모 생성
          </button>
        </div>
        <div className="ov-drawer__resize" onMouseDown={handleMemoResizeStart} />
      </div>

      <div
        className="ov-drawer"
        data-open={aiOpen ? 'true' : 'false'}
        style={{ left: aiPos.x, top: aiPos.y, width: aiSize.w, height: aiSize.h, ...(aiOpen ? { opacity: aiOpacity } : {}) }}
      >
        <div className="ov-drawer__head" onMouseDown={handleAiDragStart}>
          <span className="ov-drawer__title">AI 코치 피드백</span>
          <input
            className="ov-drawer__opacity"
            max="1"
            min="0.1"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setAiOpacity(Number(e.target.value))}
            step="0.05"
            type="range"
            value={aiOpacity}
          />
          <span className="ov-coach-tag" data-status={aiTagStatus}>{aiStatus}</span>
          <button className="ov-drawer__close" onClick={() => setAiOpen(false)} type="button">✕</button>
        </div>
        <div className="ov-drawer__body">
          {aiStatus === '분석 중' ? (
            <div className="ov-coach-loading">
              <span className="ov-coach-spinner" />
              <span>AI 분석 중...</span>
            </div>
          ) : null}
          <div className="ov-coach-notice">
            <strong>AI 분석 안내</strong>
            <p>AI 분석은 "AI 분석 요청"을 눌러야 시작됩니다. 기본 상태는 미분석입니다.</p>
          </div>
          <div className="ov-coach-dir">
            <div className="ov-coach-dir__label">공격 방향</div>
            <div className="ov-coach-dir__row">
              <button
                className="ov-coach-dir__btn"
                data-active={!isRtl ? 'true' : 'false'}
                onClick={() => setIsRtl(false)}
                type="button"
              >
                → 왼쪽에서 오른쪽
              </button>
              <button
                className="ov-coach-dir__btn"
                data-active={isRtl ? 'true' : 'false'}
                onClick={() => setIsRtl(true)}
                type="button"
              >
                ← 오른쪽에서 왼쪽
              </button>
            </div>
          </div>
          <button
            className="ov-coach-btn"
            disabled={aiStatus === '분석 중'}
            onClick={onAiRequest}
            type="button"
          >
            AI 분석 요청
          </button>
          {hasAiFeedback ? (
            <>
              <div className="ov-coach-section">
                <div className="ov-coach-section__title">현재 상황</div>
                <p>{coachContent.situation}</p>
              </div>
              <div className="ov-coach-section">
                <div className="ov-coach-section__title">추천 플레이</div>
                <p>{coachContent.movement}</p>
              </div>
              <button
                className="ov-coach-btn ov-coach-btn--ghost"
                onClick={onAppendFeedbackMemo}
                type="button"
              >
                피드백을 메모에 추가
              </button>
            </>
          ) : null}
        </div>
        <div className="ov-drawer__resize" onMouseDown={handleAiResizeStart} />
      </div>

      {isVideoReady ? (
        <div className="vpc vpc--overlay" style={{ opacity: (controlsVisible || videoPaused) ? 1 : 0, pointerEvents: (controlsVisible || videoPaused) ? 'auto' : 'none' }}>
          <button className="vpc__btn" onClick={handleOvPlayPause} type="button">
            {videoPaused ? (
              <svg fill="currentColor" height="14" viewBox="0 0 16 16" width="14"><path d="M3 2l10 6-10 6V2z"/></svg>
            ) : (
              <svg fill="currentColor" height="14" viewBox="0 0 16 16" width="14"><rect height="12" rx="1" width="4" x="2" y="2"/><rect height="12" rx="1" width="4" x="10" y="2"/></svg>
            )}
          </button>
          <span className="vpc__time">{formatTime(videoCurrentTime)}</span>
          <input
            className="vpc__seek"
            max={videoDuration || 0}
            min={0}
            onChange={handleOvSeek}
            step={0.1}
            type="range"
            value={videoCurrentTime}
          />
          <span className="vpc__time">{formatTime(videoDuration)}</span>
          <button className="vpc__btn" onClick={handleOvMuteToggle} type="button">
            {videoMuted || videoVolume === 0 ? (
              <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 16 16" width="14"><path d="M9 3L5 6H2v4h3l4 3V3z"/><line x1="13" x2="11" y1="6" y2="8"/><line x1="11" x2="13" y1="6" y2="8"/></svg>
            ) : (
              <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 16 16" width="14"><path d="M9 3L5 6H2v4h3l4 3V3z"/><path d="M12 5.5a4 4 0 010 5"/></svg>
            )}
          </button>
          <input
            className="vpc__volume"
            max={1}
            min={0}
            onChange={handleOvVolumeChange}
            step={0.05}
            type="range"
            value={videoMuted ? 0 : videoVolume}
          />
          <button className="vpc__btn vpc__btn--fullscreen" onClick={onExitOverlay} title="일반 모드로 돌아가기" type="button">
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 16 16" width="14"><path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2"/></svg>
          </button>
        </div>
      ) : null}

      {errorModal ? (
        <div
          className="error-modal-backdrop"
          onClick={() => setErrorModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && setErrorModal(null)}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="error-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="error-modal__header">
              <span className="status-pill status-pill--error">오류 발생</span>
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
    </div>
  )
}
