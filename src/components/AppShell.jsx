import React from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({ activePage, onNavigate, onLogout, showSidebar = true, children }) {
  return (
    <div className="app-shell">
      {showSidebar ? <Sidebar activePage={activePage} onLogout={onLogout} onNavigate={onNavigate} /> : null}
      <main className="app-shell__content">{children}</main>
    </div>
  )
}
