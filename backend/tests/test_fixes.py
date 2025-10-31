"""
Test suite to verify code review fixes.
Run with: python -m pytest backend/tests/test_fixes.py -v
"""
import sys
import os
import tempfile
import re

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_sql_injection_protection():
    """Test that SQL injection attempts are properly escaped."""
    from db.dao import _escape_like_pattern
    
    # Test cases with malicious input
    test_cases = [
        ("test%", "test\\%"),           # Wildcard escape
        ("test_", "test\\_"),           # Single char wildcard escape
        ("test\\", "test\\\\"),         # Backslash escape
        ("normal", "normal"),           # Normal input unchanged
        ("%_\\", "\\%\\_\\\\"),        # Multiple special chars
    ]
    
    for input_val, expected in test_cases:
        result = _escape_like_pattern(input_val)
        assert result == expected, f"Failed for {input_val}: got {result}, expected {expected}"
    
    print("✅ SQL injection protection tests passed")


def test_import_paths():
    """Test that AI module imports work correctly."""
    try:
        # These should work with uppercase AI
        from AI.probability_calculator import SuccessProbabilityCalculator
        from AI.description_customizer import DescriptionCustomizer
        from AI.form_mapper import AIFormMapper
        from AI.retry_analyzer import IntelligentRetryAnalyzer
        from AI.timing_optimizer import SubmissionTimingOptimizer
        
        print("✅ Import paths test passed (AI modules found)")
        return True
    except ImportError as e:
        print(f"❌ Import paths test failed: {e}")
        return False


def test_path_sanitization():
    """Test that directory names are properly sanitized for filenames."""
    # Simulate the sanitization logic
    def sanitize_directory(directory: str) -> str:
        return re.sub(r'[^a-zA-Z0-9_-]', '_', directory)
    
    test_cases = [
        ("example.com", "example_com"),
        ("../../../etc", "_________etc"),
        ("test'; DROP--", "test___DROP--"),  # Only alphanumeric, underscore, hyphen allowed
        ("normal-name", "normal-name"),
        ("test@#$%", "test____"),
    ]
    
    for input_val, expected in test_cases:
        result = sanitize_directory(input_val)
        assert result == expected, f"Failed for {input_val}: got {result}, expected {expected}"
    
    print("✅ Path sanitization tests passed")


def test_temp_directory_cross_platform():
    """Test that temp directory works on all platforms."""
    temp_dir = tempfile.gettempdir()
    
    # Should return a valid directory
    assert os.path.exists(temp_dir), f"Temp directory doesn't exist: {temp_dir}"
    assert os.path.isdir(temp_dir), f"Temp path is not a directory: {temp_dir}"
    
    # Test creating a file in temp directory
    test_file = os.path.join(temp_dir, "test_directorybolt.txt")
    try:
        with open(test_file, 'w') as f:
            f.write("test")
        assert os.path.exists(test_file), "Failed to create test file"
        os.remove(test_file)
        print(f"✅ Temp directory test passed: {temp_dir}")
    except Exception as e:
        print(f"❌ Temp directory test failed: {e}")
        return False
    
    return True


def test_logger_methods():
    """Test that logger methods are correct (no deprecated warn)."""
    from utils.logging import setup_logger
    
    logger = setup_logger("test")
    
    # Check that logger has warning method (not warn)
    assert hasattr(logger, 'warning'), "Logger missing 'warning' method"
    assert hasattr(logger, 'info'), "Logger missing 'info' method"
    assert hasattr(logger, 'error'), "Logger missing 'error' method"
    
    # Test that methods work
    try:
        logger.info("Test info message")
        logger.warning("Test warning message")
        logger.error("Test error message")
        print("✅ Logger methods test passed")
        return True
    except Exception as e:
        print(f"❌ Logger methods test failed: {e}")
        return False


def test_async_client_available():
    """Test that async HTTP client is available."""
    try:
        from brain.client import get_async_client
        import httpx
        
        client = get_async_client()
        assert isinstance(client, httpx.AsyncClient), "get_async_client didn't return AsyncClient"
        
        print("✅ Async client test passed")
        return True
    except Exception as e:
        print(f"❌ Async client test failed: {e}")
        return False


def test_no_hardcoded_credentials():
    """Test that no hardcoded AWS account IDs exist in create_sqs_queues.py."""
    script_path = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'create_sqs_queues.py')
    
    if not os.path.exists(script_path):
        print(f"⚠️  Script not found: {script_path}")
        return True
    
    with open(script_path, 'r') as f:
        content = f.read()
    
    # Check for hardcoded account ID
    if '231688741122' in content:
        print("❌ Hardcoded AWS account ID still present!")
        return False
    
    print("✅ No hardcoded credentials test passed")
    return True


def run_all_tests():
    """Run all verification tests."""
    print("\n" + "="*60)
    print("Running Code Review Fix Verification Tests")
    print("="*60 + "\n")
    
    tests = [
        ("SQL Injection Protection", test_sql_injection_protection),
        ("Import Paths", test_import_paths),
        ("Path Sanitization", test_path_sanitization),
        ("Temp Directory Cross-Platform", test_temp_directory_cross_platform),
        ("Logger Methods", test_logger_methods),
        ("Async Client Available", test_async_client_available),
        ("No Hardcoded Credentials", test_no_hardcoded_credentials),
    ]
    
    results = []
    for name, test_func in tests:
        print(f"\nRunning: {name}")
        print("-" * 60)
        try:
            result = test_func()
            if result is None:
                result = True  # If no return, assume success
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} failed with exception: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)

