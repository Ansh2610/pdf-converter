"""USDA FoodData Central API client with local caching."""

import json
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

import requests

from src.utils import get_env, load_config, get_project_root


class USDAClient:
    """Client for USDA FoodData Central API with local caching."""

    def __init__(self):
        self.api_key = get_env("USDA_API_KEY")
        self.config = load_config()["usda_api"]
        self.base_url = self.config["base_url"]
        self.cache_dir = get_project_root() / "data" / "usda_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, cache_key: str) -> Path:
        """Get cache file path for a given key."""
        hashed = hashlib.md5(cache_key.encode()).hexdigest()
        return self.cache_dir / f"{hashed}.json"

    def _get_cached(self, cache_key: str) -> Optional[dict]:
        """Retrieve cached response if valid."""
        cache_path = self._get_cache_path(cache_key)
        if not cache_path.exists():
            return None

        with open(cache_path, "r") as f:
            cached = json.load(f)

        # Check if cache is expired
        cached_at = datetime.fromisoformat(cached["cached_at"])
        ttl = timedelta(days=self.config["cache_ttl_days"])
        if datetime.now() - cached_at > ttl:
            return None

        return cached["data"]

    def _set_cache(self, cache_key: str, data: dict) -> None:
        """Store response in cache."""
        cache_path = self._get_cache_path(cache_key)
        with open(cache_path, "w") as f:
            json.dump({
                "cached_at": datetime.now().isoformat(),
                "data": data
            }, f)

    def search_foods(
        self,
        query: str,
        page_size: int = None,
        data_type: list[str] = None
    ) -> dict:
        """
        Search for foods by name.

        Args:
            query: Search term
            page_size: Number of results (default from config)
            data_type: Filter by type, e.g. ["Foundation", "SR Legacy"]

        Returns:
            API response with foods list
        """
        page_size = page_size or self.config["default_page_size"]
        cache_key = f"search:{query}:{page_size}:{data_type}"

        cached = self._get_cached(cache_key)
        if cached:
            return cached

        params = {
            "api_key": self.api_key,
            "query": query,
            "pageSize": page_size,
        }
        if data_type:
            params["dataType"] = data_type

        response = requests.post(
            f"{self.base_url}/foods/search",
            json=params
        )
        response.raise_for_status()
        data = response.json()

        self._set_cache(cache_key, data)
        return data

    def get_food(self, fdc_id: int) -> dict:
        """
        Get detailed food info by FDC ID.

        Args:
            fdc_id: USDA FoodData Central ID

        Returns:
            Detailed food data including nutrients
        """
        cache_key = f"food:{fdc_id}"

        cached = self._get_cached(cache_key)
        if cached:
            return cached

        response = requests.get(
            f"{self.base_url}/food/{fdc_id}",
            params={"api_key": self.api_key}
        )
        response.raise_for_status()
        data = response.json()

        self._set_cache(cache_key, data)
        return data

    def get_foods_batch(self, fdc_ids: list[int]) -> list[dict]:
        """
        Get multiple foods by their FDC IDs.

        Args:
            fdc_ids: List of USDA FoodData Central IDs

        Returns:
            List of food data
        """
        cache_key = f"batch:{sorted(fdc_ids)}"

        cached = self._get_cached(cache_key)
        if cached:
            return cached

        response = requests.post(
            f"{self.base_url}/foods",
            json={
                "fdcIds": fdc_ids,
            },
            params={"api_key": self.api_key}
        )
        response.raise_for_status()
        data = response.json()

        self._set_cache(cache_key, data)
        return data

    def parse_nutrients(self, food_data: dict) -> dict:
        """
        Extract key nutrients from USDA food response.

        Args:
            food_data: Raw API response for a food

        Returns:
            Dict with standardized nutrient values
        """
        # Nutrient IDs in USDA database
        NUTRIENT_IDS = {
            1008: "calories",      # Energy (kcal)
            1003: "protein_g",     # Protein
            1005: "carbs_g",       # Carbohydrates
            1004: "fat_g",         # Total fat
            1079: "fiber_g",       # Fiber
            2000: "sugar_g",       # Total sugars
            1093: "sodium_mg",     # Sodium
        }

        nutrients = {v: 0 for v in NUTRIENT_IDS.values()}

        food_nutrients = food_data.get("foodNutrients", [])
        for nutrient in food_nutrients:
            # Handle different response formats
            nutrient_id = nutrient.get("nutrientId") or nutrient.get("nutrient", {}).get("id")
            if nutrient_id in NUTRIENT_IDS:
                key = NUTRIENT_IDS[nutrient_id]
                nutrients[key] = nutrient.get("value") or nutrient.get("amount", 0)

        return nutrients


# Convenience instance
usda = USDAClient()
