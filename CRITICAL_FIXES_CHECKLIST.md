# 🚨 Critical Fixes Checklist - DirectoryBolt

**STOP!** Do not deploy to production until all P0 items are fixed.

---

## ✅ P0 - Critical (Must Fix Immediately)

### 1. SQL Injection Vulnerability
**File:** `backend/db/dao.py`  
**Lines:** 176, 182  
**Severity:** 🔴 CRITICAL - Security Risk  
**Time:** 1 hour

**Current Code:**
```python
# Line 176
result = supabase.table("directories").select("*").ilike("name", f"%{sanitized_name}%").limit(1).execute()

# Line 182
result = supabase.table("directories").select("*").ilike("url", f"%{sanitized_name}%").limit(1).execute()
```

**Fixed Code:**
```python
# Escape LIKE wildcards to prevent injection
def escape_like_pattern(value: str) -> str:
    """Escape special characters in LIKE patterns."""
    return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')

# Line 176
escaped_name = escape_like_pattern(sanitized_name)
result = supabase.table("directories").select("*").ilike("name", f"%{escaped_name}%").limit(1).execute()

# Line 182
escaped_name = escape_like_pattern(sanitized_name)
result = supabase.table("directories").select("*").ilike("url", f"%{escaped_name}%").limit(1).execute()
```

**Testing:**
```python
# Test with malicious input
test_inputs = [
    "test%",           # Should match literally, not as wildcard
    "test_",           # Should match literally, not as wildcard
    "test'; DROP--",   # SQL injection attempt
    "../../../etc",    # Path traversal attempt
]
```

---

### 2. Hardcoded AWS Account ID
**File:** `backend/scripts/create_sqs_queues.py`  
**Line:** 107  
**Severity:** 🔴 CRITICAL - Breaks for Other Accounts  
**Time:** 30 minutes

**Current Code:**
```python
# Line 101-107
try:
    sts = boto3.client('sts', ...)
    account_id = sts.get_caller_identity()['Account']
except:
    # Fallback to region-based URL
    account_id = '231688741122'  # ❌ HARDCODED!
```

**Fixed Code:**
```python
try:
    sts = boto3.client('sts',
                     aws_access_key_id=aws_access_key if aws_access_key else None,
                     aws_secret_access_key=aws_secret_key if aws_secret_key else None)
    account_id = sts.get_caller_identity()['Account']
except Exception as e:
    logger.error(f"Cannot determine AWS account ID: {e}")
    logger.error("Please ensure AWS credentials are properly configured")
    raise ValueError(
        "AWS account ID required but not available. "
        "Ensure AWS credentials have sts:GetCallerIdentity permission."
    )
```

**Testing:**
```bash
# Test with different AWS accounts
export AWS_DEFAULT_ACCESS_KEY_ID="your-key"
export AWS_DEFAULT_SECRET_ACCESS_KEY="your-secret"
python backend/scripts/create_sqs_queues.py
```

---

### 3. Case-Sensitive Import Paths
**Files:** `backend/orchestration/flows.py`, `backend/orchestration/tasks.py`  
**Lines:** flows.py:23-25, tasks.py:32  
**Severity:** 🔴 CRITICAL - Linux/macOS Compatibility  
**Time:** 1 hour

**Current Code:**
```python
# flows.py line 23-25
from ai.probability_calculator import SuccessProbabilityCalculator
from ai.timing_optimizer import SubmissionTimingOptimizer
from ai.retry_analyzer import IntelligentRetryAnalyzer

# tasks.py line 32
from ai.description_customizer import DescriptionCustomizer
```

**Fixed Code:**
```python
# flows.py line 23-25
from AI.probability_calculator import SuccessProbabilityCalculator
from AI.timing_optimizer import SubmissionTimingOptimizer
from AI.retry_analyzer import IntelligentRetryAnalyzer

# tasks.py line 32
from AI.description_customizer import DescriptionCustomizer
```

**Testing:**
```bash
# Test on Linux/macOS
python -c "from AI.probability_calculator import SuccessProbabilityCalculator; print('OK')"
python -c "from AI.description_customizer import DescriptionCustomizer; print('OK')"

# Run flows to ensure imports work
cd backend
python -m orchestration.flows
```

---

## ⚠️ P1 - High Priority (Fix This Week)

### 4. Path Traversal in Screenshot Filenames
**File:** `backend/workers/submission_runner.py`  
**Line:** 290  
**Severity:** 🟠 HIGH - Security Risk  
**Time:** 1 hour

**Current Code:**
```python
screenshot_path = f"/tmp/screenshot_{job_id}_{directory}.png"
```

**Fixed Code:**
```python
import tempfile
import re

# Sanitize directory name to prevent path traversal
safe_directory = re.sub(r'[^a-zA-Z0-9_-]', '_', directory)
screenshot_path = os.path.join(
    tempfile.gettempdir(),
    f"screenshot_{job_id}_{safe_directory}.png"
)
```

---

### 5. Windows Path Compatibility
**File:** `backend/workers/submission_runner.py`  
**Line:** 290  
**Severity:** 🟠 HIGH - Windows Compatibility  
**Time:** Included in #4 above

**Testing:**
```python
# Test on Windows
import tempfile
print(tempfile.gettempdir())  # Should print C:\Users\...\AppData\Local\Temp
```

---

### 6. Missing API Key Validation
**Files:** All AI service files  
**Severity:** 🟠 HIGH - Runtime Failures  
**Time:** 2 hours

