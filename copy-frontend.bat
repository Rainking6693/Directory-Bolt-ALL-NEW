@echo off
echo Copying frontend files from old DirectoryBolt to new repo...

set OLD_REPO=c:\Users\Ben\OneDrive\Documents\GitHub\DirectoryBolt
set NEW_REPO=c:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW

echo.
echo Copying pages...
xcopy "%OLD_REPO%\pages" "%NEW_REPO%\pages" /E /I /Y

echo.
echo Copying components...
xcopy "%OLD_REPO%\components" "%NEW_REPO%\components" /E /I /Y

echo.
echo Copying styles...
xcopy "%OLD_REPO%\styles" "%NEW_REPO%\styles" /E /I /Y

echo.
echo Copying public...
xcopy "%OLD_REPO%\public" "%NEW_REPO%\public" /E /I /Y

echo.
echo Copying lib...
xcopy "%OLD_REPO%\lib" "%NEW_REPO%\lib" /E /I /Y

echo.
echo Copying types...
xcopy "%OLD_REPO%\types" "%NEW_REPO%\types" /E /I /Y

echo.
echo Copying hooks...
xcopy "%OLD_REPO%\hooks" "%NEW_REPO%\hooks" /E /I /Y

echo.
echo Copying contexts...
xcopy "%OLD_REPO%\contexts" "%NEW_REPO%\contexts" /E /I /Y

echo.
echo Copying config files...
copy "%OLD_REPO%\package.json" "%NEW_REPO%\package.json" /Y
copy "%OLD_REPO%\package-lock.json" "%NEW_REPO%\package-lock.json" /Y
copy "%OLD_REPO%\tsconfig.json" "%NEW_REPO%\tsconfig.json" /Y
copy "%OLD_REPO%\next.config.js" "%NEW_REPO%\next.config.js" /Y
copy "%OLD_REPO%\tailwind.config.js" "%NEW_REPO%\tailwind.config.js" /Y
copy "%OLD_REPO%\postcss.config.js" "%NEW_REPO%\postcss.config.js" /Y
copy "%OLD_REPO%\.eslintrc.json" "%NEW_REPO%\.eslintrc.json" /Y
copy "%OLD_REPO%\next-env.d.ts" "%NEW_REPO%\next-env.d.ts" /Y

echo.
echo Copying Supabase migrations...
xcopy "%OLD_REPO%\supabase" "%NEW_REPO%\supabase" /E /I /Y

echo.
echo ✅ Frontend files copied successfully!
echo.
echo Next steps:
echo 1. cd "%NEW_REPO%"
echo 2. npm install
echo 3. Copy .env file and update with new backend URLs
echo 4. npm run dev
echo.
pause
