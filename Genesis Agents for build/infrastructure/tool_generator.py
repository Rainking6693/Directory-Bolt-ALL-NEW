"""
Tool Generator: Agent-Augmented Tool Creation (AATC)
Dynamically generates custom tools for novel tasks using Claude Sonnet 4

Based on AATC concept from orchestration research:
- When no existing tool fits, generate custom tool
- Use Claude Sonnet 4 for code generation (72.7% SWE-bench accuracy)
- Safety validation before execution
- Test cases for verification
"""

import ast
import asyncio
import json
import logging
import re
import tempfile
import subprocess
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ToolSpec:
    """
    Specification for a custom tool

    Attributes:
        tool_name: Function name (e.g., "scrape_crypto_prices")
        description: What the tool does
        input_schema: Parameter types (e.g., {"url": "str", "timeout": "int"})
        output_schema: Return type (e.g., {"prices": "List[dict]"})
        implementation: Python code as string
        dependencies: Required pip packages (e.g., ["requests", "beautifulsoup4"])
        test_cases: List of test inputs/outputs for validation
    """
    tool_name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    implementation: str  # Python code
    dependencies: List[str] = field(default_factory=list)
    test_cases: List[Dict[str, Any]] = field(default_factory=list)


class ToolSafetyValidator:
    """
    Validates generated tools are safe to execute

    Security checks:
    - No eval/exec/compile
    - No subprocess/os.system
    - No raw file system access
    - No network calls without requests library
    - AST-based dangerous pattern detection
    """

    FORBIDDEN_PATTERNS = [
        'eval', 'exec', '__import__', 'compile',
        'subprocess', 'os.system', 'os.popen',
        'open(', 'file(',  # File system access
        'socket.', 'urllib.request.urlopen',  # Raw network
        '__builtins__', 'globals()', 'locals()',
        'rmtree', 'remove', 'unlink',  # Destructive ops
        'pickle.', 'shelve.',  # Serialization risks
    ]

    FORBIDDEN_AST_NODES = [
        'Import',  # We'll whitelist specific imports instead
    ]

    ALLOWED_IMPORTS = [
        'requests', 'json', 'datetime', 'time', 'typing',
        'dataclasses', 'collections', 'itertools', 'functools',
        'math', 'random', 're', 'urllib.parse',
        'beautifulsoup4', 'bs4', 'pandas', 'numpy',
    ]

    def is_safe(self, tool_spec: ToolSpec) -> bool:
        """
        Check if tool implementation is safe

        Returns:
            True if safe, False if dangerous patterns detected
        """
        code = tool_spec.implementation

        # Step 1: Pattern matching (fast check)
        code_lower = code.lower()
        for pattern in self.FORBIDDEN_PATTERNS:
            if pattern in code_lower:
                logger.warning(f"Tool '{tool_spec.tool_name}' contains forbidden pattern: {pattern}")
                return False

        # Step 2: AST analysis (structural check)
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            logger.error(f"Tool '{tool_spec.tool_name}' has syntax errors: {e}")
            return False

        # Check for dangerous function calls
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                    if func_name in ['eval', 'exec', 'compile', '__import__']:
                        logger.warning(f"Tool contains dangerous call: {func_name}")
                        return False

            # Check imports are whitelisted
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if not any(alias.name.startswith(allowed) for allowed in self.ALLOWED_IMPORTS):
                        logger.warning(f"Tool imports non-whitelisted module: {alias.name}")
                        return False

            if isinstance(node, ast.ImportFrom):
                module = node.module or ''
                if not any(module.startswith(allowed) for allowed in self.ALLOWED_IMPORTS):
                    logger.warning(f"Tool imports from non-whitelisted module: {module}")
                    return False

        logger.info(f"Tool '{tool_spec.tool_name}' passed safety validation")
        return True

    def sanitize_code(self, code: str) -> str:
        """
        Sanitize code by removing dangerous patterns

        This is a fallback - prefer rejection over sanitization
        """
        # Remove comments that might contain injection attempts
        lines = []
        for line in code.split('\n'):
            # Keep non-comment lines
            if not line.strip().startswith('#'):
                lines.append(line)

        return '\n'.join(lines)


