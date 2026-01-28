"""Tests for CredentialService (US0081: Credential Encryption and Storage).

Tests cover:
- Credential storage and retrieval (encrypt/decrypt roundtrip)
- Validation (credential types, empty values)
- Edge cases (non-existent credentials, updates, deletes)
- Error handling (invalid key, corrupted ciphertext)
- CLI key generation
- EP0015: Per-server credential storage and retrieval
"""

import pytest
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.services.credential_service import (
    ALLOWED_CREDENTIAL_TYPES,
    CredentialDecryptionError,
    CredentialService,
)


# Generate a valid test encryption key
@pytest.fixture
def encryption_key() -> str:
    """Generate a valid Fernet encryption key for tests."""
    return Fernet.generate_key().decode()


class TestCredentialServiceStorage:
    """Test credential storage and retrieval."""

    @pytest.mark.asyncio
    async def test_store_and_retrieve_tailscale_token(
        self, db_session, encryption_key
    ) -> None:
        """AC2, AC3, AC4: Store and retrieve tailscale_token credential."""
        service = CredentialService(db_session, encryption_key)
        plaintext = "tskey-api-abc123-EXAMPLE"

        # Store credential
        credential_id = await service.store_credential("tailscale_token", plaintext)
        await db_session.commit()

        assert credential_id is not None

        # Retrieve and verify decryption
        decrypted = await service.get_credential("tailscale_token")
        assert decrypted == plaintext

    @pytest.mark.asyncio
    async def test_store_and_retrieve_ssh_private_key(
        self, db_session, encryption_key
    ) -> None:
        """AC2, AC3, AC4: Store and retrieve ssh_private_key credential."""
        service = CredentialService(db_session, encryption_key)
        plaintext = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key-content\n-----END OPENSSH PRIVATE KEY-----"

        # Store credential
        credential_id = await service.store_credential("ssh_private_key", plaintext)
        await db_session.commit()

        assert credential_id is not None

        # Retrieve and verify decryption
        decrypted = await service.get_credential("ssh_private_key")
        assert decrypted == plaintext

    @pytest.mark.asyncio
    async def test_encrypted_value_is_not_plaintext(
        self, db_session, encryption_key
    ) -> None:
        """AC2: Verify encrypted value in database is not plaintext."""
        from sqlalchemy import select

        from homelab_cmd.db.models.credential import Credential

        service = CredentialService(db_session, encryption_key)
        plaintext = "tskey-api-abc123-EXAMPLE"

        await service.store_credential("tailscale_token", plaintext)
        await db_session.commit()

        # Query database directly
        stmt = select(Credential).where(Credential.credential_type == "tailscale_token")
        result = await db_session.execute(stmt)
        credential = result.scalar_one()

        # Verify stored value is not plaintext
        assert credential.encrypted_value != plaintext
        assert "tskey" not in credential.encrypted_value


