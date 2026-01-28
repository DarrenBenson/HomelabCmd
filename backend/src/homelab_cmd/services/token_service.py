"""Token service for agent authentication and registration.

This module provides secure token generation, hashing, and validation for:
- Registration tokens (one-time use during agent installation)
- Agent API tokens (per-agent authentication)

Token formats:
- Registration: hlh_rt_{random_32_bytes_hex}
- Agent API:    hlh_ag_{guid_prefix}_{random_32_bytes_hex}
"""

import hashlib
import json
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.agent_credential import AgentCredential
from homelab_cmd.db.models.registration_token import AgentMode, RegistrationToken
from homelab_cmd.db.models.server import Server

logger = logging.getLogger(__name__)

# Token format prefixes
REGISTRATION_TOKEN_PREFIX = "hlh_rt_"
AGENT_TOKEN_PREFIX = "hlh_ag_"

# Default expiry for registration tokens (15 minutes)
DEFAULT_REGISTRATION_EXPIRY_MINUTES = 15


@dataclass
class GeneratedToken:
    """Result of token generation, containing both plaintext and hash."""

    plaintext: str
    token_hash: str
    prefix: str


@dataclass
class ClaimResult:
    """Result of claiming a registration token."""

    success: bool
    server_id: str | None = None
    server_guid: str | None = None
    api_token: str | None = None
    config_yaml: str | None = None
    error: str | None = None


