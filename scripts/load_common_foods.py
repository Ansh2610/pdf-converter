"""
Script to load common foods from USDA API into local database.

Usage:
    python scripts/load_common_foods.py

This will search for common food categories and save results to PostgreSQL.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from tqdm import tqdm

from src.db.postgres_client import db
from src.services.food_service import food_service

# Common food search terms to populate database
COMMON_FOODS = [
    # Proteins
    "chicken breast",
    "ground beef",
    "salmon",
    "tuna",
    "eggs",
    "turkey",
    "pork chop",
    "shrimp",
    "tofu",
    "greek yogurt",

    # Grains & Carbs
    "rice",
    "pasta",
    "bread",
    "oatmeal",
    "quinoa",
    "tortilla",
    "bagel",
    "cereal",

    # Fruits
    "apple",
    "banana",
    "orange",
    "strawberry",
    "blueberry",
    "grapes",
    "watermelon",
    "avocado",

    # Vegetables
    "broccoli",
    "spinach",
    "carrot",
    "tomato",
    "potato",
    "sweet potato",
    "onion",
    "bell pepper",
    "cucumber",
    "lettuce",

    # Dairy
    "milk",
    "cheese",
    "butter",
    "cream cheese",
    "cottage cheese",

    # Nuts & Seeds
    "almonds",
    "peanut butter",
    "walnuts",
    "cashews",

    # Common meals
    "pizza",
    "hamburger",
    "sandwich",
    "salad",
    "soup",
    "burrito",
    "sushi",

    # Beverages
    "coffee",
    "orange juice",
    "protein shake",

    # Snacks
    "chips",
    "crackers",
    "popcorn",
    "granola bar",
]


def main():
    """Load common foods into database."""
    print("Initializing database...")
    db.create_tables()

    total_added = 0

    print(f"\nSearching for {len(COMMON_FOODS)} food categories...")
    for term in tqdm(COMMON_FOODS, desc="Loading foods"):
        try:
            # Search USDA for this term
            results = food_service.search_usda(term, limit=25)

            # Save to local database
            added = food_service.bulk_save_from_usda(results)
            total_added += added

        except Exception as e:
            print(f"\nError loading '{term}': {e}")
            continue

    print(f"\nDone! Added {total_added} foods to database.")


if __name__ == "__main__":
    main()
