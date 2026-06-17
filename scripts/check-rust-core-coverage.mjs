/* global console, process */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tauriDir = resolve(root, 'src-tauri')
const outputPath = resolve(tauriDir, 'target/llvm-cov/all.lcov')
const coverageTargets = new Map([
  ['src/config.rs', 90],
  ['src/scanner/book.rs', 100],
  ['src/scanner/comic.rs', 53],
  ['src/tags.rs', 100],
  ['src/thumbnail.rs', 60],
])

mkdirSync(dirname(outputPath), { recursive: true })

execFileSync('cargo', ['llvm-cov', '--lcov', '--output-path', outputPath], {
  cwd: tauriDir,
  stdio: 'inherit',
})

const lcov = readFileSync(outputPath, 'utf8').split('\n')
let currentFile = ''
const discoveredFiles = new Set()
const fileCoverage = new Map()

for (const line of lcov) {
  if (line.startsWith('SF:')) {
    const sourceFile = relative(tauriDir, line.slice(3)).replaceAll('\\', '/')
    currentFile = coverageTargets.has(sourceFile) ? sourceFile : ''
    if (currentFile) discoveredFiles.add(currentFile)
    continue
  }

  if (!currentFile || !line.startsWith('DA:')) continue

  const [lineNumber, count] = line
    .slice(3)
    .split(',')
    .map((value) => Number.parseInt(value, 10))

  if (!Number.isFinite(lineNumber) || !Number.isFinite(count)) continue

  const coverage = fileCoverage.get(currentFile) ?? {
    coveredLines: 0,
    totalLines: 0,
    uncovered: [],
  }
  coverage.totalLines += 1
  if (count > 0) coverage.coveredLines += 1
  else coverage.uncovered.push(lineNumber)
  fileCoverage.set(currentFile, coverage)
}

const missingFiles = [...coverageTargets.keys()].filter(
  (file) => !discoveredFiles.has(file),
)
if (missingFiles.length > 0) {
  console.error(
    `Rust core coverage report is missing expected files: ${missingFiles.join(', ')}`,
  )
  process.exit(1)
}

let failed = false
for (const [file, minimum] of coverageTargets) {
  const coverage = fileCoverage.get(file)
  if (!coverage || coverage.totalLines === 0) {
    console.error(`${file}: coverage report contains no executable lines.`)
    failed = true
    continue
  }

  const percentage = (coverage.coveredLines / coverage.totalLines) * 100
  console.log(
    `${file}: ${percentage.toFixed(2)}% line coverage (${coverage.coveredLines}/${coverage.totalLines}, minimum ${minimum}%)`,
  )

  if (percentage < minimum) {
    console.error(`${file}: line coverage is below the ${minimum}% minimum.`)
    if (minimum === 100) {
      for (const line of coverage.uncovered) console.error(`  ${file}:${line}`)
    }
    failed = true
  }
}

if (failed) process.exit(1)
