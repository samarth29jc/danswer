"""add admin_created to chat_session

Revision ID: 40198a92a1b3
Revises: 949b4a92a401
Create Date: 2024-10-26 18:35:00.612757

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "40198a92a1b3"
down_revision = "949b4a92a401"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add admin_created column with default False
    op.add_column(
        "chat_session",
        sa.Column(
            "admin_created", sa.Boolean(), server_default="false", nullable=False
        ),
    )


def downgrade() -> None:
    # Remove the admin_created column
    op.drop_column("chat_session", "admin_created")
