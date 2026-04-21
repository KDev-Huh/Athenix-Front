import React from 'react'
import { BrandHeader } from './BrandHeader'
import { getTodayTip } from '../lib/appStorage'

export function Sidebar({ activePage, onNavigate, onLogout }) {
  const [tipTitle, setTipTitle] = React.useState('오늘의 팁')
  const [tipText, setTipText] = React.useState('수비수 뒤 공간을 활용하세요.')

  React.useEffect(() => {
    let isMounted = true

    getTodayTip().then((tip) => {
      if (!isMounted) return
      if (tip?.title) {
        setTipTitle(tip.title)
      }
      if (tip?.content) {
        setTipText(tip.content)
      }
    }).catch(() => {
      // 팁 요청 실패 시 기본 문구를 유지한다.
    })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <aside className="sidebar">
      <BrandHeader className="sidebar__brand" onClick={() => onNavigate('/')} />
      <span className="sidebar__label">메뉴</span>
      <nav className="sidebar__nav">
        {[
          ['home', '홈'],
          ['list', '경기 분석'],
          ['upload', '경기 업로드'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`sidebar__item ${activePage === key ? 'is-active' : ''}`}
            onClick={() => onNavigate(key)}
            type="button"
          >
            <span className="sidebar__dot" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar__hint">
        <div className="sidebar__hint-title">{tipTitle}</div>
        <p>{tipText}</p>
      </div>
      <div className="sidebar__footer">
        <button className="sidebar__logout" onClick={onLogout} type="button">
          로그아웃
        </button>
      </div>
    </aside>
  )
}
