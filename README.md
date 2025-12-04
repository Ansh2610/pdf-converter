# NutriScan

A nutrition tracking platform for logging meals, tracking macros, and generating AI-powered meal plans.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
python -c "from src.db.postgres_client import db; db.create_tables()"

# Run the app
streamlit run streamlit_app/app.py
```

## Architecture

- **Database**: PostgreSQL with SQLAlchemy ORM (foods, users, meal_logs, daily_summaries)
- **Data Source**: USDA FoodData Central API with local caching
- **App**: Streamlit for food logging and daily dashboards
- **Analytics**: Power BI for aggregate insights and trends
