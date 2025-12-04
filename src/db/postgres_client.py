"""Database client and schema management (PostgreSQL or SQLite)."""

import os
from pathlib import Path

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Numeric,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.sql import func

from src.utils import get_env, load_config, get_project_root

Base = declarative_base()


# ============================================================================
# Models
# ============================================================================

class Food(Base):
    """Food items with nutritional information."""
    __tablename__ = "foods"

    food_id = Column(Integer, primary_key=True)
    fdc_id = Column(Integer, unique=True, index=True)  # USDA FoodData Central ID
    name = Column(String(200), nullable=False, index=True)
    brand = Column(String(100))
    category = Column(String(100))
    serving_size = Column(Numeric(10, 2), default=100)
    serving_unit = Column(String(20), default="g")
    calories = Column(Numeric(10, 2))
    protein_g = Column(Numeric(10, 2))
    carbs_g = Column(Numeric(10, 2))
    fat_g = Column(Numeric(10, 2))
    fiber_g = Column(Numeric(10, 2))
    sugar_g = Column(Numeric(10, 2))
    sodium_mg = Column(Numeric(10, 2))

    meal_logs = relationship("MealLog", back_populates="food")
    meal_plans = relationship("MealPlan", back_populates="food")


class User(Base):
    """User profiles with nutrition goals."""
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True)
    session_id = Column(String(64), unique=True, index=True)
    goal = Column(String(50), default="maintain")  # lose_weight, maintain, gain_muscle
    calorie_target = Column(Integer)
    protein_target = Column(Integer)
    carb_target = Column(Integer)
    fat_target = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    meal_logs = relationship("MealLog", back_populates="user")
    daily_summaries = relationship("DailySummary", back_populates="user")
    meal_plans = relationship("MealPlan", back_populates="user")


class MealLog(Base):
    """Individual meal log entries."""
    __tablename__ = "meal_logs"

    log_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.food_id"), nullable=False)
    meal_type = Column(String(20), nullable=False)  # breakfast, lunch, dinner, snack
    servings = Column(Numeric(5, 2), default=1)
    logged_at = Column(DateTime, server_default=func.now())
    log_date = Column(Date, nullable=False)

    user = relationship("User", back_populates="meal_logs")
    food = relationship("Food", back_populates="meal_logs")


class DailySummary(Base):
    """Aggregated daily nutrition summaries."""
    __tablename__ = "daily_summaries"

    summary_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    log_date = Column(Date, nullable=False)
    total_calories = Column(Integer, default=0)
    total_protein = Column(Integer, default=0)
    total_carbs = Column(Integer, default=0)
    total_fat = Column(Integer, default=0)
    calorie_target_met = Column(Boolean, default=False)
    protein_target_met = Column(Boolean, default=False)

    user = relationship("User", back_populates="daily_summaries")


class MealPlan(Base):
    """Generated meal plan entries."""
    __tablename__ = "meal_plans"

    plan_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0-6 (Mon-Sun)
    meal_type = Column(String(20), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.food_id"), nullable=False)
    servings = Column(Numeric(5, 2), default=1)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="meal_plans")
    food = relationship("Food", back_populates="meal_plans")


# ============================================================================
# Database Connection
# ============================================================================

class DatabaseClient:
    """Manages database connections (PostgreSQL or SQLite)."""

    def __init__(self):
        self.engine = None
        self.Session = None
        self.db_type = os.getenv("DB_TYPE", "sqlite")  # Default to SQLite

    def _get_db_url(self) -> str:
        """Build database URL based on DB_TYPE."""
        if self.db_type == "sqlite":
            db_path = get_project_root() / "data" / "nutriscan.db"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{db_path}"
        else:
            return (
                f"postgresql://{get_env('DB_USER')}:{get_env('DB_PASSWORD')}"
                f"@{get_env('DB_HOST')}:{get_env('DB_PORT')}/{get_env('DB_NAME')}"
            )

    def connect(self) -> None:
        """Establish database connection."""
        db_url = self._get_db_url()
        config = load_config()

        if self.db_type == "sqlite":
            self.engine = create_engine(db_url, echo=False)
        else:
            self.engine = create_engine(
                db_url,
                pool_size=config["database"]["pool_size"],
                max_overflow=config["database"]["max_overflow"],
            )
        self.Session = sessionmaker(bind=self.engine)
        print(f"Connected to {self.db_type} database")

    def create_tables(self) -> None:
        """Create all tables if they don't exist."""
        if self.engine is None:
            self.connect()
        Base.metadata.create_all(self.engine)

    def drop_tables(self) -> None:
        """Drop all tables. Use with caution."""
        if self.engine is None:
            self.connect()
        Base.metadata.drop_all(self.engine)

    def get_session(self):
        """Get a new database session."""
        if self.Session is None:
            self.connect()
        return self.Session()


# Singleton instance
db = DatabaseClient()
