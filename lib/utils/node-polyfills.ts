// Node.js polyfills for browser APIs required by undici/supabase-js
// This addresses compatibility issues with Node.js 18+ and the undici library

// Ensure polyfills are only applied in Node.js server environment
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
  // Polyfill File constructor if it doesn't exist
  if (typeof globalThis.File === 'undefined') {
    class File extends Blob {
      name: string
      lastModified: number

      constructor(fileBits: BlobPart[], fileName: string, options: FilePropertyBag = {}) {
        super(fileBits, options)
        this.name = fileName
        this.lastModified = options.lastModified || Date.now()
      }
    }
    
    globalThis.File = File as any
  }

  // Polyfill Blob if it doesn't exist (though it usually does in modern Node.js)
  if (typeof globalThis.Blob === 'undefined') {
    class Blob {
      size: number
      type: string
      
      constructor(blobParts: BlobPart[] = [], options: BlobPropertyBag = {}) {
        this.size = 0
        this.type = options.type || ''
        
        // Calculate size from parts
        for (const part of blobParts) {
          if (typeof part === 'string') {
            this.size += Buffer.byteLength(part, 'utf8')
          } else if (part instanceof ArrayBuffer) {
            this.size += part.byteLength
          } else if (ArrayBuffer.isView(part)) {
            this.size += part.byteLength
          } else if (part instanceof Blob) {
            this.size += part.size
          }
        }
      }

      slice(start?: number, end?: number, contentType?: string): Blob {
        return new Blob([], { type: contentType })
      }

      stream(): ReadableStream {
        // Return a basic ReadableStream implementation
        return new ReadableStream({
          start(controller) {
            controller.close()
          }
        })
      }

      async text(): Promise<string> {
        return ''
      }

      async arrayBuffer(): Promise<ArrayBuffer> {
        return new ArrayBuffer(0)
      }
    }
    
    globalThis.Blob = Blob as any
  }

  // Polyfill FormData if needed (though it usually exists in modern Node.js)
  if (typeof globalThis.FormData === 'undefined') {
    class FormData {
      private data: Map<string, FormDataEntryValue[]> = new Map()

      append(name: string, value: FormDataEntryValue, fileName?: string): void {
        if (!this.data.has(name)) {
          this.data.set(name, [])
        }
        this.data.get(name)!.push(value)
      }

      delete(name: string): void {
        this.data.delete(name)
      }

      get(name: string): FormDataEntryValue | null {
        const values = this.data.get(name)
        return values ? values[0] : null
      }

      getAll(name: string): FormDataEntryValue[] {
        return this.data.get(name) || []
      }

      has(name: string): boolean {
        return this.data.has(name)
      }

      set(name: string, value: FormDataEntryValue, fileName?: string): void {
        this.data.set(name, [value])
      }

      forEach(callback: (value: FormDataEntryValue, key: string, parent: FormData) => void): void {
        for (const [key, values] of Array.from(this.data)) {
          for (const value of values) {
            callback(value, key, this)
          }
        }
      }

      *entries(): IterableIterator<[string, FormDataEntryValue]> {
        for (const [key, values] of Array.from(this.data)) {
          for (const value of values) {
            yield [key, value]
          }
        }
      }

      *keys(): IterableIterator<string> {
        for (const key of Array.from(this.data.keys())) {
          yield key
        }
      }

      *values(): IterableIterator<FormDataEntryValue> {
        for (const values of Array.from(this.data.values())) {
          for (const value of values) {
            yield value
          }
        }
      }

      [Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]> {
        return this.entries()
      }
    }
    
    globalThis.FormData = FormData as any
  }
}

// Types for TypeScript support
interface BlobPropertyBag {
  type?: string
  endings?: 'native' | 'transparent'
}

interface FilePropertyBag extends BlobPropertyBag {
  lastModified?: number
}

type BlobPart = BufferSource | Blob | string

type FormDataEntryValue = File | string

export {}