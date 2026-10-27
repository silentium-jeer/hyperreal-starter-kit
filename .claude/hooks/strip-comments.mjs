#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { commentTokens, isAllowedComment } from './lib/cleanCode.mjs'

const ts = createRequire(resolve(import.meta.dirname, '../../package.json'))('typescript-api')

function scriptKind(path) {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX
  if (/\.[cm]?ts$/i.test(path)) return ts.ScriptKind.TS
  return /\.jsx$/i.test(path) ? ts.ScriptKind.JSX : ts.ScriptKind.JS
}

function emptyJsxExpressions(source) {
  const found = []
  const visit = (node) => {
    if (ts.isJsxExpression(node) && !node.expression) found.push({ start: node.getStart(source), end: node.end })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function removalOf(text, token, jsxHolders) {
  const holder = jsxHolders.find((range) => range.start <= token.start && token.end <= range.end)
  let start = holder ? holder.start : token.start
  let end = holder ? holder.end : token.end
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const nextBreak = text.indexOf('\n', end)
  const lineEnd = nextBreak < 0 ? text.length : nextBreak + 1
  const alone = !text.slice(lineStart, start).trim() && !text.slice(end, nextBreak < 0 ? text.length : nextBreak).trim()
  if (alone) return { start: lineStart, end: lineEnd }
  while (start > lineStart && /[ \t]/.test(text[start - 1])) start -= 1
  return { start, end }
}

export function stripComments(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path))
  const jsxHolders = emptyJsxExpressions(source)
  const removals = commentTokens(ts, source, text)
    .filter((token) => !isAllowedComment(token.text))
    .map((token) => removalOf(text, token, jsxHolders))
    .sort((left, right) => right.start - left.start)
  let result = text
  let lowest = Infinity
  for (const removal of removals) {
    if (removal.end > lowest) continue
    result = result.slice(0, removal.start) + result.slice(removal.end)
    lowest = removal.start
  }
  return { text: result, removed: removals.length }
}

if (process.argv[1]?.endsWith('strip-comments.mjs')) {
  let total = 0
  for (const path of process.argv.slice(2)) {
    const before = readFileSync(path, 'utf8')
    const { text, removed } = stripComments(path, before)
    if (text !== before) writeFileSync(path, text)
    total += removed
    console.log(`${removed}\t${path}`)
  }
  console.log(`${total} comments removed`)
}
