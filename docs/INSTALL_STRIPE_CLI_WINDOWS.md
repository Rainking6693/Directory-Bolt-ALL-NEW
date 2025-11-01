# 🪟 Installing Stripe CLI on Windows

## Method 1: Manual Installation (Recommended - You Already Have It!)

Since you already have the extracted Stripe CLI files, here's how to install it:

### Step 1: Copy Stripe to a Permanent Location

```powershell
# Create a directory for Stripe CLI (or use existing)
New-Item -ItemType Directory -Force -Path "C:\Program Files\Stripe"

# Copy stripe.exe from your current location
Copy-Item "C:\Users\Ben\OneDrive\Desktop\6_Installers\stripe_1.32.0_windows_x86_64\stripe.exe" -Destination "C:\Program Files\Stripe\stripe.exe"
```

### Step 2: Add to PATH

```powershell
# Add to PATH (requires admin PowerShell)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Stripe", [EnvironmentVariableTarget]::Machine)
```

**OR manually:**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables"
3. Under "System variables", find "Path" and click "Edit"
4. Click "New" and add: `C:\Program Files\Stripe`
5. Click OK on all dialogs
6. **Restart PowerShell** for changes to take effect

### Step 3: Verify Installation

```powershell
# Close and reopen PowerShell, then:
stripe --version
```

Should show: `stripe version 1.32.0`

---

## Method 2: Use Scoop with Custom Bucket

If you prefer Scoop:

```powershell
# Add extras bucket (has Stripe CLI)
scoop bucket add extras

# Now install
scoop install stripe
```

---

## Method 3: Quick Install to User Directory (No Admin Needed)

If you got "registry access denied", install to your user directory instead:

```powershell
# Create directory in your user folder
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Stripe"

# Copy stripe.exe
Copy-Item "C:\Users\Ben\OneDrive\Desktop\6_Installers\stripe_1.32.0_windows_x86_64\stripe.exe" -Destination "$env:USERPROFILE\Stripe\stripe.exe"

# Add to user PATH (no admin needed)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:USERPROFILE\Stripe", [EnvironmentVariableTarget]::User)
```

Then **restart PowerShell** and test:
```powershell
stripe --version
```

---

## Quick Fix for Your Current Situation

**Easiest way right now:**

1. **Open PowerShell as Administrator:**
   - Right-click PowerShell
   - Select "Run as Administrator"

2. **Run these commands:**
   ```powershell
   # Copy to Program Files
   Copy-Item "C:\Users\Ben\OneDrive\Desktop\6_Installers\stripe_1.32.0_windows_x86_64\stripe.exe" -Destination "C:\Program Files\Stripe\stripe.exe"
   
   # Add to PATH
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Stripe", [EnvironmentVariableTarget]::Machine)
   ```

3. **Close and reopen PowerShell**, then test:
   ```powershell
   stripe --version
   ```

---

## Verify It Works

After installation, test:

```powershell
# Check version
stripe --version

# Login
stripe login

# Test webhook
stripe trigger checkout.session.completed
```

---

## Troubleshooting

### "stripe: command not found"
- Make sure PowerShell was restarted after adding to PATH
- Check PATH: `$env:Path -split ';' | Select-String Stripe`
- If not there, add manually via System Properties

### "Access denied" errors
- Run PowerShell as Administrator
- Or use Method 3 (user directory installation)

### Still not working?
Just use the full path:
```powershell
C:\Program Files\Stripe\stripe.exe --version
```

Or add an alias:
```powershell
Set-Alias stripe "C:\Program Files\Stripe\stripe.exe"
```

---

## Next Steps

Once installed:
1. `stripe login` - Connect to your Stripe account
2. `stripe trigger checkout.session.completed` - Test your webhook
3. `stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe` - Monitor webhooks

