"""Food recommendation engine."""

from typing import Optional
from collections import Counter

from src.db.postgres_client import db, Food, MealLog


class FoodRecommender:
    """Recommends foods based on user history and nutritional needs."""

    def __init__(self):
        pass

    def get_recommendations_for_macro(
        self,
        macro: str,
        target_amount: float,
        limit: int = 5
    ) -> list[Food]:
        """
        Get food recommendations to hit a specific macro target.

        Args:
            macro: 'protein', 'carbs', or 'fat'
            target_amount: Amount needed in grams
            limit: Max recommendations

        Returns:
            List of Food objects sorted by macro density
        """
        session = db.get_session()
        try:
            macro_column = {
                "protein": Food.protein_g,
                "carbs": Food.carbs_g,
                "fat": Food.fat_g
            }.get(macro)

            if not macro_column:
                return []

            # Get foods high in the target macro
            foods = (
                session.query(Food)
                .filter(macro_column >= 10)  # At least 10g per serving
                .order_by(macro_column.desc())
                .limit(limit)
                .all()
            )

            return foods
        finally:
            session.close()

    def get_similar_foods(self, food_id: int, limit: int = 5) -> list[Food]:
        """
        Get foods similar to a given food (by macro profile).

        Args:
            food_id: ID of reference food
            limit: Max recommendations

        Returns:
            List of similar Food objects
        """
        session = db.get_session()
        try:
            # Get reference food
            ref_food = session.query(Food).filter(Food.food_id == food_id).first()
            if not ref_food:
                return []

            # Find foods with similar macros (within 30% of each macro)
            tolerance = 0.3

            ref_protein = float(ref_food.protein_g or 0)
            ref_carbs = float(ref_food.carbs_g or 0)
            ref_fat = float(ref_food.fat_g or 0)

            foods = (
                session.query(Food)
                .filter(
                    Food.food_id != food_id,
                    Food.protein_g.between(
                        ref_protein * (1 - tolerance),
                        ref_protein * (1 + tolerance)
                    ),
                    Food.carbs_g.between(
                        ref_carbs * (1 - tolerance) if ref_carbs > 5 else 0,
                        ref_carbs * (1 + tolerance) if ref_carbs > 5 else 10
                    ),
                )
                .limit(limit)
                .all()
            )

            return foods
        finally:
            session.close()

    def get_user_favorites(self, user_id: int, limit: int = 5) -> list[Food]:
        """
        Get user's most logged foods.

        Args:
            user_id: User's ID
            limit: Max results

        Returns:
            List of frequently logged Food objects
        """
        session = db.get_session()
        try:
            # Count food occurrences in user's logs
            logs = (
                session.query(MealLog.food_id)
                .filter(MealLog.user_id == user_id)
                .all()
            )

            if not logs:
                return []

            food_counts = Counter([log.food_id for log in logs])
            top_food_ids = [food_id for food_id, _ in food_counts.most_common(limit)]

            foods = (
                session.query(Food)
                .filter(Food.food_id.in_(top_food_ids))
                .all()
            )

            # Sort by frequency
            foods.sort(key=lambda f: food_counts.get(f.food_id, 0), reverse=True)

            return foods
        finally:
            session.close()

    def get_meal_suggestions(
        self,
        user_id: int,
        meal_type: str,
        remaining_calories: float,
        remaining_protein: float
    ) -> list[dict]:
        """
        Get smart suggestions based on remaining daily budget.

        Args:
            user_id: User's ID
            meal_type: breakfast, lunch, dinner, or snack
            remaining_calories: Calories left for the day
            remaining_protein: Protein left for the day

        Returns:
            List of suggestion dicts with food and reasoning
        """
        suggestions = []
        session = db.get_session()

        try:
            # If low on protein, suggest high-protein foods
            if remaining_protein > 20:
                high_protein = (
                    session.query(Food)
                    .filter(Food.protein_g >= 15)
                    .order_by(Food.protein_g.desc())
                    .limit(3)
                    .all()
                )
                for food in high_protein:
                    suggestions.append({
                        "food": food,
                        "reason": f"High protein ({food.protein_g}g) to help hit your target"
                    })

            # If plenty of calories left, suggest filling options
            elif remaining_calories > 400:
                filling = (
                    session.query(Food)
                    .filter(Food.fiber_g >= 3)
                    .order_by(Food.calories.asc())
                    .limit(3)
                    .all()
                )
                for food in filling:
                    suggestions.append({
                        "food": food,
                        "reason": f"High fiber ({food.fiber_g}g) and filling"
                    })

            # If low on calories, suggest light options
            else:
                light = (
                    session.query(Food)
                    .filter(Food.calories <= remaining_calories)
                    .order_by(Food.protein_g.desc())
                    .limit(3)
                    .all()
                )
                for food in light:
                    suggestions.append({
                        "food": food,
                        "reason": f"Fits your remaining {remaining_calories:.0f} cal budget"
                    })

            return suggestions[:5]

        finally:
            session.close()


# Convenience instance
recommender = FoodRecommender()
