"""Database model for configuration compliance checks.

Part of EP0010: Configuration Management - US0117 Configuration Compliance Checker.
"""


from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from homelab_cmd.db.base import Base


class ConfigCheck(Base):
    """Stores configuration compliance check results.

    Each record represents a single compliance check run against
    a server for a specific configuration pack.
    """

    __tablename__ = "config_check"

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(String, ForeignKey("servers.id"), nullable=False, index=True)
    pack_name = Column(String, nullable=False)
    is_compliant = Column(Boolean, nullable=False)
    mismatches = Column(JSON, default=list)
    checked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    check_duration_ms = Column(Integer, nullable=False)

    # Relationships
    server = relationship("Server", back_populates="config_checks")

    def __repr__(self) -> str:
        status = "compliant" if self.is_compliant else f"{len(self.mismatches or [])} mismatches"
        return f"<ConfigCheck server={self.server_id} pack={self.pack_name} {status}>"
