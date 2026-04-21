import React from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { HomeDashboardPage } from './pages/HomeDashboardPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { MatchAnalysisListPage } from './pages/MatchAnalysisListPage'
import { MatchAnalysisPage } from './pages/MatchAnalysisPage'
import { SignupPage } from './pages/SignupPage'
import { UploadPage } from './pages/UploadPage'
import { getSession, logoutUser } from './lib/appStorage'

const routeByPage = {
  landing: '/',
  login: '/login',
  signup: '/signup',
  home: '/home',
  list: '/list',
  upload: '/upload',
  analysis: '/analysis',
}

const pageByRoute = Object.fromEntries(Object.entries(routeByPage).map(([page, route]) => [route, page]))

function getPageFromPathname(pathname) {
  return pageByRoute[pathname] ?? 'landing'
}

function resolvePath(nextPage) {
  if (nextPage.startsWith('/')) return nextPage

  return routeByPage[nextPage] ?? '/'
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const activePage = getPageFromPathname(location.pathname)
  const session = getSession()
  const isAuthenticated = Boolean(session?.userId)

  const navigateTo = React.useCallback((nextPage) => {
    navigate(resolvePath(nextPage))
  }, [navigate])

  const navigateBack = React.useCallback(() => {
    navigate('/list')
  }, [navigate])

  const handleLogout = React.useCallback(async () => {
    await logoutUser()
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate replace to="/home" /> : <LandingPage onNavigate={navigateTo} />} />
      <Route path="/login" element={isAuthenticated ? <Navigate replace to="/home" /> : <LoginPage onNavigate={navigateTo} />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate replace to="/home" /> : <SignupPage onNavigate={navigateTo} />} />
      <Route
        path="/home"
        element={isAuthenticated ? (
          <AppShell activePage={activePage} onLogout={handleLogout} onNavigate={navigateTo} showSidebar>
            <HomeDashboardPage onNavigate={navigateTo} />
          </AppShell>
        ) : <Navigate replace to="/login" />}
      />
      <Route
        path="/list"
        element={isAuthenticated ? (
          <AppShell activePage={activePage} onLogout={handleLogout} onNavigate={navigateTo} showSidebar>
            <MatchAnalysisListPage onNavigate={navigateTo} />
          </AppShell>
        ) : <Navigate replace to="/login" />}
      />
      <Route
        path="/upload"
        element={isAuthenticated ? (
          <AppShell activePage={activePage} onLogout={handleLogout} onNavigate={navigateTo} showSidebar>
            <UploadPage onNavigate={navigateTo} />
          </AppShell>
        ) : <Navigate replace to="/login" />}
      />
      <Route
        path="/analysis"
        element={isAuthenticated ? (
          <AppShell activePage={activePage} onLogout={handleLogout} onNavigate={navigateTo} showSidebar={false}>
            <MatchAnalysisPage onBack={navigateBack} />
          </AppShell>
        ) : <Navigate replace to="/login" />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
