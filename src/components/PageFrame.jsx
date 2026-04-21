import React from 'react'

export function PageFrame({ title, description, helper, children }) {
  return (
    <section className="page-frame">
      <header className="page-frame__header">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {helper ? <span>{helper}</span> : null}
      </header>
      {children}
    </section>
  )
}
