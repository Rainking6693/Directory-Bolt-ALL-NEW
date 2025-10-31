type BcryptjsModule = typeof import('../node_modules/@types/bcryptjs/index')
type JsonWebTokenModule = typeof import('../node_modules/@types/jsonwebtoken/index')

declare module 'bcryptjs' {
  const bcrypt: BcryptjsModule
  export = bcrypt
}

declare module 'jsonwebtoken' {
  const jsonwebtoken: JsonWebTokenModule
  export = jsonwebtoken
}

declare module 'formidable' {
  const formidable: any
  export default formidable
}

declare module 'validator';

declare module 'formidable' {
  interface File {
    filepath: string
    originalFilename?: string | null
    mimetype?: string | null
    size?: number
  }

  interface Fields {
    [key: string]: string | string[] | undefined
  }

  interface Files {
    [key: string]: File | File[] | undefined
  }

  interface Options {
    multiples?: boolean
    maxFileSize?: number
  }

  class IncomingForm {
    constructor(options?: Options)
    parse(
      req: import('http').IncomingMessage,
      callback: (err: Error | null, fields: Fields, files: Files) => void
    ): void
  }

  function formidable(options?: Options): IncomingForm

  export { File, Files, Fields, IncomingForm, Options }
  export default formidable
}

