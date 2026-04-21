import React from 'react'

export function BrandHeader({ className = '', onClick }) {
  const Component = onClick ? 'button' : 'div'
  const classes = ['brand-link', className].filter(Boolean).join(' ')
  const componentProps = onClick ? { onClick, type: 'button' } : {}

  return (
    <Component className={classes} {...componentProps}>
      <img src="/assets/logo_no_background.png" alt="무브인사이트" className="brand-logo" />
      <span>ATHENIX</span>
    </Component>
  )
}