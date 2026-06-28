"""initial_schema — полная схема БД (все таблицы)

Revision ID: 122e9039ad84
Revises:
Create Date: 2026-06-28 20:36:54.961957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '122e9039ad84'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Создаёт все таблицы — полная initial-миграция."""

    # ---------- Мастера ----------
    op.create_table('masters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('photo_url', sa.String(), nullable=True),
        sa.Column('bio', sa.String(), nullable=True),
        sa.Column('telegram_id', sa.Integer(), nullable=True),
        sa.Column('tg_username', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_masters_id'), 'masters', ['id'], unique=False)

    # ---------- Услуги (глобальный список) ----------
    op.create_table('services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_services_id'), 'services', ['id'], unique=False)

    # ---------- Записи ----------
    op.create_table('bookings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('master_id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('customer_name', sa.String(), nullable=False),
        sa.Column('customer_phone', sa.String(), nullable=True),
        sa.Column('customer_tg_username', sa.String(), nullable=True),
        sa.Column('customer_tg_id', sa.Integer(), nullable=True),
        sa.Column('booking_time', sa.DateTime(), nullable=False),
        sa.Column('is_confirmed', sa.Boolean(), nullable=True),
        sa.Column('is_cancelled', sa.Boolean(), nullable=True),
        sa.Column('notified_day_before', sa.Boolean(), nullable=True),
        sa.Column('notified_hour_before', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_bookings_id'), 'bookings', ['id'], unique=False)

    # ---------- Связь мастер-услуга ----------
    op.create_table('master_services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('master_id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_master_services_id'), 'master_services', ['id'], unique=False)

    # ---------- Расписание мастера ----------
    op.create_table('master_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('master_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('is_working', sa.Boolean(), nullable=True),
        sa.Column('start_time', sa.String(), nullable=True),
        sa.Column('end_time', sa.String(), nullable=True),
        sa.Column('slot_interval_minutes', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_master_schedules_id'), 'master_schedules', ['id'], unique=False)

    # ---------- Особые даты ----------
    op.create_table('master_date_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('master_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.String(), nullable=False),
        sa.Column('is_working', sa.Boolean(), nullable=True),
        sa.Column('max_bookings', sa.Integer(), nullable=True),
        sa.Column('note', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_master_date_overrides_date'), 'master_date_overrides', ['date'], unique=False)
    op.create_index(op.f('ix_master_date_overrides_id'), 'master_date_overrides', ['id'], unique=False)

    # ---------- Инвайт-токены ----------
    op.create_table('master_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('is_used', sa.Boolean(), nullable=True),
        sa.Column('used_by_telegram_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_master_invites_id'), 'master_invites', ['id'], unique=False)
    op.create_index(op.f('ix_master_invites_token'), 'master_invites', ['token'], unique=True)


def downgrade() -> None:
    """Удаляет все таблицы в обратном порядке."""
    op.drop_index(op.f('ix_master_invites_token'), table_name='master_invites')
    op.drop_index(op.f('ix_master_invites_id'), table_name='master_invites')
    op.drop_table('master_invites')
    op.drop_index(op.f('ix_master_date_overrides_id'), table_name='master_date_overrides')
    op.drop_index(op.f('ix_master_date_overrides_date'), table_name='master_date_overrides')
    op.drop_table('master_date_overrides')
    op.drop_index(op.f('ix_master_schedules_id'), table_name='master_schedules')
    op.drop_table('master_schedules')
    op.drop_index(op.f('ix_master_services_id'), table_name='master_services')
    op.drop_table('master_services')
    op.drop_index(op.f('ix_bookings_id'), table_name='bookings')
    op.drop_table('bookings')
    op.drop_index(op.f('ix_services_id'), table_name='services')
    op.drop_table('services')
    op.drop_index(op.f('ix_masters_id'), table_name='masters')
    op.drop_table('masters')
