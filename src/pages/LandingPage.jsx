import React from 'react'
import { BrandHeader } from '../components/BrandHeader'
import {
  featureCards,
  landingStats,
  serviceSteps,
  targetUsers,
} from '../data/appData'

export function LandingPage({ onNavigate }) {
  const serviceRef = React.useRef(null)
  const featureRef = React.useRef(null)

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <BrandHeader className="landing-header__brand" />
        <nav className="landing-header__nav">
          <button onClick={() => scrollToSection(serviceRef)} type="button">
            사용방법
          </button>
          <button onClick={() => scrollToSection(featureRef)} type="button">
            주요 기능
          </button>
          <button className="button button--primary" onClick={() => onNavigate('login')} type="button">
            로그인
          </button>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <span className="eyebrow">AI 코치 피드백</span>
          <h1>경기 영상을 분석하고 더 좋은 플레이로 개선하세요</h1>
          <p>AI 기반 영상분석을 통해 축구 경기 플레이를 분석하고 피드백합니다.</p>
          <div className="button-row">
            <button className="button button--primary" onClick={() => onNavigate('upload')} type="button">
              시작하기
            </button>
            <button className="button button--ghost" onClick={() => onNavigate('list')} type="button">
              분석 목록 보기
            </button>
          </div>
        </div>
        <div className="hero-preview">
          <div className="hero-preview__image" />
          <div className="hero-preview__bar">
            <div />
          </div>
          <div className="hero-preview__caption">
            <span>AI 분석</span>
            <span>수비 사이를 찌르는 스루패스를 넣으면 더 좋은 결과를 얻을 수 있습니다</span>
          </div>
        </div>
      </section>

      <section className="landing-section" ref={serviceRef}>
        <div className="section-head">
          <h2>사용 방법</h2>
          <p>경기 영상을 올리고 장면을 고르면 바로 피드백을 받습니다.</p>
        </div>
        <div className="three-grid">
          {serviceSteps.map(([step, title, desc]) => (
            <article className="info-card" key={step}>
              <span className="eyebrow">{step}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" ref={featureRef}>
        <div className="section-head">
          <h2>주요 기능</h2>
          <p>선수에게 필요한 분석만 간단하게 제공합니다.</p>
        </div>
        <div className="two-grid">
          {featureCards.map(([title, desc]) => (
            <article className="info-card info-card--wide" key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <h2>추천 대상</h2>
          <p>개인 선수의 움직임 개선을 위한 서비스입니다.</p>
        </div>
        <div className="three-grid">
          {targetUsers.map(([title, desc]) => (
            <article className="info-card" key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta__card">
          <h2>지금 경기 영상을 분석해보세요</h2>
          <p>업로드 후 바로 AI 코치 피드백을 확인할 수 있습니다.</p>
          <button className="button button--primary" onClick={() => onNavigate('upload')} type="button">
            분석 시작
          </button>
        </div>
      </section>
    </div>
  )
}
