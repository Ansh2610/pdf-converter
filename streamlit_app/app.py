"""NutriScan Streamlit App - Main entry point."""

import streamlit as st

st.set_page_config(
    page_title="NutriScan",
    page_icon="",
    layout="wide",
)

st.title("NutriScan")
st.subheader("Food & Nutrition Intelligence Platform")

st.markdown("""
Welcome to NutriScan. Use the sidebar to navigate between pages:

- **Food Logger** - Search and log your meals
- **Daily Dashboard** - Track your daily progress
- **Meal Planner** - Generate optimized meal plans
""")

# TODO: Add user session management
# TODO: Connect to database
