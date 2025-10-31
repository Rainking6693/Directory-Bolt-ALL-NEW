import type { NextApiRequest, NextApiResponse } from 'next'
import formidable, { type Fields, type Files, type File } from 'formidable'
import fs from 'fs'
import { supabaseServer } from '@/lib/supabaseServer'
import { getUserId } from '@/lib/auth'

export const config = {
  api: {
    bodyParser: false
  }
}

const BUCKET = process.env.SUPABASE_BUCKET_NAME || 'customer-documents'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

type ParsedForm = {
  fields: Fields
  files: Files
}

type FormidableFile = File

function parseForm(req: NextApiRequest): Promise<ParsedForm> {
  const form = formidable({
    multiples: false,
    maxFileSize: MAX_FILE_SIZE
  })

  return new Promise((resolve, reject) => {
    form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
      if (err) {
        reject(err)
        return
      }
      resolve({ fields, files })
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let tempFilePath: string | null = null

  try {
    const { fields, files } = await parseForm(req)
    const fileField = files.file as FormidableFile | FormidableFile[] | undefined
    const selectedFile = Array.isArray(fileField) ? fileField?.[0] : fileField
    const rawNotes = fields.notes
    const notesValue = Array.isArray(rawNotes) ? rawNotes[0] : rawNotes
    const notes =
      typeof notesValue === 'string' && notesValue.trim().length > 0 ? notesValue : null

    if (!selectedFile?.filepath || !selectedFile.originalFilename) {
      return res.status(400).json({ error: 'Missing file' })
    }

    if ((selectedFile.size ?? 0) > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File exceeds 50MB limit' })
    }

    tempFilePath = selectedFile.filepath
    const filePath = tempFilePath as string

    const userId = await getUserId(req)
    const prefix = userId ?? 'anon'
    const key = `${prefix}/${Date.now()}-${selectedFile.originalFilename}`
    const buffer = await fs.promises.readFile(filePath)
    const contentType = selectedFile.mimetype || 'application/octet-stream'

    const { error: uploadError } = await supabaseServer.storage
      .from(BUCKET)
      .upload(key, buffer, { contentType, upsert: false })

    if (uploadError) {
      return res.status(500).json({ error: 'Upload failed', details: uploadError.message })
    }

    const { data: submission, error: insertError } = await supabaseServer
      .from('directory_submissions')
      .insert({
        user_id: userId,
        file_path: key,
        file_name: selectedFile.originalFilename,
        mime_type: contentType,
        size_bytes: selectedFile.size ?? null,
        storage_bucket: BUCKET,
        notes
      })
      .select('*')
      .single()

    if (insertError) {
      await supabaseServer.storage.from(BUCKET).remove([key]).catch(() => {})
      return res.status(500).json({ error: 'DB insert failed', details: insertError.message })
    }

    await fs.promises.unlink(filePath).catch(() => {})
    tempFilePath = null

    return res.status(201).json({ submission })
  } catch (error: unknown) {
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {})
    }

    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({
      error: 'Server error',
      details: message
    })
  }
}
