"""SSH connection service for ad-hoc device scanning.

This module provides SSH connection capabilities for scanning transient devices
that don't have agents installed. It handles:
- SSH key discovery and validation
- Connection testing with multiple key support
- Proper error handling for network issues
- SSH key management (upload, delete, metadata)
- Default key management (US0093)

US0037: SSH Key Configuration
US0071: SSH Key Manager UI
US0093: Unified SSH Key Management
"""

import asyncio
import base64
import hashlib
import io
import json
import logging
import os
import re
import stat
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

import paramiko
from paramiko import AuthenticationException, SSHException

from homelab_cmd.config import get_settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class ConnectionResult:
    """Result of an SSH connection test.

    US0073: Network Discovery Key Selection - added key_used field.
    """

    success: bool
    hostname: str
    remote_hostname: str | None = None
    response_time_ms: int | None = None
    error: str | None = None
    key_used: str | None = None  # Name of key that succeeded


@dataclass
class CommandResult:
    """Result of an SSH command execution."""

    success: bool
    stdout: str
    stderr: str
    exit_code: int
    error: str | None = None


@dataclass
class SSHKeyMetadata:
    """Metadata about an SSH key (without the private key content).

    US0071: SSH Key Manager UI - AC1
    US0072: SSH Key Username Association
    US0093: Unified SSH Key Management - added is_default field
    """

    id: str
    name: str
    type: str
    fingerprint: str
    created_at: datetime
    username: str | None = None
    is_default: bool = False


class SSHKeyError(Exception):
    """Exception raised for SSH key validation errors."""

    pass


