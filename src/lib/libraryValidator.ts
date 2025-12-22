import { exists } from '@tauri-apps/plugin-fs'

export interface ValidationResult {
  isValid: boolean
  reason?: string
}

/**
 * Validate if a library path is accessible
 */
export async function validateLibraryPath(
  path: string,
): Promise<ValidationResult> {
  try {
    const pathExists = await exists(path)
    if (!pathExists) {
      return {
        isValid: false,
        reason: '路径不存在',
      }
    }
    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : '未知错误',
    }
  }
}

/**
 * Validate multiple libraries in batch
 */
export async function validateLibraries(
  libraries: { id: string; path: string }[],
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>()

  await Promise.all(
    libraries.map(async (lib) => {
      const result = await validateLibraryPath(lib.path)
      results.set(lib.id, result)
    }),
  )

  return results
}
