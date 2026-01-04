import { readTextFile } from '@tauri-apps/plugin-fs'

export interface Chapter {
  title: string
  lineIndex: number
  charIndex: number
}

export interface BookContent {
  lines: string[]
  lineStartOffsets: number[]
  chapters: Chapter[]
  totalChars: number
}

const CHAPTER_REGEX =
  /(?:^|\n)(第[0-9０-９一二三四五六七八九十百千]+[章回节卷集幕].*)/

export async function parseBook(path: string): Promise<BookContent> {
  try {
    const text = await readTextFile(path)
    const lines = text.split('\n').filter((line) => line.trim() !== '')
    const chapters: Chapter[] = []
    const lineStartOffsets: number[] = []

    let charCount = 0
    lines.forEach((line, index) => {
      lineStartOffsets.push(charCount)
      const match = CHAPTER_REGEX.exec(line)
      if (match) {
        chapters.push({
          title: match[1].trim(),
          lineIndex: index,
          charIndex: charCount,
        })
      }
      charCount += line.length + 1 // +1 for newline
    })

    return {
      lines,
      lineStartOffsets,
      chapters,
      totalChars: charCount,
    }
  } catch (error) {
    console.error('Failed to parse book:', error)
    throw error
  }
}

export const findLineIndexByOffset = (
  offsets: number[],
  targetOffset: number,
) => {
  let low = 0
  let high = offsets.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const midOffset = offsets[mid]

    if (midOffset === targetOffset) return mid
    if (midOffset < targetOffset) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return Math.max(0, high)
}
