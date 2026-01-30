"""Configuration pack API endpoints.

Provides endpoints for listing and retrieving configuration pack definitions.
Part of EP0010: Configuration Management.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from homelab_cmd.api.deps import verify_api_key
from homelab_cmd.api.responses import AUTH_RESPONSES, NOT_FOUND_RESPONSE
from homelab_cmd.api.schemas.config_pack import (
    ConfigPack,
    ConfigPackListResponse,
)
from homelab_cmd.services.config_pack_service import ConfigPackError, ConfigPackService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/config/packs", tags=["Configuration"])

# Service instance (singleton for caching)
_service: ConfigPackService | None = None


def get_config_pack_service() -> ConfigPackService:
    """Get the config pack service instance."""
    global _service
    if _service is None:
        _service = ConfigPackService()
    return _service


@router.get(
    "",
    response_model=ConfigPackListResponse,
    operation_id="list_config_packs",
    summary="List available configuration packs",
    responses={**AUTH_RESPONSES},
)
async def list_packs(
    _: str = Depends(verify_api_key),
    service: ConfigPackService = Depends(get_config_pack_service),
) -> ConfigPackListResponse:
    """List all available configuration packs.

    Returns metadata for all valid configuration packs found in the
    data/config-packs/ directory. Invalid packs are logged and skipped.

    The response includes:
    - Pack identifier (filename without .yaml)
    - Display name and description
    - Item count (own items, excluding inherited)
    - Parent pack name if extends another pack
    - Last modification timestamp
    """
    packs = service.list_packs()
    return ConfigPackListResponse(packs=packs, total=len(packs))


@router.get(
    "/{pack_name}",
    response_model=ConfigPack,
    operation_id="get_config_pack",
    summary="Get configuration pack details",
    responses={**AUTH_RESPONSES, **NOT_FOUND_RESPONSE},
)
async def get_pack(
    pack_name: str,
    resolve_extends: bool = True,
    _: str = Depends(verify_api_key),
    service: ConfigPackService = Depends(get_config_pack_service),
) -> ConfigPack:
    """Get a configuration pack by name.

    Args:
        pack_name: Pack identifier (filename without .yaml extension)
        resolve_extends: If true (default), includes inherited items from
            parent packs. If false, returns only the pack's own items.

    Returns:
        Complete pack definition with all items.

    The resolved pack includes all items from the inheritance chain,
    with parent items appearing before child items in each category.
    """
    try:
        return service.load_pack(pack_name, resolve_extends=resolve_extends)
    except ConfigPackError as e:
        logger.warning("Failed to load pack %s: %s", pack_name, e)
        raise HTTPException(status_code=404, detail=str(e)) from e
