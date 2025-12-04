"""Utility functions for NutriScan."""

import os
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent


def load_config() -> dict:
    """Load configuration from config.yaml."""
    config_path = get_project_root() / "config" / "config.yaml"
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def get_env(key: str, default: str = None) -> str:
    """Get environment variable with optional default."""
    value = os.getenv(key, default)
    if value is None:
        raise ValueError(f"Environment variable {key} not set")
    return value
