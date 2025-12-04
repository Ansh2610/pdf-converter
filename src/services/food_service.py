"""Food data service - search, load, and manage foods."""

from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_

from src.db.postgres_client import db, Food
from src.api.usda_client import usda


class FoodService:
    """Handles food search, storage, and retrieval."""

    def search_local(
        self,
        query: str,
        limit: int = 20,
        session: Session = None
    ) -> list[Food]:
        """
        Search foods in local database.

        Args:
            query: Search term
            limit: Max results to return
            session: Optional existing session

        Returns:
            List of matching Food objects
        """
        close_session = session is None
        session = session or db.get_session()

        try:
            results = (
                session.query(Food)
                .filter(Food.name.ilike(f"%{query}%"))
                .limit(limit)
                .all()
            )
            return results
        finally:
            if close_session:
                session.close()

    def search_usda(self, query: str, limit: int = 20) -> list[dict]:
        """
        Search USDA API and return parsed results.

        Args:
            query: Search term
            limit: Max results

        Returns:
            List of food dicts with nutrients
        """
        response = usda.search_foods(query, page_size=limit)
        foods = []

        for item in response.get("foods", []):
            nutrients = usda.parse_nutrients(item)
            foods.append({
                "fdc_id": item.get("fdcId"),
                "name": item.get("description", "Unknown"),
                "brand": item.get("brandOwner"),
                "category": item.get("foodCategory"),
                "serving_size": 100,  # USDA values are per 100g
                "serving_unit": "g",
                **nutrients
            })

        return foods

    def get_by_id(self, food_id: int, session: Session = None) -> Optional[Food]:
        """Get food by local database ID."""
        close_session = session is None
        session = session or db.get_session()

        try:
            return session.query(Food).filter(Food.food_id == food_id).first()
        finally:
            if close_session:
                session.close()

    def get_by_fdc_id(self, fdc_id: int, session: Session = None) -> Optional[Food]:
        """Get food by USDA FDC ID."""
        close_session = session is None
        session = session or db.get_session()

        try:
            return session.query(Food).filter(Food.fdc_id == fdc_id).first()
        finally:
            if close_session:
                session.close()

    def save_from_usda(self, food_data: dict, session: Session = None) -> Food:
        """
        Save a food from USDA search results to local database.

        Args:
            food_data: Dict from search_usda()
            session: Optional existing session

        Returns:
            Created or existing Food object
        """
        close_session = session is None
        session = session or db.get_session()

        try:
            # Check if already exists
            existing = self.get_by_fdc_id(food_data["fdc_id"], session)
            if existing:
                return existing

            food = Food(
                fdc_id=food_data["fdc_id"],
                name=food_data["name"],
                brand=food_data.get("brand"),
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
            session.commit()
            session.refresh(food)
            return food
        except Exception:
            session.rollback()
            raise
        finally:
            if close_session:
                session.close()

    def bulk_save_from_usda(
        self,
        foods_data: list[dict],
        session: Session = None
    ) -> int:
        """
        Bulk save foods from USDA to local database.

        Args:
            foods_data: List of dicts from search_usda()
            session: Optional existing session

        Returns:
            Number of new foods added
        """
        close_session = session is None
        session = session or db.get_session()
        added = 0

        try:
            for food_data in foods_data:
                existing = self.get_by_fdc_id(food_data["fdc_id"], session)
                if existing:
                    continue

                food = Food(
                    fdc_id=food_data["fdc_id"],
                    name=food_data["name"],
                    brand=food_data.get("brand"),
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
            return added
        except Exception:
            session.rollback()
            raise
        finally:
            if close_session:
                session.close()


# Convenience instance
food_service = FoodService()
