const rawBasePath = import.meta.env.BASE_URL || '/'

const normalizedBasePath = (() => {
  const trimmed = rawBasePath.trim()
  if (!trimmed || trimmed === '/') return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash
})()

export function withBasePath(path: string): string {
  if (!path) return normalizedBasePath || '/'

  if (path.startsWith('/')) {
    return normalizedBasePath ? `${normalizedBasePath}${path}` : path
  }

  return normalizedBasePath
    ? `${normalizedBasePath}/${path}`
    : `/${path}`
}
