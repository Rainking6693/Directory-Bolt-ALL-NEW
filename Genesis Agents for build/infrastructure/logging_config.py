"""
Centralized Logging Configuration for Genesis Agent System
Provides structured, production-ready logging for all agents
"""

import logging
import logging.handlers
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# Create logs directory (relative path works anywhere)
LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True, parents=True)

class StructuredFormatter(logging.Formatter):
    """
    Structured JSON formatter for machine-readable logs
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add custom fields from extra
        if hasattr(record, 'agent_id'):
            log_data["agent_id"] = record.agent_id
        if hasattr(record, 'business_id'):
            log_data["business_id"] = record.business_id
        if hasattr(record, 'cost'):
            log_data["cost"] = record.cost
        if hasattr(record, 'intent_confidence'):
            log_data["intent_confidence"] = record.intent_confidence
        if hasattr(record, 'tool_name'):
            log_data["tool_name"] = record.tool_name

        return json.dumps(log_data)

def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Setup a logger with both file and console handlers

    Args:
        name: Logger name (usually __name__)
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid duplicate handlers
    if logger.handlers:
        return logger

    # Console Handler - Human readable
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)

    # File Handler - JSON structured logs
    log_file = LOGS_DIR / f"{name.replace('.', '_')}.log"

    disable_file_logs = os.getenv("GENESIS_DISABLE_FILE_LOGS") == "1"

    if not disable_file_logs:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())

    # Add handlers
    logger.addHandler(console_handler)
    if not disable_file_logs:
        logger.addHandler(file_handler)

    return logger

# Create root logger for the system
def get_logger(name: str) -> logging.Logger:
    """
    Get or create a logger for a module

    Args:
        name: Module name (use __name__)

    Returns:
        Logger instance

    Example:
        ```python
        from infrastructure.logging_config import get_logger

        logger = get_logger(__name__)
        logger.info("Agent initialized", extra={"agent_id": "spec_123"})
        logger.error("Failed to generate spec", exc_info=True)
        logger.info("Intent extracted", extra={"intent_confidence": 0.95, "tool_name": "extract_intent"})
        ```
    """
    return setup_logger(name)

# Convenience loggers for common components
genesis_logger = get_logger("genesis_agent")
infrastructure_logger = get_logger("infrastructure")
agent_logger = get_logger("agents")
a2a_logger = get_logger("a2a_service")
