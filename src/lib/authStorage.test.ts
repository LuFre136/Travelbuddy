import { beforeEach, describe, expect, it } from 'vitest'
import { authStorage, getRemember, setRemember } from './authStorage'

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('bleibt standardmäßig angemeldet', () => {
    expect(getRemember()).toBe(true)
    authStorage.setItem('sb-x-auth-token', 'token')
    expect(localStorage.getItem('sb-x-auth-token')).toBe('token')
  })

  it('speichert ohne „Angemeldet bleiben“ nur für diese Sitzung', () => {
    setRemember(false)
    authStorage.setItem('sb-x-auth-token', 'token')
    expect(localStorage.getItem('sb-x-auth-token')).toBeNull()
    expect(authStorage.getItem('sb-x-auth-token')).toBe('token')
  })

  it('zieht eine bestehende Sitzung beim Umschalten um', () => {
    setRemember(false)
    authStorage.setItem('sb-x-auth-token', 'token')
    setRemember(true)
    expect(localStorage.getItem('sb-x-auth-token')).toBe('token')
    expect(sessionStorage.getItem('sb-x-auth-token')).toBeNull()
    authStorage.removeItem('sb-x-auth-token')
    expect(authStorage.getItem('sb-x-auth-token')).toBeNull()
  })
})