**Current Code:**
```python
# AI services initialize without checking if API key exists
self.anthropic = Anthropic(
    api_key=config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
)
```

**Fixed Code:**
```python
api_key = config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
if not api_key:
    logger.warning("Anthropic API key not found - service will be disabled")
    self.anthropic = None
    self.enabled = False
else:
    try:
        self.anthropic = Anthropic(api_key=api_key)
        # Test the API key with a simple call
        self.anthropic.messages.create(
            model="claude-3-sonnet-20241022",
            max_tokens=10,
            messages=[{"role": "user", "content": "test"}]
        )
        self.enabled = True
        logger.info("Anthropic API initialized successfully")
    except Exception as e:
        logger.error(f"Anthropic API initialization failed: {e}")
        self.anthropic = None
        self.enabled = False
```

---

### 7. Playwright Resource Leaks
**File:** `backend/workers/submission_runner.py`  
**Lines:** 364-390  
**Severity:** 🟠 HIGH - Memory Leaks  
**Time:** 2 hours

**Current Code:**
```python
finally:
    # Cleanup resources in reverse order
    try:
        if page:
            await page.close()
    except Exception as e:
        logger.warning(f"Failed to close page: {e}")
    # ... similar for context and browser
```

**Fixed Code:**
```python
finally:
    # Cleanup resources with individual error handling
    cleanup_errors = []
    
    # Close page
    if page:
        try:
            await page.close()
        except Exception as e:
            cleanup_errors.append(f"page: {e}")
            logger.warning(f"Failed to close page: {e}")
    
    # Close context
    if context:
        try:
            await context.close()
        except Exception as e:
            cleanup_errors.append(f"context: {e}")
            logger.warning(f"Failed to close context: {e}")
    
    # Close browser
    if browser:
        try:
            await browser.close()
        except Exception as e:
            cleanup_errors.append(f"browser: {e}")
            logger.warning(f"Failed to close browser: {e}")
    
    # Stop heartbeat
    if heartbeat_task and not heartbeat_task.done():
        heartbeat_task.cancel()
        try:
            await asyncio.wait_for(heartbeat_task, timeout=2.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass
        except Exception as e:
            cleanup_errors.append(f"heartbeat: {e}")
            logger.warning(f"Error cancelling heartbeat task: {e}")
    
    if cleanup_errors:
        logger.error(f"Cleanup completed with errors: {', '.join(cleanup_errors)}")
```

---

### 8. Async/Sync Mismatch
**File:** `backend/brain/client.py`  
**Line:** 32  
**Severity:** 🟠 HIGH - Performance Issue  
**Time:** 3 hours

**Current Code:**
```python
@retry_with_backoff(max_attempts=3, base_delay=1.0)
def get_plan(directory: str, business: Dict[str, Any]) -> Dict[str, Any]:
    # Synchronous function
    client = get_client()
    response = client.post(f"{BRAIN_URL}/plan", json=request_data)
```

**Fixed Code:**
```python
import httpx

# Create async client
_async_client: Optional[httpx.AsyncClient] = None

def get_async_client() -> httpx.AsyncClient:
    global _async_client
    if _async_client is None:
        _async_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
        )
    return _async_client

@retry_with_backoff(max_attempts=3, base_delay=1.0)
async def get_plan(directory: str, business: Dict[str, Any]) -> Dict[str, Any]:
    # Now async
    client = get_async_client()
    response = await client.post(f"{BRAIN_URL}/plan", json=request_data)
    response.raise_for_status()
    return response.json()
```

---

## 📋 Verification Checklist

After fixing all P0 issues, verify:

- [ ] SQL injection tests pass with malicious input
- [ ] Script works on different AWS accounts
- [ ] Imports work on Linux/macOS (test in Docker)
- [ ] Screenshots save to correct temp directory on Windows
- [ ] API keys are validated before use
- [ ] Playwright resources cleanup properly (check memory usage)
- [ ] Async functions properly await async calls
- [ ] All tests pass (create basic tests if none exist)

---

## 🧪 Testing Commands

```bash
# 1. Test imports on Linux
docker run -it --rm -v $(pwd):/app python:3.11 bash -c "cd /app/backend && python -c 'from AI.probability_calculator import SuccessProbabilityCalculator'"

# 2. Test SQL injection protection
cd backend
python -c "
from db.dao import get_directory_info
# Should not return all directories
result = get_directory_info('test%')
print(result)
"

# 3. Test AWS script without hardcoded account
cd backend/scripts
python create_sqs_queues.py

# 4. Test screenshot path on Windows
python -c "
import tempfile
import os
print(f'Temp dir: {tempfile.gettempdir()}')
print(f'Exists: {os.path.exists(tempfile.gettempdir())}')
"

# 5. Run basic flow test
cd backend
python -m pytest tests/ -v  # After creating tests
```

---

## 📞 Need Help?

- **SQL Injection:** Review OWASP SQL Injection Prevention Cheat Sheet
- **AWS Issues:** Check AWS credentials with `aws sts get-caller-identity`
- **Import Issues:** Verify package name matches directory: `ls -la backend/` should show `AI/` (uppercase)
- **Path Issues:** Use `pathlib.Path` for cross-platform compatibility

---

**Last Updated:** 2025-10-31  
**Priority:** 🔴 CRITICAL - Do not skip these fixes

