"""Agent registration API endpoints.

Provides endpoints for:
- Creating registration tokens for pull-based installation
- Listing pending registration tokens
- Cancelling registration tokens
- Claiming tokens and receiving agent credentials
- Managing agent tokens (rotate, revoke)
- Getting the install script

Secure Agent Architecture: Pull-based installation with per-agent tokens.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, BAD_REQUEST_RESPONSE, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.agent_register import (
    AgentCredentialResponse,
    ClaimTokenRequest,
    ClaimTokenResponse,
    CreateRegistrationTokenRequest,
    CreateRegistrationTokenResponse,
    RegistrationTokenListResponse,
    RegistrationTokenResponse,
    RevokeTokenResponse,
    RotateTokenResponse,
)
from homelab_cmd.config import get_settings
from homelab_cmd.db.models.registration_token import AgentMode as DbAgentMode
from homelab_cmd.db.session import get_async_session
from homelab_cmd.services.token_service import TokenService

router = APIRouter(prefix="/agents/register", tags=["Agent Registration"])
logger = logging.getLogger(__name__)


def _get_hub_url(request: Request) -> str:
    """Get the hub URL for agent configuration.

    Uses external_url setting if configured, otherwise derives from request.
    """
    settings = get_settings()
    if settings.external_url:
        return settings.external_url.rstrip("/")

    # Derive from request
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{scheme}://{host}"


# --- Registration Token Endpoints ---


@router.post(
    "/tokens",
    response_model=CreateRegistrationTokenResponse,
    operation_id="create_registration_token",
    summary="Create a registration token",
    responses={**AUTH_RESPONSES},
)
async def create_registration_token(
    request_data: CreateRegistrationTokenRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> CreateRegistrationTokenResponse:
    """Create a registration token for pull-based agent installation.

    Returns a one-time token that can be used with the install script.
    The plaintext token is returned once and cannot be retrieved again.
    """
    service = TokenService(session)

    # Convert schema enum to model enum
    mode = DbAgentMode(request_data.mode.value)

    token_model, plaintext = await service.create_registration_token(
        mode=mode,
        display_name=request_data.display_name,
        monitored_services=request_data.monitored_services,
        expiry_minutes=request_data.expiry_minutes,
    )

    await session.commit()

    # Build install command
    hub_url = _get_hub_url(request)
    install_command = (
        f"curl -sSL {hub_url}/api/v1/agents/register/install.sh | "
        f"sudo bash -s -- --token {plaintext}"
    )

    return CreateRegistrationTokenResponse(
        token=plaintext,
        token_prefix=token_model.token_prefix,
        expires_at=token_model.expires_at,
        install_command=install_command,
    )


@router.get(
    "/tokens",
    response_model=RegistrationTokenListResponse,
    operation_id="list_registration_tokens",
    summary="List pending registration tokens",
    responses={**AUTH_RESPONSES},
)
async def list_registration_tokens(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> RegistrationTokenListResponse:
    """List all pending (unclaimed, unexpired) registration tokens."""
    service = TokenService(session)
    tokens = await service.list_pending_registration_tokens()

    token_responses = []
    for token in tokens:
        monitored_services = None
        if token.monitored_services:
            monitored_services = json.loads(token.monitored_services)

        token_responses.append(
            RegistrationTokenResponse(
                id=token.id,
                token_prefix=token.token_prefix,
                mode=token.mode,
                display_name=token.display_name,
                monitored_services=monitored_services,
                expires_at=token.expires_at,
                created_at=token.created_at,
                is_expired=token.is_expired,
                is_claimed=token.is_claimed,
            )
        )

    return RegistrationTokenListResponse(
        tokens=token_responses,
        total=len(token_responses),
    )


@router.delete(
    "/tokens/{token_id}",
    status_code=204,
    operation_id="cancel_registration_token",
    summary="Cancel a registration token",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
        **BAD_REQUEST_RESPONSE,
    },
)
async def cancel_registration_token(
    token_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> None:
    """Cancel a pending registration token.

    Tokens that have already been claimed cannot be cancelled.
    """
    service = TokenService(session)
    success, error = await service.cancel_registration_token(token_id)

    if not success:
        if "not found" in (error or "").lower():
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=400, detail=error)

    await session.commit()


# --- Token Claim Endpoint (no auth required - token is the auth) ---


@router.post(
    "/claim",
    response_model=ClaimTokenResponse,
    operation_id="create_agent_claim",
    summary="Claim a registration token",
    responses={
        **BAD_REQUEST_RESPONSE,
    },
)
async def claim_registration_token(
    request_data: ClaimTokenRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> ClaimTokenResponse:
    """Claim a registration token and receive agent credentials.

    This endpoint does not require API key authentication - the registration
    token itself serves as authentication. Called by the install script.

    Returns per-agent API token and complete configuration YAML.
    """
    service = TokenService(session)
    hub_url = _get_hub_url(request)

    result = await service.claim_registration_token(
        plaintext_token=request_data.token,
        server_id=request_data.server_id,
        hostname=request_data.hostname,
        hub_url=hub_url,
    )

    if not result.success:
        # Don't commit on failure
        raise HTTPException(status_code=400, detail=result.error)

    await session.commit()

    return ClaimTokenResponse(
        success=True,
        server_id=result.server_id,
        server_guid=result.server_guid,
        api_token=result.api_token,
        config_yaml=result.config_yaml,
    )


# --- Install Script Endpoint (no auth required) ---


@router.get(
    "/install.sh",
    response_class=PlainTextResponse,
    operation_id="get_install_script",
    summary="Get the agent install script",
)
async def get_install_script(
    request: Request,
) -> PlainTextResponse:
    """Get the agent install script for pull-based installation.

    This script is designed to be piped to bash:
    curl -sSL http://hub/api/v1/agents/register/install.sh | sudo bash -s -- --token hlh_rt_xxx
    """
    hub_url = _get_hub_url(request)

    script = _generate_install_script(hub_url)

    return PlainTextResponse(content=script, media_type="text/x-shellscript")


# --- Agent Token Management Endpoints ---


@router.get(
    "/credentials/{server_guid}",
    response_model=AgentCredentialResponse,
    operation_id="get_agent_credential",
    summary="Get agent credential info",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
    },
)
async def get_agent_credential(
    server_guid: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> AgentCredentialResponse:
    """Get credential information for an agent.

    Does not return the token itself, only metadata.
    """
    service = TokenService(session)
    credential = await service.get_credential_by_guid(server_guid)

    if credential is None:
        raise HTTPException(status_code=404, detail="Credential not found")

    return AgentCredentialResponse(
        server_guid=credential.server_guid,
        api_token_prefix=credential.api_token_prefix,
        is_legacy=credential.is_legacy,
        last_used_at=credential.last_used_at,
        is_revoked=credential.is_revoked,
        created_at=credential.created_at,
    )


@router.post(
    "/credentials/{server_guid}/rotate",
    response_model=RotateTokenResponse,
    operation_id="create_token_rotation",
    summary="Rotate agent API token",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
    },
)
async def rotate_agent_token(
    server_guid: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> RotateTokenResponse:
    """Rotate an agent's API token.

    Generates a new token and revokes the old one. The agent must be
    reconfigured with the new token. The new plaintext token is returned
    once and cannot be retrieved again.
    """
    service = TokenService(session)
    new_token, error = await service.rotate_agent_token(server_guid)

    if error:
        raise HTTPException(status_code=404, detail=error)

    await session.commit()

    # Get the new credential to return prefix
    credential = await service.get_credential_by_guid(server_guid)

    return RotateTokenResponse(
        success=True,
        server_guid=server_guid,
        api_token=new_token,
        api_token_prefix=credential.api_token_prefix if credential else None,
    )


@router.post(
    "/credentials/{server_guid}/revoke",
    response_model=RevokeTokenResponse,
    operation_id="create_token_revocation",
    summary="Revoke agent API token",
    responses={
        **AUTH_RESPONSES,
        **NOT_FOUND_RESPONSE,
    },
)
async def revoke_agent_token(
    server_guid: str,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(verify_api_key),
) -> RevokeTokenResponse:
    """Revoke an agent's API token.

    The agent will no longer be able to authenticate with the hub.
    This action cannot be undone - a new token must be generated.
    """
    service = TokenService(session)
    success, error = await service.revoke_agent_token(server_guid)

    if not success:
        raise HTTPException(status_code=404, detail=error)

    await session.commit()

    return RevokeTokenResponse(
        success=True,
        server_guid=server_guid,
    )


def _generate_install_script(hub_url: str) -> str:
    """Generate the install script for pull-based installation."""
    return f'''#!/bin/bash
# HomelabCmd Agent Installation Script (Pull-Based)
# Generated by hub at: {hub_url}
#
# Usage:
#   curl -sSL {hub_url}/api/v1/agents/register/install.sh | sudo bash -s -- --token hlh_rt_xxx
#
# This script:
# 1. Claims the registration token to get credentials
# 2. Downloads and installs the agent
# 3. Writes the configuration
# 4. Starts the agent service

set -euo pipefail

HUB_URL="{hub_url}"
TOKEN=""
SERVER_ID=""
INSTALL_DIR="/opt/homelab-agent"
CONFIG_DIR="/etc/homelab-agent"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --token)
            TOKEN="$2"
            shift 2
            ;;
        --server-id)
            SERVER_ID="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [[ -z "$TOKEN" ]]; then
    echo "Error: --token is required"
    echo "Usage: curl -sSL $HUB_URL/api/v1/agents/register/install.sh | sudo bash -s -- --token hlh_rt_xxx"
    exit 1
fi

# Check for root
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Derive server_id from hostname if not provided
if [[ -z "$SERVER_ID" ]]; then
    SERVER_ID=$(hostname | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
    if [[ -z "$SERVER_ID" ]]; then
        SERVER_ID="server-$(date +%s)"
    fi
fi

HOSTNAME=$(hostname)

echo "=== HomelabCmd Agent Installation ==="
echo "Hub URL: $HUB_URL"
echo "Server ID: $SERVER_ID"
echo "Hostname: $HOSTNAME"
echo ""

# Step 1: Claim the token
echo "Claiming registration token..."
CLAIM_RESPONSE=$(curl -sSL -X POST "$HUB_URL/api/v1/agents/register/claim" \\
    -H "Content-Type: application/json" \\
    -d "$(cat <<EOF
{{
    "token": "$TOKEN",
    "server_id": "$SERVER_ID",
    "hostname": "$HOSTNAME"
}}
EOF
)" 2>&1) || {{
    echo "Error: Failed to claim token"
    echo "$CLAIM_RESPONSE"
    exit 1
}}

# Check if claim was successful
if echo "$CLAIM_RESPONSE" | grep -q '"success":false'; then
    ERROR=$(echo "$CLAIM_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "Error: Token claim failed - $ERROR"
    exit 1
fi

# Extract credentials from response
CONFIG_YAML=$(echo "$CLAIM_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('config_yaml', ''))" 2>/dev/null) || {{
    echo "Error: Failed to parse claim response"
    echo "$CLAIM_RESPONSE"
    exit 1
}}

if [[ -z "$CONFIG_YAML" ]]; then
    echo "Error: No configuration received from hub"
    exit 1
fi

echo "Token claimed successfully!"
echo ""

# Step 2: Create directories
echo "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"

# Step 3: Write configuration
echo "Writing configuration..."
echo "$CONFIG_YAML" > "$CONFIG_DIR/config.yaml"
chmod 600 "$CONFIG_DIR/config.yaml"

# Step 4: Check for existing agent installation
if [[ -f "$INSTALL_DIR/VERSION" ]]; then
    echo "Existing agent found, updating configuration only..."
    systemctl restart homelab-agent 2>/dev/null || true
    echo ""
    echo "=== Configuration Updated ==="
    echo "Agent configuration has been updated."
    echo "Check status: systemctl status homelab-agent"
    exit 0
fi

# Step 5: Download and install agent (if not present)
echo "Downloading agent..."

# Check for required Python packages
echo "Checking Python dependencies..."
python3 -c "import psutil, httpx, yaml" 2>/dev/null || {{
    echo "Installing Python dependencies..."
    if command -v apt-get &>/dev/null; then
        apt-get update -qq
        apt-get install -y -qq python3-psutil python3-httpx python3-yaml || {{
            pip3 install psutil httpx pyyaml
        }}
    elif command -v dnf &>/dev/null; then
        dnf install -y python3-psutil python3-httpx python3-pyyaml || {{
            pip3 install psutil httpx pyyaml
        }}
    else
        pip3 install psutil httpx pyyaml
    fi
}}

# Download agent files from hub
echo "Downloading agent files..."
curl -sSL "$HUB_URL/api/v1/agents/download" -o /tmp/homelab-agent.tar.gz 2>/dev/null || {{
    echo "Warning: Could not download agent from hub, attempting alternative method..."
    # Fallback: try to copy from local path if available
    if [[ -f "/opt/homelab-agent/agent.py" ]]; then
        echo "Using existing agent files..."
    else
        echo "Error: Could not obtain agent files"
        exit 1
    fi
}}

if [[ -f /tmp/homelab-agent.tar.gz ]]; then
    tar -xzf /tmp/homelab-agent.tar.gz -C "$INSTALL_DIR"
    rm /tmp/homelab-agent.tar.gz
fi

# Step 6: Create systemd service
echo "Creating systemd service..."

# Determine mode from config
MODE=$(grep "^mode:" "$CONFIG_DIR/config.yaml" | awk '{{print $2}}' || echo "readonly")

if [[ "$MODE" == "readwrite" ]]; then
    SERVICE_USER="root"
else
    # Create unprivileged user for readonly mode
    if ! id homelab-agent &>/dev/null; then
        useradd --system --no-create-home --shell /usr/sbin/nologin homelab-agent
    fi
    SERVICE_USER="homelab-agent"
    chown -R homelab-agent:homelab-agent "$CONFIG_DIR"
    chmod 750 "$CONFIG_DIR"
fi

cat > /etc/systemd/system/homelab-agent.service <<EOF
[Unit]
Description=HomelabCmd Monitoring Agent
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
ExecStart=/usr/bin/python3 $INSTALL_DIR/__main__.py -c $CONFIG_DIR/config.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Step 7: Enable and start service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable homelab-agent
systemctl start homelab-agent

echo ""
echo "=== Installation Complete ==="
echo "Agent installed and running."
echo "Check status: systemctl status homelab-agent"
echo "View logs: journalctl -u homelab-agent -f"
'''
