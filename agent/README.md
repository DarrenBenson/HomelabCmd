# HomelabCmd Monitoring Agent

A lightweight Python agent that collects system metrics and sends heartbeats to the HomelabCmd server. Designed to run as a systemd service on Linux servers.

## Features

- **System Metrics**: CPU%, RAM%, Disk%, Network I/O, Load averages, Uptime
- **OS Information**: Distribution, version, kernel, architecture
- **Automatic Registration**: New servers are auto-registered on first heartbeat
- **Resilient**: Retries failed heartbeats 3 times with 5-second delays
- **Secure**: Configuration file permissions, systemd hardening
- **Lightweight**: Minimal dependencies (psutil, httpx, pyyaml)

## Requirements

- Python 3.11+
- Linux (Debian/Ubuntu, Raspberry Pi OS, or similar)
- Network access to the HomelabCmd server

## Quick Install

```bash
# Clone or copy the agent directory to your server
cd agent

# Run the installation script as root
sudo ./install.sh

# Edit the configuration
sudo nano /etc/homelab-agent/config.yaml

# Start the service
sudo systemctl start homelab-agent
```

## Manual Installation

If you prefer to install manually:

```bash
# Create directories
sudo mkdir -p /opt/homelab-agent
sudo mkdir -p /etc/homelab-agent

# Copy files
sudo cp homelab_agent.py /opt/homelab-agent/
sudo chmod 755 /opt/homelab-agent/homelab_agent.py

# Install dependencies
pip3 install psutil httpx pyyaml

# Copy systemd service
sudo cp homelab-agent.service /etc/systemd/system/

# Create config from template
sudo cp config.yaml.example /etc/homelab-agent/config.yaml
sudo chmod 600 /etc/homelab-agent/config.yaml

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable homelab-agent
sudo systemctl start homelab-agent
```

## Configuration

Edit `/etc/homelab-agent/config.yaml`:

```yaml
# Hub URL (required)
hub_url: "http://homelab-cmd.home.lan:8080"

# Server ID (required) - unique identifier for this server
server_id: "omv-mediaserver"

# API Key (required) - must match hub's HOMELAB_CMD_API_KEY
api_key: "your-api-key-here"

# Heartbeat interval in seconds (optional, default: 60)
heartbeat_interval: 60
```

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `hub_url` | Yes | - | URL of your HomelabCmd server |
| `server_id` | Yes | - | Unique identifier (lowercase, hyphens allowed) |
| `api_key` | Yes | - | API key matching hub's `HOMELAB_CMD_API_KEY` |
| `heartbeat_interval` | No | 60 | Seconds between heartbeats |
| `monitored_services` | No | [] | List of systemd services (future) |

## Managing the Service

```bash
# Check status
sudo systemctl status homelab-agent

# View logs (follow mode)
sudo journalctl -u homelab-agent -f

# View recent logs
sudo journalctl -u homelab-agent -n 50

# Restart after config changes
sudo systemctl restart homelab-agent

# Stop the service
sudo systemctl stop homelab-agent

# Disable auto-start
sudo systemctl disable homelab-agent
```

## Testing

Run the agent manually in verbose mode:

```bash
python3 /opt/homelab-agent/homelab_agent.py -c /etc/homelab-agent/config.yaml -v
```

## Troubleshooting

### "Configuration file not found"

Ensure the config file exists at `/etc/homelab-agent/config.yaml` or specify the path with `-c`.

### "Authentication failed - check API key"

The `api_key` in your config doesn't match the hub's `HOMELAB_CMD_API_KEY` environment variable.

### "Hub connection failed"

- Check the `hub_url` is correct and accessible from this server
- Verify the hub service is running
- Check firewall rules allow the connection

### "Failed to collect metrics"

Some metrics may fail on certain systems. The agent will send partial metrics and continue. Check the logs for specific errors.

### Service keeps restarting

Check the logs for errors:
```bash
sudo journalctl -u homelab-agent -n 100
```

Common causes:
- Invalid configuration file syntax
- Missing required fields in config
- Python dependency not installed

## Uninstalling

```bash
# Stop and disable the service
sudo systemctl stop homelab-agent
sudo systemctl disable homelab-agent

# Remove files
sudo rm -rf /opt/homelab-agent
sudo rm -rf /etc/homelab-agent
sudo rm /etc/systemd/system/homelab-agent.service

# Reload systemd
sudo systemctl daemon-reload
```

## Security Notes

- The configuration file contains your API key - permissions are set to 600 (root only)
- The systemd service runs with security hardening (NoNewPrivileges, ProtectSystem)
- The agent only makes outbound HTTP connections to the hub
- No listening ports are opened

## Metrics Collected

| Metric | Source | Description |
|--------|--------|-------------|
| `cpu_percent` | psutil | CPU usage percentage |
| `memory_percent` | psutil | RAM usage percentage |
| `memory_total_mb` | psutil | Total RAM in MB |
| `memory_used_mb` | psutil | Used RAM in MB |
| `disk_percent` | psutil | Root disk usage percentage |
| `disk_total_gb` | psutil | Root disk size in GB |
| `disk_used_gb` | psutil | Root disk used in GB |
| `network_rx_bytes` | psutil | Network bytes received |
| `network_tx_bytes` | psutil | Network bytes sent |
| `load_1m` | psutil | 1-minute load average |
| `load_5m` | psutil | 5-minute load average |
| `load_15m` | psutil | 15-minute load average |
| `uptime_seconds` | psutil | System uptime in seconds |
