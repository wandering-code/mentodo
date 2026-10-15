"""nombres y orden de propiedades

Revision ID: 6c4bed85b1ef
Revises: f5d57e588e8c
Create Date: 2026-10-15 10:22:33.558301
"""
from alembic import op
import sqlalchemy as sa


revision = '6c4bed85b1ef'
down_revision = 'f5d57e588e8c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('prop_names', sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column('projects', sa.Column('prop_order', sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))


def downgrade():
    op.drop_column('projects', 'prop_order')
    op.drop_column('projects', 'prop_names')
    # ### end Alembic commands ###
