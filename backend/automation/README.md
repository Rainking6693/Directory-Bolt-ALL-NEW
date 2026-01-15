# Directory Submission Automation

Automated directory submission using **Playwright + Gemini Flash + NopeCHA** - 100% free stack.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SUBMISSION STACK                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Playwright │  │   Gemini    │  │    NopeCHA      │ │
│  │  (Browser)  │  │   Flash     │  │   (CAPTCHA)     │ │
│  │             │  │  (AI Form   │  │                 │ │
│  │             │  │   Mapping)  │  │                 │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│         │                │                │             │
│         └────────────────┴────────────────┘             │
│                          │                              │
│                    ┌─────▼─────┐                        │
│                    │ Supabase  │                        │
│                    │ (209 dirs)│                        │
│                    └───────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd backend/automation
pip install -r requirements.txt
playwright install chromium
```

### 2. Download NopeCHA Extension (Free CAPTCHA Solver)

1. Go to https://nopecha.com/
2. Download the Chrome extension (CRX file)
3. Extract to `./extensions/nopecha/`

```bash
mkdir -p extensions/nopecha
# Extract the CRX contents here
```

Alternatively, you can run without NopeCHA (CAPTCHAs won't be solved):
```bash
export NOPECHA_EXTENSION_PATH=""
```

### 3. Environment Variables

Make sure these are set in your `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key

# Optional
NOPECHA_EXTENSION_PATH=./extensions/nopecha
```

## Usage

### Test Run (5 Easy Directories)

```bash
python cron_runner.py test \
  --name "My Startup" \
  --url "https://mystartup.com" \
  --email "hello@mystartup.com" \
  --description "We build amazing AI tools for developers"
```

### Manual Run (Custom Options)

```bash
python cron_runner.py manual \
  --name "My Startup" \
  --url "https://mystartup.com" \
  --email "hello@mystartup.com" \
  --description "We build amazing AI tools for developers" \
  --limit 50 \
  --difficulty Easy \
  --parallel 3
```

### Cron Mode (Process Pending Jobs)

```bash
python cron_runner.py cron
```

This processes all jobs with `status='pending'` from the `jobs` table.

### Direct Python Usage

```python
import asyncio
from directory_submitter import DirectorySubmitter, BusinessData

async def main():
    business = BusinessData(
        name="My Startup",
        url="https://mystartup.com",
        email="hello@mystartup.com",
        description="We build amazing AI tools for developers",
        tagline="AI for devs",
        category="ai_tools"
    )

    submitter = DirectorySubmitter(
        supabase_url="...",
        supabase_key="...",
        gemini_api_key="...",
        parallel_workers=3
    )

    # Get all Easy directories
    directories = await submitter.get_directories(difficulty="Easy")

    # Submit!
    results = await submitter.run_submissions(business, directories)

    print(f"Success: {sum(1 for r in results if r.success)}/{len(results)}")

asyncio.run(main())
```

## How It Works

### 1. Form Analysis (Gemini Flash)
- Fetches the submission page HTML
- Uses Gemini to identify form fields and map them to your business data
- Returns CSS selectors for each field

### 2. Form Filling (Playwright)
- Fills each field using the Gemini-provided selectors
- Handles different input types (text, textarea, select, checkbox)
- Adds realistic delays between fields

### 3. CAPTCHA Solving (NopeCHA)
- Detects reCAPTCHA, hCAPTCHA, or Cloudflare
- NopeCHA extension auto-solves in the background
- Falls back gracefully if no CAPTCHA solver available

### 4. Submission & Verification
- Clicks submit button
- Takes screenshot of result
- Checks for success indicators in page text
- Records result to Supabase

## Directory Breakdown (209 Total)

| Type | Count | Handling |
|------|-------|----------|
| No CAPTCHA | 113 | Pure Playwright |
| reCAPTCHA v2 | 86 | Playwright + NopeCHA |
| reCAPTCHA v3 | 3 | Playwright + NopeCHA |
| Cloudflare | 2 | Playwright + NopeCHA |
| Unknown | 5 | Best effort |

| Difficulty | Count |
|------------|-------|
| Easy | 195 |
| Medium | 9 |
| Hard | 5 |

## Scheduling as Cron Job

### Linux/Mac (crontab)

```bash
# Run every day at 2 AM
0 2 * * * cd /path/to/backend/automation && python cron_runner.py cron >> /var/log/directory_submissions.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, etc.)
4. Action: Start a program
   - Program: `python`
   - Arguments: `cron_runner.py cron`
   - Start in: `C:\path\to\backend\automation`

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN playwright install chromium

COPY . .

CMD ["python", "cron_runner.py", "cron"]
```

## Troubleshooting

### "Gemini form analysis error"
- Check your `GEMINI_API_KEY` is valid
- You may have hit rate limits (15 RPM free tier)
- Try reducing `parallel_workers` to 1

### "NopeCHA extension not found"
- Download from https://nopecha.com
- Extract CRX to `./extensions/nopecha/`
- Set `NOPECHA_EXTENSION_PATH` env var

### "CAPTCHA solve timeout"
- NopeCHA may be slow or the CAPTCHA type is unsupported
- The script will continue and mark that directory as failed
- Consider running those manually later

### "No success confirmation found"
- The submission may have actually worked
- Check the screenshot in `./screenshots/`
- Some sites don't show clear success messages

## Cost Breakdown

| Service | Cost |
|---------|------|
| Playwright | Free (self-hosted) |
| Gemini Flash | Free (15 RPM, 1M tokens/day) |
| NopeCHA | Free (browser extension) |
| Supabase | Free tier (50K rows) |
| **Total** | **$0** |

## Files

```
backend/automation/
├── directory_submitter.py   # Main submission logic
├── cron_runner.py           # CLI and cron job runner
├── requirements.txt         # Python dependencies
├── README.md               # This file
├── extensions/
│   └── nopecha/            # NopeCHA extension files
└── screenshots/            # Submission screenshots
```
