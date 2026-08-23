"""add tasks.due_date

Revision ID: c3f8a91d2e47
Revises: f7edfaf7d248
Create Date: 2026-08-23 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3f8a91d2e47'
down_revision: Union[str, None] = 'f7edfaf7d248'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('due_date', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.drop_column('due_date')
