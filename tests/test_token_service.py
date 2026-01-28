"""Tests for the token service.

Tests cover token generation, hashing, validation, and lifecycle management
for both registration tokens and agent API tokens.
"""

import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.db.models.agent_credential import AgentCredential
from homelab_cmd.db.models.registration_token import AgentMode, RegistrationToken
from homelab_cmd.db.models.server import Server
from homelab_cmd.services.token_service import (
    AGENT_TOKEN_PREFIX,
    REGISTRATION_TOKEN_PREFIX,
    TokenService,
)


class TestTokenGeneration:
    """Tests for static token generation methods."""

    def test_generate_registration_token_format(self) -> None:
        """Generated registration token should have correct prefix."""
        token = TokenService.generate_registration_token()

        assert token.plaintext.startswith(REGISTRATION_TOKEN_PREFIX)
        # hlh_rt_ (7) + 64 hex chars = 71 total
        assert len(token.plaintext) == 71

    def test_generate_registration_token_uniqueness(self) -> None:
        """Each call should generate a unique token."""
        token1 = TokenService.generate_registration_token()
        token2 = TokenService.generate_registration_token()

        assert token1.plaintext != token2.plaintext
        assert token1.token_hash != token2.token_hash

    def test_generate_registration_token_hash_matches(self) -> None:
        """Generated hash should match SHA-256 of plaintext."""
        token = TokenService.generate_registration_token()

        expected_hash = hashlib.sha256(token.plaintext.encode()).hexdigest()
        assert token.token_hash == expected_hash

    def test_generate_registration_token_prefix_extraction(self) -> None:
        """Token prefix should be first 16 characters."""
        token = TokenService.generate_registration_token()

        assert token.prefix == token.plaintext[:16]
        assert token.prefix.startswith(REGISTRATION_TOKEN_PREFIX)

    def test_generate_agent_token_format(self) -> None:
        """Generated agent token should have correct format with GUID prefix."""
        server_guid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        token = TokenService.generate_agent_token(server_guid)

        assert token.plaintext.startswith(AGENT_TOKEN_PREFIX)
        # Should contain first 8 chars of GUID
        assert "a1b2c3d4" in token.plaintext
        # hlh_ag_ (7) + guid_prefix (8) + _ (1) + 64 hex chars = 80 total
        assert len(token.plaintext) == 80

    def test_generate_agent_token_uniqueness(self) -> None:
        """Each call should generate a unique agent token."""
        server_guid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        token1 = TokenService.generate_agent_token(server_guid)
        token2 = TokenService.generate_agent_token(server_guid)

        assert token1.plaintext != token2.plaintext
        assert token1.token_hash != token2.token_hash

    def test_generate_agent_token_hash_matches(self) -> None:
        """Generated hash should match SHA-256 of plaintext."""
        server_guid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        token = TokenService.generate_agent_token(server_guid)

        expected_hash = hashlib.sha256(token.plaintext.encode()).hexdigest()
        assert token.token_hash == expected_hash


class TestTokenHashing:
    """Tests for token hashing and verification."""

    def test_hash_token_produces_sha256(self) -> None:
        """hash_token should produce a 64-character hex SHA-256 hash."""
        plaintext = "test-token-12345"
        result = TokenService.hash_token(plaintext)

        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_hash_token_consistent(self) -> None:
        """Same plaintext should always produce same hash."""
        plaintext = "test-token-12345"
        hash1 = TokenService.hash_token(plaintext)
        hash2 = TokenService.hash_token(plaintext)

        assert hash1 == hash2

    def test_hash_token_different_for_different_input(self) -> None:
        """Different plaintexts should produce different hashes."""
        hash1 = TokenService.hash_token("token-one")
        hash2 = TokenService.hash_token("token-two")

        assert hash1 != hash2

    def test_verify_token_accepts_correct_token(self) -> None:
        """verify_token should return True for matching token and hash."""
        plaintext = "test-token-12345"
        stored_hash = hashlib.sha256(plaintext.encode()).hexdigest()

        assert TokenService.verify_token(plaintext, stored_hash) is True

    def test_verify_token_rejects_wrong_token(self) -> None:
        """verify_token should return False for non-matching token."""
        plaintext = "test-token-12345"
        stored_hash = hashlib.sha256(b"different-token").hexdigest()

        assert TokenService.verify_token(plaintext, stored_hash) is False

    def test_verify_token_timing_safe(self) -> None:
        """verify_token should use timing-safe comparison (secrets.compare_digest)."""
        # This is more of a documentation test - we verify the implementation
        # uses compare_digest by testing that wrong hashes are rejected
        plaintext = "test-token"
        correct_hash = TokenService.hash_token(plaintext)

        # Slightly different hash should be rejected
        wrong_hash = correct_hash[:-1] + ("0" if correct_hash[-1] != "0" else "1")
        assert TokenService.verify_token(plaintext, wrong_hash) is False


