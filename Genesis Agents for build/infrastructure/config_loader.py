"""
Configuration Loader with Environment Detection

Loads environment-specific configuration (dev, staging, production).
"""

import os
import yaml
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigLoader:
    """
    Loads configuration based on environment
    
    Environment detection order:
    1. GENESIS_ENV environment variable
    2. Default to 'dev' if not set
    """
    
    DEFAULT_ENV = "dev"
    CONFIG_DIR = Path("infrastructure/config")
    
    @staticmethod
    def detect_environment() -> str:
        """
        Detect current environment
        
        Returns:
            Environment name: 'dev', 'staging', or 'production'
        """
        env = os.getenv("GENESIS_ENV", ConfigLoader.DEFAULT_ENV).lower()
        
        # Validate environment
        valid_envs = ["dev", "development", "staging", "production", "prod"]
        if env not in valid_envs:
            logger.warning(f"Unknown environment '{env}', defaulting to '{ConfigLoader.DEFAULT_ENV}'")
            env = ConfigLoader.DEFAULT_ENV
        
        # Normalize aliases
        if env in ["development"]:
            env = "dev"
        elif env in ["prod"]:
            env = "production"
        
        return env
    
    @staticmethod
    def load(env: Optional[str] = None) -> Dict[str, Any]:
        """
        Load configuration for specified environment
        
        Args:
            env: Environment name (defaults to detected environment)
        
        Returns:
            Configuration dictionary
        
        Raises:
            FileNotFoundError: If config file doesn't exist
            yaml.YAMLError: If config file is invalid YAML
        """
        if env is None:
            env = ConfigLoader.detect_environment()
        
        config_path = ConfigLoader.CONFIG_DIR / f"{env}.yaml"
        
        if not config_path.exists():
            raise FileNotFoundError(
                f"Config file not found: {config_path}. "
                f"Available configs: {list(ConfigLoader.CONFIG_DIR.glob('*.yaml'))}"
            )
        
        with open(config_path) as f:
            config = yaml.safe_load(f) or {}
        
        # Expand environment variables
        config = ConfigLoader._expand_env_vars(config)
        
        logger.info(f"Loaded configuration from {config_path} (environment: {env})")
        
        return config
    
    @staticmethod
    def _expand_env_vars(config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively expand environment variables in config values
        
        Args:
            config: Configuration dictionary
        
        Returns:
            Configuration with expanded environment variables
        """
        if isinstance(config, dict):
            return {k: ConfigLoader._expand_env_vars(v) for k, v in config.items()}
        elif isinstance(config, list):
            return [ConfigLoader._expand_env_vars(item) for item in config]
        elif isinstance(config, str) and config.startswith("${") and config.endswith("}"):
            # Extract env var name
            env_var = config[2:-1]
            default_value = None
            
            # Check for default value: ${VAR:default}
            if ":" in env_var:
                env_var, default_value = env_var.split(":", 1)
            
            value = os.getenv(env_var, default_value)
            if value is None:
                logger.warning(f"Environment variable '{env_var}' not set, using None")
            return value
        else:
            return config
    
    @staticmethod
    def get(key: str, default: Any = None, env: Optional[str] = None) -> Any:
        """
        Get configuration value by key (supports dot notation)
        
        Args:
            key: Configuration key (e.g., "models.use_finetuned")
            default: Default value if key not found
            env: Environment name (defaults to detected environment)
        
        Returns:
            Configuration value or default
        """
        config = ConfigLoader.load(env)
        
        # Support dot notation
        keys = key.split(".")
        value = config
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default
        
        return value if value is not None else default
    
    @staticmethod
    def is_production() -> bool:
        """Check if running in production environment"""
        env = ConfigLoader.detect_environment()
        return env == "production"
    
    @staticmethod
    def is_staging() -> bool:
        """Check if running in staging environment"""
        env = ConfigLoader.detect_environment()
        return env == "staging"
    
    @staticmethod
    def is_development() -> bool:
        """Check if running in development environment"""
        env = ConfigLoader.detect_environment()
        return env == "dev"


# Convenience functions
def get_config(env: Optional[str] = None) -> Dict[str, Any]:
    """Get configuration for environment"""
    return ConfigLoader.load(env)


def get_config_value(key: str, default: Any = None, env: Optional[str] = None) -> Any:
    """Get configuration value by key"""
    return ConfigLoader.get(key, default, env)


def is_production() -> bool:
    """Check if running in production"""
    return ConfigLoader.is_production()


def is_staging() -> bool:
    """Check if running in staging"""
    return ConfigLoader.is_staging()


def is_development() -> bool:
    """Check if running in development"""
    return ConfigLoader.is_development()

