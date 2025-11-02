# How to Unlink OneDrive (since iCloud is running)

## Quick Steps:

1. **Right-click the OneDrive icon** in your system tray (bottom right corner, near the clock)
2. Click **Settings** (gear icon)
3. Go to the **Account** tab
4. Click **Unlink this PC**
5. Click **Unlink account** when prompted

This will **STOP syncing** OneDrive to your computer but **won't delete files** from the cloud.

## Alternative (if you can't find the icon):

Run this in PowerShell:
```powershell
& "C:\Program Files\Microsoft OneDrive\OneDrive.exe" /shutdown
```

**EASIEST METHOD: Use Run Dialog**
1. Press **Windows Key + R**
2. Type: `%localappdata%\Microsoft\OneDrive\OneDrive.exe`
3. Press Enter (OneDrive will open)
4. Look for the **gear icon** in the OneDrive window
5. Click it → **Settings** → **Account** tab
6. Click **Unlink this PC**

**ALTERNATIVE: Windows Settings**
1. Press **Windows Key + I** (opens Settings)
2. Go to **Accounts** → **Windows backup**
3. Turn off **OneDrive** syncing

## After Unlinking:

- Your files in OneDrive cloud are safe
- Local OneDrive folder will remain but won't sync
- You can delete the local OneDrive folder if you want to free up space
- iCloud will continue to sync normally

