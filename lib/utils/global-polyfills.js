// Global polyfill loader for Node.js 18+ compatibility
// This file should be imported at the very beginning of the application

// Only apply polyfills in Node.js environment
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
  
  // File API polyfill for undici compatibility
  if (typeof globalThis.File === 'undefined') {
    class File extends Blob {
      constructor(fileBits, fileName, options = {}) {
        super(fileBits, options)
        this.name = fileName
        this.lastModified = options.lastModified || Date.now()
      }
    }
    globalThis.File = File
  }

  // FormData polyfill if needed
  if (typeof globalThis.FormData === 'undefined') {
    class FormData {
      constructor() {
        this.data = new Map()
      }

      append(name, value, fileName) {
        if (!this.data.has(name)) {
          this.data.set(name, [])
        }
        this.data.get(name).push(value)
      }

      get(name) {
        const values = this.data.get(name)
        return values ? values[0] : null
      }

      getAll(name) {
        return this.data.get(name) || []
      }

      has(name) {
        return this.data.has(name)
      }

      set(name, value, fileName) {
        this.data.set(name, [value])
      }

      delete(name) {
        this.data.delete(name)
      }

      forEach(callback) {
        for (const [key, values] of Array.from(this.data)) {
          for (const value of values) {
            callback(value, key, this)
          }
        }
      }

      *entries() {
        for (const [key, values] of Array.from(this.data)) {
          for (const value of values) {
            yield [key, value]
          }
        }
      }

      *keys() {
        for (const key of Array.from(this.data.keys())) {
          yield key
        }
      }

      *values() {
        for (const values of Array.from(this.data.values())) {
          for (const value of values) {
            yield value
          }
        }
      }

      [Symbol.iterator]() {
        return this.entries()
      }
    }
    globalThis.FormData = FormData
  }

  // Headers polyfill for fetch compatibility
  if (typeof globalThis.Headers === 'undefined') {
    class Headers {
      constructor(init) {
        this.map = new Map()
        if (init) {
          if (Array.isArray(init)) {
            for (const [key, value] of init) {
              this.append(key, value)
            }
          } else if (typeof init === 'object') {
            for (const [key, value] of Object.entries(init)) {
              this.append(key, value)
            }
          }
        }
      }

      append(name, value) {
        name = name.toLowerCase()
        const existing = this.map.get(name)
        this.map.set(name, existing ? `${existing}, ${value}` : value)
      }

      delete(name) {
        this.map.delete(name.toLowerCase())
      }

      get(name) {
        return this.map.get(name.toLowerCase()) || null
      }

      has(name) {
        return this.map.has(name.toLowerCase())
      }

      set(name, value) {
        this.map.set(name.toLowerCase(), value)
      }

      *entries() {
        for (const [key, value] of Array.from(this.map)) {
          yield [key, value]
        }
      }

      *keys() {
        for (const key of Array.from(this.map.keys())) {
          yield key
        }
      }

      *values() {
        for (const value of Array.from(this.map.values())) {
          yield value
        }
      }

      [Symbol.iterator]() {
        return this.entries()
      }
    }
    globalThis.Headers = Headers
  }

  console.log('✅ Node.js polyfills loaded successfully for undici/Supabase compatibility')
}