"""add_working_intervals — время работы интервалами в особых датах

Revision ID: 7e3b0f1a2c4d
Revises: 122e9039ad84
Create Date: 2026-06-28 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e3b0f1a2c4d'
down_revision: Union[str, Sequence[str], None] = '122e9039ad84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавляем поле working_intervals (JSON TEXT) в master_date_overrides."""
    op.add_column('master_date_overrides',
        sa.Column('working_intervals', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """SQLite не поддерживает DROP COLUMN, так что downgrade — no-op."""
    pass
