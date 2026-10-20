"""vacaciones: gastar los días del año anterior (arrastre)

Revision ID: 9b2c4f1e6a70
Revises: 7a1d2e9c4b30
Create Date: 2026-10-20 16:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '9b2c4f1e6a70'
down_revision = '7a1d2e9c4b30'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('vacations', sa.Column('prev_year', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('vacations', 'prev_year')
