/* global console, process */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tauriDir = resolve(root, 'src-tauri')
const outputPath = resolve(tauriDir, 'target/llvm-cov/all.lcov')
const coreFiles = new Set(['src/scanner/book.rs', 'src/tags.rs'])

mkdirSync(dirname(outputPath), { recursive: true })

execFileSync('cargo', ['llvm-cov', '--lcov', '--output-path', outputPath], {
  cwd: tauriDir,
  stdio: 'inherit',
})

const lcov = readFileSync(outputPath, 'utf8').split('\n')
let currentFile = ''
let coveredLines = 0
let totalLines = 0
const discoveredFiles = new Set()
const uncovered = []

for (const line of lcov) {
  if (line.startsWith('SF:')) {
    const sourceFile = relative(tauriDir, line.slice(3)).replaceAll('\\', '/')
    currentFile = coreFiles.has(sourceFile) ? sourceFile : ''
    if (currentFile) discoveredFiles.add(currentFile)
    continue
  }

  if (!currentFile || !line.startsWith('DA:')) continue

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

const missingFiles = [...coreFiles].filter((file) => !discoveredFiles.has(file))
if (missingFiles.length > 0) {
  console.error(
    `Rust core coverage report is missing expected files: ${missingFiles.join(', ')}`,
  )
  process.exit(1)
}

if (totalLines === 0) {
  console.error('Rust core coverage report contains no executable lines.')
  process.exit(1)
}

if (uncovered.length > 0) {
  console.error('Rust core line coverage is below 100%. Uncovered lines:')
  for (const location of uncovered) console.error(`  ${location}`)
  process.exit(1)
}

console.log(
  `Rust core line coverage: 100% (${coveredLines}/${totalLines} executable lines across ${coreFiles.size} modules)`,
)