class ToolGenerator:
    """
    Generate custom tools using LLM code generation

    Uses Claude Sonnet 4 for tool creation (best code generation model)
    Validates safety before returning tools
    Provides test case execution for verification
    """

    def __init__(self, llm_client=None):
        """
        Initialize tool generator

        Args:
            llm_client: LLM client for code generation (defaults to mock)
        """
        self.llm_client = llm_client
        self.safety_validator = ToolSafetyValidator()
        self.logger = logger

    async def generate_tool(
        self,
        task_description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> ToolSpec:
        """
        Generate a custom tool for a specific task

        Args:
            task_description: What the tool should do
            context: Additional context (e.g., existing tools, data formats)

        Returns:
            ToolSpec with implementation and tests

        Raises:
            SecurityError: If generated tool fails safety validation
            ValueError: If tool generation fails
        """
        self.logger.info(f"Generating tool for task: {task_description[:100]}")

        context = context or {}

        # Generate tool specification using LLM
        tool_spec = await self._llm_generate_tool(task_description, context)

        # Validate safety
        if not self.safety_validator.is_safe(tool_spec):
            raise SecurityError(
                f"Generated tool '{tool_spec.tool_name}' failed safety validation"
            )

        # Validate syntax
        try:
            ast.parse(tool_spec.implementation)
        except SyntaxError as e:
            raise ValueError(f"Generated tool has syntax errors: {e}")

        self.logger.info(f"Successfully generated tool: {tool_spec.tool_name}")
        return tool_spec

    async def _llm_generate_tool(
        self,
        task_description: str,
        context: Dict[str, Any]
    ) -> ToolSpec:
        """
        Use LLM to generate tool specification

        This method uses Claude Sonnet 4 for code generation
        Prompt engineering ensures safe, tested code
        """
        system_prompt = """You are an expert Python developer specializing in tool creation.

Your role is to generate production-quality Python functions that solve specific tasks.

RULES:
1. Generate a single, focused Python function
2. Include type hints and docstrings
3. Handle errors gracefully with try/except
4. Use only whitelisted packages: requests, json, datetime, time, typing, dataclasses, collections, itertools, functools, math, random, re, urllib.parse, beautifulsoup4, bs4, pandas, numpy
5. NO unsafe operations (eval, exec, system calls, raw file system access)
6. Include 3-5 test cases with realistic inputs
7. Output valid JSON

SECURITY CONSTRAINTS:
- NEVER use eval(), exec(), or compile()
- NEVER use subprocess or os.system
- NEVER access file system without validation
- ONLY use requests library for HTTP (no urllib.request.urlopen or socket)
- ONLY import whitelisted modules
- Validate all inputs
- Handle all exceptions

OUTPUT FORMAT (JSON):
{
  "tool_name": "function_name",
  "description": "Clear description of what the tool does",
  "input_schema": {"param1": "str", "param2": "int"},
  "output_schema": {"result": "dict"},
  "implementation": "def function_name(param1: str, param2: int) -> dict:\\n    \\"\\"\\"Docstring\\"\\"\\"\\n    ...",
  "dependencies": ["requests", "beautifulsoup4"],
  "test_cases": [
    {"input": {"param1": "test", "param2": 1}, "expected_output": {"result": {"status": "ok"}}}
  ]
}"""

        user_prompt = f"""Generate a Python tool for this task:

Task: {task_description}

Context: {json.dumps(context, indent=2) if context else "None"}

Requirements:
1. Function should be self-contained
2. Use only whitelisted imports
3. Include error handling
4. Provide 3-5 test cases
5. Follow security constraints strictly

Generate the tool specification as JSON."""

        # Use LLM client if available, otherwise use heuristic
        if self.llm_client:
            try:
                response = await self.llm_client.generate_structured_output(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_schema={
                        "tool_name": "string",
                        "description": "string",
                        "input_schema": {},
                        "output_schema": {},
                        "implementation": "string",
                        "dependencies": ["string"],
                        "test_cases": [{"input": {}, "expected_output": {}}]
                    },
                    temperature=0.2  # Low temperature for code generation
                )

                return ToolSpec(
                    tool_name=response["tool_name"],
                    description=response["description"],
                    input_schema=response["input_schema"],
                    output_schema=response["output_schema"],
                    implementation=response["implementation"],
                    dependencies=response.get("dependencies", []),
                    test_cases=response.get("test_cases", [])
                )
            except Exception as e:
                self.logger.error(f"LLM tool generation failed: {e}")
                # Fall through to heuristic

        # Fallback: Generate simple tool heuristically
        return self._generate_tool_heuristic(task_description, context)

    def _generate_tool_heuristic(
        self,
        task_description: str,
        context: Dict[str, Any]
    ) -> ToolSpec:
        """
        Generate simple tool without LLM (fallback)

        Creates basic HTTP fetch tool as example
        """
        self.logger.info("Using heuristic tool generation (LLM not available)")

        # Detect task type from description
        desc_lower = task_description.lower()

        if 'fetch' in desc_lower or 'scrape' in desc_lower or 'download' in desc_lower:
            # HTTP fetching tool
            tool_name = "fetch_url"
            description = "Fetch content from URL using requests"
            implementation = '''def fetch_url(url: str, timeout: int = 30) -> dict:
    """
    Fetch content from URL

    Args:
        url: URL to fetch
        timeout: Request timeout in seconds

    Returns:
        Dictionary with status, content, and headers
    """
    import requests
    from typing import Dict, Any

    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()

        return {
            "status": "success",
            "status_code": response.status_code,
            "content": response.text[:10000],  # Limit to 10KB
            "headers": dict(response.headers)
        }
    except requests.exceptions.RequestException as e:
        return {
            "status": "error",
            "error": str(e)
        }
'''
            input_schema = {"url": "str", "timeout": "int"}
            output_schema = {"status": "str", "content": "str"}
            dependencies = ["requests"]
            test_cases = [
                {
                    "input": {"url": "https://httpbin.org/json", "timeout": 10},
                    "expected_output": {"status": "success", "status_code": 200}
                }
            ]

        elif 'parse' in desc_lower or 'json' in desc_lower:
            # JSON parsing tool
            tool_name = "parse_json_data"
            description = "Parse JSON data with error handling"
            implementation = '''def parse_json_data(json_string: str) -> dict:
    """
    Parse JSON string into dict

    Args:
        json_string: JSON string to parse

    Returns:
        Parsed data or error dict
    """
    import json
    from typing import Dict, Any

    try:
        data = json.loads(json_string)
        return {
            "status": "success",
            "data": data
        }
    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "error": f"JSON parse error: {str(e)}"
        }
'''
            input_schema = {"json_string": "str"}
            output_schema = {"status": "str", "data": "Any"}
            dependencies = ["json"]
            test_cases = [
                {
                    "input": {"json_string": '{"key": "value"}'},
                    "expected_output": {"status": "success", "data": {"key": "value"}}
                }
            ]

        else:
            # Generic processing tool
            tool_name = "process_data"
            description = "Generic data processing tool"
            implementation = '''def process_data(input_data: str) -> dict:
    """
    Process input data

    Args:
        input_data: Data to process

    Returns:
        Processed result
    """
    return {
        "status": "success",
        "result": input_data,
        "length": len(input_data)
    }
'''
            input_schema = {"input_data": "str"}
            output_schema = {"status": "str", "result": "str"}
            dependencies = []
            test_cases = [
                {
                    "input": {"input_data": "test"},
                    "expected_output": {"status": "success", "length": 4}
                }
            ]

        return ToolSpec(
            tool_name=tool_name,
            description=description,
            input_schema=input_schema,
            output_schema=output_schema,
            implementation=implementation,
            dependencies=dependencies,
            test_cases=test_cases
        )

    async def validate_tool(self, tool_spec: ToolSpec) -> bool:
        """
        Validate tool works correctly by running test cases

        Args:
            tool_spec: Tool specification to validate

        Returns:
            True if all tests pass

        Raises:
            ValueError: If tool fails validation
        """
        self.logger.info(f"Validating tool: {tool_spec.tool_name}")

        # Step 1: Syntax validation
        try:
            ast.parse(tool_spec.implementation)
        except SyntaxError as e:
            raise ValueError(f"Tool has syntax errors: {e}")

        # Step 2: Safety validation
        if not self.safety_validator.is_safe(tool_spec):
            raise ValueError(f"Tool failed safety validation")

        # Step 3: Run test cases in sandbox
        if tool_spec.test_cases:
            test_results = await self._run_tests_sandboxed(tool_spec)

            failed_tests = [i for i, passed in enumerate(test_results) if not passed]
            if failed_tests:
                raise ValueError(
                    f"Tool failed {len(failed_tests)}/{len(test_results)} test cases: {failed_tests}"
                )

            self.logger.info(f"Tool passed {len(test_results)}/{len(test_results)} tests")

        return True

    async def _run_tests_sandboxed(self, tool_spec: ToolSpec) -> List[bool]:
        """
        Run test cases in sandboxed environment

        Uses temporary file + subprocess for isolation

        Args:
            tool_spec: Tool with test cases

        Returns:
            List of booleans (True = test passed)
        """
        results = []

        for i, test_case in enumerate(tool_spec.test_cases):
            try:
                # Create test script in temp file
                test_code = self._generate_test_script(tool_spec, test_case)

                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                    f.write(test_code)
                    test_file = f.name

                # Run test in subprocess (sandboxed)
                proc = await asyncio.create_subprocess_exec(
                    'python3', test_file,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                # Use asyncio.wait_for for timeout
                try:
                    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)
                except asyncio.TimeoutError:
                    proc.kill()
                    await proc.wait()
                    self.logger.error(f"Test {i+1} timed out after 10 seconds")
                    results.append(False)
                    Path(test_file).unlink(missing_ok=True)
                    continue

                # Test passes if return code is 0
                passed = (proc.returncode == 0)
                results.append(passed)

                if not passed:
                    self.logger.warning(
                        f"Test {i+1} failed for {tool_spec.tool_name}: {stderr.decode()}"
                    )

                # Clean up
                Path(test_file).unlink(missing_ok=True)

            except Exception as e:
                self.logger.error(f"Test {i+1} execution failed: {e}")
                results.append(False)

        return results

    def _generate_test_script(self, tool_spec: ToolSpec, test_case: Dict[str, Any]) -> str:
        """
        Generate standalone test script

        Returns:
            Python code that runs test and exits with 0 if pass
        """
        test_input = test_case.get("input", {})
        expected_output = test_case.get("expected_output", {})

        script = f'''
import sys
import json

# Tool implementation
{tool_spec.implementation}

# Test execution
try:
    # Run tool
    test_input = {json.dumps(test_input)}
    result = {tool_spec.tool_name}(**test_input)

    # Validate result
    expected = {json.dumps(expected_output)}

    # Check key fields match
    for key in expected:
        if key not in result:
            print(f"Missing key: {{key}}", file=sys.stderr)
            sys.exit(1)

        if result[key] != expected[key]:
            print(f"Mismatch on {{key}}: {{result[key]}} != {{expected[key]}}", file=sys.stderr)
            sys.exit(1)

    print("Test passed")
    sys.exit(0)

except Exception as e:
    print(f"Test failed: {{e}}", file=sys.stderr)
    sys.exit(1)
'''
        return script


class SecurityError(Exception):
    """Raised when tool fails security validation"""
    pass
