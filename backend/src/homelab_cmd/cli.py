"""Command-line utilities for HomelabCmd.

Part of EP0008: Tailscale Integration (US0081).

Provides utility commands for credential management and system setup.
"""

import click
from cryptography.fernet import Fernet


@click.group()
def cli() -> None:
    """HomelabCmd command-line utilities."""
    pass


@cli.command("generate-key")
def generate_key() -> None:
    """Generate a new encryption key for credential storage.

    The encryption key is required for storing sensitive credentials
    (Tailscale tokens, SSH keys) securely in the database.

    IMPORTANT: Store this key securely! If lost, all stored credentials
    will become unrecoverable. Back up the key before using it.
    """
    key = Fernet.generate_key().decode()

    click.echo()
    click.echo("Generated encryption key:")
    click.echo(f"  {key}")
    click.echo()
    click.echo("Add to your environment:")
    click.echo(f'  export HOMELABCMD_ENCRYPTION_KEY="{key}"')
    click.echo()
    click.echo("Or add to your .env file:")
    click.echo(f'  HOMELABCMD_ENCRYPTION_KEY="{key}"')
    click.echo()
    click.secho(
        "WARNING: Store this key securely! If lost, stored credentials "
        "cannot be recovered.",
        fg="yellow",
        bold=True,
    )


if __name__ == "__main__":
    cli()