class TokenService:
    """Service for generating and validating tokens.

    This service:
    - Generates registration tokens for pull-based installation
    - Generates per-agent API tokens
    - Validates tokens against stored hashes
    - Manages token lifecycle (creation, claim, revocation)
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialise the token service.

        Args:
            session: SQLAlchemy async session for database operations
        """
        self.session = session

    @staticmethod
    def generate_registration_token() -> GeneratedToken:
        """Generate a new registration token.

        Returns:
            GeneratedToken with plaintext, hash, and prefix
        """
        random_bytes = secrets.token_hex(32)  # 64 hex chars
        plaintext = f"{REGISTRATION_TOKEN_PREFIX}{random_bytes}"
        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        prefix = plaintext[:16]  # "hlh_rt_" + first 9 chars of random

        return GeneratedToken(plaintext=plaintext, token_hash=token_hash, prefix=prefix)

    @staticmethod
    def generate_agent_token(server_guid: str) -> GeneratedToken:
        """Generate a new agent API token.

        Args:
            server_guid: The server's permanent GUID (UUID v4)

        Returns:
            GeneratedToken with plaintext, hash, and prefix
        """
        guid_prefix = server_guid[:8]  # First 8 chars of GUID
        random_bytes = secrets.token_hex(32)  # 64 hex chars
        plaintext = f"{AGENT_TOKEN_PREFIX}{guid_prefix}_{random_bytes}"
        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        prefix = plaintext[:20]  # "hlh_ag_" + guid_prefix + "_" + first chars

        return GeneratedToken(plaintext=plaintext, token_hash=token_hash, prefix=prefix)

    @staticmethod
    def hash_token(plaintext: str) -> str:
        """Hash a plaintext token using SHA-256.

        Args:
            plaintext: The plaintext token to hash

        Returns:
            Hex-encoded SHA-256 hash
        """
        return hashlib.sha256(plaintext.encode()).hexdigest()

    @staticmethod
    def verify_token(plaintext: str, stored_hash: str) -> bool:
        """Verify a plaintext token against a stored hash.

        Args:
            plaintext: The plaintext token to verify
            stored_hash: The stored SHA-256 hash to compare against

        Returns:
            True if the token matches, False otherwise
        """
        computed_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        return secrets.compare_digest(computed_hash, stored_hash)

    async def create_registration_token(
        self,
        mode: AgentMode = AgentMode.READONLY,
        display_name: str | None = None,
        monitored_services: list[str] | None = None,
        expiry_minutes: int = DEFAULT_REGISTRATION_EXPIRY_MINUTES,
    ) -> tuple[RegistrationToken, str]:
        """Create a new registration token.

        Args:
            mode: Agent operating mode (readonly/readwrite)
            display_name: Optional human-readable name for the server
            monitored_services: Optional list of systemd services to monitor
            expiry_minutes: Token expiry time in minutes (default: 15)

        Returns:
            Tuple of (RegistrationToken model, plaintext token)
        """
        token = self.generate_registration_token()

        registration_token = RegistrationToken(
            token_hash=token.token_hash,
            token_prefix=token.prefix,
            mode=mode.value if isinstance(mode, AgentMode) else mode,
            display_name=display_name,
            monitored_services=json.dumps(monitored_services) if monitored_services else None,
            expires_at=datetime.now(UTC) + timedelta(minutes=expiry_minutes),
        )

        self.session.add(registration_token)
        await self.session.flush()  # Get the ID without committing

        logger.info(
            "Created registration token id=%d prefix=%s mode=%s expires_at=%s",
            registration_token.id,
            token.prefix,
            mode,
            registration_token.expires_at.isoformat(),
        )

        return registration_token, token.plaintext

    async def get_registration_token_by_hash(
        self, plaintext_token: str
    ) -> RegistrationToken | None:
        """Look up a registration token by its plaintext value.

        Args:
            plaintext_token: The plaintext token to look up

        Returns:
            RegistrationToken if found, None otherwise
        """
        token_hash = self.hash_token(plaintext_token)
        result = await self.session.execute(
            select(RegistrationToken).where(RegistrationToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def validate_registration_token(
        self, plaintext_token: str
    ) -> tuple[bool, RegistrationToken | None, str | None]:
        """Validate a registration token.

        Args:
            plaintext_token: The plaintext token to validate

        Returns:
            Tuple of (is_valid, token_if_valid, error_message_if_invalid)
        """
        token = await self.get_registration_token_by_hash(plaintext_token)

        if token is None:
            return False, None, "Invalid token"

        if token.is_claimed:
            return False, None, "Token has already been claimed"

        if token.is_expired:
            return False, None, "Token has expired"

        return True, token, None

    async def claim_registration_token(
        self,
        plaintext_token: str,
        server_id: str,
        hostname: str,
        hub_url: str,
    ) -> ClaimResult:
        """Claim a registration token and create agent credentials.

        This is the core of the pull-based registration flow:
        1. Validate the registration token
        2. Create or update the server record
        3. Generate per-agent API token
        4. Store credential (hash only)
        5. Mark registration token as claimed
        6. Return credentials for agent configuration

        Args:
            plaintext_token: The registration token to claim
            server_id: The server identifier (slug format)
            hostname: The server's hostname
            hub_url: The hub URL for the agent config

        Returns:
            ClaimResult with credentials or error
        """
        # Validate the token
        is_valid, registration_token, error = await self.validate_registration_token(
            plaintext_token
        )
        if not is_valid or registration_token is None:
            logger.warning(
                "Registration token claim failed: %s (server_id=%s)",
                error,
                server_id,
            )
            return ClaimResult(success=False, error=error)

        # Check if server already exists
        existing_server = await self.session.get(Server, server_id)

        if existing_server:
            # Server exists - this might be a re-registration
            if existing_server.guid:
                # Server has GUID - check if it has active credentials
                existing_cred = await self.session.execute(
                    select(AgentCredential).where(
                        AgentCredential.server_guid == existing_server.guid,
                        AgentCredential.revoked_at.is_(None),
                    )
                )
                if existing_cred.scalar_one_or_none():
                    logger.warning(
                        "Server %s already has active credentials, use rotate instead",
                        server_id,
                    )
                    return ClaimResult(
                        success=False,
                        error="Server already registered. Use token rotation to update credentials.",
                    )
            server = existing_server
        else:
            # Create new server record
            import uuid

            server_guid = str(uuid.uuid4())
            server = Server(
                id=server_id,
                guid=server_guid,
                hostname=hostname,
                display_name=registration_token.display_name,
            )
            self.session.add(server)
            await self.session.flush()

        # Ensure server has a GUID
        if not server.guid:
            import uuid

            server.guid = str(uuid.uuid4())
            await self.session.flush()

        # Generate agent API token
        agent_token = self.generate_agent_token(server.guid)

        # Create credential record
        credential = AgentCredential(
            server_guid=server.guid,
            api_token_hash=agent_token.token_hash,
            api_token_prefix=agent_token.prefix,
            is_legacy=False,
        )
        self.session.add(credential)

        # Mark registration token as claimed
        registration_token.claimed_at = datetime.now(UTC)
        registration_token.claimed_by_server_id = server.id

        await self.session.flush()

        # Generate config YAML
        monitored_services = (
            json.loads(registration_token.monitored_services)
            if registration_token.monitored_services
            else None
        )
        config_yaml = self._generate_config_yaml(
            hub_url=hub_url,
            server_id=server.id,
            server_guid=server.guid,
            api_token=agent_token.plaintext,
            mode=registration_token.mode,
            monitored_services=monitored_services,
        )

        logger.info(
            "Registration token claimed: token_id=%d server_id=%s server_guid=%s",
            registration_token.id,
            server.id,
            server.guid,
        )

        return ClaimResult(
            success=True,
            server_id=server.id,
            server_guid=server.guid,
            api_token=agent_token.plaintext,
            config_yaml=config_yaml,
        )

    async def get_credential_by_guid(self, server_guid: str) -> AgentCredential | None:
        """Get active credential for a server by GUID.

        Args:
            server_guid: The server's permanent GUID

        Returns:
            AgentCredential if found and active, None otherwise
        """
        result = await self.session.execute(
            select(AgentCredential).where(
                AgentCredential.server_guid == server_guid,
                AgentCredential.revoked_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def validate_agent_token(
        self, plaintext_token: str, server_guid: str
    ) -> tuple[bool, AgentCredential | None]:
        """Validate an agent API token.

        Args:
            plaintext_token: The plaintext token to validate
            server_guid: The server's GUID to match

        Returns:
            Tuple of (is_valid, credential_if_valid)
        """
        credential = await self.get_credential_by_guid(server_guid)

        if credential is None:
            return False, None

        if credential.is_revoked:
            return False, None

        if not self.verify_token(plaintext_token, credential.api_token_hash):
            return False, None

        # Update last used timestamp
        credential.last_used_at = datetime.now(UTC)

        return True, credential

    async def rotate_agent_token(self, server_guid: str) -> tuple[str | None, str | None]:
        """Rotate an agent's API token.

        Generates a new token and revokes the old one. There is no grace
        period - the agent must be reconfigured with the new token.

        Args:
            server_guid: The server's permanent GUID

        Returns:
            Tuple of (new_plaintext_token, error_message)
        """
        # Get existing credential
        old_credential = await self.get_credential_by_guid(server_guid)

        if old_credential is None:
            return None, "No active credential found for server"

        # Generate new token
        new_token = self.generate_agent_token(server_guid)

        # Create new credential
        new_credential = AgentCredential(
            server_guid=server_guid,
            api_token_hash=new_token.token_hash,
            api_token_prefix=new_token.prefix,
            is_legacy=False,
        )
        self.session.add(new_credential)

        # Revoke old credential
        old_credential.revoked_at = datetime.now(UTC)

        await self.session.flush()

        logger.info(
            "Agent token rotated: server_guid=%s old_prefix=%s new_prefix=%s",
            server_guid,
            old_credential.api_token_prefix,
            new_token.prefix,
        )

        return new_token.plaintext, None

    async def revoke_agent_token(self, server_guid: str) -> tuple[bool, str | None]:
        """Revoke an agent's API token.

        The agent will no longer be able to authenticate.

        Args:
            server_guid: The server's permanent GUID

        Returns:
            Tuple of (success, error_message)
        """
        credential = await self.get_credential_by_guid(server_guid)

        if credential is None:
            return False, "No active credential found for server"

        credential.revoked_at = datetime.now(UTC)

        logger.info(
            "Agent token revoked: server_guid=%s prefix=%s",
            server_guid,
            credential.api_token_prefix,
        )

        return True, None

    async def list_pending_registration_tokens(self) -> list[RegistrationToken]:
        """List all pending (unclaimed, unexpired) registration tokens.

        Returns:
            List of pending RegistrationToken records
        """
        result = await self.session.execute(
            select(RegistrationToken)
            .where(
                RegistrationToken.claimed_at.is_(None),
                RegistrationToken.expires_at > datetime.now(UTC),
            )
            .order_by(RegistrationToken.created_at.desc())
        )
        return list(result.scalars().all())

    async def cancel_registration_token(self, token_id: int) -> tuple[bool, str | None]:
        """Cancel a pending registration token.

        Args:
            token_id: The ID of the token to cancel

        Returns:
            Tuple of (success, error_message)
        """
        token = await self.session.get(RegistrationToken, token_id)

        if token is None:
            return False, "Token not found"

        if token.is_claimed:
            return False, "Token has already been claimed"

        # Delete the token
        await self.session.delete(token)

        logger.info("Registration token cancelled: id=%d", token_id)

        return True, None

    @staticmethod
    def _generate_config_yaml(
        hub_url: str,
        server_id: str,
        server_guid: str,
        api_token: str,
        mode: str,
        monitored_services: list[str] | None = None,
    ) -> str:
        """Generate YAML configuration for the agent.

        Args:
            hub_url: The hub URL for heartbeats
            server_id: The server identifier
            server_guid: The server's permanent GUID
            api_token: The agent's API token
            mode: Agent operating mode
            monitored_services: Optional list of services to monitor

        Returns:
            YAML configuration string
        """
        lines = [
            f"hub_url: {hub_url}",
            f"server_id: {server_id}",
            f"server_guid: {server_guid}",
            f"api_token: {api_token}",
            f"mode: {mode}",
            "heartbeat_interval: 60",
        ]

        if monitored_services:
            lines.append("monitored_services:")
            for service in monitored_services:
                lines.append(f"  - {service}")

        if mode == "readwrite":
            lines.append("command_execution_enabled: true")

        return "\n".join(lines) + "\n"
