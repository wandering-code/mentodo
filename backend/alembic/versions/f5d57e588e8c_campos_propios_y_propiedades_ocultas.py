"""campos propios y propiedades ocultas

Revision ID: f5d57e588e8c
Revises: d83834b47cb1
Create Date: 2026-10-15 09:23:08.339335
"""
from alembic import op
import sqlalchemy as sa


revision = 'f5d57e588e8c'
down_revision = 'd83834b47cb1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('fields',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('kind', sa.String(length=12), nullable=False),
    sa.Column('position', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fields_project_id'), 'fields', ['project_id'], unique=False)
    op.add_column('cards', sa.Column('values', sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column('cards', sa.Column('hidden_props', sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))
    op.add_column('projects', sa.Column('hidden_props', sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))


def downgrade():
    op.drop_column('projects', 'hidden_props')
    op.drop_column('cards', 'hidden_props')
    op.drop_column('cards', 'values')
    op.drop_index(op.f('ix_fields_project_id'), table_name='fields')
    op.drop_table('fields')
    # ### end Alembic commands ###
