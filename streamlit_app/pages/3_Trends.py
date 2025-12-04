"""Trends Page - Analyze nutrition over time."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from datetime import date, timedelta

from src.db.postgres_client import db, DailySummary, MealLog, Food

st.set_page_config(page_title="Trends - NutriScan", page_icon="📈", layout="wide")

db.create_tables()


def init_session():
    if "user_id" not in st.session_state:
        st.warning("Please visit the home page first to initialize your session.")
        st.stop()


init_session()

st.title("Nutrition Trends")
st.markdown("Analyze your eating patterns over time")

# Time range selector
time_range = st.selectbox(
    "Time Range",
    ["Last 7 days", "Last 14 days", "Last 30 days"],
    index=0
)

days = {"Last 7 days": 7, "Last 14 days": 14, "Last 30 days": 30}[time_range]
start_date = date.today() - timedelta(days=days)

# Fetch data
session = db.get_session()
try:
    # Get daily data by aggregating meal logs
    logs = (
        session.query(MealLog, Food)
        .join(Food, MealLog.food_id == Food.food_id)
        .filter(
            MealLog.user_id == st.session_state.user_id,
            MealLog.log_date >= start_date
        )
        .all()
    )

    # Aggregate by date
    daily_data = {}
    for log, food in logs:
        d = log.log_date
        if d not in daily_data:
            daily_data[d] = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
        daily_data[d]["calories"] += float(food.calories) * float(log.servings)
        daily_data[d]["protein"] += float(food.protein_g) * float(log.servings)
        daily_data[d]["carbs"] += float(food.carbs_g) * float(log.servings)
        daily_data[d]["fat"] += float(food.fat_g) * float(log.servings)

    # Fill missing dates with zeros
    all_dates = [start_date + timedelta(days=i) for i in range(days + 1)]
    for d in all_dates:
        if d not in daily_data:
            daily_data[d] = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}

    # Convert to DataFrame
    df = pd.DataFrame([
        {"date": d, **vals}
        for d, vals in sorted(daily_data.items())
    ])

finally:
    session.close()

if df.empty or df["calories"].sum() == 0:
    st.info("Not enough data to show trends. Log some meals first!")
    st.stop()

# Summary stats
st.subheader("Summary")
stat_cols = st.columns(4)

avg_calories = df["calories"].mean()
avg_protein = df["protein"].mean()
avg_carbs = df["carbs"].mean()
avg_fat = df["fat"].mean()

cal_target = st.session_state.get("calorie_target", 2000)
protein_target = st.session_state.get("protein_target", 150)

stat_cols[0].metric(
    "Avg Daily Calories",
    f"{avg_calories:.0f}",
    delta=f"{avg_calories - cal_target:.0f} vs target"
)
stat_cols[1].metric(
    "Avg Daily Protein",
    f"{avg_protein:.0f}g",
    delta=f"{avg_protein - protein_target:.0f}g vs target"
)
stat_cols[2].metric("Avg Daily Carbs", f"{avg_carbs:.0f}g")
stat_cols[3].metric("Avg Daily Fat", f"{avg_fat:.0f}g")

# Calorie trend chart
st.markdown("---")
st.subheader("Calorie Trend")

fig = go.Figure()

fig.add_trace(go.Scatter(
    x=df["date"],
    y=df["calories"],
    mode="lines+markers",
    name="Calories",
    line=dict(color="#4ECDC4", width=3),
    marker=dict(size=8)
))

# Target line
fig.add_hline(
    y=cal_target,
    line_dash="dash",
    line_color="red",
    annotation_text=f"Target: {cal_target}"
)

fig.update_layout(
    xaxis_title="Date",
    yaxis_title="Calories",
    height=400,
    hovermode="x unified"
)

st.plotly_chart(fig, use_container_width=True)

# Macro trends
st.markdown("---")
st.subheader("Macro Trends")

fig2 = go.Figure()

fig2.add_trace(go.Scatter(
    x=df["date"], y=df["protein"],
    mode="lines+markers", name="Protein (g)",
    line=dict(color="#FF6B6B")
))

fig2.add_trace(go.Scatter(
    x=df["date"], y=df["carbs"],
    mode="lines+markers", name="Carbs (g)",
    line=dict(color="#4ECDC4")
))

fig2.add_trace(go.Scatter(
    x=df["date"], y=df["fat"],
    mode="lines+markers", name="Fat (g)",
    line=dict(color="#FFE66D")
))

fig2.update_layout(
    xaxis_title="Date",
    yaxis_title="Grams",
    height=400,
    hovermode="x unified",
    legend=dict(orientation="h", yanchor="bottom", y=1.02)
)

st.plotly_chart(fig2, use_container_width=True)

# Best/Worst days
st.markdown("---")
best_worst_cols = st.columns(2)

with best_worst_cols[0]:
    st.subheader("Best Days (Closest to Target)")
    df["cal_diff"] = abs(df["calories"] - cal_target)
    best_days = df.nsmallest(3, "cal_diff")[["date", "calories"]]
    for _, row in best_days.iterrows():
        if row["calories"] > 0:
            st.markdown(f"✅ **{row['date'].strftime('%b %d')}** - {row['calories']:.0f} cal")

with best_worst_cols[1]:
    st.subheader("Days Over Target")
    over_days = df[df["calories"] > cal_target * 1.1][["date", "calories"]]
    if len(over_days) > 0:
        for _, row in over_days.head(3).iterrows():
            over = row["calories"] - cal_target
            st.markdown(f"⚠️ **{row['date'].strftime('%b %d')}** - {row['calories']:.0f} cal (+{over:.0f})")
    else:
        st.markdown("🎉 No days significantly over target!")

# Weekly averages
st.markdown("---")
st.subheader("Insights")

days_logged = len(df[df["calories"] > 0])
total_days = len(df)
consistency = (days_logged / total_days * 100) if total_days > 0 else 0

insight_cols = st.columns(3)
insight_cols[0].metric("Days Logged", f"{days_logged}/{total_days}")
insight_cols[1].metric("Consistency", f"{consistency:.0f}%")

# Protein insight
if avg_protein < protein_target * 0.8:
    insight_cols[2].warning(f"Protein is {protein_target - avg_protein:.0f}g below target on average")
else:
    insight_cols[2].success("Protein intake on track!")
