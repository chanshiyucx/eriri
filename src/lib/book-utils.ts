import { readTextFile } from '@tauri-apps/plugin-fs'

export interface Chapter {
  title: string
  lineIndex: number
  charIndex: number
}

export interface BookContent {
  fullText: string
  lines: string[]
  lineStartOffsets: number[]
  chapters: Chapter[]
}

const CHAPTER_REGEX =
  /(?:^|\n)(第[0-9０-９一二三四五六七八九十百千]+[章回节卷集幕].*)/

export async function parseBook(path: string): Promise<BookContent> {
  try {
    const text = await readTextFile(path)
    const lines = text.split('\n')
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

    // If no chapters found, create a dummy one
    if (chapters.length === 0) {
      chapters.push({ title: '开始', lineIndex: 0, charIndex: 0 })
    }

    return {
      fullText: text,
      lines,
      lineStartOffsets,
      chapters,
    }
  } catch (error) {
    console.error('Failed to parse book:', error)
    throw error
  }
}
