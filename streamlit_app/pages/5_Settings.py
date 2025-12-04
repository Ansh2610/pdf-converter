"""Settings Page - Update user goals and preferences."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import streamlit as st

from src.db.postgres_client import db, User

st.set_page_config(page_title="Settings - NutriScan", page_icon="⚙️", layout="wide")

db.create_tables()


def init_session():
    if "user_id" not in st.session_state:
        st.warning("Please visit the home page first to initialize your session.")
        st.stop()


init_session()

st.title("Settings")
st.markdown("Update your nutrition goals and preferences")

# Get current user
session = db.get_session()
try:
    user = session.query(User).filter(User.user_id == st.session_state.user_id).first()

    if not user:
        st.error("User not found")
        st.stop()

    # Goals section
    st.subheader("Daily Nutrition Targets")

    col1, col2 = st.columns(2)

    with col1:
        calorie_target = st.number_input(
            "Daily Calorie Target",
            min_value=1200,
            max_value=5000,
            value=user.calorie_target or 2000,
            step=100,
            help="Recommended: 1500-2500 for most adults"
        )

        protein_target = st.number_input(
            "Daily Protein Target (g)",
            min_value=30,
            max_value=300,
            value=user.protein_target or 150,
            step=10,
            help="Recommended: 0.8-1g per lb of body weight"
        )

    with col2:
        carb_target = st.number_input(
            "Daily Carb Target (g)",
            min_value=50,
            max_value=500,
            value=user.carb_target or 200,
            step=10,
            help="Recommended: 45-65% of total calories"
        )

        fat_target = st.number_input(
            "Daily Fat Target (g)",
            min_value=20,
            max_value=200,
            value=user.fat_target or 65,
            step=5,
            help="Recommended: 20-35% of total calories"
        )

    # Goal type
    st.markdown("---")
    st.subheader("Your Goal")

    goal = st.selectbox(
        "What's your primary goal?",
        ["maintain", "lose_weight", "gain_muscle"],
        index=["maintain", "lose_weight", "gain_muscle"].index(user.goal or "maintain"),
        format_func=lambda x: {
            "maintain": "Maintain Weight",
            "lose_weight": "Lose Weight",
            "gain_muscle": "Build Muscle"
        }.get(x, x)
    )

    # Macro calculator helper
    st.markdown("---")
    st.subheader("Quick Calculator")
    st.markdown("Estimate your daily needs based on your stats")

    calc_cols = st.columns(4)
    weight = calc_cols[0].number_input("Weight (lbs)", min_value=80, max_value=400, value=160)
    height = calc_cols[1].number_input("Height (inches)", min_value=48, max_value=84, value=68)
    age = calc_cols[2].number_input("Age", min_value=16, max_value=100, value=30)
    activity = calc_cols[3].selectbox(
        "Activity Level",
        ["Sedentary", "Light", "Moderate", "Active", "Very Active"],
        index=2
    )

    if st.button("Calculate Recommended Targets"):
        # Mifflin-St Jeor equation
        weight_kg = weight * 0.453592
        height_cm = height * 2.54

        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5  # Male formula

        activity_multipliers = {
            "Sedentary": 1.2,
            "Light": 1.375,
            "Moderate": 1.55,
            "Active": 1.725,
            "Very Active": 1.9
        }

        tdee = bmr * activity_multipliers[activity]

        # Adjust for goal
        if goal == "lose_weight":
            recommended_cals = int(tdee - 500)
        elif goal == "gain_muscle":
            recommended_cals = int(tdee + 300)
        else:
            recommended_cals = int(tdee)

        recommended_protein = int(weight * 0.8)  # 0.8g per lb
        recommended_fat = int(recommended_cals * 0.25 / 9)  # 25% from fat
        recommended_carbs = int((recommended_cals - recommended_protein * 4 - recommended_fat * 9) / 4)

        st.success(f"""
        **Recommended Daily Targets:**
        - Calories: {recommended_cals} kcal
        - Protein: {recommended_protein}g
        - Carbs: {recommended_carbs}g
        - Fat: {recommended_fat}g
        """)

    # Save button
    st.markdown("---")

    if st.button("Save Settings", type="primary", use_container_width=True):
        try:
            user.calorie_target = calorie_target
            user.protein_target = protein_target
            user.carb_target = carb_target
            user.fat_target = fat_target
            user.goal = goal
            session.commit()

            # Update session state
            st.session_state.calorie_target = calorie_target
            st.session_state.protein_target = protein_target
            st.session_state.carb_target = carb_target
            st.session_state.fat_target = fat_target
            st.session_state.goal = goal

            st.success("Settings saved successfully!")
            st.rerun()
        except Exception as e:
            session.rollback()
            st.error(f"Error saving settings: {e}")

finally:
    session.close()

# Info section
st.markdown("---")
st.subheader("About Your Targets")
st.markdown("""
**Calories:** Your total daily energy expenditure (TDEE) depends on your age, weight, height, and activity level.
- **Weight loss:** Aim for 500 calories below TDEE
- **Maintenance:** Match your TDEE
- **Muscle gain:** Aim for 200-500 calories above TDEE

**Protein:** Critical for muscle maintenance and satiety.
- General: 0.8g per kg body weight
- Active/athletic: 1.2-2g per kg body weight

**Carbs & Fat:** These can be adjusted based on personal preference while staying within your calorie target.
""")
