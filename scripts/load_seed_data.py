"""
Load seed food data into database (no API needed).

Usage:
    python scripts/load_seed_data.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db.postgres_client import db, Food


def main():
    """Load seed foods into database."""
    print("Initializing database...")
    db.create_tables()

    seed_file = Path(__file__).parent.parent / "data" / "seed" / "common_foods.json"

    with open(seed_file, "r") as f:
        foods_data = json.load(f)

    session = db.get_session()
    added = 0
    skipped = 0

    try:
        for food_data in foods_data:
            # Check if already exists
            existing = session.query(Food).filter(Food.fdc_id == food_data["fdc_id"]).first()
            if existing:
                skipped += 1
                continue

            food = Food(
                fdc_id=food_data["fdc_id"],
                name=food_data["name"],
                category=food_data.get("category"),
                serving_size=food_data.get("serving_size", 100),
                serving_unit=food_data.get("serving_unit", "g"),
                calories=food_data.get("calories", 0),
                protein_g=food_data.get("protein_g", 0),
                carbs_g=food_data.get("carbs_g", 0),
                fat_g=food_data.get("fat_g", 0),
                fiber_g=food_data.get("fiber_g", 0),
                sugar_g=food_data.get("sugar_g", 0),
                sodium_mg=food_data.get("sodium_mg", 0),
            )
            session.add(food)
            added += 1

        session.commit()
        print(f"Added {added} foods, skipped {skipped} existing")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