class TestCredentialServiceValidation:
    """Test input validation."""

    @pytest.mark.asyncio
    async def test_unknown_credential_type_rejected(
        self, db_session, encryption_key
    ) -> None:
        """AC4: Unknown credential type raises ValueError."""
        service = CredentialService(db_session, encryption_key)

        with pytest.raises(ValueError) as exc_info:
            await service.store_credential("unknown_type", "some-value")

        assert "Unknown credential type" in str(exc_info.value)
        assert "unknown_type" in str(exc_info.value)
        assert "tailscale_token" in str(exc_info.value)
        assert "ssh_private_key" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_empty_value_rejected(self, db_session, encryption_key) -> None:
        """Edge case: Empty credential value raises ValueError."""
        service = CredentialService(db_session, encryption_key)

        with pytest.raises(ValueError) as exc_info:
            await service.store_credential("tailscale_token", "")

        assert "cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_whitespace_only_value_rejected(
        self, db_session, encryption_key
    ) -> None:
        """Edge case: Whitespace-only value raises ValueError."""
        service = CredentialService(db_session, encryption_key)

        with pytest.raises(ValueError) as exc_info:
            await service.store_credential("tailscale_token", "   \t\n  ")

        assert "cannot be empty" in str(exc_info.value)

    def test_invalid_encryption_key_format(self, db_session) -> None:
        """AC1: Invalid encryption key format raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            CredentialService(db_session, "not-a-valid-key")

        assert "Invalid encryption key format" in str(exc_info.value)
        assert "generate-key" in str(exc_info.value)


class TestCredentialServiceEdgeCases:
    """Test edge cases and error scenarios."""

    @pytest.mark.asyncio
    async def test_get_nonexistent_credential_returns_none(
        self, db_session, encryption_key
    ) -> None:
        """Edge case: Get non-existent credential returns None."""
        service = CredentialService(db_session, encryption_key)

        result = await service.get_credential("tailscale_token")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_existing_credential_returns_true(
        self, db_session, encryption_key
    ) -> None:
        """Edge case: Delete existing credential returns True."""
        service = CredentialService(db_session, encryption_key)

        await service.store_credential("tailscale_token", "test-value")
        await db_session.commit()

        result = await service.delete_credential("tailscale_token")
        await db_session.commit()

        assert result is True

        # Verify deletion
        exists = await service.credential_exists("tailscale_token")
        assert exists is False

    @pytest.mark.asyncio
    async def test_delete_nonexistent_credential_returns_false(
        self, db_session, encryption_key
    ) -> None:
        """Edge case: Delete non-existent credential returns False."""
        service = CredentialService(db_session, encryption_key)

        result = await service.delete_credential("tailscale_token")
        assert result is False

    @pytest.mark.asyncio
    async def test_update_existing_credential(
        self, db_session, encryption_key
    ) -> None:
        """Edge case: Storing same type updates existing credential."""
        service = CredentialService(db_session, encryption_key)

        # Store initial value
        id1 = await service.store_credential("tailscale_token", "initial-value")
        await db_session.commit()

        # Update with new value
        id2 = await service.store_credential("tailscale_token", "updated-value")
        await db_session.commit()

        # Same ID (update, not insert)
        assert id2 == id1

        # Verify updated value
        decrypted = await service.get_credential("tailscale_token")
        assert decrypted == "updated-value"

    @pytest.mark.asyncio
    async def test_credential_exists(self, db_session, encryption_key) -> None:
        """Test credential_exists method."""
        service = CredentialService(db_session, encryption_key)

        # Not exists initially
        assert await service.credential_exists("tailscale_token") is False

        # Create credential
        await service.store_credential("tailscale_token", "test-value")
        await db_session.commit()

        # Now exists
        assert await service.credential_exists("tailscale_token") is True


class TestCredentialServiceDecryptionErrors:
    """Test decryption error scenarios."""

    @pytest.mark.asyncio
    async def test_corrupted_ciphertext_raises_error(
        self, db_session, encryption_key
    ) -> None:
        """Edge case: Corrupted ciphertext raises CredentialDecryptionError."""
        from homelab_cmd.db.models.credential import Credential

        # Insert corrupted data directly
        credential = Credential(
            id="test-id",
            credential_type="tailscale_token",
            encrypted_value="corrupted-not-valid-fernet-data",
        )
        db_session.add(credential)
        await db_session.commit()

        service = CredentialService(db_session, encryption_key)

        with pytest.raises(CredentialDecryptionError) as exc_info:
            await service.get_credential("tailscale_token")

        assert exc_info.value.credential_type == "tailscale_token"
        assert "re-enter the credential" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_wrong_key_raises_decryption_error(self, db_session) -> None:
        """Edge case: Different encryption key cannot decrypt."""
        # Store with one key
        key1 = Fernet.generate_key().decode()
        service1 = CredentialService(db_session, key1)
        await service1.store_credential("tailscale_token", "secret-value")
        await db_session.commit()

        # Try to retrieve with different key
        key2 = Fernet.generate_key().decode()
        service2 = CredentialService(db_session, key2)

        with pytest.raises(CredentialDecryptionError):
            await service2.get_credential("tailscale_token")


class TestCredentialServiceConstants:
    """Test module constants."""

    def test_allowed_credential_types(self) -> None:
        """AC4: Verify allowed credential types (EP0015: added sudo_password, ssh_password)."""
        assert "tailscale_token" in ALLOWED_CREDENTIAL_TYPES
        assert "ssh_private_key" in ALLOWED_CREDENTIAL_TYPES
        # EP0015: New credential types for per-host credentials
        assert "sudo_password" in ALLOWED_CREDENTIAL_TYPES
        assert "ssh_password" in ALLOWED_CREDENTIAL_TYPES
        assert len(ALLOWED_CREDENTIAL_TYPES) == 4


class TestCLIKeyGeneration:
    """Test CLI key generation command."""

    def test_generate_key_produces_valid_fernet_key(self) -> None:
        """AC5: CLI generates valid Fernet key."""
        from click.testing import CliRunner

        from homelab_cmd.cli import generate_key

        runner = CliRunner()
        result = runner.invoke(generate_key)

        assert result.exit_code == 0
        assert "Generated encryption key" in result.output
        assert "HOMELABCMD_ENCRYPTION_KEY" in result.output

        # Extract the key from output and verify it's valid
        lines = result.output.split("\n")
        key_line = None
        for i, line in enumerate(lines):
            if "Generated encryption key:" in line:
                key_line = lines[i + 1].strip()
                break

        assert key_line is not None

        # Verify the key is valid Fernet format
        fernet = Fernet(key_line.encode())
        # If we get here without exception, key is valid
        test_data = b"test"
        encrypted = fernet.encrypt(test_data)
        decrypted = fernet.decrypt(encrypted)
        assert decrypted == test_data

    def test_generate_key_shows_warning(self) -> None:
        """AC5: CLI shows security warning about key storage."""
        from click.testing import CliRunner

        from homelab_cmd.cli import generate_key

        runner = CliRunner()
        result = runner.invoke(generate_key)

        assert result.exit_code == 0
        assert "WARNING" in result.output
        assert "securely" in result.output.lower()


class TestPerServerCredentials:
    """Test per-server credential functionality (EP0015)."""

    @pytest.fixture
    async def service_with_server(
        self, db_session: AsyncSession, encryption_key: str
    ) -> tuple[CredentialService, str]:
        """Create service and a test server."""
        from homelab_cmd.db.models.server import Server

        service = CredentialService(db_session, encryption_key)

        # Create a test server
        server = Server(
            id="test-server-1",
            hostname="test-server.local",
        )
        db_session.add(server)
        await db_session.flush()

        return service, "test-server-1"

    async def test_store_per_server_credential(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC1: Store per-server credential."""
        service, server_id = service_with_server

        cred_id = await service.store_credential(
            "sudo_password", "server-secret-123", server_id=server_id
        )

        assert cred_id is not None
        value = await service.get_credential("sudo_password", server_id=server_id)
        assert value == "server-secret-123"

    async def test_global_credential_separate_from_per_server(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC2: Global and per-server credentials are separate."""
        service, server_id = service_with_server

        # Store global
        await service.store_credential("sudo_password", "global-password")
        # Store per-server
        await service.store_credential(
            "sudo_password", "server-password", server_id=server_id
        )

        # Retrieve each - they should be different
        global_value = await service.get_credential("sudo_password")
        per_server_value = await service.get_credential("sudo_password", server_id=server_id)

        assert global_value == "global-password"
        assert per_server_value == "server-password"

    async def test_get_per_server_returns_none_when_only_global_exists(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC2: get_credential does not fall back - use get_effective_credential."""
        service, server_id = service_with_server

        # Store only global
        await service.store_credential("sudo_password", "global-password")

        # get_credential for server should return None (no fallback)
        per_server_value = await service.get_credential("sudo_password", server_id=server_id)
        assert per_server_value is None

    async def test_get_effective_credential_returns_per_server(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC3: get_effective_credential returns per-server when both exist."""
        service, server_id = service_with_server

        # Store both
        await service.store_credential("sudo_password", "global-password")
        await service.store_credential(
            "sudo_password", "server-password", server_id=server_id
        )

        # Effective should be per-server
        effective = await service.get_effective_credential("sudo_password", server_id)
        assert effective == "server-password"

    async def test_get_effective_credential_falls_back_to_global(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC3: get_effective_credential returns global when per-server doesn't exist."""
        service, server_id = service_with_server

        # Store only global
        await service.store_credential("sudo_password", "global-password")

        # Effective should fall back to global
        effective = await service.get_effective_credential("sudo_password", server_id)
        assert effective == "global-password"

    async def test_get_effective_credential_returns_none_when_neither_exists(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC3: get_effective_credential returns None when neither exists."""
        service, server_id = service_with_server

        # No credentials stored
        effective = await service.get_effective_credential("sudo_password", server_id)
        assert effective is None

    async def test_delete_per_server_leaves_global(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC4: Deleting per-server credential leaves global intact."""
        service, server_id = service_with_server

        # Store both
        await service.store_credential("sudo_password", "global-password")
        await service.store_credential(
            "sudo_password", "server-password", server_id=server_id
        )

        # Delete per-server
        deleted = await service.delete_credential("sudo_password", server_id=server_id)
        assert deleted is True

        # Per-server should be gone
        per_server = await service.get_credential("sudo_password", server_id=server_id)
        assert per_server is None

        # Global should remain
        global_value = await service.get_credential("sudo_password")
        assert global_value == "global-password"

    async def test_credential_exists_per_server(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC6: credential_exists works for per-server credentials."""
        service, server_id = service_with_server

        # Initially no credential
        assert await service.credential_exists("sudo_password", server_id=server_id) is False

        # Store per-server
        await service.store_credential(
            "sudo_password", "server-password", server_id=server_id
        )

        # Now exists
        assert await service.credential_exists("sudo_password", server_id=server_id) is True

    async def test_get_credential_scope_per_server(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """get_credential_scope returns 'per_server' when server has credential."""
        service, server_id = service_with_server

        await service.store_credential(
            "sudo_password", "server-password", server_id=server_id
        )

        scope = await service.get_credential_scope("sudo_password", server_id)
        assert scope == "per_server"

    async def test_get_credential_scope_global(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """get_credential_scope returns 'global' when only global exists."""
        service, server_id = service_with_server

        await service.store_credential("sudo_password", "global-password")

        scope = await service.get_credential_scope("sudo_password", server_id)
        assert scope == "global"

    async def test_get_credential_scope_none(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """get_credential_scope returns 'none' when no credential exists."""
        service, server_id = service_with_server

        scope = await service.get_credential_scope("sudo_password", server_id)
        assert scope == "none"

    async def test_store_sudo_password_type(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC5: Can store sudo_password credential type."""
        service, server_id = service_with_server

        cred_id = await service.store_credential(
            "sudo_password", "my-sudo-pass", server_id=server_id
        )
        assert cred_id is not None

    async def test_store_ssh_password_type(
        self, service_with_server: tuple[CredentialService, str]
    ) -> None:
        """AC5: Can store ssh_password credential type."""
        service, server_id = service_with_server

        cred_id = await service.store_credential(
            "ssh_password", "my-ssh-pass", server_id=server_id
        )
        assert cred_id is not None
