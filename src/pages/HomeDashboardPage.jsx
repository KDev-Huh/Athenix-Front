import React from 'react'
import {
  clearHighlightedMemoId,
  getRecentMatches,
  getRecentMemos,
  getSession,
  getUserSummary,
  setCurrentMatchId,
  setHighlightedMemoId,
} from '../lib/appStorage'

const BLOCKED_STATUSES = ['처리중', '처리 실패']

const STATUS_PILL = {
  '분석 완료': 'status-pill--complete',
  '처리중': 'status-pill--processing',
  '처리 실패': 'status-pill--error',
  '임시 저장': 'status-pill--draft',
}

const ARROW_ICON = { SOLID: '——→', DASHED: '╌╌→', WAVY: '〜〜→' }

const LEAGUES = [
  { id: 'eng.1', label: '프리미어리그' },
  { id: 'ger.1', label: '분데스리가' },
  { id: 'esp.1', label: '라리가' },
]

function formatStatValue(val) { return val == null ? '—' : String(val) }

function formatNewsDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
}

async function fetchStandingsData(leagueId) {
  const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`)
  const data = await res.json()
  const entries = data?.children?.[0]?.standings?.entries ?? []
  return entries.map((e, idx) => {
    const sm = {}
    for (const s of (e.stats ?? [])) sm[s.name] = s.value
    return {
      rank: idx + 1,
      short: e.team?.shortDisplayName ?? e.team?.abbreviation ?? '',
      logo: e.team?.logos?.[0]?.href ?? null,
      w: sm.wins ?? 0, d: sm.ties ?? 0, l: sm.losses ?? 0, pts: sm.points ?? 0,
    }
  })
}

async function fetchNewsData() {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=6')
  const data = await res.json()
  return (data?.articles ?? []).map(a => ({
    title: a.headline ?? '',
    desc: a.description ?? '',
    date: formatNewsDate(a.published),
    url: a.links?.web?.href ?? null,
    img: a.images?.[0]?.url ?? null,
  }))
}

export function HomeDashboardPage({ onNavigate }) {
  const session = getSession()
  const [recentMatches, setRecentMatches] = React.useState([])
  const [recentMemos, setRecentMemos] = React.useState([])
  const [summary, setSummary] = React.useState({ totalMatches: null, totalMemos: null, aiAnalysisCount: null })
  const [loaded, setLoaded] = React.useState(false)
  const [leagueTab, setLeagueTab] = React.useState('eng.1')
  const [standings, setStandings] = React.useState([])
  const [standingsLoading, setStandingsLoading] = React.useState(false)
  const [footballNews, setFootballNews] = React.useState([])

  React.useEffect(() => {
    let alive = true
    Promise.all([getRecentMatches(3), getRecentMemos(8), getUserSummary()])
      .then(([matches, memos, sum]) => {
        if (!alive) return
        setRecentMatches(matches)
        setRecentMemos(memos)
        setSummary(sum ?? { totalMatches: null, totalMemos: null, aiAnalysisCount: null })
        setLoaded(true)
      }).catch(() => { if (alive) setLoaded(true) })
    fetchNewsData().then(a => { if (alive) setFootballNews(a) }).catch(() => {})
    return () => { alive = false }
  }, [])

  React.useEffect(() => {
    let alive = true
    setStandingsLoading(true)
    setStandings([])
    fetchStandingsData(leagueTab)
      .then(rows => { if (alive) { setStandings(rows); setStandingsLoading(false) } })
      .catch(() => { if (alive) { setStandings([]); setStandingsLoading(false) } })
    return () => { alive = false }
  }, [leagueTab])

  const openMatch = React.useCallback((match) => {
    if (BLOCKED_STATUSES.includes(match.status)) return
    setCurrentMatchId(match.id)
    clearHighlightedMemoId()
    onNavigate('analysis')
  }, [onNavigate])

  const openMemo = React.useCallback((memo) => {
    if (memo.matchId) setCurrentMatchId(memo.matchId)
    setHighlightedMemoId(memo.id)
    onNavigate('analysis')
  }, [onNavigate])

  const userName = session?.name ?? '선수'
  const userPosition = session?.position ?? null

  return (
    <div className="hd">

      {/* 그리팅 */}
      <section className="panel hd-greeting">
        <div className="hd-greeting__copy">
          {userPosition && <span className="eyebrow">{userPosition}</span>}
          <h1 className="hd-greeting__name">안녕하세요, {userName}님</h1>
          <div className="hd-greeting__actions">
            <button className="button button--primary button--small" onClick={() => onNavigate('upload')} type="button">경기 업로드</button>
            <button className="button button--ghost button--small" onClick={() => onNavigate('list')} type="button">경기 분석 보기</button>
          </div>
        </div>
        <div className="hd-stats">
          <div className="hd-stat">
            <strong>{formatStatValue(summary.totalMatches)}</strong>
            <span>총 경기</span>
          </div>
          <div className="hd-stat">
            <strong>{formatStatValue(summary.totalMemos)}</strong>
            <span>총 메모</span>
          </div>
          <div className="hd-stat hd-stat--accent">
            <strong>{formatStatValue(summary.aiAnalysisCount)}</strong>
            <span>AI 분석</span>
          </div>
        </div>
      </section>

      {/* 메인 2열 레이아웃 */}
      <div className="hd-grid">
        <div className="hd-left-col">

        {/* 최근 분석 경기 */}
        <div className="hd-block hd-col1-r1">
          <div className="hd-block__head">
            <span>최근 분석 경기</span>
            <button className="button button--ghost button--small" onClick={() => onNavigate('list')} type="button">전체 보기</button>
          </div>
          <div className="hd-block__body">
            {loaded && recentMatches.length === 0 ? (
              <p className="hd-empty">아직 분석한 경기가 없습니다.</p>
            ) : (
              <div className="hd-match-row">
                {recentMatches.map(match => {
                  const blocked = BLOCKED_STATUSES.includes(match.status)
                  return (
                    <div
                      className={`hd-match-card${blocked ? ' is-blocked' : ''}`}
                      key={match.id}
                      onClick={() => openMatch(match)}
                      role="button"
                      tabIndex={blocked ? -1 : 0}
                    >
                      <div className="hd-match-card__thumb">
                        {match.thumbnailUrl && <img alt={match.title} src={match.thumbnailUrl} />}
                      </div>
                      <div className="hd-match-card__body">
                        <p className="hd-match-card__title">{match.title}</p>
                        <div className="hd-match-card__meta">
                          <span className="hd-match-card__date">{match.date}</span>
                          <span className={`status-pill ${STATUS_PILL[match.status] ?? 'status-pill--draft'}`}>{match.status}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* [col1, row2] 최근 활동 */}
        <div className="hd-block hd-col1-r2">
          <div className="hd-block__head">
            <span>최근 활동</span>
          </div>
          <div className="hd-activity">
            {loaded && recentMemos.length === 0 ? (
              <p className="hd-empty" style={{ padding: '12px 16px' }}>메모가 없습니다.</p>
            ) : recentMemos.map(memo => {
              const isAi = memo.label === 'AI 피드백'
              const arrowIcon = memo.arrowStyle ? (ARROW_ICON[memo.arrowStyle] ?? null) : null
              return (
                <div className="hd-activity__item" key={memo.id} onClick={() => openMemo(memo)} role="button" tabIndex={0}>
                  <span className="hd-activity__time">{memo.timeLabel ?? memo.time ?? '—'}</span>
                  <span className={`hd-activity__badge${isAi ? ' hd-activity__badge--ai' : ' hd-activity__badge--memo'}`}>
                    {memo.label || '메모'}
                  </span>
                  <span className="hd-activity__text">{memo.text}</span>
                  {arrowIcon && <span className="hd-activity__arrow">{arrowIcon}</span>}
                </div>
              )
            })}
          </div>
        </div>

        </div>{/* end hd-left-col */}

        {/* 리그 순위 */}
        <div className="hd-standings">
          <div className="hd-standings__head">
            <span className="hd-standings__title">리그 순위</span>
            <div className="hd-standings__tabs">
              {LEAGUES.map(lg => (
                <button
                  className={`hd-tab${leagueTab === lg.id ? ' is-active' : ''}`}
                  key={lg.id}
                  onClick={() => setLeagueTab(lg.id)}
                  type="button"
                >
                  {lg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hd-standings__body">
            {standingsLoading ? (
              <p className="hd-empty" style={{ padding: '16px' }}>불러오는 중...</p>
            ) : standings.length === 0 ? (
              <p className="hd-empty" style={{ padding: '16px' }}>데이터 없음</p>
            ) : (
              <table className="hd-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>팀</th>
                    <th>승</th>
                    <th>무</th>
                    <th>패</th>
                    <th>승점</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(row => (
                    <tr key={row.rank}>
                      <td className="hd-table__rank">{row.rank}</td>
                      <td>
                        <div className="hd-table__team">
                          {row.logo && <img alt={row.short} className="hd-table__logo" src={row.logo} />}
                          <span>{row.short}</span>
                        </div>
                      </td>
                      <td>{row.w}</td>
                      <td>{row.d}</td>
                      <td>{row.l}</td>
                      <td className="hd-table__pts">{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* 뉴스 */}
      {footballNews.length > 0 && (
        <div className="hd-block">
          <div className="hd-block__head">
            <span>최근 축구 뉴스</span>
          </div>
          <div className="hd-block__body">
            <div className="hd-news">
              {footballNews.map((a, i) => (
                <a className="hd-news__card" href={a.url ?? '#'} key={i} rel="noopener noreferrer" target="_blank">
                  <div className="hd-news__thumb">
                    {a.img ? <img alt={a.title} src={a.img} /> : null}
                  </div>
                  <div className="hd-news__body">
                    <p className="hd-news__title">{a.title}</p>
                    {a.desc && <p className="hd-news__desc">{a.desc}</p>}
                    <span className="hd-news__date">{a.date}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
