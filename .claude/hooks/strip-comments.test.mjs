import { describe, expect, it } from 'vitest'
import { stripComments } from './strip-comments.mjs'

describe('stripComments', () => {
  it('removes whole-line, trailing and block comments and keeps the code', () => {
    const text = '// header\nconst a = 1 // trailing\n/* block\n   two lines */\nexport const b = a + 1\n'
    expect(stripComments('src/x.ts', text).text).toBe('const a = 1\nexport const b = a + 1\n')
  })

  it('keeps tooling directives and comments marked @important', () => {
    const text = '// @ts-expect-error legacy\nconst a: number = "x"\n// @important kept\nconst b = 2\n'
    expect(stripComments('src/x.ts', text).text).toBe(text)
  })

  it('removes a JSX comment with its braces and leaves strings alone', () => {
    const text = 'export const view = <div>\n  {/* note */}\n  <span title="// not a comment" />\n</div>\n'
    expect(stripComments('src/x.tsx', text).text).toBe('export const view = <div>\n  <span title="// not a comment" />\n</div>\n')
  })

  it('keeps the braces of a block whose only content is a comment', () => {
    const text = 'try {\n  run()\n} catch {\n  // ignored\n}\n'
    expect(stripComments('src/x.ts', text).text).toBe('try {\n  run()\n} catch {\n}\n')
  })
})
