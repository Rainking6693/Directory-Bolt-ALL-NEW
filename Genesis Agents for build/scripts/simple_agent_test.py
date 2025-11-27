"""
Simple Genesis Agent Test - Minimal Dependencies
Tests agents can actually run and respond
"""

import sys
import asyncio
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Fix Windows encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from infrastructure.load_env import load_genesis_env

# Load API keys
load_genesis_env()

async def test_simple_agent():
    """Test a simple agent call without complex infrastructure"""

    print("\n" + "="*60)
    print("🧪 SIMPLE GENESIS AGENT TEST")
    print("="*60 + "\n")

    # Test 1: Import agents
    print("Step 1: Testing agent imports...")
    try:
        from agents.analyst_agent import AnalystAgent
        from agents.builder_agent import BuilderAgent
        from agents.research_discovery_agent import ResearchDiscoveryAgent
        print("✅ All agents imported successfully\n")
    except Exception as e:
        print(f"❌ Import failed: {e}\n")
        return

    # Test 2: Initialize a simple agent
    print("Step 2: Initializing Analyst Agent...")
    try:
        analyst = AnalystAgent()
        print("✅ Analyst Agent initialized\n")
    except Exception as e:
        print(f"❌ Initialization failed: {e}\n")
        return

    # Test 3: Simple task - analyze a simple question
    print("Step 3: Testing agent with simple task...")
    print("Task: Analyze what database types are commonly used in web applications\n")

    try:
        # Use a simple method if available
        if hasattr(analyst, 'analyze_text'):
            result = await analyst.analyze_text(
                "What are the most common database types used in modern web applications? "
                "List PostgreSQL, MongoDB, MySQL and their typical use cases."
            )
        elif hasattr(analyst, 'analyze'):
            result = await analyst.analyze(
                task="database analysis",
                context="What are common database types in web apps?"
            )
        else:
            print("⚠️  Analyst agent doesn't have analyze_text or analyze methods")
            print("   Available methods:", [m for m in dir(analyst) if not m.startswith('_')])
            result = None

        if result:
            print("✅ Agent responded successfully!\n")
            print("Response:")
            print("-" * 60)
            print(result)
            print("-" * 60)
        else:
            print("⚠️  Agent initialized but couldn't complete task")

    except Exception as e:
        print(f"❌ Agent execution failed: {e}\n")
        import traceback
        traceback.print_exc()
        return

    print("\n" + "="*60)
    print("✅ TEST COMPLETE")
    print("="*60 + "\n")

if __name__ == "__main__":
    asyncio.run(test_simple_agent())
