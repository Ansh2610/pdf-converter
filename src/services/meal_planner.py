"""Meal plan optimizer - generates daily/weekly meal plans."""

from typing import Optional
import random

from src.db.postgres_client import db, Food


class MealPlanner:
    """Generates optimized meal plans based on nutritional targets."""

    # Meal type calorie distribution
    MEAL_DISTRIBUTION = {
        "breakfast": 0.25,
        "lunch": 0.30,
        "dinner": 0.30,
        "snack": 0.15
    }

    # Food categories suitable for each meal
    MEAL_CATEGORIES = {
        "breakfast": ["Grains", "Dairy", "Eggs", "Fruits"],
        "lunch": ["Poultry", "Fish", "Grains", "Vegetables", "Protein"],
        "dinner": ["Poultry", "Fish", "Beef", "Vegetables", "Grains", "Protein"],
        "snack": ["Fruits", "Nuts", "Dairy", "Snacks"]
    }

    def __init__(self):
        self.session = None

    def _get_foods_for_meal(
        self,
        meal_type: str,
        vegetarian: bool = False,
        high_protein: bool = False
    ) -> list[Food]:
        """Get suitable foods for a meal type."""
        session = db.get_session()
        try:
            categories = self.MEAL_CATEGORIES.get(meal_type, [])

            query = session.query(Food)

            if categories:
                query = query.filter(Food.category.in_(categories))

            if vegetarian:
                # Exclude meat categories
                query = query.filter(~Food.category.in_(["Poultry", "Fish", "Beef"]))

            if high_protein:
                query = query.filter(Food.protein_g >= 10)

            foods = query.all()
            return foods
        finally:
            session.close()

    def _select_foods_for_target(
        self,
        foods: list[Food],
        calorie_target: float,
        protein_target: float,
        num_items: int = 2
    ) -> list[dict]:
        """Select foods to meet calorie/protein targets."""
        if not foods:
            return []

        selected = []
        remaining_cals = calorie_target
        remaining_protein = protein_target

        # Shuffle for variety
        foods_copy = foods.copy()
        random.shuffle(foods_copy)

        # Prioritize high-protein foods if needed
        if protein_target > 0:
            foods_copy.sort(key=lambda f: float(f.protein_g or 0), reverse=True)

        for food in foods_copy[:num_items * 2]:  # Consider more options
            if len(selected) >= num_items:
                break

            if remaining_cals <= 0:
                break

            # Calculate servings to fit remaining calories
            cals_per_serving = float(food.calories or 0)
            if cals_per_serving <= 0:
                continue

            # Target servings based on remaining calories
            ideal_servings = remaining_cals / cals_per_serving
            servings = min(max(0.5, ideal_servings), 2.0)  # Clamp between 0.5 and 2
            servings = round(servings * 2) / 2  # Round to nearest 0.5

            item_cals = cals_per_serving * servings
            item_protein = float(food.protein_g or 0) * servings
            item_carbs = float(food.carbs_g or 0) * servings
            item_fat = float(food.fat_g or 0) * servings

            selected.append({
                "food_id": food.food_id,
                "name": food.name,
                "servings": servings,
                "calories": item_cals,
                "protein": item_protein,
                "carbs": item_carbs,
                "fat": item_fat
            })

            remaining_cals -= item_cals
            remaining_protein -= item_protein

        return selected

    def generate_day_plan(
        self,
        calorie_target: int = 2000,
        protein_target: int = 150,
        carb_target: int = 200,
        fat_target: int = 65,
        vegetarian: bool = False,
        high_protein: bool = False
    ) -> Optional[dict]:
        """
        Generate a single day meal plan.

        Returns dict with meals list, each containing foods and totals.
        """
        meals = []

        for meal_type, cal_fraction in self.MEAL_DISTRIBUTION.items():
            meal_cal_target = calorie_target * cal_fraction
            meal_protein_target = protein_target * cal_fraction

            # Get suitable foods
            foods = self._get_foods_for_meal(meal_type, vegetarian, high_protein)

            if not foods:
                # Fallback: get any foods
                session = db.get_session()
                try:
                    foods = session.query(Food).limit(20).all()
                finally:
                    session.close()

            # Select foods for this meal
            num_items = 2 if meal_type == "snack" else 3
            selected_foods = self._select_foods_for_target(
                foods,
                meal_cal_target,
                meal_protein_target,
                num_items=num_items
            )

            if selected_foods:
                meal_cals = sum(f["calories"] for f in selected_foods)
                meal_protein = sum(f["protein"] for f in selected_foods)
                meal_carbs = sum(f["carbs"] for f in selected_foods)
                meal_fat = sum(f["fat"] for f in selected_foods)

                meals.append({
                    "meal_type": meal_type,
                    "foods": selected_foods,
                    "calories": meal_cals,
                    "protein": meal_protein,
                    "carbs": meal_carbs,
                    "fat": meal_fat
                })

        if not meals:
            return None

        return {
            "meals": meals,
            "targets": {
                "calories": calorie_target,
                "protein": protein_target,
                "carbs": carb_target,
                "fat": fat_target
            }
        }

    def generate_week_plan(
        self,
        calorie_target: int = 2000,
        protein_target: int = 150,
        carb_target: int = 200,
        fat_target: int = 65,
        vegetarian: bool = False,
        high_protein: bool = False
    ) -> list[dict]:
        """Generate a 7-day meal plan."""
        week_plan = []

        for day in range(7):
            day_plan = self.generate_day_plan(
                calorie_target=calorie_target,
                protein_target=protein_target,
                carb_target=carb_target,
                fat_target=fat_target,
                vegetarian=vegetarian,
                high_protein=high_protein
            )
            if day_plan:
                day_plan["day"] = day
                week_plan.append(day_plan)

        return week_plan
