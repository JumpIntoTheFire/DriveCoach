"""Reminders: add reminder_preference to students, push_subscriptions, reminder_log tables

Revision ID: 002a0000
Revises: 001a0000
Create Date: 2026-04-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002a0000"
down_revision: Union[str, None] = "001a0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reminder_preference to students (sms | push | both | none)
    op.add_column(
        "students",
        sa.Column("reminder_preference", sa.String(10), nullable=False, server_default="sms"),
    )

    op.create_table(
        "push_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "instructor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instructors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("endpoint", sa.Text, nullable=False),
        sa.Column("p256dh", sa.Text, nullable=False),
        sa.Column("auth", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_push_subscriptions_instructor_id", "push_subscriptions", ["instructor_id"])
    op.create_index("ix_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"], unique=True)

    op.create_table(
        "reminder_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "lesson_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            UUID(as_uuid=True),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "instructor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instructors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reminder_type", sa.String(10), nullable=False),  # 24h | 1h | manual
        sa.Column("channel", sa.String(10), nullable=False),        # sms | push
        sa.Column("status", sa.String(10), nullable=False),         # sent | failed
        sa.Column("error_message", sa.Text),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_reminder_log_lesson_id", "reminder_log", ["lesson_id"])


def downgrade() -> None:
    op.drop_table("reminder_log")
    op.drop_table("push_subscriptions")
    op.drop_column("students", "reminder_preference")
