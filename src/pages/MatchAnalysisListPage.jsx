import React from 'react'
import { deleteMatch, getMatches, setCurrentMatchId, updateMatchStatus } from '../lib/appStorage'

export function MatchAnalysisListPage({ onNavigate }) {
  const PAGE_SIZE = 10
  const statusOptions = ['임시 저장', '분석 중', '분석 완료']
  const [queryStatus, setQueryStatus] = React.useState('')
  const [querySort, setQuerySort] = React.useState('latest')
  const [queryPage, setQueryPage] = React.useState(1)
  const [openStatusCardId, setOpenStatusCardId] = React.useState(null)
  const [cards, setCards] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasNextPage, setHasNextPage] = React.useState(false)
  const [deletingMatchId, setDeletingMatchId] = React.useState(null)

  React.useEffect(() => {
    let isMounted = true

    setIsLoading(true)
    getMatches({
      status: queryStatus || undefined,
      sort: querySort,
      page: queryPage,
      size: PAGE_SIZE,
    }).then((nextCards) => {
      if (!isMounted) return
      setCards(nextCards)
      setHasNextPage(nextCards.length >= PAGE_SIZE)
      setIsLoading(false)
    }).catch(() => {
      if (!isMounted) return
      setCards([])
      setHasNextPage(false)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [queryPage, querySort, queryStatus])

  const getStatusClassName = React.useCallback((status) => {
    if (status === '임시 저장') return 'status-pill status-pill--draft'
    if (status === '분석 중') return 'status-pill status-pill--processing'
    return 'status-pill status-pill--complete'
  }, [])

  const handleStatusToggle = React.useCallback((event, cardId) => {
    event.stopPropagation()
    setOpenStatusCardId((currentId) => (currentId === cardId ? null : cardId))
  }, [])

  const handleStatusSelect = React.useCallback(async (event, cardId, nextStatus) => {
    event.stopPropagation()
    try {
      await updateMatchStatus(cardId, nextStatus)
      setCards((currentCards) => currentCards.map((card) => (
        card.id === cardId ? { ...card, status: nextStatus } : card
      )))
    } catch {
      // keep current state if patch fails
    }
    setOpenStatusCardId(null)
  }, [])

  const handleDeleteMatch = React.useCallback(async (event, cardId) => {
    event.stopPropagation()

    if (deletingMatchId === cardId) return

    const confirmed = window.confirm('이 경기를 삭제할까요? 관련 데이터도 함께 삭제됩니다.')
    if (!confirmed) return

    setDeletingMatchId(cardId)
    try {
      await deleteMatch(cardId)
      setCards((currentCards) => currentCards.filter((card) => card.id !== cardId))
      setOpenStatusCardId((currentOpenId) => (currentOpenId === cardId ? null : currentOpenId))
    } catch {
      // 삭제 실패 시 현재 목록을 유지한다.
    } finally {
      setDeletingMatchId(null)
    }
  }, [deletingMatchId])

  const handleCardKeyDown = React.useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onNavigate('analysis')
    }
  }, [onNavigate])

  return (
    <div className="list-page">
      <header className="list-header">
        <h1>경기 분석 목록</h1>
        <p>등록된 영상과 분석된 경기를 선택하세요.</p>
        <div className="list-filters">
          <label className="list-filter">
            <span>상태</span>
            <select
              onChange={(event) => {
                setQueryStatus(event.target.value)
                setQueryPage(1)
              }}
              value={queryStatus}
            >
              <option value="">전체</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="list-filter">
            <span>정렬</span>
            <select
              onChange={(event) => {
                setQuerySort(event.target.value)
                setQueryPage(1)
              }}
              value={querySort}
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
          </label>
        </div>
      </header>
      <div className="list-stack">
        {isLoading ? <p className="list-loading">목록을 불러오는 중입니다...</p> : null}
        {!isLoading && cards.length === 0 ? <p className="list-empty">조건에 맞는 경기가 없습니다.</p> : null}
        {cards.map((card) => (
          <article
            key={card.id}
            className="list-card"
            onKeyDown={handleCardKeyDown}
            onClick={() => {
              setCurrentMatchId(card.id)
              onNavigate('analysis')
            }}
            role="button"
            tabIndex={0}
          >
            {card.thumbnailUrl ? (
              <img alt={`${card.title} 썸네일`} className="list-card__thumb list-card__thumb--image" src={card.thumbnailUrl} />
            ) : (
              <div className="list-card__thumb" />
            )}
            <div className="list-card__body">
              <strong>{card.title}</strong>
              <span>{card.date}</span>
              <p>{card.desc}</p>
            </div>
            <div className="list-card__actions" onClick={(event) => event.stopPropagation()}>
              <div className="status-control">
                <button
                  className={getStatusClassName(card.status)}
                  onClick={(event) => handleStatusToggle(event, card.id)}
                  type="button"
                >
                  {card.status}
                </button>
                {openStatusCardId === card.id ? (
                  <div className="status-menu" role="menu">
                    {statusOptions.map((status) => (
                      <button
                        className={`status-menu__item ${status === card.status ? 'is-active' : ''}`}
                        key={status}
                        onClick={(event) => handleStatusSelect(event, card.id, status)}
                        type="button"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                className="list-card__delete"
                disabled={deletingMatchId === card.id}
                onClick={(event) => handleDeleteMatch(event, card.id)}
                type="button"
              >
                {deletingMatchId === card.id ? '삭제 중...' : '경기 삭제'}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="list-pagination">
        <button
          className="button button--ghost button--small"
          disabled={isLoading || queryPage <= 1}
          onClick={() => setQueryPage((current) => Math.max(1, current - 1))}
          type="button"
        >
          이전
        </button>
        <span className="list-pagination__label">{queryPage} 페이지</span>
        <button
          className="button button--ghost button--small"
          disabled={isLoading || !hasNextPage}
          onClick={() => setQueryPage((current) => current + 1)}
          type="button"
        >
          다음
        </button>
      </div>
    </div>
  )
}
