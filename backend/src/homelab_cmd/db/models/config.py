"""Config model for HomelabCmd.

This model stores system configuration as key-value pairs with JSON values.
"""

from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from homelab_cmd.db.base import Base


class Config(Base):
    """SQLAlchemy model for system configuration.

    Stores configuration values as key-value pairs where the value is JSON.
    This allows storing complex configuration objects (thresholds, notifications).

    Attributes:
        key: Configuration key (e.g., "thresholds", "notifications")
        value: JSON-encoded configuration value
        updated_at: Timestamp of last update
    """

    __tablename__ = "config"

    # Primary key - configuration key name
    key: Mapped[str] = mapped_column(String(100), primary_key=True)

    # JSON value for flexible configuration storage
    value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Last update timestamp
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        """Return string representation of the config."""
        return f"<Config(key={self.key!r}, updated_at={self.updated_at})>"
