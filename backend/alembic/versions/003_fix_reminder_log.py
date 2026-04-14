"""Fix reminder_log: widen reminder_type to String(20), add composite index for SMS limit queries

Revision ID: 003a0000
Revises: 002a0000
Create Date: 2026-04-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003a0000"
down_revision: Union[str, None] = "002a0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Widen reminder_type column to match the ORM model (String(20))
    op.alter_column(
        "reminder_log",
        "reminder_type",
        type_=sa.String(20),
        existing_type=sa.String(10),
        nullable=False,
    )

    # Composite index to speed up monthly SMS limit count queries:
    # SELECT COUNT(*) FROM reminder_log
    # WHERE instructor_id = ? AND channel = 'sms' AND status = 'sent' AND sent_at >= ?
    op.create_index(
        "ix_reminder_log_sms_count",
        "reminder_log",
        ["instructor_id", "channel", "status", "sent_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_reminder_log_sms_count", table_name="reminder_log")
    op.alter_column(
        "reminder_log",
        "reminder_type",
        type_=sa.String(10),
        existing_type=sa.String(20),
        nullable=False,
    )
