"""Daily Dashboard - Track today's progress."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from datetime import date

from src.db.postgres_client import db, Food, MealLog, User
from src.services.logging_service import logging_service

st.set_page_config(page_title="Dashboard - NutriScan", page_icon="📊", layout="wide")

db.create_tables()


def init_session():
    if "user_id" not in st.session_state:
        st.warning("Please visit the home page first to initialize your session.")
        st.stop()


init_session()

st.title("Daily Dashboard")
st.markdown(f"**{date.today().strftime('%A, %B %d, %Y')}**")

# Get daily totals
totals = logging_service.calculate_daily_totals(
    st.session_state.user_id,
    date.today()
)

# Targets
cal_target = st.session_state.get("calorie_target", 2000)
protein_target = st.session_state.get("protein_target", 150)
carb_target = st.session_state.get("carb_target", 200)
fat_target = st.session_state.get("fat_target", 65)

# Progress bars section
st.subheader("Progress")

# Calorie progress
cal_pct = min(100, (totals["total_calories"] / cal_target * 100)) if cal_target else 0
remaining_cal = max(0, cal_target - totals["total_calories"])

col1, col2 = st.columns([3, 1])
with col1:
    st.markdown(f"**Calories:** {totals['total_calories']} / {cal_target}")
    st.progress(cal_pct / 100)
with col2:
    st.metric("Remaining", f"{remaining_cal} cal")

# Macro progress
st.markdown("---")
macro_cols = st.columns(3)

with macro_cols[0]:
    protein_pct = min(100, (totals["total_protein"] / protein_target * 100)) if protein_target else 0
    st.markdown(f"**Protein:** {totals['total_protein']}g / {protein_target}g")
    st.progress(protein_pct / 100)
    remaining_p = max(0, protein_target - totals["total_protein"])
    st.caption(f"{remaining_p}g remaining")

with macro_cols[1]:
    carb_pct = min(100, (totals["total_carbs"] / carb_target * 100)) if carb_target else 0
    st.markdown(f"**Carbs:** {totals['total_carbs']}g / {carb_target}g")
    st.progress(carb_pct / 100)
    remaining_c = max(0, carb_target - totals["total_carbs"])
    st.caption(f"{remaining_c}g remaining")

with macro_cols[2]:
    fat_pct = min(100, (totals["total_fat"] / fat_target * 100)) if fat_target else 0
    st.markdown(f"**Fat:** {totals['total_fat']}g / {fat_target}g")
    st.progress(fat_pct / 100)
    remaining_f = max(0, fat_target - totals["total_fat"])
    st.caption(f"{remaining_f}g remaining")

# Macro breakdown chart
st.markdown("---")
chart_cols = st.columns(2)

with chart_cols[0]:
    st.subheader("Macro Breakdown")

    if totals["total_protein"] + totals["total_carbs"] + totals["total_fat"] > 0:
        fig = go.Figure(data=[go.Pie(
            labels=["Protein", "Carbs", "Fat"],
            values=[totals["total_protein"], totals["total_carbs"], totals["total_fat"]],
            hole=0.4,
            marker_colors=["#FF6B6B", "#4ECDC4", "#FFE66D"]
        )])
        fig.update_layout(
            showlegend=True,
            height=300,
            margin=dict(t=20, b=20, l=20, r=20)
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Log some meals to see your macro breakdown")

with chart_cols[1]:
    st.subheader("Calorie Budget")

    fig = go.Figure(go.Indicator(
        mode="gauge+number+delta",
        value=totals["total_calories"],
        delta={"reference": cal_target, "relative": False},
        gauge={
            "axis": {"range": [0, cal_target * 1.2]},
            "bar": {"color": "#4ECDC4"},
            "steps": [
                {"range": [0, cal_target * 0.9], "color": "#E8F5E9"},
                {"range": [cal_target * 0.9, cal_target * 1.1], "color": "#C8E6C9"},
                {"range": [cal_target * 1.1, cal_target * 1.2], "color": "#FFCDD2"},
            ],
            "threshold": {
                "line": {"color": "red", "width": 2},
                "thickness": 0.75,
                "value": cal_target
            }
        },
        title={"text": "Calories"}
    ))
    fig.update_layout(height=300, margin=dict(t=50, b=20, l=20, r=20))
    st.plotly_chart(fig, use_container_width=True)

# Meals breakdown
st.markdown("---")
st.subheader("Meals Today")

session = db.get_session()
try:
    logs = (
        session.query(MealLog, Food)
        .join(Food, MealLog.food_id == Food.food_id)
        .filter(
            MealLog.user_id == st.session_state.user_id,
            MealLog.log_date == date.today()
        )
        .all()
    )

    if logs:
        meal_types = ["breakfast", "lunch", "dinner", "snack"]
        meal_icons = {"breakfast": "🌅", "lunch": "☀️", "dinner": "🌙", "snack": "🍿"}

        for meal_type in meal_types:
            meal_logs = [(log, food) for log, food in logs if log.meal_type == meal_type]
            if meal_logs:
                meal_cals = sum(float(food.calories) * float(log.servings) for log, food in meal_logs)
                st.markdown(f"**{meal_icons.get(meal_type, '')} {meal_type.title()}** - {meal_cals:.0f} cal")

                for log, food in meal_logs:
                    cals = float(food.calories) * float(log.servings)
                    st.caption(f"  {food.name} ({log.servings}x) - {cals:.0f} cal")
    else:
        st.info("No meals logged today. Head to the Food Logger to add some!")
finally:
    session.close()

# Recommendation
st.markdown("---")
remaining_protein = max(0, protein_target - totals["total_protein"])
if remaining_protein > 20:
    st.info(f"💡 You need **{remaining_protein}g more protein** today. Try: chicken breast, Greek yogurt, or eggs.")
elif remaining_cal > 300:
    st.success(f"✅ Great progress! You have **{remaining_cal} calories** left for the day.")
elif totals["total_calories"] > cal_target:
    over = totals["total_calories"] - cal_target
    st.warning(f"⚠️ You're **{over} calories** over your target today.")
