/* global console, process */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tauriDir = resolve(root, 'src-tauri')
const outputPath = resolve(tauriDir, 'target/llvm-cov/core.lcov')

mkdirSync(dirname(outputPath), { recursive: true })

const ignoreFilenameRegex =
  'src/(config|lib|main|server|tray|library|progress|thumbnail)\\.rs|src/scanner/(comic|utils)\\.rs'

execFileSync(
  'cargo',
  [
    'llvm-cov',
    '--lcov',
    '--ignore-filename-regex',
    ignoreFilenameRegex,
    '--output-path',
    outputPath,
  ],
  { cwd: tauriDir, stdio: 'inherit' },
)

const lcov = readFileSync(outputPath, 'utf8').split('\n')
let currentFile = ''
let coveredLines = 0
let totalLines = 0
const uncovered = []

for (const line of lcov) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3)
    continue
  }

  if (!line.startsWith('DA:')) continue

  const [lineNumber, count] = line
    .slice(3)
    .split(',')
    .map((value) => Number.parseInt(value, 10))

  if (!Number.isFinite(lineNumber) || !Number.isFinite(count)) continue

  totalLines += 1
  if (count > 0) {
    coveredLines += 1
  } else {
    uncovered.push(`${currentFile}:${lineNumber}`)
  }
}

if (uncovered.length > 0) {
  console.error('Rust core line coverage is below 100%. Uncovered lines:')
  for (const location of uncovered) console.error(`  ${location}`)
  process.exit(1)
}

console.log(
  `Rust core line coverage: 100% (${coveredLines}/${totalLines} executable lines)`,
)
