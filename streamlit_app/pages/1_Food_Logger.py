"""Food Logger Page - Search and log meals."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import streamlit as st
from datetime import date

from src.db.postgres_client import db, Food, MealLog, User
from src.services.food_service import food_service
from src.services.logging_service import logging_service
from src.utils import load_config

st.set_page_config(page_title="Food Logger - NutriScan", page_icon="🍽️", layout="wide")

# Initialize database
db.create_tables()


def init_session():
    """Ensure user session exists."""
    if "user_id" not in st.session_state:
        st.warning("Please visit the home page first to initialize your session.")
        st.stop()


init_session()

st.title("Food Logger")
st.markdown("Search for foods and log your meals")

# Two-column layout
col_search, col_log = st.columns([2, 1])

with col_search:
    st.subheader("Search Foods")

    search_query = st.text_input(
        "Search for a food",
        placeholder="e.g., chicken breast, banana, rice...",
        key="food_search"
    )

    if search_query:
        results = food_service.search_local(search_query, limit=10)

        if results:
            st.markdown(f"**Found {len(results)} results:**")

            for food in results:
                with st.container():
                    cols = st.columns([3, 1, 1, 1, 1])
                    cols[0].markdown(f"**{food.name}**")
                    cols[1].markdown(f"🔥 {food.calories} cal")
                    cols[2].markdown(f"🥩 {food.protein_g}g")
                    cols[3].markdown(f"🍞 {food.carbs_g}g")
                    cols[4].markdown(f"🧈 {food.fat_g}g")

                    if st.button("Select", key=f"select_{food.food_id}"):
                        st.session_state.selected_food = food
                        st.rerun()
        else:
            st.info("No foods found. Try a different search term.")

with col_log:
    st.subheader("Log Meal")

    if "selected_food" in st.session_state and st.session_state.selected_food:
        food = st.session_state.selected_food

        st.markdown(f"**Selected: {food.name}**")
        st.markdown(f"Per serving ({food.serving_size}{food.serving_unit}):")

        # Nutrition info
        info_cols = st.columns(2)
        info_cols[0].metric("Calories", f"{food.calories}")
        info_cols[1].metric("Protein", f"{food.protein_g}g")

        info_cols2 = st.columns(2)
        info_cols2[0].metric("Carbs", f"{food.carbs_g}g")
        info_cols2[1].metric("Fat", f"{food.fat_g}g")

        st.markdown("---")

        # Logging form
        servings = st.number_input(
            "Servings",
            min_value=0.25,
            max_value=10.0,
            value=1.0,
            step=0.25
        )

        meal_type = st.selectbox(
            "Meal Type",
            ["breakfast", "lunch", "dinner", "snack"]
        )

        log_date = st.date_input("Date", value=date.today())

        # Calculate totals
        st.markdown("**Your totals:**")
        calc_cols = st.columns(2)
        calc_cols[0].markdown(f"Calories: **{float(food.calories) * servings:.0f}**")
        calc_cols[1].markdown(f"Protein: **{float(food.protein_g) * servings:.1f}g**")

        if st.button("Log Food", type="primary", use_container_width=True):
            try:
                logging_service.log_meal(
                    user_id=st.session_state.user_id,
                    food_id=food.food_id,
                    meal_type=meal_type,
                    servings=servings,
                    log_date=log_date
                )
                st.success(f"Logged {servings}x {food.name} for {meal_type}!")
                st.session_state.selected_food = None
                st.rerun()
            except Exception as e:
                st.error(f"Error logging food: {e}")

        if st.button("Clear Selection", use_container_width=True):
            st.session_state.selected_food = None
            st.rerun()
    else:
        st.info("Search and select a food to log it.")

# Today's log section
st.markdown("---")
st.subheader("Today's Meals")

session = db.get_session()
try:
    logs = (
        session.query(MealLog, Food)
        .join(Food, MealLog.food_id == Food.food_id)
        .filter(
            MealLog.user_id == st.session_state.user_id,
            MealLog.log_date == date.today()
        )
        .order_by(MealLog.logged_at)
        .all()
    )

    if logs:
        # Group by meal type
        meal_types = ["breakfast", "lunch", "dinner", "snack"]

        for meal_type in meal_types:
            meal_logs = [(log, food) for log, food in logs if log.meal_type == meal_type]
            if meal_logs:
                st.markdown(f"**{meal_type.title()}**")
                for log, food in meal_logs:
                    cols = st.columns([3, 1, 1, 1])
                    cols[0].markdown(f"{food.name} ({log.servings}x)")
                    cols[1].markdown(f"{float(food.calories) * float(log.servings):.0f} cal")
                    cols[2].markdown(f"{float(food.protein_g) * float(log.servings):.1f}g protein")
                    if cols[3].button("Delete", key=f"del_{log.log_id}"):
                        logging_service.delete_log(log.log_id)
                        st.rerun()
    else:
        st.info("No meals logged today. Start by searching for a food above!")
finally:
    session.close()
