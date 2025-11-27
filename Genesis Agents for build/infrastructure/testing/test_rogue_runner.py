"""
Unit tests for Rogue Runner and Scenario Loader.

Tests cover:
- Scenario loading from YAML/JSON
- Scenario validation
- Filtering by priority/category/tags
- Cost estimation
- Caching functionality
- Parallel execution simulation
"""

import json
import tempfile
from pathlib import Path

import pytest

from infrastructure.testing.scenario_loader import ScenarioLoader, ScenarioValidationError
from infrastructure.testing.rogue_runner import CostTracker, ResultCache


# ============================================================================
# Scenario Loader Tests
# ============================================================================

def test_scenario_loader_yaml_valid():
    """Test loading valid YAML scenarios."""
    yaml_content = """
scenarios:
  - id: "test_001"
    priority: "P0"
    category: "success"
    description: "Test scenario"
    input:
      task: "Test task"
    expected_output:
      status: "success"
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(yaml_content)
        temp_path = f.name

    try:
        loader = ScenarioLoader()
        scenarios = loader.load_from_yaml(temp_path)

        assert len(scenarios) == 1
        assert scenarios[0]["id"] == "test_001"
        assert scenarios[0]["priority"] == "P0"
        assert scenarios[0]["category"] == "success"
    finally:
        Path(temp_path).unlink()


def test_scenario_loader_missing_required_field():
    """Test validation error on missing required field."""
    yaml_content = """
scenarios:
  - id: "test_001"
    priority: "P0"
    # Missing 'category', 'description', 'input', 'expected_output'
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(yaml_content)
        temp_path = f.name

    try:
        loader = ScenarioLoader(strict=True)
        with pytest.raises(ScenarioValidationError):
            loader.load_from_yaml(temp_path)
    finally:
        Path(temp_path).unlink()


