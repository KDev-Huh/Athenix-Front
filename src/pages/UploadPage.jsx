import React from 'react'
import { PageFrame } from '../components/PageFrame'
import { addMatch, saveMatchVideo } from '../lib/appStorage'

function UploadField({ label, value, onChange, placeholder }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <div className="form-field__input">
        <input className="form-field__control" onChange={onChange} placeholder={placeholder} type="text" value={value} />
      </div>
    </label>
  )
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`
  return `${mb.toFixed(1)} MB`
}

export function UploadPage({ onNavigate }) {
  const fileRef = React.useRef(null)
  const [selectedFile, setSelectedFile] = React.useState(null)
  const [progress, setProgress] = React.useState(0)
  const [isUploading, setIsUploading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')
  const [form, setForm] = React.useState({
    matchName: '',
    matchDate: '',
    opponentName: '',
    teamName: '',
    position: '',
    jerseyNumber: '',
    description: '',
  })

  const updateField = React.useCallback((field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }, [])

  const handleFileSelect = React.useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    const filename = file.name.replace(/\.[^.]+$/, '')
    setForm((current) => ({ ...current, matchName: filename }))
    setErrorMessage('')
    setProgress(0)
  }, [])

  const handleStart = React.useCallback(async () => {
    if (isUploading) return

    if (!selectedFile) {
      setErrorMessage('먼저 경기 영상을 선택해주세요.')
      return
    }

    if (!form.matchName.trim() || !form.matchDate.trim()) {
      setErrorMessage('경기 이름과 경기 날짜를 입력해주세요.')
      return
    }

    setErrorMessage('')
    setIsUploading(true)
    setProgress(0)

    try {
      const nextMatch = await addMatch({
        title: form.matchName.trim(),
        date: form.matchDate.trim(),
        description: form.description.trim(),
        opponentName: form.opponentName.trim(),
        teamName: form.teamName.trim(),
        position: form.position.trim(),
        jerseyNumber: form.jerseyNumber.trim(),
        videoFile: selectedFile,
      }, (percent) => {
        setProgress(percent)
      })

      setProgress(100)
      await saveMatchVideo(nextMatch.id, selectedFile)
      setIsUploading(false)
      onNavigate('list')
    } catch (error) {
      setIsUploading(false)
      setProgress(0)
      setErrorMessage(error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.')
    }
  }, [form.description, form.jerseyNumber, form.matchDate, form.matchName, form.opponentName, form.position, form.teamName, isUploading, onNavigate, selectedFile])

  const progressLabel = `${progress.toFixed(1)}%`

  return (
    <PageFrame
      title="경기 업로드"
      description="영상만 업로드하면 AI가 전술 피드백을 만들어줍니다."
      helper="파일 크기는 최대 2GB, MP4/MOV만 지원합니다."
    >
      <div className="upload-layout">
        <section className="upload-drop">
          <button className="upload-drop__zone" onClick={() => fileRef.current?.click()} type="button">
            <div className="upload-drop__icon">↥</div>
            <strong>경기 영상을 업로드하세요</strong>
            {selectedFile ? (
              <>
                <p className="upload-drop__selected-name">{selectedFile.name}</p>
                <span>{formatFileSize(selectedFile.size)}</span>
              </>
            ) : (
              <>
                <p>Drag & Drop 또는 클릭해서 파일 선택</p>
                <span>파일 형식: MP4 / MOV | 최대 2GB</span>
              </>
            )}
          </button>
          <input
            accept=".mp4,.mov,video/mp4,video/quicktime"
            className="upload-drop__file"
            onChange={handleFileSelect}
            ref={fileRef}
            type="file"
          />
          <div className="upload-progress">
            <div className="upload-progress__meta">
              <span>{selectedFile ? selectedFile.name : '선택된 파일 없음'}</span>
              <span>{isUploading ? '업로드 중' : '업로드 대기'}</span>
            </div>
            <div className="upload-progress__bar">
              <div style={{ width: progressLabel }} />
            </div>
            <div className="upload-progress__meta">
              <span>진행률 {progressLabel}</span>
            </div>
          </div>
        </section>

        <section className="upload-form">
          <div className="upload-form__title">
            <span className="dot-icon" />
            <h2>경기 정보</h2>
          </div>
          <div className="upload-form__fields">
            <UploadField label="경기 이름" onChange={updateField('matchName')} placeholder="예: 부산고 vs 서울" value={form.matchName} />
            <UploadField label="경기 날짜" onChange={updateField('matchDate')} placeholder="2026-04-03" value={form.matchDate} />
            <UploadField label="상대팀 이름" onChange={updateField('opponentName')} placeholder="예: 블루웨이브" value={form.opponentName} />
            <div className="form-row">
              <UploadField label="소속" onChange={updateField('teamName')} placeholder="예: 중원유나이티드" value={form.teamName} />
              <UploadField label="포지션" onChange={updateField('position')} placeholder="중앙" value={form.position} />
            </div>
            <div className="form-row">
              <UploadField label="등번호" onChange={updateField('jerseyNumber')} placeholder="예: 8" value={form.jerseyNumber} />
                <UploadField label="설명" onChange={updateField('description')} placeholder="예: 1:0 패배" value={form.description} />
            </div>
          </div>
          {errorMessage ? <p className="upload-error">{errorMessage}</p> : null}
          <p className="upload-form__note">업로드 후 AI 분석 분석을 진행할 수 있습니다.</p>
          <button className="button button--primary button--block" onClick={handleStart} type="button">
            업로드
          </button>
        </section>
      </div>
    </PageFrame>
  )
}
