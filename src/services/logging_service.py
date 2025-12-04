"""Meal logging service - CRUD operations for meal logs."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from src.db.postgres_client import db, MealLog, Food, User, DailySummary
from src.utils import load_config


class LoggingService:
    """Handles meal logging CRUD operations."""

    def __init__(self):
        self.config = load_config()

    def log_meal(
        self,
        user_id: int,
        food_id: int,
        meal_type: str,
        servings: float = 1.0,
        log_date: date = None,
        session: Session = None
    ) -> MealLog:
        """
        Log a meal for a user.

        Args:
            user_id: User's ID
            food_id: Food's ID
            meal_type: breakfast, lunch, dinner, or snack
            servings: Number of servings (default 1)
            log_date: Date to log for (default today)
            session: Optional existing session

        Returns:
            Created MealLog object
        """
        close_session = session is None
        session = session or db.get_session()
        log_date = log_date or date.today()

        try:
            meal_log = MealLog(
                user_id=user_id,
                food_id=food_id,
                meal_type=meal_type,
                servings=servings,
                log_date=log_date,
            )
            session.add(meal_log)
            session.commit()
            session.refresh(meal_log)
            return meal_log
        except Exception:
            session.rollback()
            raise
        finally:
            if close_session:
                session.close()

    def get_logs_for_date(
        self,
        user_id: int,
        log_date: date = None,
        session: Session = None
    ) -> list[MealLog]:
        """Get all meal logs for a user on a specific date."""
        close_session = session is None
        session = session or db.get_session()
        log_date = log_date or date.today()

        try:
            return (
                session.query(MealLog)
                .filter(MealLog.user_id == user_id, MealLog.log_date == log_date)
                .order_by(MealLog.logged_at)
                .all()
            )
        finally:
            if close_session:
                session.close()

    def get_logs_by_meal_type(
        self,
        user_id: int,
        meal_type: str,
        log_date: date = None,
        session: Session = None
    ) -> list[MealLog]:
        """Get meal logs filtered by meal type."""
        close_session = session is None
        session = session or db.get_session()
        log_date = log_date or date.today()

        try:
            return (
                session.query(MealLog)
                .filter(
                    MealLog.user_id == user_id,
                    MealLog.log_date == log_date,
                    MealLog.meal_type == meal_type
                )
                .all()
            )
        finally:
            if close_session:
                session.close()

    def delete_log(self, log_id: int, session: Session = None) -> bool:
        """Delete a meal log by ID."""
        close_session = session is None
        session = session or db.get_session()

        try:
            log = session.query(MealLog).filter(MealLog.log_id == log_id).first()
            if log:
                session.delete(log)
                session.commit()
                return True
            return False
        except Exception:
            session.rollback()
            raise
        finally:
            if close_session:
                session.close()

    def update_servings(
        self,
        log_id: int,
        servings: float,
        session: Session = None
    ) -> Optional[MealLog]:
        """Update servings for a meal log."""
        close_session = session is None
        session = session or db.get_session()

        try:
            log = session.query(MealLog).filter(MealLog.log_id == log_id).first()
            if log:
                log.servings = servings
                session.commit()
                session.refresh(log)
                return log
            return None
        except Exception:
            session.rollback()
            raise
        finally:
            if close_session:
                session.close()

    def calculate_daily_totals(
        self,
        user_id: int,
        log_date: date = None,
        session: Session = None
    ) -> dict:
        """
        Calculate total nutrition for a user on a specific date.

        Returns dict with total_calories, total_protein, total_carbs, total_fat
        """
        close_session = session is None
        session = session or db.get_session()
        log_date = log_date or date.today()

        try:
            # Join meal_logs with foods and sum nutrients * servings
            result = (
                session.query(
                    func.coalesce(func.sum(Food.calories * MealLog.servings), 0).label("calories"),
                    func.coalesce(func.sum(Food.protein_g * MealLog.servings), 0).label("protein"),
                    func.coalesce(func.sum(Food.carbs_g * MealLog.servings), 0).label("carbs"),
                    func.coalesce(func.sum(Food.fat_g * MealLog.servings), 0).label("fat"),
                )
                .join(Food, MealLog.food_id == Food.food_id)
                .filter(MealLog.user_id == user_id, MealLog.log_date == log_date)
                .first()
            )

            return {
                "total_calories": int(result.calories or 0),
                "total_protein": int(result.protein or 0),
                "total_carbs": int(result.carbs or 0),
                "total_fat": int(result.fat or 0),
            }
        finally:
            if close_session:
                session.close()

    def update_daily_summary(
        self,
        user_id: int,
        log_date: date = None,
        session: Session = None
    ) -> DailySummary:
        """
        Update or create daily summary for a user.

        Calculates totals and checks if targets were met.
        """
        close_session = session is None
        session = session or db.get_session()
        log_date = log_date or date.today()

        try:
            # Get user targets
            user = session.query(User).filter(User.user_id == user_id).first()
            if not user:
                raise ValueError(f"User {user_id} not found")

            # Calculate totals
            totals = self.calculate_daily_totals(user_id, log_date, session)

            # Check if targets met (within tolerance)
            tolerance = self.config["nutrition"]["target_tolerance"]

            calorie_target_met = False
            protein_target_met = False

            if user.calorie_target:
                diff = abs(totals["total_calories"] - user.calorie_target) / user.calorie_target
                calorie_target_met = diff <= tolerance

            if user.protein_target:
                diff = abs(totals["total_protein"] - user.protein_target) / user.protein_target
                protein_target_met = diff <= tolerance

            # Update or create summary
            summary = (
                session.query(DailySummary)
                .filter(DailySummary.user_id == user_id, DailySummary.log_date == log_date)
                .first()
            )

            if summary:
                summary.total_calories = totals["total_calories"]
                summary.total_protein = totals["total_protein"]
                summary.total_carbs = totals["total_carbs"]
                summary.total_fat = totals["total_fat"]
                summary.calorie_target_met = calorie_target_met
                summary.protein_target_met = protein_target_met
            else:
                summary = DailySummary(
                    user_id=user_id,
                    log_date=log_date,
                    total_calories=totals["total_calories"],
                    total_protein=totals["total_protein"],
                    total_carbs=totals["total_carbs"],
                    total_fat=totals["total_fat"],
                    calorie_target_met=calorie_target_met,
                    protein_target_met=protein_target_met,
                )
                session.add(summary)

            session.commit()
            session.refresh(summary)
            return summary
        except Exception:
            session.rollback()
            raise
        finally:
            if close_session:
                session.close()


# Convenience instance
logging_service = LoggingService()
