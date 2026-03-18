"""add account_type column

Revision ID: b3c1d2e4f567
Revises: ae22b9ad0151
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c1d2e4f567'
down_revision: Union[str, None] = 'ae22b9ad0151'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('transactions', sa.Column('account_type', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('transactions', 'account_type')
