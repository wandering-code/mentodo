"""festivos propios (solo para mí o para un equipo)

Revision ID: 7a1d2e9c4b30
Revises: c3b412a68e83
Create Date: 2026-10-20 15:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '7a1d2e9c4b30'
down_revision = 'c3b412a68e83'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('days_off',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('team_id', sa.Integer(), nullable=True),
    sa.Column('start', sa.Date(), nullable=False),
    sa.Column('end', sa.Date(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_days_off_user_id'), 'days_off', ['user_id'], unique=False)
    op.create_index(op.f('ix_days_off_team_id'), 'days_off', ['team_id'], unique=False)
    op.create_index(op.f('ix_days_off_start'), 'days_off', ['start'], unique=False)
    op.create_index(op.f('ix_days_off_end'), 'days_off', ['end'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_days_off_end'), table_name='days_off')
    op.drop_index(op.f('ix_days_off_start'), table_name='days_off')
    op.drop_index(op.f('ix_days_off_team_id'), table_name='days_off')
    op.drop_index(op.f('ix_days_off_user_id'), table_name='days_off')
    op.drop_table('days_off')
