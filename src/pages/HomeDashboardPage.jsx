import React from 'react'
import {
  clearHighlightedMemoId,
  getRecentMatches,
  getRecentMemos,
  setCurrentMatchId,
  setHighlightedMemoId,
} from '../lib/appStorage'

export function HomeDashboardPage({ onNavigate }) {
  const [recentMatches, setRecentMatches] = React.useState([])
  const [feedbackCards, setFeedbackCards] = React.useState([])

  React.useEffect(() => {
    let isMounted = true

    Promise.all([
      getRecentMatches(3),
      getRecentMemos(2),
    ]).then(([matches, memos]) => {
      if (!isMounted) return
      setRecentMatches(matches)
      setFeedbackCards(memos)
    }).catch(() => {
      if (!isMounted) return
      setRecentMatches([])
      setFeedbackCards([])
    })

    return () => {
      isMounted = false
    }
  }, [])

  const openMatchAnalysis = React.useCallback((matchId) => {
    setCurrentMatchId(matchId)
    clearHighlightedMemoId()
    onNavigate('analysis')
  }, [onNavigate])

  const openMemoAnalysis = React.useCallback((memo) => {
    if (memo.matchId) {
      setCurrentMatchId(memo.matchId)
    }
    setHighlightedMemoId(memo.id)
    onNavigate('analysis')
  }, [onNavigate])

  return (
    <div className="dashboard">
      <section className="panel panel--hero">
        <p>최근 경기 분석을 이어서 확인하세요</p>
        <button className="button button--primary" onClick={() => onNavigate('list')} type="button">
          최근 분석 보기
        </button>
      </section>

      <section className="dashboard-section">
        <h2>최근 분석 경기</h2>
        <div className="card-row">
          {recentMatches.map((match) => (
            <div className="mini-card" key={match.id} onClick={() => openMatchAnalysis(match.id)} role="button" tabIndex={0}>
              <span>{match.date}</span>
              <strong>{match.title}</strong>
              <p>{match.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <h2>최근 메모</h2>
        <div className="card-row card-row--double">
          {feedbackCards.map((memo) => (
            <div className="feedback-card" key={memo.id} onClick={() => openMemoAnalysis(memo)} role="button" tabIndex={0}>
              <span>{memo.label || '메모'}</span>
              <p>{memo.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <h2>빠른 실행</h2>
        <div className="button-row">
          <button className="button button--primary" onClick={() => onNavigate('upload')} type="button">
            경기 업로드
          </button>
          <button className="button button--ghost" onClick={() => onNavigate('list')} type="button">
            경기 분석 보기
          </button>
        </div>
      </section>
    </div>
  )
}
