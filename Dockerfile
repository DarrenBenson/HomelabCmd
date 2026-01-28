# Multi-stage build for Home-Lab-Hub
# Stage 1: Build
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir hatchling

# Copy project files
COPY pyproject.toml README.md ./
COPY backend/ ./backend/

# Build wheel
RUN pip wheel --no-deps --wheel-dir /app/wheels .

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser

# Copy wheel from builder
COPY --from=builder /app/wheels/*.whl /app/

# Install the application
RUN pip install --no-cache-dir /app/*.whl && rm /app/*.whl

# Copy agent source for deployment
COPY agent/ /app/agent/

# Create data and SSH directories
RUN mkdir -p /app/data /app/ssh && chown -R appuser:appuser /app/data /app/ssh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/v1/system/health', timeout=5)"

# Default environment variables
ENV HOMELAB_CMD_HOST=0.0.0.0
ENV HOMELAB_CMD_PORT=8080

# Run the application
CMD ["python", "-m", "uvicorn", "homelab_cmd.main:app", "--host", "0.0.0.0", "--port", "8080"]
