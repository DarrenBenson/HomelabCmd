"""SSH Pooled Executor for Tailscale connections.

Part of EP0008: Tailscale Integration (US0079).
Extended by EP0013: Synchronous Command Execution (US0151).

Provides SSH connection management with:
- Connection pooling (5-minute TTL)
- Automatic retry on transient failures (3 attempts, 2s delay)
- Host key verification (TOFU pattern)
- Integration with CredentialService for SSH key storage
- Command execution with timeout support (US0151)
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Literal

import paramiko
from paramiko import AuthenticationException, SSHException

from homelab_cmd.services.credential_service import CredentialService
from homelab_cmd.services.host_key_service import HostKeyService

if TYPE_CHECKING:
    from homelab_cmd.db.models.server import Server

logger = logging.getLogger(__name__)


class SSHKeyNotConfiguredError(Exception):
    """Raised when SSH key is not configured."""

    def __init__(
        self, message: str = "No SSH key configured. Upload a key in Settings > Connectivity."
    ) -> None:
        self.message = message
        super().__init__(message)


class SSHConnectionError(Exception):
    """Raised when SSH connection fails after all retry attempts."""

    def __init__(self, hostname: str, last_error: Exception | None, attempts: int) -> None:
        self.hostname = hostname
        self.last_error = last_error
        self.attempts = attempts
        message = f"SSH connection to {hostname} failed after {attempts} attempts"
        if last_error:
            message += f": {last_error}"
        super().__init__(message)


class SSHAuthenticationError(Exception):
    """Raised when SSH authentication fails (not retried)."""

    def __init__(self, hostname: str, username: str, message: str | None = None) -> None:
        self.hostname = hostname
        self.username = username
        msg = message or f"Authentication failed for {username}@{hostname}"
        super().__init__(msg)


class HostKeyChangedError(Exception):
    """Raised when host key has changed (potential MITM attack)."""

    def __init__(self, hostname: str, old_fingerprint: str, new_fingerprint: str) -> None:
        self.hostname = hostname
        self.old_fingerprint = old_fingerprint
        self.new_fingerprint = new_fingerprint
        super().__init__(
            f"Host key changed for {hostname}. "
            f"Expected: {old_fingerprint}, Got: {new_fingerprint}. "
            "This could indicate a man-in-the-middle attack. "
            "Accept new key only if you trust this change."
        )


class CommandTimeoutError(Exception):
    """Raised when a command exceeds its timeout (US0151 AC3)."""

    def __init__(
        self,
        hostname: str,
        command: str,
        timeout: int,
        partial_stdout: str | None = None,
        partial_stderr: str | None = None,
    ) -> None:
        self.hostname = hostname
        self.command = command
        self.timeout = timeout
        self.partial_stdout = partial_stdout
        self.partial_stderr = partial_stderr
        super().__init__(
            f"Command timed out after {timeout}s on {hostname}: {command[:50]}..."
            if len(command) > 50
            else f"Command timed out after {timeout}s on {hostname}: {command}"
        )


@dataclass
class OutputChunk:
    """Single chunk of streaming command output (US0156).

    Attributes:
        type: Chunk type - stdout, stderr, exit, or error.
        data: Output text or exit code (as string for exit type).
        timestamp: When this chunk was received.
    """

    type: Literal["stdout", "stderr", "exit", "error"]
    data: str
    timestamp: datetime


@dataclass
class CommandResult:
    """Result of SSH command execution (US0151 AC1).

    Attributes:
        exit_code: Command exit status (0 = success).
        stdout: Standard output from the command.
        stderr: Standard error from the command.
        duration_ms: Execution time in milliseconds.
        hostname: Target hostname where command was executed.
    """

    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    hostname: str


@dataclass
class SSHTestResult:
    """Result of an SSH connection test."""

    success: bool
    hostname: str
    latency_ms: int | None = None
    host_key_fingerprint: str | None = None
    error: str | None = None
    attempts: int = 1


class SSHPooledExecutor:
    """SSH executor with connection pooling and retry logic.

    Implements:
    - AC1: Connect via Tailscale hostname
    - AC3: Connection pooling with 5-minute TTL
    - AC4: Retry logic (3 attempts, 2s delay)
    - AC6: Host key verification (TOFU)

    Args:
        credential_service: Service for retrieving SSH private key.
        host_key_service: Service for storing/verifying host keys.
    """

    POOL_TTL = timedelta(minutes=5)
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # seconds
    CONNECT_TIMEOUT = 10  # seconds

    def __init__(
        self,
        credential_service: CredentialService,
        host_key_service: HostKeyService,
    ) -> None:
        self._credential_service = credential_service
        self._host_key_service = host_key_service
        self._pool: dict[str, tuple[paramiko.SSHClient, datetime]] = {}

    def _compute_fingerprint(self, key_bytes: bytes) -> str:
        """Compute SHA256 fingerprint of a host key."""
        digest = hashlib.sha256(key_bytes).digest()
        b64 = base64.b64encode(digest).decode().rstrip("=")
        return f"SHA256:{b64}"

    def _load_private_key(self, key_content: str) -> paramiko.PKey:
        """Load private key from PEM content, auto-detecting type."""
        key_file = io.StringIO(key_content)

        # Try Ed25519 first (most common modern key type)
        try:
            key_file.seek(0)
            return paramiko.Ed25519Key.from_private_key(key_file)
        except SSHException:
            pass

        # Try RSA
        try:
            key_file.seek(0)
            return paramiko.RSAKey.from_private_key(key_file)
        except SSHException:
            pass

        # Try ECDSA
        try:
            key_file.seek(0)
            return paramiko.ECDSAKey.from_private_key(key_file)
        except SSHException:
            pass

        raise SSHException("Unable to load SSH private key - unsupported format")

    def _load_file_based_key(self) -> paramiko.PKey | None:
        """Load SSH key from file-based storage (fallback for legacy configuration).

        Looks for keys in the configured SSH key path (default: /app/ssh/).
        Tries Ed25519, ECDSA, RSA, DSA in order.

        Returns:
            Loaded PKey or None if no key found.
        """
        from pathlib import Path

        from homelab_cmd.config import get_settings

        settings = get_settings()
        key_path = Path(settings.ssh_key_path)

        if not key_path.exists():
            logger.debug("SSH key path does not exist: %s", key_path)
            return None

        # Try to find any key file
        key_patterns = ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"]

        for pattern in key_patterns:
            key_file = key_path / pattern
            if key_file.exists():
                try:
                    logger.debug("Trying file-based SSH key: %s", key_file)
                    return paramiko.RSAKey.from_private_key_file(str(key_file))
                except SSHException:
                    pass
                try:
                    return paramiko.Ed25519Key.from_private_key_file(str(key_file))
                except SSHException:
                    pass
                try:
                    return paramiko.ECDSAKey.from_private_key_file(str(key_file))
                except SSHException:
                    pass

        # Also try any file that starts with id_
        for key_file in key_path.glob("id_*"):
            if key_file.is_file() and not key_file.suffix == ".pub":
                try:
                    logger.debug("Trying file-based SSH key: %s", key_file)
                    return paramiko.Ed25519Key.from_private_key_file(str(key_file))
                except SSHException:
                    pass
                try:
                    return paramiko.RSAKey.from_private_key_file(str(key_file))
                except SSHException:
                    pass
                try:
                    return paramiko.ECDSAKey.from_private_key_file(str(key_file))
                except SSHException:
                    pass

        logger.warning("No valid SSH key found in %s", key_path)
        return None

    async def get_connection(
        self,
        hostname: str,
        username: str,
        machine_id: str,
    ) -> paramiko.SSHClient:
        """Get or create a pooled SSH connection.

        Args:
            hostname: Tailscale hostname to connect to.
            username: SSH username.
            machine_id: Machine ID for host key verification.

        Returns:
            Active SSHClient connection.

        Raises:
            SSHKeyNotConfiguredError: If no SSH key is stored.
            SSHConnectionError: If connection fails after retries.
            SSHAuthenticationError: If authentication fails.
            HostKeyChangedError: If host key has changed.
        """
        # Check pool for existing connection
        if hostname in self._pool:
            client, expires = self._pool[hostname]
            if datetime.now(UTC) < expires:
                # Check if connection is still active
                transport = client.get_transport()
                if transport and transport.is_active():
                    logger.debug("Reusing pooled connection to %s", hostname)
                    return client
            # Connection expired or inactive, close and remove
            try:
                client.close()
            except Exception:
                pass
            del self._pool[hostname]

        # Get SSH private key from credential service or fall back to file-based keys
        private_key = await self._credential_service.get_credential("ssh_private_key")
        pkey: paramiko.PKey | None = None

        if private_key:
            # Load from credential service
            pkey = await asyncio.to_thread(self._load_private_key, private_key)
        else:
            # Fall back to file-based keys in /app/ssh/
            logger.debug("Falling back to file-based SSH keys")
            pkey = await asyncio.to_thread(self._load_file_based_key)

        if not pkey:
            raise SSHKeyNotConfiguredError()

        # Get stored host key for verification
        stored_host_key = await self._host_key_service.get_host_key(machine_id)

        # Connect with retries
        logger.debug("Attempting SSH connection to %s@%s", username, hostname)
        last_error: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                client = await asyncio.to_thread(
                    self._connect_sync,
                    hostname,
                    username,
                    pkey,
                    stored_host_key,
                    machine_id,
                )

                # Store host key if first connection (TOFU)
                if not stored_host_key:
                    transport = client.get_transport()
                    if transport:
                        server_key = transport.get_remote_server_key()
                        fingerprint = self._compute_fingerprint(server_key.asbytes())
                        await self._host_key_service.store_host_key(
                            machine_id=machine_id,
                            hostname=hostname,
                            key_type=server_key.get_name(),
                            public_key=server_key.get_base64(),
                            fingerprint=fingerprint,
                        )
                else:
                    await self._host_key_service.update_last_seen(machine_id)

                # Add to pool
                self._pool[hostname] = (client, datetime.now(UTC) + self.POOL_TTL)
                return client

            except HostKeyChangedError:
                # Don't retry on host key change
                raise

            except AuthenticationException as e:
                # Don't retry on auth failure (not transient)
                raise SSHAuthenticationError(hostname, username, str(e)) from e

            except (SSHException, OSError, TimeoutError) as e:
                last_error = e
                logger.warning(
                    "SSH connection attempt %d/%d to %s failed: %s",
                    attempt + 1,
                    self.MAX_RETRIES,
                    hostname,
                    e,
                )
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY)

        raise SSHConnectionError(hostname, last_error, self.MAX_RETRIES)

    def _connect_sync(
        self,
        hostname: str,
        username: str,
        pkey: paramiko.PKey,
        stored_host_key: object | None,
        machine_id: str,
    ) -> paramiko.SSHClient:
        """Synchronous SSH connection (runs in thread pool)."""
        client = paramiko.SSHClient()
        # We handle host key verification ourselves
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        client.connect(
            hostname=hostname,
            username=username,
            pkey=pkey,
            timeout=self.CONNECT_TIMEOUT,
            auth_timeout=self.CONNECT_TIMEOUT,
            look_for_keys=False,
            allow_agent=False,
        )

        # Verify host key
        transport = client.get_transport()
        if transport:
            server_key = transport.get_remote_server_key()
            key_bytes = server_key.asbytes()
            fingerprint = self._compute_fingerprint(key_bytes)

            if stored_host_key:
                # Verify against stored key
                if stored_host_key.fingerprint != fingerprint:
                    client.close()
                    raise HostKeyChangedError(
                        hostname=hostname,
                        old_fingerprint=stored_host_key.fingerprint,
                        new_fingerprint=fingerprint,
                    )
                # Update last_seen will be done async after this returns
            else:
                # Store host key on first connection (TOFU)
                # This will be handled by the async caller
                pass

        return client

    async def test_connection(
        self,
        hostname: str,
        username: str,
        machine_id: str,
    ) -> SSHTestResult:
        """Test SSH connection and return result.

        Args:
            hostname: Tailscale hostname to test.
            username: SSH username.
            machine_id: Machine ID for host key verification.

        Returns:
            SSHTestResult with success status and latency.
        """
        start_time = datetime.now(UTC)
        attempts = 0

        try:
            # Get SSH private key from credential service or fall back to file-based keys
            private_key = await self._credential_service.get_credential("ssh_private_key")
            pkey: paramiko.PKey | None = None

            if private_key:
                # Load from credential service
                pkey = await asyncio.to_thread(self._load_private_key, private_key)
            else:
                # Fall back to file-based keys in /app/ssh/
                logger.debug("test_connection: Falling back to file-based SSH keys")
                pkey = await asyncio.to_thread(self._load_file_based_key)

            if not pkey:
                raise SSHKeyNotConfiguredError()

            stored_host_key = await self._host_key_service.get_host_key(machine_id)

            last_error: Exception | None = None
            for attempt in range(self.MAX_RETRIES):
                attempts = attempt + 1
                try:
                    client = await asyncio.to_thread(
                        self._connect_sync,
                        hostname,
                        username,
                        pkey,
                        stored_host_key,
                        machine_id,
                    )

                    # Get host key fingerprint
                    transport = client.get_transport()
                    fingerprint = None
                    if transport:
                        server_key = transport.get_remote_server_key()
                        fingerprint = self._compute_fingerprint(server_key.asbytes())

                        # Store host key if first connection
                        if not stored_host_key:
                            await self._host_key_service.store_host_key(
                                machine_id=machine_id,
                                hostname=hostname,
                                key_type=server_key.get_name(),
                                public_key=server_key.get_base64(),
                                fingerprint=fingerprint,
                            )
                        else:
                            await self._host_key_service.update_last_seen(machine_id)

                    client.close()

                    elapsed = datetime.now(UTC) - start_time
                    latency_ms = int(elapsed.total_seconds() * 1000)

                    return SSHTestResult(
                        success=True,
                        hostname=hostname,
                        latency_ms=latency_ms,
                        host_key_fingerprint=fingerprint,
                        attempts=attempts,
                    )

                except HostKeyChangedError:
                    raise

                except AuthenticationException as e:
                    raise SSHAuthenticationError(hostname, username, str(e)) from e

                except (SSHException, OSError, TimeoutError) as e:
                    last_error = e
                    if attempt < self.MAX_RETRIES - 1:
                        await asyncio.sleep(self.RETRY_DELAY)

            raise SSHConnectionError(hostname, last_error, self.MAX_RETRIES)

        except SSHKeyNotConfiguredError as e:
            return SSHTestResult(
                success=False,
                hostname=hostname,
                error=e.message,
                attempts=attempts,
            )

        except SSHAuthenticationError as e:
            return SSHTestResult(
                success=False,
                hostname=hostname,
                error=str(e),
                attempts=attempts,
            )

        except SSHConnectionError as e:
            return SSHTestResult(
                success=False,
                hostname=hostname,
                error=str(e),
                attempts=e.attempts,
            )

        except HostKeyChangedError as e:
            return SSHTestResult(
                success=False,
                hostname=hostname,
                error=str(e),
                attempts=attempts,
            )

    async def execute(
        self,
        server: Server,
        command: str,
        timeout: int = 30,
        username: str | None = None,
    ) -> CommandResult:
        """Execute a command on a server via SSH (US0151 AC1).

        Uses the pooled connection if available, otherwise creates a new one.
        Commands are executed with a configurable timeout (default 30s).

        Args:
            server: Server model with tailscale_hostname and id.
            command: Shell command to execute.
            timeout: Maximum execution time in seconds (default 30).

        Returns:
            CommandResult with exit_code, stdout, stderr, and duration_ms.

        Raises:
            ValueError: If command is empty or server has no tailscale_hostname.
            SSHKeyNotConfiguredError: If no SSH key is configured.
            SSHConnectionError: If connection fails after retries.
            SSHAuthenticationError: If authentication fails.
            CommandTimeoutError: If command exceeds timeout.
            HostKeyChangedError: If host key has changed.
        """
        # Input validation (AC3 edge cases)
        if not command or not command.strip():
            raise ValueError("Command cannot be empty")

        # Use tailscale hostname if available, fall back to IP or hostname
        hostname = server.tailscale_hostname or server.ip_address or server.hostname
        if not hostname:
            raise ValueError(
                f"Server {server.id} has no hostname, IP, or tailscale_hostname configured"
            )

        # Get SSH username - per-server override takes precedence, then caller-provided
        # Callers must provide username from Config (key="ssh", field="default_username")
        if username is None:
            # No username provided - check per-server override
            if server.ssh_username:
                username = server.ssh_username
            else:
                raise ValueError(
                    f"No SSH username configured for server {server.id}. "
                    "Configure a username in Settings > Connectivity."
                )
        else:
            # Use per-server override if set, otherwise use provided username
            username = server.ssh_username or username

        logger.info(
            "Executing command on %s (%s): %s",
            server.id,
            hostname,
            command[:100] + "..." if len(command) > 100 else command,
        )

        start_time = time.monotonic()

        # Get pooled connection (handles retries internally)
        client = await self.get_connection(hostname, username, server.id)

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(self._execute_command_sync, client, command),
                timeout=timeout,
            )

            duration_ms = int((time.monotonic() - start_time) * 1000)

            command_result = CommandResult(
                exit_code=result["exit_code"],
                stdout=result["stdout"],
                stderr=result["stderr"],
                duration_ms=duration_ms,
                hostname=hostname,
            )

            # Log execution result (AC4)
            log_level = logging.INFO if result["exit_code"] == 0 else logging.WARNING
            logger.log(
                log_level,
                "Command completed on %s: exit_code=%d, duration=%dms",
                server.id,
                result["exit_code"],
                duration_ms,
            )

            return command_result

        except TimeoutError as e:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            logger.warning(
                "Command timed out after %ds on %s: %s",
                timeout,
                server.id,
                command[:50],
            )
            raise CommandTimeoutError(
                hostname=hostname,
                command=command,
                timeout=timeout,
            ) from e

        except (SSHException, OSError) as e:
            # Connection dropped mid-command - remove from pool and retry once
            logger.warning(
                "Connection error during command on %s: %s. Retrying with new connection.",
                server.id,
                e,
            )
            # Remove stale connection from pool
            if hostname in self._pool:
                try:
                    self._pool[hostname][0].close()
                except Exception:
                    pass
                del self._pool[hostname]

            # Retry with fresh connection
            client = await self.get_connection(hostname, username, server.id)
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(self._execute_command_sync, client, command),
                    timeout=timeout,
                )

                duration_ms = int((time.monotonic() - start_time) * 1000)

                return CommandResult(
                    exit_code=result["exit_code"],
                    stdout=result["stdout"],
                    stderr=result["stderr"],
                    duration_ms=duration_ms,
                    hostname=hostname,
                )

            except TimeoutError as e:
                raise CommandTimeoutError(
                    hostname=hostname,
                    command=command,
                    timeout=timeout,
                ) from e

    def _execute_command_sync(
        self,
        client: paramiko.SSHClient,
        command: str,
    ) -> dict[str, str | int]:
        """Execute command synchronously (runs in thread pool).

        Args:
            client: Active SSH client connection.
            command: Command to execute.

        Returns:
            Dict with exit_code, stdout, stderr.
        """
        _stdin, stdout, stderr = client.exec_command(command)

        # Read output (limit to 10KB to prevent memory issues)
        max_output = 10 * 1024
        stdout_data = stdout.read(max_output).decode("utf-8", errors="replace")
        stderr_data = stderr.read(max_output).decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()

        return {
            "exit_code": exit_code,
            "stdout": stdout_data,
            "stderr": stderr_data,
        }

    async def clear_pool(self) -> None:
        """Clear all pooled connections.

        Called when SSH key is changed to ensure stale connections
        don't persist.
        """
        for _hostname, (client, _) in list(self._pool.items()):
            try:
                client.close()
            except Exception:
                pass
        self._pool.clear()
        logger.info("Cleared SSH connection pool")

    async def close(self) -> None:
        """Close all connections and clean up."""
        await self.clear_pool()

    async def execute_streaming(
        self,
        server: Server,
        command: str,
        timeout: int = 300,
        username: str | None = None,
    ) -> AsyncGenerator[OutputChunk, None]:
        """Execute a command with streaming output via non-blocking channel reads (US0156).

        Uses asyncio.Queue to bridge sync Paramiko channel reads to async generator.
        Yields chunks as they arrive, with final chunk having type="exit".

        Args:
            server: Server model with tailscale_hostname and id.
            command: Shell command to execute.
            timeout: Maximum execution time in seconds (default 300 for long operations).

        Yields:
            OutputChunk objects with stdout, stderr, exit, or error type.

        Raises:
            ValueError: If command is empty or server has no hostname.
            SSHKeyNotConfiguredError: If no SSH key is configured.
            SSHConnectionError: If connection fails after retries.
            SSHAuthenticationError: If authentication fails.
            HostKeyChangedError: If host key has changed.
        """
        # Input validation
        if not command or not command.strip():
            raise ValueError("Command cannot be empty")

        hostname = server.tailscale_hostname or server.ip_address or server.hostname
        if not hostname:
            raise ValueError(
                f"Server {server.id} has no hostname, IP, or tailscale_hostname configured"
            )

        # Get SSH username - per-server override takes precedence, then caller-provided
        # Callers must provide username from Config (key="ssh", field="default_username")
        if username is None:
            # No username provided - check per-server override
            if server.ssh_username:
                username = server.ssh_username
            else:
                raise ValueError(
                    f"No SSH username configured for server {server.id}. "
                    "Configure a username in Settings > Connectivity."
                )
        else:
            # Use per-server override if set, otherwise use provided username
            username = server.ssh_username or username

        logger.info(
            "Starting streaming command on %s (%s): %s",
            server.id,
            hostname,
            command[:100] + "..." if len(command) > 100 else command,
        )

        start_time = time.monotonic()

        # Get pooled connection
        client = await self.get_connection(hostname, username, server.id)

        # Queue for passing chunks from sync thread to async generator
        queue: asyncio.Queue[OutputChunk | None] = asyncio.Queue()

        async def read_output() -> None:
            """Read output in background thread and push to queue."""
            try:
                await asyncio.to_thread(
                    self._read_streaming_output_sync,
                    client,
                    command,
                    queue,
                    timeout,
                    start_time,
                )
            except Exception as e:
                # Push error to queue
                await queue.put(
                    OutputChunk(
                        type="error",
                        data=str(e),
                        timestamp=datetime.now(UTC),
                    )
                )
            finally:
                # Signal end of stream
                await queue.put(None)

        # Start background task
        task = asyncio.create_task(read_output())

        try:
            # Yield chunks from queue
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield chunk
        finally:
            # Ensure task is cleaned up
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    def _read_streaming_output_sync(
        self,
        client: paramiko.SSHClient,
        command: str,
        queue: asyncio.Queue[OutputChunk | None],
        timeout: int,
        start_time: float,
    ) -> None:
        """Read streaming output synchronously (runs in thread pool).

        Uses non-blocking channel reads with small buffer for responsive streaming.

        Args:
            client: Active SSH client.
            command: Command to execute.
            queue: Queue to push chunks to (accessed via run_coroutine_threadsafe).
            timeout: Maximum execution time in seconds.
            start_time: Monotonic start time for duration calculation.
        """
        import asyncio as _asyncio

        # Get the event loop for queue operations
        try:
            loop = _asyncio.get_running_loop()
        except RuntimeError:
            # No running loop in thread - need to use different approach
            loop = None

        def put_chunk(chunk: OutputChunk) -> None:
            """Put chunk into queue from sync context."""
            if loop:
                _asyncio.run_coroutine_threadsafe(queue.put(chunk), loop)
            else:
                # Fallback for testing - direct put (blocking)

                if hasattr(queue, "_queue"):
                    queue._queue.append(chunk)

        transport = client.get_transport()
        if not transport:
            put_chunk(
                OutputChunk(
                    type="error",
                    data="No transport available",
                    timestamp=datetime.now(UTC),
                )
            )
            return

        channel = transport.open_session()
        channel.exec_command(command)
        channel.setblocking(0)  # Non-blocking mode

        # Read buffer size - small for responsive streaming
        buffer_size = 1024
        max_output = 50 * 1024  # 50KB max total output per stream
        total_stdout = 0
        total_stderr = 0

        try:
            while True:
                # Check timeout
                elapsed = time.monotonic() - start_time
                if elapsed > timeout:
                    put_chunk(
                        OutputChunk(
                            type="error",
                            data=f"Command timed out after {timeout}s",
                            timestamp=datetime.now(UTC),
                        )
                    )
                    channel.close()
                    return

                # Check for stdout
                if channel.recv_ready():
                    data = channel.recv(buffer_size)
                    if data and total_stdout < max_output:
                        text = data.decode("utf-8", errors="replace")
                        total_stdout += len(data)
                        put_chunk(
                            OutputChunk(
                                type="stdout",
                                data=text,
                                timestamp=datetime.now(UTC),
                            )
                        )

                # Check for stderr
                if channel.recv_stderr_ready():
                    data = channel.recv_stderr(buffer_size)
                    if data and total_stderr < max_output:
                        text = data.decode("utf-8", errors="replace")
                        total_stderr += len(data)
                        put_chunk(
                            OutputChunk(
                                type="stderr",
                                data=text,
                                timestamp=datetime.now(UTC),
                            )
                        )

                # Check if command finished
                if channel.exit_status_ready():
                    # Drain remaining output
                    while channel.recv_ready() and total_stdout < max_output:
                        data = channel.recv(buffer_size)
                        if data:
                            text = data.decode("utf-8", errors="replace")
                            total_stdout += len(data)
                            put_chunk(
                                OutputChunk(
                                    type="stdout",
                                    data=text,
                                    timestamp=datetime.now(UTC),
                                )
                            )

                    while channel.recv_stderr_ready() and total_stderr < max_output:
                        data = channel.recv_stderr(buffer_size)
                        if data:
                            text = data.decode("utf-8", errors="replace")
                            total_stderr += len(data)
                            put_chunk(
                                OutputChunk(
                                    type="stderr",
                                    data=text,
                                    timestamp=datetime.now(UTC),
                                )
                            )

                    # Get exit status
                    exit_code = channel.recv_exit_status()
                    duration_ms = int((time.monotonic() - start_time) * 1000)

                    put_chunk(
                        OutputChunk(
                            type="exit",
                            data=f'{{"code": {exit_code}, "duration_ms": {duration_ms}}}',
                            timestamp=datetime.now(UTC),
                        )
                    )
                    break

                # Small sleep to prevent busy-waiting
                time.sleep(0.05)

        finally:
            channel.close()
