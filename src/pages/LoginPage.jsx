import React from 'react'
import { BrandHeader } from '../components/BrandHeader'
import { loginUser } from '../lib/appStorage'

export function LoginPage({ onNavigate }) {
  const [showPassword, setShowPassword] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleLogin = React.useCallback(async () => {
    if (isSubmitting) return

    if (!email.trim() || !password.trim()) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    const result = await loginUser({ email, password })
    setIsSubmitting(false)

    if (!result.ok) {
      setErrorMessage(result.message)
      return
    }

    setErrorMessage('')
    onNavigate('home')
  }, [email, isSubmitting, onNavigate, password])

  return (
    <div className="auth-page auth-page--login">
      <section className="auth-page__panel auth-page__panel--hero">
        <BrandHeader className="auth-brand" onClick={() => onNavigate('/')} />
        <span className="auth-page__eyebrow">Match insight platform</span>
        <h1>영상을 업로드하고 플레이 분석을 바로 확인하세요.</h1>
        <p className="auth-page__lead">
          경기 장면을 AI가 분석하여 과거 프로선수 경기 데이터 기반으로 더 나은 플레이를 추천해줍니다.
        </p>

        <div className="auth-proof-row">
          <article className="auth-proof-card">
            <strong>AI 분석</strong>
            <span>수많은 프로 경기 데이터를 기반으로 정확한 분석 제공</span>
          </article>
          <article className="auth-proof-card">
            <strong>경기 메모</strong>
            <span>단순 경기 시청이 아닌 이미지 트레이닝 및 회고 진행</span>
          </article>
        </div>
      </section>

      <section className="auth-page__panel auth-page__panel--form">
        <div className="auth-card">
          <div className="auth-card__head">
            <h2>로그인</h2>
            <p>경기 분석 기록을 이어서 확인하려면 계정으로 들어오세요.</p>
          </div>

          <div className="auth-form">
            <label className="auth-field">
              <span>이메일</span>
              <input
                onChange={(event) => setEmail(event.target.value)}
                placeholder="player@soccermove.ai"
                type="email"
                value={email}
              />
            </label>

            <label className="auth-field">
              <span>비밀번호</span>
              <div className="auth-field__input auth-field__input--split">
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8자 이상 입력"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button className="auth-inline-button" onClick={() => setShowPassword((prev) => !prev)} type="button">
                  {showPassword ? '숨기기' : '표시'}
                </button>
              </div>
            </label>

            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

            <button
              className="button button--primary button--block auth-submit"
              disabled={isSubmitting}
              onClick={handleLogin}
              type="button"
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>

            <div className="auth-divider">
              <div />
              <span>처음이신가요?</span>
              <div />
            </div>

            <button
              className="button button--ghost button--block auth-alt-button"
              onClick={() => onNavigate('signup')}
              type="button"
            >
              회원가입 화면 보기
            </button>

            <p className="auth-microcopy">
              분석 결과와 업로드 이력은 계정에 안전하게 보관됩니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