class SSHConnectionService:
    """Service for managing SSH connections to remote devices.

    Handles key discovery, permission validation, and connection testing.
    Keys are loaded from a configurable directory (default: /app/ssh).
    """

    # Supported key file patterns (in order of preference)
    KEY_PATTERNS = ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"]

    def __init__(self, key_path: str | None = None) -> None:
        """Initialise the SSH connection service.

        Args:
            key_path: Path to SSH keys directory. Defaults to settings.ssh_key_path.
        """
        settings = get_settings()
        self.key_path = Path(key_path or settings.ssh_key_path)
        self.timeout = settings.ssh_connection_timeout
        self._keys_validated = False

    def get_available_keys(self) -> list[str]:
        """Get list of available SSH key files.

        Returns:
            List of key filenames found in the key directory.
            Returns empty list if directory doesn't exist or is empty.
        """
        if not self.key_path.exists():
            logger.warning("SSH key directory does not exist: %s", self.key_path)
            return []

        if not self.key_path.is_dir():
            logger.warning("SSH key path is not a directory: %s", self.key_path)
            return []

        keys = []
        # Common non-key files to ignore
        ignore_files = {".gitkeep", ".DS_Store", "README.md"}

        for pattern in self.KEY_PATTERNS:
            key_file = self.key_path / pattern
            if key_file.exists() and key_file.is_file():
                keys.append(pattern)

        # Also check for any other private key files (without .pub extension)
        for item in self.key_path.iterdir():
            if item.is_file() and not item.name.endswith(".pub") and item.name not in ignore_files:
                if item.name not in keys and item.name not in self.KEY_PATTERNS:
                    keys.append(item.name)

        return sorted(keys)

    def validate_key_permissions(self) -> dict[str, bool]:
        """Validate that SSH key files have correct permissions (600).

        Returns:
            Dict mapping key filename to whether permissions are valid.
            Logs warnings for keys with incorrect permissions.
        """
        results = {}
        keys = self.get_available_keys()

        for key_name in keys:
            key_file = self.key_path / key_name
            try:
                file_stat = key_file.stat()
                mode = stat.S_IMODE(file_stat.st_mode)
                # Check if permissions are 600 (owner read/write only)
                is_valid = mode == 0o600

                if not is_valid:
                    logger.warning(
                        "SSH key %s has incorrect permissions %o (expected 600). Run: chmod 600 %s",
                        key_name,
                        mode,
                        key_file,
                    )
                results[key_name] = is_valid
            except OSError as e:
                logger.error("Cannot check permissions for %s: %s", key_name, e)
                results[key_name] = False

        self._keys_validated = True
        return results

    def _load_key(self, key_path: Path) -> paramiko.PKey | None:
        """Load a private key from file, auto-detecting key type.

        Args:
            key_path: Path to the private key file.

        Returns:
            Paramiko PKey object, or None if loading fails.
        """
        try:
            # Try to auto-detect key type using paramiko's from_private_key_file
            # This handles RSA, ECDSA, Ed25519, and DSA keys
            return paramiko.RSAKey.from_private_key_file(str(key_path))
        except paramiko.PasswordRequiredException:
            logger.warning("Key %s requires a password", key_path)
            return None
        except paramiko.SSHException:
            pass

        try:
            return paramiko.Ed25519Key.from_private_key_file(str(key_path))
        except paramiko.PasswordRequiredException:
            logger.warning("Key %s requires a password", key_path)
            return None
        except paramiko.SSHException:
            pass

        try:
            return paramiko.ECDSAKey.from_private_key_file(str(key_path))
        except paramiko.PasswordRequiredException:
            logger.warning("Key %s requires a password", key_path)
            return None
        except paramiko.SSHException:
            pass

        # Note: DSSKey (DSA) removed in paramiko 4.0 - DSA keys are deprecated

        logger.warning("Could not load key %s - unsupported format", key_path)
        return None

    # =========================================================================
    # US0071: SSH Key Management Methods
    # =========================================================================

    @staticmethod
    def sanitise_key_name(name: str) -> str:
        """Sanitise a key name to safe characters.

        Removes any characters that could be used for path traversal or injection.

        Args:
            name: The raw key name.

        Returns:
            Sanitised key name containing only alphanumeric, underscore, and hyphen.
        """
        # Remove path components (prevent directory traversal)
        name = name.replace("/", "").replace("\\", "").replace("..", "")
        # Keep only alphanumeric, underscore, and hyphen
        sanitised = re.sub(r"[^a-zA-Z0-9_-]", "", name)
        # Ensure not empty
        return sanitised or "key"

    def _detect_key_type_from_content(self, key_content: str) -> tuple[str, paramiko.PKey]:
        """Detect key type and parse key from content.

        Args:
            key_content: The private key content as string.

        Returns:
            Tuple of (key_type_string, paramiko_key_object).

        Raises:
            SSHKeyError: If key format is invalid or password-protected.
        """
        key_file = io.StringIO(key_content)

        # Try RSA first
        try:
            key_file.seek(0)
            pkey = paramiko.RSAKey.from_private_key(key_file)
            bits = pkey.get_bits()
            return f"RSA-{bits}", pkey
        except paramiko.PasswordRequiredException as err:
            raise SSHKeyError(
                "Password-protected keys are not supported. Please decrypt the key first."
            ) from err
        except paramiko.SSHException:
            pass

        # Try Ed25519
        try:
            key_file.seek(0)
            pkey = paramiko.Ed25519Key.from_private_key(key_file)
            return "ED25519", pkey
        except paramiko.PasswordRequiredException as err:
            raise SSHKeyError(
                "Password-protected keys are not supported. Please decrypt the key first."
            ) from err
        except paramiko.SSHException:
            pass

        # Try ECDSA
        try:
            key_file.seek(0)
            pkey = paramiko.ECDSAKey.from_private_key(key_file)
            bits = pkey.get_bits()
            return f"ECDSA-{bits}", pkey
        except paramiko.PasswordRequiredException as err:
            raise SSHKeyError(
                "Password-protected keys are not supported. Please decrypt the key first."
            ) from err
        except paramiko.SSHException:
            pass

        raise SSHKeyError("Invalid SSH private key format")

    def _get_key_fingerprint(self, pkey: paramiko.PKey) -> str:
        """Get SHA256 fingerprint of a key.

        Args:
            pkey: Paramiko key object.

        Returns:
            SHA256 fingerprint string (e.g., "SHA256:abc123...").
        """
        key_bytes = pkey.asbytes()
        fingerprint = hashlib.sha256(key_bytes).digest()
        # Base64 encode and strip padding
        b64_fingerprint = base64.b64encode(fingerprint).decode().rstrip("=")
        return f"SHA256:{b64_fingerprint}"

    def _get_key_metadata(self, key_path: Path) -> SSHKeyMetadata | None:
        """Get metadata for a single key file.

        Args:
            key_path: Path to the key file.

        Returns:
            SSHKeyMetadata or None if key cannot be loaded.
        """
        try:
            pkey = self._load_key(key_path)
            if pkey is None:
                return None

            # Detect key type
            key_type = "Unknown"
            if isinstance(pkey, paramiko.RSAKey):
                key_type = f"RSA-{pkey.get_bits()}"
            elif isinstance(pkey, paramiko.Ed25519Key):
                key_type = "ED25519"
            elif isinstance(pkey, paramiko.ECDSAKey):
                key_type = f"ECDSA-{pkey.get_bits()}"

            # Get fingerprint
            fingerprint = self._get_key_fingerprint(pkey)

            # Get file creation time
            file_stat = key_path.stat()
            created_at = datetime.fromtimestamp(file_stat.st_mtime, tz=UTC)

            return SSHKeyMetadata(
                id=key_path.name,
                name=key_path.name,
                type=key_type,
                fingerprint=fingerprint,
                created_at=created_at,
            )
        except Exception as e:
            logger.warning("Could not get metadata for key %s: %s", key_path, e)
            return None

    def list_keys_with_metadata(
        self, default_key_id: str | None = None
    ) -> list[SSHKeyMetadata]:
        """List all SSH keys with their metadata.

        US0071: SSH Key Manager UI - AC1
        US0093: Unified SSH Key Management - added default_key_id parameter

        Args:
            default_key_id: Optional ID of the default key (from database config).

        Returns:
            List of SSHKeyMetadata objects (never includes private key content).
        """
        keys = self.get_available_keys()
        metadata_list = []

        for key_name in keys:
            key_path = self.key_path / key_name
            metadata = self._get_key_metadata(key_path)
            if metadata:
                # Mark if this is the default key
                metadata.is_default = key_name == default_key_id
                metadata_list.append(metadata)

        return metadata_list

    def upload_key(self, name: str, private_key: str) -> SSHKeyMetadata:
        """Upload and store a new SSH key.

        US0071: SSH Key Manager UI - AC2

        Args:
            name: Key name (will be sanitised).
            private_key: Private key content.

        Returns:
            SSHKeyMetadata for the uploaded key.

        Raises:
            SSHKeyError: If key is invalid, password-protected, or name conflicts.
        """
        # Sanitise the key name
        sanitised_name = self.sanitise_key_name(name)
        key_path = self.key_path / sanitised_name

        # Check for duplicate
        if key_path.exists():
            raise SSHKeyError(f"A key with name '{sanitised_name}' already exists")

        # Validate the key content (also checks for password protection)
        key_type, pkey = self._detect_key_type_from_content(private_key)

        # Ensure the key directory exists
        self.key_path.mkdir(parents=True, exist_ok=True)

        # Write the key file with secure permissions
        # Use os.open with mode flags to ensure atomic creation with correct perms
        fd = os.open(str(key_path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.write(fd, private_key.encode())
        finally:
            os.close(fd)

        # Get fingerprint
        fingerprint = self._get_key_fingerprint(pkey)

        # Get file creation time
        created_at = datetime.now(tz=UTC)

        return SSHKeyMetadata(
            id=sanitised_name,
            name=sanitised_name,
            type=key_type,
            fingerprint=fingerprint,
            created_at=created_at,
        )

    def delete_key(self, key_id: str) -> bool:
        """Delete an SSH key.

        US0071: SSH Key Manager UI - AC3
        US0093: Unified SSH Key Management - returns deleted key ID for default promotion

        Args:
            key_id: The key identifier (filename).

        Returns:
            True if key was deleted.

        Raises:
            SSHKeyError: If key not found.
        """
        # Sanitise to prevent directory traversal
        sanitised_id = self.sanitise_key_name(key_id)
        key_path = self.key_path / sanitised_id

        if not key_path.exists():
            raise SSHKeyError(f"Key '{key_id}' not found")

        key_path.unlink()
        logger.info("Deleted SSH key: %s", sanitised_id)
        return True

    def get_next_available_key(self, exclude_key_id: str | None = None) -> str | None:
        """Get the next available key ID, optionally excluding one.

        US0093: Unified SSH Key Management - for default key auto-promotion

        Args:
            exclude_key_id: Optional key ID to exclude from consideration.

        Returns:
            Key ID of next available key, or None if no keys available.
        """
        keys = self.get_available_keys()
        for key in keys:
            if key != exclude_key_id:
                return key
        return None

    def key_exists(self, key_id: str) -> bool:
        """Check if a key exists.

        US0093: Unified SSH Key Management - validation helper

        Args:
            key_id: The key identifier (filename).

        Returns:
            True if key exists, False otherwise.
        """
        sanitised_id = self.sanitise_key_name(key_id)
        key_path = self.key_path / sanitised_id
        return key_path.exists() and key_path.is_file()

    def get_key_content(self, key_id: str) -> str:
        """Get the content of an SSH private key.

        US0093: Unified SSH Key Management - for migration

        Args:
            key_id: The key identifier (filename).

        Returns:
            The private key content as a string.

        Raises:
            SSHKeyError: If key not found.
        """
        sanitised_id = self.sanitise_key_name(key_id)
        key_path = self.key_path / sanitised_id

        if not key_path.exists():
            raise SSHKeyError(f"Key '{key_id}' not found")

        return key_path.read_text()

    def get_fingerprint_from_content(self, key_content: str) -> str | None:
        """Get fingerprint from key content.

        US0093: Unified SSH Key Management - for migration duplicate checking

        Args:
            key_content: The private key content.

        Returns:
            SHA256 fingerprint string, or None if key cannot be parsed.
        """
        try:
            _, pkey = self._detect_key_type_from_content(key_content)
            return self._get_key_fingerprint(pkey)
        except SSHKeyError:
            return None

    def _test_connection_sync(
        self,
        hostname: str,
        port: int,
        username: str,
        key_usernames: dict[str, str] | None = None,
        key_filter: str | None = None,
    ) -> ConnectionResult:
        """Synchronous SSH connection test (called via asyncio.to_thread).

        US0073: Network Discovery Key Selection - added key_filter parameter and key_used tracking.

        Args:
            hostname: Target hostname or IP address.
            port: SSH port number.
            username: Default SSH username (fallback).
            key_usernames: Optional dict mapping key names to their associated usernames.
            key_filter: Optional key ID to filter to. If provided, only this key is tried.

        Returns:
            ConnectionResult with success/failure details and key_used.
        """
        keys = self.get_available_keys()
        key_usernames = key_usernames or {}

        # Filter to specific key if requested
        if key_filter:
            if key_filter not in keys:
                return ConnectionResult(
                    success=False,
                    hostname=hostname,
                    error=f"SSH key '{key_filter}' not found",
                )
            keys = [key_filter]

        if not keys:
            return ConnectionResult(
                success=False,
                hostname=hostname,
                error=f"No SSH keys configured in {self.key_path}",
            )

        client = paramiko.SSHClient()
        # Accept unknown hosts (edge case 4: no strict host checking)
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        last_error = ""
        keys_tried = 0

        for key_name in keys:
            key_path = self.key_path / key_name
            pkey = self._load_key(key_path)

            if pkey is None:
                continue

            keys_tried += 1
            start_time = time.time()

            # Use key-specific username if available, otherwise fall back to default
            effective_username = key_usernames.get(key_name, username)

            try:
                logger.debug(
                    "Connecting to %s:%d as %s with key %s",
                    hostname,
                    port,
                    effective_username,
                    key_name,
                )
                client.connect(
                    hostname=hostname,
                    port=port,
                    username=effective_username,
                    pkey=pkey,
                    timeout=self.timeout,
                    auth_timeout=self.timeout,
                    look_for_keys=False,
                    allow_agent=False,
                )

                # Get remote hostname
                _, stdout, _ = client.exec_command("hostname", timeout=5)
                remote_hostname = stdout.read().decode().strip()

                elapsed_ms = int((time.time() - start_time) * 1000)
                client.close()

                return ConnectionResult(
                    success=True,
                    hostname=hostname,
                    remote_hostname=remote_hostname,
                    response_time_ms=elapsed_ms,
                    key_used=key_name,
                )

            except AuthenticationException as e:
                # Edge case 5: Key rejected, try next key
                last_error = f"Authentication failed: {e}"
                logger.debug("Key %s rejected for %s@%s: %s", key_name, username, hostname, e)

            except TimeoutError:
                # Edge case 3: Connection timeout
                client.close()
                return ConnectionResult(
                    success=False,
                    hostname=hostname,
                    error=f"Connection timed out after {self.timeout}s",
                )

            except OSError as e:
                # Socket errors (connection refused, network unreachable, etc.)
                last_error = str(e)
                logger.debug("Connection error with %s: %s", key_name, e)

            except SSHException as e:
                # Other SSH errors
                last_error = f"SSH error: {e}"
                logger.debug("SSH error with %s: %s", key_name, e)

            finally:
                try:
                    client.close()
                except Exception:
                    pass

        # All keys failed
        if keys_tried == 0:
            return ConnectionResult(
                success=False,
                hostname=hostname,
                error="No valid SSH keys could be loaded",
            )

        return ConnectionResult(
            success=False,
            hostname=hostname,
            error=f"All {keys_tried} keys rejected. Last error: {last_error}",
        )

    def _execute_command_sync(
        self,
        hostname: str,
        port: int,
        username: str,
        command: str,
        command_timeout: int = 30,
        key_usernames: dict[str, str] | None = None,
        key_filter: str | None = None,
        password: str | None = None,
    ) -> CommandResult:
        """Synchronous SSH command execution (called via asyncio.to_thread).

        US0073: Network Discovery Key Selection - added key_filter parameter.

        Args:
            hostname: Target hostname or IP address.
            port: SSH port number.
            username: Default SSH username (fallback).
            command: Command to execute.
            command_timeout: Timeout for command execution in seconds.
            key_usernames: Optional dict mapping key names to their associated usernames.
            key_filter: Optional key ID to filter to. If provided, only this key is tried.
            password: Optional SSH password for password authentication.

        Returns:
            CommandResult with stdout, stderr, exit code, and any errors.
        """
        if password:
            return self._execute_command_with_password(
                hostname=hostname,
                port=port,
                username=username,
                command=command,
                command_timeout=command_timeout,
                password=password,
            )

        keys = self.get_available_keys()
        key_usernames = key_usernames or {}

        # Filter to specific key if requested
        if key_filter:
            if key_filter not in keys:
                return CommandResult(
                    success=False,
                    stdout="",
                    stderr="",
                    exit_code=-1,
                    error=f"SSH key '{key_filter}' not found",
                )
            keys = [key_filter]

        if not keys:
            return CommandResult(
                success=False,
                stdout="",
                stderr="",
                exit_code=-1,
                error=f"No SSH keys configured in {self.key_path}",
            )

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        last_error = ""

        for key_name in keys:
            key_path = self.key_path / key_name
            pkey = self._load_key(key_path)

            if pkey is None:
                continue

            # Use key-specific username if available, otherwise fall back to default
            effective_username = key_usernames.get(key_name, username)

            try:
                logger.debug(
                    "Executing command on %s:%d as %s with key %s",
                    hostname,
                    port,
                    effective_username,
                    key_name,
                )
                client.connect(
                    hostname=hostname,
                    port=port,
                    username=effective_username,
                    pkey=pkey,
                    timeout=self.timeout,
                    auth_timeout=self.timeout,
                    look_for_keys=False,
                    allow_agent=False,
                )

                # Execute command
                _, stdout, stderr = client.exec_command(command, timeout=command_timeout)
                exit_code = stdout.channel.recv_exit_status()
                stdout_text = stdout.read().decode("utf-8", errors="replace")
                stderr_text = stderr.read().decode("utf-8", errors="replace")

                client.close()

                return CommandResult(
                    success=exit_code == 0,
                    stdout=stdout_text,
                    stderr=stderr_text,
                    exit_code=exit_code,
                )

            except AuthenticationException as e:
                last_error = f"Authentication failed: {e}"
                logger.debug("Key %s rejected for %s@%s: %s", key_name, username, hostname, e)

            except TimeoutError:
                client.close()
                return CommandResult(
                    success=False,
                    stdout="",
                    stderr="",
                    exit_code=-1,
                    error=f"Connection timed out after {self.timeout}s",
                )

            except OSError as e:
                last_error = str(e)
                logger.debug("Connection error with %s: %s", key_name, e)

            except SSHException as e:
                last_error = f"SSH error: {e}"
                logger.debug("SSH error with %s: %s", key_name, e)

            finally:
                try:
                    client.close()
                except Exception:
                    pass

        return CommandResult(
            success=False,
            stdout="",
            stderr="",
            exit_code=-1,
            error=f"All keys rejected. Last error: {last_error}",
        )

    def _execute_command_with_password(
        self,
        hostname: str,
        port: int,
        username: str,
        command: str,
        command_timeout: int,
        password: str,
    ) -> CommandResult:
        """Execute a command using password authentication.

        Args:
            hostname: Target hostname or IP address.
            port: SSH port number.
            username: SSH username.
            command: Command to execute.
            command_timeout: Timeout for command execution in seconds.
            password: SSH password.

        Returns:
            CommandResult with stdout, stderr, exit code, and any errors.
        """
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            logger.debug(
                "Executing command on %s:%d as %s with password auth",
                hostname,
                port,
                username,
            )
            client.connect(
                hostname=hostname,
                port=port,
                username=username,
                password=password,
                timeout=self.timeout,
                auth_timeout=self.timeout,
                look_for_keys=False,
                allow_agent=False,
            )

            _, stdout, stderr = client.exec_command(command, timeout=command_timeout)
            exit_code = stdout.channel.recv_exit_status()
            stdout_text = stdout.read().decode("utf-8", errors="replace")
            stderr_text = stderr.read().decode("utf-8", errors="replace")

            return CommandResult(
                success=exit_code == 0,
                stdout=stdout_text,
                stderr=stderr_text,
                exit_code=exit_code,
            )
        except AuthenticationException as err:
            return CommandResult(
                success=False,
                stdout="",
                stderr="",
                exit_code=-1,
                error=f"Password authentication failed: {err}",
            )
        except TimeoutError:
            return CommandResult(
                success=False,
                stdout="",
                stderr="",
                exit_code=-1,
                error=f"Connection timed out after {self.timeout}s",
            )
        except OSError as err:
            return CommandResult(
                success=False,
                stdout="",
                stderr="",
                exit_code=-1,
                error=str(err),
            )
        except SSHException as err:
            return CommandResult(
                success=False,
                stdout="",
                stderr="",
                exit_code=-1,
                error=f"SSH error: {err}",
            )
        finally:
            try:
                client.close()
            except Exception:
                pass

    async def execute_command(
        self,
        hostname: str,
        port: int | None = None,
        username: str | None = None,
        command: str = "",
        command_timeout: int = 30,
        key_usernames: dict[str, str] | None = None,
        key_filter: str | None = None,
        password: str | None = None,
    ) -> CommandResult:
        """Execute a command on a remote host via SSH.

        Tries each available SSH key in order until one succeeds.
        Uses asyncio.to_thread to avoid blocking the event loop.

        US0073: Network Discovery Key Selection - added key_filter parameter.

        Args:
            hostname: Target hostname or IP address.
            port: SSH port (defaults to settings.ssh_default_port).
            username: Default SSH username (defaults to settings.ssh_default_username).
            command: Command to execute.
            command_timeout: Timeout for command execution in seconds.
            key_usernames: Optional dict mapping key names to their associated usernames.
            key_filter: Optional key ID to filter to. If provided, only this key is tried.
            password: Optional SSH password for password authentication.

        Returns:
            CommandResult with stdout, stderr, exit code, and any errors.
        """
        settings = get_settings()
        port = port or settings.ssh_default_port
        username = username or settings.ssh_default_username

        # Validate keys on first attempt
        if not self._keys_validated and not password:
            self.validate_key_permissions()

        # Run blocking SSH code in thread pool
        return await asyncio.to_thread(
            self._execute_command_sync,
            hostname,
            port,
            username,
            command,
            command_timeout,
            key_usernames,
            key_filter,
            password,
        )

    async def test_connection(
        self,
        hostname: str,
        port: int | None = None,
        username: str | None = None,
        key_usernames: dict[str, str] | None = None,
    ) -> ConnectionResult:
        """Test SSH connection to a remote host.

        Tries each available SSH key in order until one succeeds.
        Uses asyncio.to_thread to avoid blocking the event loop.

        Args:
            hostname: Target hostname or IP address.
            port: SSH port (defaults to settings.ssh_default_port).
            username: Default SSH username (defaults to settings.ssh_default_username).
            key_usernames: Optional dict mapping key names to their associated usernames.

        Returns:
            ConnectionResult with success/failure details and key_used.
        """
        settings = get_settings()
        port = port or settings.ssh_default_port
        username = username or settings.ssh_default_username

        # Validate keys on first connection attempt
        if not self._keys_validated:
            self.validate_key_permissions()

        # Run blocking SSH code in thread pool
        return await asyncio.to_thread(
            self._test_connection_sync,
            hostname,
            port,
            username,
            key_usernames,
        )

    async def test_connection_with_key(
        self,
        hostname: str,
        port: int | None = None,
        username: str | None = None,
        key_id: str | None = None,
        key_usernames: dict[str, str] | None = None,
    ) -> ConnectionResult:
        """Test SSH connection using a specific key.

        US0073: Network Discovery Key Selection

        Args:
            hostname: Target hostname or IP address.
            port: SSH port (defaults to settings.ssh_default_port).
            username: Default SSH username (defaults to settings.ssh_default_username).
            key_id: Specific SSH key ID to use for connection.
            key_usernames: Optional dict mapping key names to their associated usernames.

        Returns:
            ConnectionResult with success/failure details and key_used.
        """
        settings = get_settings()
        port = port or settings.ssh_default_port
        username = username or settings.ssh_default_username

        # Validate keys on first connection attempt
        if not self._keys_validated:
            self.validate_key_permissions()

        # Run blocking SSH code in thread pool with key filter
        return await asyncio.to_thread(
            self._test_connection_sync,
            hostname,
            port,
            username,
            key_usernames,
            key_id,
        )


# Module-level instance for convenience
_ssh_service: SSHConnectionService | None = None


def get_ssh_service() -> SSHConnectionService:
    """Get the SSH connection service instance.

    Returns:
        Singleton SSHConnectionService instance.
    """
    global _ssh_service
    if _ssh_service is None:
        _ssh_service = SSHConnectionService()
    return _ssh_service


async def migrate_tailscale_ssh_key(session: "AsyncSession") -> bool:
    """Migrate SSH key from TailscaleSSHSettings (credential store) to unified SSHKeyManager.

    US0093: Unified SSH Key Management - AC4

    This is a one-time migration that:
    1. Checks if ssh_private_key exists in credentials table
    2. Gets the key content
    3. Saves it to the SSHKeyManager file storage if not already present (by fingerprint)
    4. Removes the old credential entry
    5. Marks the new key as default if no other default exists

    Args:
        session: Async database session

    Returns:
        True if migration occurred, False if no migration needed
    """
    from sqlalchemy import select

    from homelab_cmd.db.models.config import Config
    from homelab_cmd.services.credential_service import CredentialService

    settings = get_settings()
    if not settings.encryption_key:
        logger.warning("No encryption key configured, skipping Tailscale SSH key migration")
        return False

    credential_service = CredentialService(session, settings.encryption_key)

    # Check if old key exists
    key_content = await credential_service.get_credential("ssh_private_key")
    if not key_content:
        logger.debug("No Tailscale SSH key to migrate")
        return False

    # Get fingerprint of the key to migrate
    ssh_service = get_ssh_service()
    new_fingerprint = ssh_service.get_fingerprint_from_content(key_content)
    if not new_fingerprint:
        logger.warning("Could not parse Tailscale SSH key for migration, skipping")
        return False

    # Check if key with same fingerprint already exists
    existing_keys = ssh_service.list_keys_with_metadata()
    for existing_key in existing_keys:
        if existing_key.fingerprint == new_fingerprint:
            logger.info(
                "Key with fingerprint %s already exists as '%s', removing old credential",
                new_fingerprint,
                existing_key.id,
            )
            await credential_service.delete_credential("ssh_private_key")
            await session.commit()
            return True

    # Key doesn't exist - migrate it
    try:
        key_metadata = ssh_service.upload_key("tailscale_migrated", key_content)
        logger.info(
            "Migrated Tailscale SSH key to unified storage: %s (%s)",
            key_metadata.id,
            key_metadata.fingerprint,
        )
    except SSHKeyError as e:
        logger.warning("Failed to migrate Tailscale SSH key: %s", e)
        return False

    # Remove old credential
    await credential_service.delete_credential("ssh_private_key")

    # Set as default if no other default exists
    result = await session.execute(select(Config).where(Config.key == "ssh_config"))
    config = result.scalar_one_or_none()
    ssh_config = config.value if config else {}

    if not ssh_config.get("default_key_id"):
        ssh_config["default_key_id"] = key_metadata.id
        if config:
            config.value = ssh_config
        else:
            config = Config(key="ssh_config", value=ssh_config)
            session.add(config)
        logger.info("Set migrated key '%s' as default", key_metadata.id)

    await session.commit()
    logger.info("Tailscale SSH key migration completed successfully")
    return True
