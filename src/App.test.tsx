import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('zeigt einen Einrichtungshinweis ohne Supabase-Konfiguration', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Supabase ist noch nicht verbunden/ })).toBeInTheDocument()
  })
})