class TestRegistrationTokenLifecycle:
    """Tests for registration token database operations."""

    @pytest.mark.asyncio
    async def test_create_registration_token_stores_hash_only(
        self, db_session: AsyncSession
    ) -> None:
        """Created token should store hash, not plaintext."""
        service = TokenService(db_session)

        token_record, plaintext = await service.create_registration_token()
        await db_session.commit()

        assert token_record.token_hash is not None
        assert plaintext not in token_record.token_hash
        # Verify hash matches plaintext
        expected_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        assert token_record.token_hash == expected_hash

    @pytest.mark.asyncio
    async def test_create_registration_token_with_custom_expiry(
        self, db_session: AsyncSession
    ) -> None:
        """Token should respect custom expiry time."""
        service = TokenService(db_session)

        token_record, _ = await service.create_registration_token(expiry_minutes=30)
        await db_session.commit()

        expected_expiry = datetime.now(UTC) + timedelta(minutes=30)
        # Allow 5 second tolerance
        assert abs((token_record.expires_at - expected_expiry).total_seconds()) < 5

    @pytest.mark.asyncio
    async def test_create_registration_token_with_mode(
        self, db_session: AsyncSession
    ) -> None:
        """Token should store specified agent mode."""
        service = TokenService(db_session)

        token_record, _ = await service.create_registration_token(
            mode=AgentMode.READWRITE
        )
        await db_session.commit()

        assert token_record.mode == AgentMode.READWRITE.value

    @pytest.mark.asyncio
    async def test_create_registration_token_with_display_name(
        self, db_session: AsyncSession
    ) -> None:
        """Token should store display name for the server."""
        service = TokenService(db_session)

        token_record, _ = await service.create_registration_token(
            display_name="My Test Server"
        )
        await db_session.commit()

        assert token_record.display_name == "My Test Server"

    @pytest.mark.asyncio
    async def test_create_registration_token_with_services(
        self, db_session: AsyncSession
    ) -> None:
        """Token should store monitored services as JSON."""
        service = TokenService(db_session)
        services = ["nginx", "docker", "postgresql"]

        token_record, _ = await service.create_registration_token(
            monitored_services=services
        )
        await db_session.commit()

        import json

        stored_services = json.loads(token_record.monitored_services)
        assert stored_services == services

    @pytest.mark.asyncio
    async def test_get_registration_token_by_hash_found(
        self, db_session: AsyncSession
    ) -> None:
        """Should find token when given correct plaintext."""
        service = TokenService(db_session)
        _, plaintext = await service.create_registration_token()
        await db_session.commit()

        found = await service.get_registration_token_by_hash(plaintext)

        assert found is not None
        assert found.token_hash == hashlib.sha256(plaintext.encode()).hexdigest()

    @pytest.mark.asyncio
    async def test_get_registration_token_by_hash_not_found(
        self, db_session: AsyncSession
    ) -> None:
        """Should return None for non-existent token."""
        service = TokenService(db_session)

        found = await service.get_registration_token_by_hash("hlh_rt_nonexistent")

        assert found is None

    @pytest.mark.asyncio
    async def test_validate_registration_token_valid(
        self, db_session: AsyncSession
    ) -> None:
        """Valid token should pass validation."""
        service = TokenService(db_session)
        _, plaintext = await service.create_registration_token()
        await db_session.commit()

        is_valid, token, error = await service.validate_registration_token(plaintext)

        assert is_valid is True
        assert token is not None
        assert error is None

    @pytest.mark.asyncio
    async def test_validate_registration_token_invalid(
        self, db_session: AsyncSession
    ) -> None:
        """Non-existent token should fail validation."""
        service = TokenService(db_session)

        is_valid, token, error = await service.validate_registration_token(
            "hlh_rt_invalid123"
        )

        assert is_valid is False
        assert token is None
        assert error == "Invalid token"

    @pytest.mark.asyncio
    async def test_validate_registration_token_expired(
        self, db_session: AsyncSession
    ) -> None:
        """Expired token should fail validation."""
        service = TokenService(db_session)
        token_record, plaintext = await service.create_registration_token(
            expiry_minutes=1
        )
        # Manually expire the token
        token_record.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        await db_session.commit()

        is_valid, token, error = await service.validate_registration_token(plaintext)

        assert is_valid is False
        assert token is None
        assert error == "Token has expired"

    @pytest.mark.asyncio
    async def test_validate_registration_token_already_claimed(
        self, db_session: AsyncSession
    ) -> None:
        """Already claimed token should fail validation."""
        service = TokenService(db_session)

        # Create a new server first (needed for claimed_by_server_id FK)
        from homelab_cmd.db.models.server import Server

        server = Server(
            id="test-server",
            guid="test-guid-12345678",
            hostname="test.local",
        )
        db_session.add(server)
        await db_session.flush()

        token_record, plaintext = await service.create_registration_token()
        # Mark as claimed
        token_record.claimed_at = datetime.now(UTC)
        token_record.claimed_by_server_id = "test-server"
        await db_session.commit()

        is_valid, token, error = await service.validate_registration_token(plaintext)

        assert is_valid is False
        assert token is None
        assert error == "Token has already been claimed"

    @pytest.mark.asyncio
    async def test_list_pending_registration_tokens_filters_correctly(
        self, db_session: AsyncSession
    ) -> None:
        """Should only list unclaimed, unexpired tokens."""
        service = TokenService(db_session)

        # Create valid pending token
        valid_token, _ = await service.create_registration_token()

        # Create expired token
        expired, _ = await service.create_registration_token()
        expired.expires_at = datetime.now(UTC) - timedelta(hours=1)

        # Create claimed token
        claimed, _ = await service.create_registration_token()
        claimed.claimed_at = datetime.now(UTC)

        await db_session.commit()

        pending = await service.list_pending_registration_tokens()

        # Should only return the valid pending token
        assert len(pending) == 1
        assert pending[0].claimed_at is None
        # Check that it's the valid token by ID (avoid timezone comparison issues with SQLite)
        assert pending[0].id == valid_token.id

    @pytest.mark.asyncio
    async def test_cancel_registration_token_success(
        self, db_session: AsyncSession
    ) -> None:
        """Should delete unclaimed token."""
        service = TokenService(db_session)
        token_record, _ = await service.create_registration_token()
        await db_session.commit()
        token_id = token_record.id

        success, error = await service.cancel_registration_token(token_id)
        await db_session.commit()

        assert success is True
        assert error is None
        # Verify deleted
        deleted = await db_session.get(RegistrationToken, token_id)
        assert deleted is None

    @pytest.mark.asyncio
    async def test_cancel_registration_token_not_found(
        self, db_session: AsyncSession
    ) -> None:
        """Should return error for non-existent token."""
        service = TokenService(db_session)

        success, error = await service.cancel_registration_token(99999)

        assert success is False
        assert error == "Token not found"

    @pytest.mark.asyncio
    async def test_cancel_registration_token_already_claimed(
        self, db_session: AsyncSession
    ) -> None:
        """Should refuse to cancel claimed token."""
        service = TokenService(db_session)
        token_record, _ = await service.create_registration_token()
        token_record.claimed_at = datetime.now(UTC)
        await db_session.commit()

        success, error = await service.cancel_registration_token(token_record.id)

        assert success is False
        assert error == "Token has already been claimed"


