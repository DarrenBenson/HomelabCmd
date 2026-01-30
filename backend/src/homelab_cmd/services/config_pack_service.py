"""Service for loading and managing configuration packs."""

import logging
from datetime import UTC, datetime
from pathlib import Path

import yaml
from pydantic import ValidationError

from homelab_cmd.api.schemas.config_pack import (
    ConfigPack,
    ConfigPackMetadata,
    PackItems,
)
from homelab_cmd.config import get_settings

logger = logging.getLogger(__name__)


class ConfigPackError(Exception):
    """Error raised for configuration pack issues."""

    pass


class ConfigPackService:
    """Service for loading and managing configuration packs.

    Loads pack definitions from YAML files in the data/config-packs/ directory.
    Supports pack inheritance via the 'extends' field.
    """

    def __init__(self, packs_dir: Path | None = None) -> None:
        """Initialise the config pack service.

        Args:
            packs_dir: Directory containing pack YAML files.
                       Defaults to HOMELAB_CMD_CONFIG_PACKS_DIR setting.
        """
        if packs_dir is None:
            settings = get_settings()
            packs_dir = Path(settings.config_packs_dir)

        self.packs_dir = packs_dir
        self.templates_dir = packs_dir / "templates"
        self._pack_cache: dict[str, ConfigPack] = {}

    def _get_pack_path(self, pack_name: str) -> Path:
        """Get the file path for a pack by name."""
        return self.packs_dir / f"{pack_name}.yaml"

    def _load_pack_raw(self, pack_name: str) -> ConfigPack:
        """Load a pack from YAML without resolving extends.

        Args:
            pack_name: Pack identifier (filename without .yaml)

        Returns:
            ConfigPack model with raw data

        Raises:
            ConfigPackError: If pack cannot be loaded or parsed
        """
        pack_path = self._get_pack_path(pack_name)

        if not pack_path.exists():
            raise ConfigPackError(f"Pack file not found: {pack_path}")

        try:
            with open(pack_path) as f:
                data = yaml.safe_load(f)

            if data is None:
                raise ConfigPackError(f"Empty pack file: {pack_path}")

            return ConfigPack.model_validate(data)

        except yaml.YAMLError as e:
            raise ConfigPackError(f"Invalid YAML in {pack_path}: {e}") from e
        except ValidationError as e:
            raise ConfigPackError(f"Invalid pack schema in {pack_path}: {e}") from e

    def _validate_templates(self, pack: ConfigPack) -> None:
        """Validate that all referenced template files exist.

        Args:
            pack: Pack to validate

        Raises:
            ConfigPackError: If any template file is missing
        """
        for file_item in pack.items.files:
            if file_item.template:
                template_path = self.templates_dir / file_item.template
                if not template_path.exists():
                    raise ConfigPackError(
                        f"Template file not found: {template_path} "
                        f"(referenced by {file_item.path})"
                    )

    def _resolve_extends(
        self, pack: ConfigPack, pack_name: str, visited: set[str] | None = None
    ) -> ConfigPack:
        """Resolve pack inheritance by merging parent items.

        Args:
            pack: Pack to resolve
            pack_name: Name of the pack (for cycle detection)
            visited: Set of already visited pack names (for cycle detection)

        Returns:
            Pack with all inherited items merged

        Raises:
            ConfigPackError: If circular dependency detected
        """
        if visited is None:
            visited = set()

        if pack_name in visited:
            raise ConfigPackError(
                f"Circular extends reference detected: {pack_name} -> {' -> '.join(visited)}"
            )

        if pack.extends is None:
            return pack

        visited.add(pack_name)

        # Load parent pack
        try:
            parent = self.load_pack(pack.extends, _visited=visited)
        except ConfigPackError as e:
            raise ConfigPackError(
                f"Cannot resolve extends '{pack.extends}' for pack '{pack_name}': {e}"
            ) from e

        # Merge items: parent items first, then child items
        merged_files = parent.items.files + pack.items.files
        merged_packages = parent.items.packages + pack.items.packages
        merged_settings = parent.items.settings + pack.items.settings

        return ConfigPack(
            name=pack.name,
            description=pack.description,
            extends=pack.extends,
            items=PackItems(
                files=merged_files,
                packages=merged_packages,
                settings=merged_settings,
            ),
        )

    def load_pack(
        self, pack_name: str, *, resolve_extends: bool = True, _visited: set[str] | None = None
    ) -> ConfigPack:
        """Load a configuration pack by name.

        Args:
            pack_name: Pack identifier (filename without .yaml)
            resolve_extends: Whether to resolve inheritance (default True)
            _visited: Internal parameter for cycle detection

        Returns:
            ConfigPack model with all items (including inherited if resolve_extends=True)

        Raises:
            ConfigPackError: If pack cannot be loaded or has errors
        """
        # Check cache first (only for fully resolved packs)
        if resolve_extends and pack_name in self._pack_cache:
            return self._pack_cache[pack_name]

        pack = self._load_pack_raw(pack_name)
        self._validate_templates(pack)

        if resolve_extends:
            pack = self._resolve_extends(pack, pack_name, _visited)
            self._pack_cache[pack_name] = pack

        return pack

    def list_packs(self) -> list[ConfigPackMetadata]:
        """List all available configuration packs.

        Returns:
            List of pack metadata, sorted by name
        """
        packs: list[ConfigPackMetadata] = []

        if not self.packs_dir.exists():
            logger.warning("Config packs directory does not exist: %s", self.packs_dir)
            return packs

        for pack_path in sorted(self.packs_dir.glob("*.yaml")):
            pack_name = pack_path.stem

            try:
                # Load raw pack (without resolving extends) for metadata
                raw_pack = self._load_pack_raw(pack_name)

                # Get file modification time
                mtime = datetime.fromtimestamp(pack_path.stat().st_mtime, tz=UTC)

                # Count items (raw, not resolved - to show pack's own items)
                item_count = (
                    len(raw_pack.items.files)
                    + len(raw_pack.items.packages)
                    + len(raw_pack.items.settings)
                )

                packs.append(
                    ConfigPackMetadata(
                        name=pack_name,
                        display_name=raw_pack.name,
                        description=raw_pack.description,
                        item_count=item_count,
                        extends=raw_pack.extends,
                        last_updated=mtime,
                    )
                )

            except ConfigPackError as e:
                logger.warning("Skipping invalid pack %s: %s", pack_name, e)
                continue

        return packs

    def get_template_content(self, template_name: str) -> str:
        """Get the content of a template file.

        Args:
            template_name: Template filename

        Returns:
            Template file content

        Raises:
            ConfigPackError: If template not found
        """
        template_path = self.templates_dir / template_name

        if not template_path.exists():
            raise ConfigPackError(f"Template not found: {template_path}")

        return template_path.read_text()

    def clear_cache(self) -> None:
        """Clear the pack cache."""
        self._pack_cache.clear()
