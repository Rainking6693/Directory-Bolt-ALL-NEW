/** @type {import('next').NextConfig} */
const path = require('path')

// Windows-safe watcher ignore: filter out problematic device names and root junk files
const isWindows = process.platform === 'win32'
const RESERVED_WIN_BASENAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

function shouldIgnore(p) {
  if (!p) return true // guard undefined/null from bubbling into path.relative
  try {
    const base = path.basename(p).toUpperCase()
    if (RESERVED_WIN_BASENAMES.has(base)) return true
    // Ignore root-level files that start with double-dash (e.g., "--date=iso")
    if (base.startsWith('--')) return true
    // Ignore common junk and heavy dirs
    if (p.includes(`${path.sep}.git${path.sep}`)) return true
    if (p.includes(`${path.sep}.next${path.sep}`)) return true
    if (p.includes(`${path.sep}node_modules${path.sep}`)) return true
    if (p.includes(`${path.sep}.cache${path.sep}`)) return true
    return false
  } catch {
    return true
  }
}

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Narrow the dev watcher to avoid Windows reserved filenames and repo junk
  webpack: (config, { dev }) => {
    if (dev) {
      const ignored = [
        '**/node_modules/**',
        '**/.next/**',
        '**/.git/**',
        '**/.cache/**',
        // Root junk like "--date=iso"
        '**/--*',
      ]
      if (isWindows) {
        ignored.push('**/NUL', '**/CON', '**/PRN', '**/AUX')
        ignored.push('**/COM[1-9]', '**/LPT[1-9]')
      }
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored,
        aggregateTimeout: 300,
        ...(process.env.NEXT_WP_POLL_INTERVAL
          ? { poll: Number(process.env.NEXT_WP_POLL_INTERVAL) || 1000 }
          : {}),
      }
    }
    return config
  },
}

module.exports = nextConfig
