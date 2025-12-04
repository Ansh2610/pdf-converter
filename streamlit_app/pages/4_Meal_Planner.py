"""Meal Planner Page - Generate optimized meal plans."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import streamlit as st
from datetime import date

from src.db.postgres_client import db, Food
from src.services.meal_planner import MealPlanner

st.set_page_config(page_title="Meal Planner - NutriScan", page_icon="📅", layout="wide")

db.create_tables()


def init_session():
    if "user_id" not in st.session_state:
        st.warning("Please visit the home page first to initialize your session.")
        st.stop()


init_session()

st.title("Meal Plan Generator")
st.markdown("Generate optimized meal plans based on your goals")

# Settings
st.subheader("Your Goals")

goal_cols = st.columns(4)

calorie_target = goal_cols[0].number_input(
    "Daily Calories",
    min_value=1200,
    max_value=4000,
    value=st.session_state.get("calorie_target", 2000),
    step=100
)

protein_target = goal_cols[1].number_input(
    "Protein (g)",
    min_value=50,
    max_value=300,
    value=st.session_state.get("protein_target", 150),
    step=10
)

carb_target = goal_cols[2].number_input(
    "Carbs (g)",
    min_value=50,
    max_value=400,
    value=st.session_state.get("carb_target", 200),
    step=10
)

fat_target = goal_cols[3].number_input(
    "Fat (g)",
    min_value=20,
    max_value=150,
    value=st.session_state.get("fat_target", 65),
    step=5
)

# Preferences
st.markdown("---")
st.subheader("Preferences")

pref_cols = st.columns(3)
vegetarian = pref_cols[0].checkbox("Vegetarian")
high_protein = pref_cols[1].checkbox("High Protein Focus")
low_carb = pref_cols[2].checkbox("Low Carb")

# Generate button
st.markdown("---")

if st.button("Generate Meal Plan", type="primary", use_container_width=True):
    with st.spinner("Generating your personalized meal plan..."):
        planner = MealPlanner()

        try:
            plan = planner.generate_day_plan(
                calorie_target=calorie_target,
                protein_target=protein_target,
                carb_target=carb_target,
                fat_target=fat_target,
                vegetarian=vegetarian,
                high_protein=high_protein
            )

            if plan:
                st.session_state.meal_plan = plan
                st.success("Meal plan generated!")
            else:
                st.error("Could not generate a meal plan. Try adjusting your targets.")
        except Exception as e:
            st.error(f"Error generating plan: {e}")

# Display meal plan
if "meal_plan" in st.session_state and st.session_state.meal_plan:
    plan = st.session_state.meal_plan

    st.markdown("---")
    st.subheader("Your Meal Plan")

    # Totals
    total_cals = sum(m["calories"] for m in plan["meals"])
    total_protein = sum(m["protein"] for m in plan["meals"])
    total_carbs = sum(m["carbs"] for m in plan["meals"])
    total_fat = sum(m["fat"] for m in plan["meals"])

    total_cols = st.columns(4)
    total_cols[0].metric("Total Calories", f"{total_cals:.0f}", delta=f"{total_cals - calorie_target:.0f}")
    total_cols[1].metric("Total Protein", f"{total_protein:.0f}g", delta=f"{total_protein - protein_target:.0f}g")
    total_cols[2].metric("Total Carbs", f"{total_carbs:.0f}g")
    total_cols[3].metric("Total Fat", f"{total_fat:.0f}g")

    st.markdown("---")

    # Meals
    meal_icons = {"breakfast": "🌅", "lunch": "☀️", "dinner": "🌙", "snack": "🍿"}

    for meal in plan["meals"]:
        with st.container():
            icon = meal_icons.get(meal["meal_type"], "🍽️")
            st.markdown(f"### {icon} {meal['meal_type'].title()}")

            for item in meal["foods"]:
                item_cols = st.columns([3, 1, 1, 1, 1])
                item_cols[0].markdown(f"**{item['name']}** ({item['servings']}x)")
                item_cols[1].markdown(f"{item['calories']:.0f} cal")
                item_cols[2].markdown(f"{item['protein']:.0f}g protein")
                item_cols[3].markdown(f"{item['carbs']:.0f}g carbs")
                item_cols[4].markdown(f"{item['fat']:.0f}g fat")

            st.markdown(f"**Meal Total:** {meal['calories']:.0f} cal | {meal['protein']:.0f}g protein")
            st.markdown("---")

    # Grocery list
    st.subheader("Grocery List")

    all_foods = []
    for meal in plan["meals"]:
        for item in meal["foods"]:
            all_foods.append(item["name"])

    unique_foods = list(set(all_foods))
    for food in sorted(unique_foods):
        st.markdown(f"- {food}")
else:
    st.info("Click 'Generate Meal Plan' to create a personalized plan based on your goals.")

# Tips
st.markdown("---")
st.subheader("Tips")
st.markdown("""
- **Adjust servings** based on your hunger and activity level
- **Swap similar foods** if you don't like something (e.g., chicken for turkey)
- **Prep in batches** - cook proteins and grains ahead of time
- **Stay flexible** - this is a guide, not a strict rule
""")
