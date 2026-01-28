# Home-Lab-Hub Agent Container
# For testing agent functionality

FROM python:3.12-slim

WORKDIR /opt

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent as a proper package (directory name must be valid Python identifier)
COPY __init__.py __main__.py config.py collectors.py heartbeat.py executor.py VERSION ./agent/

# Environment variables for configuration (no config file needed)
ENV HOMELAB_AGENT_HUB_URL=http://backend:8080
ENV HOMELAB_AGENT_API_KEY=dev-key-change-me
ENV HOMELAB_AGENT_HEARTBEAT_INTERVAL=30

# Run agent as a package module from /opt (so 'agent' is a valid package)
CMD ["python", "-m", "agent"]
