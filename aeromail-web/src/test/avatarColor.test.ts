import { describe, it, expect } from 'vitest'
import { getAvatarColor } from '../utils/avatarColor'

describe('getAvatarColor', () => {
  it('returns the same color for the same input', () => {
    const color1 = getAvatarColor('Alice')
    const color2 = getAvatarColor('Alice')
    expect(color1).toBe(color2)
  })

  it('returns a valid hex color string', () => {
    const color = getAvatarColor('Bob')
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('returns valid hex for various inputs', () => {
    const names = ['Alice', 'Bob', 'Charlie', 'noreply@example.com', 'X', '']
    for (const name of names) {
      const color = getAvatarColor(name)
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('different inputs likely produce different colors', () => {
    // With 12 colors in the palette, these names should not all collide
    const colors = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'].map(getAvatarColor)
    const unique = new Set(colors)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('is deterministic across multiple calls', () => {
    const name = 'test@aeromail.com'
    const results = Array.from({ length: 5 }, () => getAvatarColor(name))
    expect(new Set(results).size).toBe(1)
  })
})
