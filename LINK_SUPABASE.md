# How to Link Your Project to Supabase

## Which Repository?
Run all commands in: **`Directory-Bolt-ALL-NEW`** (the main frontend repo)

## Prerequisites

You'll need:
1. **Supabase Project Reference** (found in Supabase Dashboard → Project Settings → General)
   - Looks like: `abcdefghijklmnop`
2. **Database Password** (if you don't remember it, you can reset it in Supabase Dashboard)

## Steps to Link

### Option 1: Interactive Link (Recommended)

1. **Navigate to the repo:**
   ```bash
   cd "C:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW"
   ```

2. **Run the link command:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   
   Replace `YOUR_PROJECT_REF` with your actual project reference.

3. **You'll be prompted for:**
   - Database password (enter your Supabase database password)
   - The CLI will save the connection automatically

### Option 2: Link with All Parameters

If you prefer to provide everything at once:

```bash
cd "C:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW"
supabase link --project-ref YOUR_PROJECT_REF --password YOUR_DB_PASSWORD
```

### Find Your Project Reference

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **General**
4. Look for **Reference ID** (looks like `abcdefghijklmnop`)

### Find Your Database Password

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Under **Connection string**, you can reset the password if needed

## After Linking

Once linked, you can:

1. **Generate TypeScript types:**
   ```bash
   supabase gen types typescript --linked > types/supabase-generated.ts
   ```

2. **Pull database changes:**
   ```bash
   supabase db pull
   ```

3. **Push local migrations:**
   ```bash
   supabase db push
   ```

## Verify Link

To check if you're linked:

```bash
supabase projects list
```

Or check the `.supabase/config.toml` file - it should have your project reference.

