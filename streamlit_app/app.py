"""NutriScan Streamlit App - Main entry point."""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
from src.db.postgres_client import db, User
from src.utils import load_config
import uuid

st.set_page_config(
    page_title="NutriScan",
    page_icon="🥗",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Initialize database
db.create_tables()


def init_user_session():
    """Initialize or retrieve user session."""
    if "user_id" not in st.session_state:
        # Check for existing session in cookies/state
        if "session_id" not in st.session_state:
            st.session_state.session_id = str(uuid.uuid4())[:8]

        session = db.get_session()
        try:
            # Find or create user
            user = session.query(User).filter(
                User.session_id == st.session_state.session_id
            ).first()

            if not user:
                config = load_config()
                user = User(
                    session_id=st.session_state.session_id,
                    goal="maintain",
                    calorie_target=config["nutrition"]["default_calorie_target"],
                    protein_target=config["nutrition"]["default_protein_target"],
                    carb_target=config["nutrition"]["default_carb_target"],
                    fat_target=config["nutrition"]["default_fat_target"],
                )
                session.add(user)
                session.commit()
                session.refresh(user)

            st.session_state.user_id = user.user_id
            st.session_state.calorie_target = user.calorie_target
            st.session_state.protein_target = user.protein_target
            st.session_state.carb_target = user.carb_target
            st.session_state.fat_target = user.fat_target
        finally:
            session.close()


# Initialize user
init_user_session()

# Sidebar
st.sidebar.title("NutriScan")
st.sidebar.markdown("---")

# User goals in sidebar
st.sidebar.subheader("Your Daily Targets")
st.sidebar.metric("Calories", f"{st.session_state.calorie_target} kcal")
st.sidebar.metric("Protein", f"{st.session_state.protein_target}g")
st.sidebar.metric("Carbs", f"{st.session_state.carb_target}g")
st.sidebar.metric("Fat", f"{st.session_state.fat_target}g")

st.sidebar.markdown("---")
st.sidebar.caption(f"Session: {st.session_state.session_id}")

# Main content
st.title("NutriScan")
st.subheader("Food & Nutrition Intelligence Platform")

st.markdown("""
Welcome to NutriScan! Track your nutrition, analyze trends, and get personalized meal plans.

**Navigate using the sidebar:**

- **Food Logger** - Search foods and log your meals
- **Dashboard** - View today's progress and macros
- **Trends** - Analyze your nutrition over time
- **Meal Planner** - Generate optimized meal plans
""")

# Quick stats
col1, col2, col3 = st.columns(3)

session = db.get_session()
try:
    from src.db.postgres_client import Food, MealLog
    from datetime import date

    food_count = session.query(Food).count()
    today_logs = session.query(MealLog).filter(
        MealLog.user_id == st.session_state.user_id,
        MealLog.log_date == date.today()
    ).count()

    col1.metric("Foods in Database", food_count)
    col2.metric("Meals Logged Today", today_logs)
    col3.metric("Your Goal", st.session_state.get("goal", "Maintain"))
finally:
    session.close()