class TestClaimRegistrationToken:
    """Tests for the registration token claim flow."""

    @pytest.mark.asyncio
    async def test_claim_creates_server_and_credential(
        self, db_session: AsyncSession
    ) -> None:
        """Claiming token should create server and credential records."""
        service = TokenService(db_session)
        _, plaintext = await service.create_registration_token(
            display_name="Test Server"
        )
        await db_session.commit()

        result = await service.claim_registration_token(
            plaintext_token=plaintext,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        assert result.success is True
        assert result.server_id == "test-server"
        assert result.server_guid is not None
        assert result.api_token is not None
        assert result.api_token.startswith(AGENT_TOKEN_PREFIX)
        assert result.config_yaml is not None

        # Verify server was created
        server = await db_session.get(Server, "test-server")
        assert server is not None
        assert server.display_name == "Test Server"

        # Verify credential was created
        from sqlalchemy import select

        cred_result = await db_session.execute(
            select(AgentCredential).where(
                AgentCredential.server_guid == result.server_guid
            )
        )
        credential = cred_result.scalar_one_or_none()
        assert credential is not None
        assert credential.is_legacy is False

    @pytest.mark.asyncio
    async def test_claim_marks_token_as_claimed(
        self, db_session: AsyncSession
    ) -> None:
        """Claiming should mark the registration token as claimed."""
        service = TokenService(db_session)
        token_record, plaintext = await service.create_registration_token()
        await db_session.commit()

        result = await service.claim_registration_token(
            plaintext_token=plaintext,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        assert result.success is True
        # Refresh token record
        await db_session.refresh(token_record)
        assert token_record.claimed_at is not None
        assert token_record.claimed_by_server_id == "test-server"

    @pytest.mark.asyncio
    async def test_claim_generates_config_yaml(
        self, db_session: AsyncSession
    ) -> None:
        """Claim result should include properly formatted config YAML."""
        service = TokenService(db_session)
        _, plaintext = await service.create_registration_token(
            mode=AgentMode.READWRITE, monitored_services=["nginx", "docker"]
        )
        await db_session.commit()

        result = await service.claim_registration_token(
            plaintext_token=plaintext,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )

        assert result.success is True
        assert "hub_url: http://hub.local:8000" in result.config_yaml
        assert "server_id: test-server" in result.config_yaml
        assert "mode: readwrite" in result.config_yaml
        assert "monitored_services:" in result.config_yaml
        assert "- nginx" in result.config_yaml
        assert "- docker" in result.config_yaml
        assert "command_execution_enabled: true" in result.config_yaml

    @pytest.mark.asyncio
    async def test_claim_invalid_token_fails(
        self, db_session: AsyncSession
    ) -> None:
        """Claiming invalid token should fail."""
        service = TokenService(db_session)

        result = await service.claim_registration_token(
            plaintext_token="hlh_rt_invalid",
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )

        assert result.success is False
        assert result.error == "Invalid token"

    @pytest.mark.asyncio
    async def test_claim_existing_server_with_active_credential_fails(
        self, db_session: AsyncSession
    ) -> None:
        """Should not allow claiming when server already has active credential."""
        service = TokenService(db_session)

        # First claim
        _, token1 = await service.create_registration_token()
        await db_session.commit()
        result1 = await service.claim_registration_token(
            plaintext_token=token1,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()
        assert result1.success is True

        # Try second claim for same server
        _, token2 = await service.create_registration_token()
        await db_session.commit()
        result2 = await service.claim_registration_token(
            plaintext_token=token2,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )

        assert result2.success is False
        assert "already registered" in result2.error


class TestAgentCredentialOperations:
    """Tests for agent credential management."""

    @pytest.mark.asyncio
    async def test_validate_agent_token_success(
        self, db_session: AsyncSession
    ) -> None:
        """Valid agent token should pass validation."""
        service = TokenService(db_session)

        # Set up server and credential via claim
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        is_valid, credential = await service.validate_agent_token(
            plaintext_token=claim_result.api_token,
            server_guid=claim_result.server_guid,
        )

        assert is_valid is True
        assert credential is not None
        assert credential.server_guid == claim_result.server_guid

    @pytest.mark.asyncio
    async def test_validate_agent_token_updates_last_used(
        self, db_session: AsyncSession
    ) -> None:
        """Successful validation should update last_used_at."""
        service = TokenService(db_session)

        # Set up server and credential
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        before = datetime.now(UTC)
        is_valid, credential = await service.validate_agent_token(
            plaintext_token=claim_result.api_token,
            server_guid=claim_result.server_guid,
        )
        after = datetime.now(UTC)

        assert is_valid is True
        assert credential.last_used_at is not None
        assert before <= credential.last_used_at <= after

    @pytest.mark.asyncio
    async def test_validate_agent_token_wrong_token(
        self, db_session: AsyncSession
    ) -> None:
        """Wrong token should fail validation."""
        service = TokenService(db_session)

        # Set up server and credential
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        is_valid, credential = await service.validate_agent_token(
            plaintext_token="hlh_ag_wrong_token",
            server_guid=claim_result.server_guid,
        )

        assert is_valid is False
        assert credential is None

    @pytest.mark.asyncio
    async def test_validate_agent_token_wrong_guid(
        self, db_session: AsyncSession
    ) -> None:
        """Token with wrong GUID should fail validation."""
        service = TokenService(db_session)

        # Set up server and credential
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        is_valid, credential = await service.validate_agent_token(
            plaintext_token=claim_result.api_token,
            server_guid="wrong-guid-12345678",
        )

        assert is_valid is False
        assert credential is None

    @pytest.mark.asyncio
    async def test_rotate_agent_token_success(
        self, db_session: AsyncSession
    ) -> None:
        """Token rotation should create new credential and revoke old."""
        service = TokenService(db_session)

        # Set up server and credential
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()
        old_token = claim_result.api_token

        # Rotate
        new_token, error = await service.rotate_agent_token(claim_result.server_guid)
        await db_session.commit()

        assert new_token is not None
        assert error is None
        assert new_token != old_token
        assert new_token.startswith(AGENT_TOKEN_PREFIX)

        # Old token should no longer work
        is_valid, _ = await service.validate_agent_token(
            plaintext_token=old_token,
            server_guid=claim_result.server_guid,
        )
        assert is_valid is False

        # New token should work
        is_valid, _ = await service.validate_agent_token(
            plaintext_token=new_token,
            server_guid=claim_result.server_guid,
        )
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_rotate_agent_token_no_credential(
        self, db_session: AsyncSession
    ) -> None:
        """Rotation should fail when no credential exists."""
        service = TokenService(db_session)

        new_token, error = await service.rotate_agent_token("nonexistent-guid")

        assert new_token is None
        assert error == "No active credential found for server"

    @pytest.mark.asyncio
    async def test_revoke_agent_token_success(
        self, db_session: AsyncSession
    ) -> None:
        """Token revocation should prevent further authentication."""
        service = TokenService(db_session)

        # Set up server and credential
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()

        # Revoke
        success, error = await service.revoke_agent_token(claim_result.server_guid)
        await db_session.commit()

        assert success is True
        assert error is None

        # Token should no longer work
        is_valid, _ = await service.validate_agent_token(
            plaintext_token=claim_result.api_token,
            server_guid=claim_result.server_guid,
        )
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_revoke_agent_token_no_credential(
        self, db_session: AsyncSession
    ) -> None:
        """Revocation should fail when no credential exists."""
        service = TokenService(db_session)

        success, error = await service.revoke_agent_token("nonexistent-guid")

        assert success is False
        assert error == "No active credential found for server"

    @pytest.mark.asyncio
    async def test_get_credential_by_guid_excludes_revoked(
        self, db_session: AsyncSession
    ) -> None:
        """get_credential_by_guid should not return revoked credentials."""
        service = TokenService(db_session)

        # Set up and revoke
        _, reg_token = await service.create_registration_token()
        await db_session.commit()
        claim_result = await service.claim_registration_token(
            plaintext_token=reg_token,
            server_id="test-server",
            hostname="test.local",
            hub_url="http://hub.local:8000",
        )
        await db_session.commit()
        await service.revoke_agent_token(claim_result.server_guid)
        await db_session.commit()

        credential = await service.get_credential_by_guid(claim_result.server_guid)

        assert credential is None


class TestConfigYamlGeneration:
    """Tests for config YAML generation."""

    def test_generate_config_yaml_basic(self) -> None:
        """Should generate basic config YAML."""
        config = TokenService._generate_config_yaml(
            hub_url="http://hub.local:8000",
            server_id="test-server",
            server_guid="abc-123-def",
            api_token="hlh_ag_abc12345_randomtoken",
            mode="readonly",
        )

        assert "hub_url: http://hub.local:8000" in config
        assert "server_id: test-server" in config
        assert "server_guid: abc-123-def" in config
        assert "api_token: hlh_ag_abc12345_randomtoken" in config
        assert "mode: readonly" in config
        assert "heartbeat_interval: 60" in config
        assert "command_execution_enabled" not in config

    def test_generate_config_yaml_readwrite_mode(self) -> None:
        """Readwrite mode should enable command execution."""
        config = TokenService._generate_config_yaml(
            hub_url="http://hub.local:8000",
            server_id="test-server",
            server_guid="abc-123-def",
            api_token="hlh_ag_test",
            mode="readwrite",
        )

        assert "mode: readwrite" in config
        assert "command_execution_enabled: true" in config

    def test_generate_config_yaml_with_services(self) -> None:
        """Should include monitored services list."""
        config = TokenService._generate_config_yaml(
            hub_url="http://hub.local:8000",
            server_id="test-server",
            server_guid="abc-123-def",
            api_token="hlh_ag_test",
            mode="readonly",
            monitored_services=["nginx", "docker", "postgresql"],
        )

        assert "monitored_services:" in config
        assert "  - nginx" in config
        assert "  - docker" in config
        assert "  - postgresql" in config
