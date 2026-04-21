import React from 'react'
import { BrandHeader } from '../components/BrandHeader'
import { loginUser, registerUser } from '../lib/appStorage'

export function SignupPage({ onNavigate }) {
  const [showPassword, setShowPassword] = React.useState(false)
  const [name, setName] = React.useState('')
  const [position, setPosition] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSignup = React.useCallback(async () => {
    if (isSubmitting) return

    if (!name.trim() || !position.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('모든 항목을 입력해주세요.')
      return
    }

    if (password.trim().length < 8) {
      setErrorMessage('비밀번호는 8자 이상으로 입력해주세요.')
      return
    }

    setIsSubmitting(true)

    const registerResult = await registerUser({ name, position, email, password })
    if (!registerResult.ok) {
      setIsSubmitting(false)
      setErrorMessage(registerResult.message)
      return
    }

    const loginResult = await loginUser({ email, password })
    setIsSubmitting(false)

    if (!loginResult.ok) {
      setErrorMessage('회원가입 후 로그인에 실패했습니다. 다시 시도해주세요.')
      return
    }

    setErrorMessage('')
    onNavigate('home')
  }, [email, isSubmitting, name, onNavigate, password, position])

  return (
    <div className="auth-page auth-page--signup">
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
            <h2>회원가입</h2>
            <p>분석 결과를 저장할 기본 계정을 만듭니다.</p>
          </div>

          <div className="auth-form">
            <div className="auth-form__row">
              <label className="auth-field">
                <span>이름</span>
                <input onChange={(event) => setName(event.target.value)} placeholder="홍길동" type="text" value={name} />
              </label>
              <label className="auth-field">
                <span>포지션</span>
                <input onChange={(event) => setPosition(event.target.value)} placeholder="윙어" type="text" value={position} />
              </label>
            </div>

            <label className="auth-field">
              <span>이메일</span>
              <input onChange={(event) => setEmail(event.target.value)} placeholder="player@soccermove.ai" type="email" value={email} />
            </label>

            <label className="auth-field">
              <span>비밀번호</span>
              <div className="auth-field__input auth-field__input--split">
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="영문, 숫자 포함 8자 이상"
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
              onClick={handleSignup}
              type="button"
            >
              {isSubmitting ? '계정 생성 중...' : '계정 만들기'}
            </button>

            <div className="auth-divider">
              <div />
              <span>이미 계정이 있나요?</span>
              <div />
            </div>

            <button
              className="button button--ghost button--block auth-alt-button"
              onClick={() => onNavigate('login')}
              type="button"
            >
              로그인 화면 보기
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
