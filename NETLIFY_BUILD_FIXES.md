# Netlify Build Fixes

**Date:** October 31, 2025  
**Status:** ✅ **FIXED - Build should now succeed**

---

## 🔧 Issues Fixed

### 1. ✅ TypeScript Type Error in conversion-tracker.ts

**Error:**
```
Type '{ event: string; count: number; }[]' is not assignable to type '{ event: ConversionEventType; count: number; }[]'
```

**Location:** `lib/services/conversion-tracker.ts:703-706`

**Root Cause:**
The map callback was incorrectly typed as `[string, number]` instead of `[ConversionEventType, number]`, causing TypeScript to infer the `event` property as `string` instead of `ConversionEventType`.

**Fix Applied:**
```typescript
// Before:
return Array.from(eventCounts.entries())
  .map(([event, count]: [string, number]) => ({event, count}))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10)

// After:
return Array.from(eventCounts.entries())
  .map(([event, count]: [ConversionEventType, number]) => ({event, count}))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10)
```

**Impact:** TypeScript now correctly infers the return type, satisfying the type checker.

---

### 2. ✅ Supabase Type Error in customer/documents.ts

**Error:**
```
Argument of type '{ user_id: string | null; file_path: string; ... }' is not assignable to parameter of type 'never'
```

**Location:** `pages/api/customer/documents.ts:81-93`

**Root Cause:**
The code was attempting to insert file upload metadata into the `directory_submissions` table, which is designed for tracking directory submissions, not file uploads. The table schema doesn't have the fields `user_id`, `file_path`, `file_name`, `mime_type`, `size_bytes`, `storage_bucket`, or `notes`.

**Fix Applied:**
Removed the database insert entirely since:
1. The file is already uploaded to Supabase Storage
2. No separate tracking table exists for customer document uploads
3. The storage bucket itself serves as the record of uploaded files

```typescript
// Before:
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

return res.status(201).json({ submission })

// After:
const { error: uploadError } = await supabaseServer.storage
  .from(BUCKET)
  .upload(key, buffer, { contentType, upsert: false })

if (uploadError) {
  return res.status(500).json({ error: 'Upload failed', details: uploadError.message })
}

// Clean up temp file
await fs.promises.unlink(filePath).catch(() => {})
tempFilePath = null

// Return upload success with file metadata
return res.status(201).json({ 
  success: true,
  file: {
    path: key,
    name: selectedFile.originalFilename,
    size: selectedFile.size,
    type: contentType,
    bucket: BUCKET,
    notes
  }
})
```

**Impact:** 
- Removes TypeScript error
- Simplifies code by removing unnecessary database operation
- File uploads still work correctly via Supabase Storage
- Response now includes file metadata for client-side tracking

---

## 📊 Verification

### TypeScript Check
```bash
npx tsc --noEmit --skipLibCheck
```
**Result:** ✅ No errors found

### Files Modified
1. `lib/services/conversion-tracker.ts` - Fixed type annotation (1 line)
2. `pages/api/customer/documents.ts` - Removed invalid database insert (simplified code)

---

## 🚀 Next Steps

1. **Commit and push changes:**
   ```bash
   git add lib/services/conversion-tracker.ts pages/api/customer/documents.ts
   git commit -m "fix: TypeScript build errors for Netlify deployment"
   git push origin main
   ```

2. **Netlify will automatically:**
   - Detect the new commit
   - Trigger a new build
   - Run `npm run build` (which includes TypeScript type checking)
   - Deploy if build succeeds

3. **Monitor the build:**
   - Check Netlify dashboard for build status
   - Verify no new TypeScript errors appear
   - Confirm deployment succeeds

---

## 📝 Notes

### Why the directory_submissions table wasn't suitable:

Looking at the actual schema from `types/supabase.ts`:
```typescript
directory_submissions: {
  Row: {
    created_at: string | null
    customer_id: string | null
    customer_job_id: string | null
    directory_category: string | null
    directory_tier: string | null
    directory_url: string
    error_message: string | null
    id: string
    listing_data: Json | null
    processing_time_seconds: number | null
    result_message: string | null
    status: string | null
    submission_queue_id: string | null
    updated_at: string | null
  }
}
```

This table is for tracking **directory submission jobs** (e.g., submitting a business to Yelp, Google My Business, etc.), not for tracking **uploaded files**.

### Future Enhancement (Optional):

If you need to track uploaded documents in the database, create a new table:

```sql
CREATE TABLE customer_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  storage_bucket TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

But for now, the file storage itself is sufficient.

---

## ✅ Summary

Both TypeScript errors that were blocking the Netlify build have been fixed:

1. **conversion-tracker.ts** - Corrected type annotation from `string` to `ConversionEventType`
2. **customer/documents.ts** - Removed invalid database insert, simplified to storage-only upload

The build should now succeed! 🎉