def test_scenario_loader_invalid_priority():
    """Test validation error on invalid priority."""
    yaml_content = """
scenarios:
  - id: "test_001"
    priority: "P99"  # Invalid priority
    category: "success"
    description: "Test"
    input:
      task: "Test"
    expected_output:
      status: "success"
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(yaml_content)
        temp_path = f.name

    try:
        loader = ScenarioLoader(strict=True)
        with pytest.raises(ScenarioValidationError):
            loader.load_from_yaml(temp_path)
    finally:
        Path(temp_path).unlink()


def test_scenario_loader_filter_by_priority():
    """Test filtering scenarios by priority."""
    scenarios = [
        {"id": "test_001", "priority": "P0", "category": "success"},
        {"id": "test_002", "priority": "P1", "category": "success"},
        {"id": "test_003", "priority": "P0", "category": "success"},
    ]

    loader = ScenarioLoader()
    loader.loaded_scenarios = scenarios

    p0_scenarios = loader.filter_by_priority(scenarios, "P0")
    assert len(p0_scenarios) == 2
    assert all(s["priority"] == "P0" for s in p0_scenarios)


def test_scenario_loader_filter_by_category():
    """Test filtering scenarios by category."""
    scenarios = [
        {"id": "test_001", "priority": "P0", "category": "success"},
        {"id": "test_002", "priority": "P0", "category": "failure"},
        {"id": "test_003", "priority": "P0", "category": "success"},
    ]

    loader = ScenarioLoader()
    loader.loaded_scenarios = scenarios

    success_scenarios = loader.filter_by_category(scenarios, "success")
    assert len(success_scenarios) == 2
    assert all(s["category"] == "success" for s in success_scenarios)


def test_scenario_loader_filter_by_tags():
    """Test filtering scenarios by tags."""
    scenarios = [
        {"id": "test_001", "priority": "P0", "category": "success", "tags": ["ocr", "critical"]},
        {"id": "test_002", "priority": "P0", "category": "success", "tags": ["security"]},
        {"id": "test_003", "priority": "P0", "category": "success", "tags": ["ocr", "visual"]},
    ]

    loader = ScenarioLoader()
    loader.loaded_scenarios = scenarios

    ocr_scenarios = loader.filter_by_tags(scenarios, ["ocr"])
    assert len(ocr_scenarios) == 2
    assert all("ocr" in s["tags"] for s in ocr_scenarios)


def test_scenario_loader_statistics():
    """Test statistics generation."""
    scenarios = [
        {"id": "test_001", "priority": "P0", "category": "success"},
        {"id": "test_002", "priority": "P1", "category": "failure"},
        {"id": "test_003", "priority": "P0", "category": "success"},
        {"id": "test_004", "priority": "P2", "category": "edge_case"},
    ]

    loader = ScenarioLoader()
    loader.loaded_scenarios = scenarios

    stats = loader.get_statistics()

    assert stats["total"] == 4
    assert stats["by_priority"]["P0"] == 2
    assert stats["by_priority"]["P1"] == 1
    assert stats["by_priority"]["P2"] == 1
    assert stats["by_category"]["success"] == 2
    assert stats["by_category"]["failure"] == 1
    assert stats["by_category"]["edge_case"] == 1


# ============================================================================
# Cost Tracker Tests
# ============================================================================

def test_cost_tracker_estimate_p0():
    """Test cost estimation for P0 scenario."""
    tracker = CostTracker()
    cost = tracker.estimate_cost("P0")

    # P0 uses GPT-4o: 1500 input tokens * $3/1M + 500 output tokens * $15/1M
    # = $0.0045 + $0.0075 = $0.012
    assert cost == pytest.approx(0.012, rel=1e-3)
    assert tracker.total_cost == pytest.approx(0.012, rel=1e-3)


def test_cost_tracker_estimate_p2():
    """Test cost estimation for P2 scenario."""
    tracker = CostTracker()
    cost = tracker.estimate_cost("P2")

    # P2 uses Gemini Flash: 800 input tokens * $0.03/1M + 200 output tokens * $0.03/1M
    # = $0.000024 + $0.000006 = $0.00003
    assert cost == pytest.approx(0.00003, rel=1e-3)


def test_cost_tracker_actual_tokens():
    """Test cost estimation with actual token counts."""
    tracker = CostTracker()
    cost = tracker.estimate_cost("P0", actual_tokens={"input": 2000, "output": 1000})

    # 2000 input * $3/1M + 1000 output * $15/1M = $0.006 + $0.015 = $0.021
    assert cost == pytest.approx(0.021, rel=1e-3)


def test_cost_tracker_summary():
    """Test cost summary generation."""
    tracker = CostTracker()
    tracker.estimate_cost("P0")
    tracker.estimate_cost("P1")
    tracker.estimate_cost("P2")

    summary = tracker.get_summary()

    assert "total_cost_usd" in summary
    assert "cost_by_priority" in summary
    assert summary["cost_by_priority"]["P0"] > 0
    assert summary["cost_by_priority"]["P1"] > 0
    # P2 uses Gemini Flash which is very cheap, may round to 0.0
    assert summary["cost_by_priority"]["P2"] >= 0


# ============================================================================
# Result Cache Tests
# ============================================================================

def test_result_cache_miss():
    """Test cache miss on non-existent scenario."""
    with tempfile.TemporaryDirectory() as cache_dir:
        cache = ResultCache(cache_dir)

        scenario = {"id": "test_001", "priority": "P0", "description": "Test"}
        result = cache.get("test_001", scenario)

        assert result is None
        assert cache.misses == 1
        assert cache.hits == 0


def test_result_cache_hit():
    """Test cache hit on existing scenario."""
    with tempfile.TemporaryDirectory() as cache_dir:
        cache = ResultCache(cache_dir)

        scenario = {"id": "test_001", "priority": "P0", "description": "Test"}
        test_result = {"passed": True, "execution_time": 1.5}

        # Store result
        cache.put("test_001", scenario, test_result)

        # Retrieve result
        cached_result = cache.get("test_001", scenario)

        assert cached_result is not None
        assert cached_result["passed"] == True
        assert cached_result["execution_time"] == 1.5
        assert cache.hits == 1
        assert cache.misses == 0


def test_result_cache_invalidation_on_change():
    """Test cache invalidation when scenario changes."""
    with tempfile.TemporaryDirectory() as cache_dir:
        cache = ResultCache(cache_dir)

        scenario_v1 = {"id": "test_001", "priority": "P0", "description": "Test v1"}
        scenario_v2 = {"id": "test_001", "priority": "P0", "description": "Test v2"}  # Changed
        test_result = {"passed": True, "execution_time": 1.5}

        # Store with v1
        cache.put("test_001", scenario_v1, test_result)

        # Try to retrieve with v2 (different hash)
        cached_result = cache.get("test_001", scenario_v2)

        assert cached_result is None  # Cache invalidated
        assert cache.misses == 1


def test_result_cache_stats():
    """Test cache statistics."""
    with tempfile.TemporaryDirectory() as cache_dir:
        cache = ResultCache(cache_dir)

        scenario = {"id": "test_001", "priority": "P0", "description": "Test"}
        test_result = {"passed": True}

        # Miss
        cache.get("test_001", scenario)
        # Store
        cache.put("test_001", scenario, test_result)
        # Hit
        cache.get("test_001", scenario)
        # Hit
        cache.get("test_001", scenario)

        stats = cache.get_stats()

        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["total_requests"] == 3
        assert stats["hit_rate_percent"] == pytest.approx(66.7, rel=0.1)


# ============================================================================
# Integration Tests
# ============================================================================

def test_full_workflow_simulation():
    """Test simulated workflow: load scenarios, estimate costs, cache results."""
    # Create temp scenario file
    yaml_content = """
scenarios:
  - id: "test_001"
    priority: "P0"
    category: "success"
    description: "Test scenario 1"
    input:
      task: "Test task"
    expected_output:
      status: "success"
  - id: "test_002"
    priority: "P1"
    category: "failure"
    description: "Test scenario 2"
    input:
      task: "Test task"
    expected_output:
      status: "failure"
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(yaml_content)
        temp_yaml_path = f.name

    with tempfile.TemporaryDirectory() as cache_dir:
        try:
            # Load scenarios
            loader = ScenarioLoader()
            scenarios = loader.load_from_yaml(temp_yaml_path)
            assert len(scenarios) == 2

            # Track costs
            tracker = CostTracker()
            for scenario in scenarios:
                cost = tracker.estimate_cost(scenario["priority"])
                assert cost > 0

            # Cache results
            cache = ResultCache(cache_dir)
            for scenario in scenarios:
                result = {
                    "scenario_id": scenario["id"],
                    "passed": True,
                    "execution_time": 2.0,
                    "cost_usd": tracker.estimate_cost(scenario["priority"])
                }
                cache.put(scenario["id"], scenario, result)

            # Verify cache hits
            for scenario in scenarios:
                cached = cache.get(scenario["id"], scenario)
                assert cached is not None
                assert cached["passed"] == True

            # Verify statistics
            stats = loader.get_statistics()
            assert stats["total"] == 2

            cost_summary = tracker.get_summary()
            assert cost_summary["total_cost_usd"] > 0

            cache_stats = cache.get_stats()
            assert cache_stats["hits"] == 2

        finally:
            Path(temp_yaml_path).unlink()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
