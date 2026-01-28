# Legacy Project Audit Report

**Date:** 2026-01-18 (Revised)
**Purpose:** Extract domain knowledge from legacy projects to inform HomelabCmd development
**Projects Audited:**
- `/home/darren/code/DarrenBenson/HomeLab`
- `/home/darren/code/DarrenBenson/HomeLab-Ansible-Playbooks`
- `/home/darren/code/DarrenBenson/DockerComposeScripts` (pending)

---

## Executive Summary

HomelabCmd is a **new custom monitoring platform** (FastAPI + React + Python agents), not a consolidation of existing configurations. The legacy projects represent the **infrastructure being monitored**, not components to recycle into the hub itself.

### Revised Assessment

| Project | Original View | Revised View |
|---------|---------------|--------------|
| HomeLab | "Migrate Docker Compose files" | **Monitoring targets** - Services to be monitored by HomelabCmd |
| HomeLab-Ansible-Playbooks | "Extract to roles" | **Domain knowledge** - Informs remediation patterns, but agent handles this differently |
| ollama-bench | "High value, migrate directly" | **Separate utility** - Useful but outside core product scope |

### What's Actually Valuable

1. **Server inventory** - Names, IPs, TDPs, expected services
2. **Service mappings** - What runs where (Plex on MediaServer, etc.)
3. **Domain knowledge** - OMV patterns, systemd services, network topology
4. **Pain points** - Validates PRD requirements (fragmented monitoring, manual SSH)

---

## Extracted Domain Knowledge

### Server Inventory (for initial configuration)

This data directly populates the HomelabCmd server registration:

| Server ID | Display Name | Type | TDP | Location | Expected Services |
|-----------|--------------|------|-----|----------|-------------------|
| omv-homeserver | OMV HomeServer | OMV/Pi4 8GB | 50W | Primary | smbd, docker |
| omv-backupserver | OMV BackupServer | OMV/Pi4 4GB | 40W | Backup | smbd, rsync |
| omv-documentserver | OMV DocumentServer | OMV | 40W | - | smbd |
| omv-mediaserver | OMV MediaServer | OMV/Mini PC | 65W | - | plex, sonarr, radarr, transmission, jackett |
| omv-cloudserver1 | OMV CloudServer1 | OMV | 50W | - | smbd, nextcloud (docker) |
| omv-webserver1 | OMV WebServer1 | OMV | 45W | - | nginx, n8n (docker) |
| omv-webserver2 | OMV Webserver 2 | OMV | 45W | - | nginx |
| omv-homeautoserver | OMV HomeAutoServer | OMV | 50W | - | homeassistant (docker) |
| omv-aiserver1 | OMV AIServer1 | OMV | 100W | - | ollama, docker |
| pihole-master | Pi-hole Master | RPi | 5W | DNS Primary | pihole-FTL |
| pihole-backup | Pi-hole Backup | RPi | 5W | DNS Backup | pihole-FTL |

**Total estimated TDP:** 495W
**Estimated daily cost (at £0.24/kWh):** £2.85
**Estimated monthly cost:** £85.54

### Network Topology

```
                    ┌─────────────────┐
                    │    pfSense      │
                    │   (gateway)     │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌─────▼─────┐        ┌────▼────┐
   │Pi-hole  │         │ LAN Switch│        │Pi-hole  │
   │ Master  │         │           │        │ Backup  │
   │10.0.0.2 │         └─────┬─────┘        │10.0.0.3 │
   └─────────┘               │              └─────────┘
                             │
    ┌──────────┬──────────┬──┴───┬──────────┬──────────┐
    │          │          │      │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌▼───┐ ┌───▼───┐ ┌───▼───┐
│Home   │ │Media  │ │Backup │ │... │ │Cloud  │ │AI     │
│Server │ │Server │ │Server │ │    │ │Server │ │Server │
└───────┘ └───────┘ └───────┘ └────┘ └───────┘ └───────┘
```

**Key observations:**
- Dual Pi-hole for DNS redundancy (reboot scheduling must respect this)
- MergerFS pools on primary/backup servers (multi-disk monitoring needed)
- Most services run in Docker containers (container status more relevant than systemd)

### Service Categories

| Category | Services | Criticality | Notes |
|----------|----------|-------------|-------|
| DNS | pihole-FTL | Critical | Staggered reboots required |
| File Sharing | smbd | High | Core NAS functionality |
| Media | plex, sonarr, radarr, transmission, jackett | Medium | User-facing but non-essential |
| Productivity | nextcloud, n8n, nginx | Medium | Can tolerate brief outages |
| AI/ML | ollama | Low | Development/experimental |
| Home Automation | homeassistant | Medium | Separate from this monitoring |

### Storage Architecture

**Primary Server (homeserver):**
- MergerFS pool: 13.65 TiB
- Multiple physical drives aggregated
- `/srv/mergerfs/diskpool` mount point

**Backup Server (backupserver):**
- MergerFS pool: 12.74 TiB
- Rsync-based replication from primary

**Implication for HomelabCmd:**
- Single "disk %" metric insufficient
- Need per-mount monitoring
- Alert on any mount exceeding threshold

### Current Pain Points (validates PRD)

From legacy project analysis:

| Pain Point | Evidence | PRD Requirement |
|------------|----------|-----------------|
| Fragmented monitoring | 46 separate docker-compose files, no central status | US-1.1: Single dashboard |
| Manual SSH for fixes | Ansible playbooks require manual execution | US-4.1: Suggested remediation |
| No proactive alerts | UptimeKuma only checks "is it responding?" | US-3.1-3.4: Threshold alerts |
| Unknown resource usage | No consolidated metrics | US-1.2: Real-time metrics |
| Unknown costs | No power tracking | US-5.1-5.4: Cost tracking |

---

## Patterns Worth Noting

### From HomeLab

**ollama-bench script** (1,598 lines) demonstrates:
- REST API integration pattern (relevant for agent design)
- Flexible argument parsing
- Comprehensive error handling with trap
- Auto-dependency management

**Not directly reusable** but informs coding standards for the Python agent.

### From Ansible Playbooks

**Intelligent reboot scheduling:**
```yaml
# Pattern: Check system load before disruptive action
- name: Check system load
  shell: cat /proc/loadavg | awk '{print $1}'
  register: system_load

- name: Skip if load too high
  when: system_load.stdout | float < 2.0
```

**Relevant for remediation engine:** Before executing `apply_updates`, agent could check system load and defer if too high.

**DNS server awareness:**
```yaml
# Pattern: Stagger reboots for redundant services
- name: Delay reboot for primary DNS
  when: inventory_hostname == 'homeserver'
  pause: 1800  # 30 minutes

- name: Delay reboot for backup DNS
  when: inventory_hostname == 'backupserver'
  pause: 3600  # 60 minutes
```

**Relevant for remediation engine:** Certain servers may need coordinated actions to maintain service availability.

**Retry with backoff:**
```yaml
retries: 3
delay: 5
until: result is success
```

**Relevant for agent:** Heartbeat should retry on transient network failures.

---

## PRD/TRD Feedback

### Strengths

The PRD and TRD are comprehensive and well-structured:

- Clear problem statement with measurable success criteria
- Well-defined user stories with acceptance criteria
- Clean architecture (monolith with agent fleet)
- Solid API contracts with request/response schemas
- Good ADRs explaining key decisions
- Security considerations with threat model

### Identified Gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| Agent versioning | Hub can't detect outdated agents | Add `agent_version` to heartbeat; warn if mismatch |
| Multi-disk monitoring | OMV servers have MergerFS pools | Collect per-mount metrics; alert on any threshold breach |
| Docker container status | Many services are containers, not systemd | Phase 3/4: Optional `docker ps` collection |
| Network resilience | Agents fail silently if hub unreachable | Buffer last N metrics locally; replay on reconnection |
| Database migrations | Schema changes need management | Use Alembic from Phase 1 |
| Testing strategy | No test plan documented | Add pytest/Vitest approach to TRD |

### Minor Observations

1. **Electricity rate** - Default £0.24/kWh is below current UK rates (~£0.28-0.30)
2. **Heartbeat interval** - 60s is sensible; consider 30s option for faster failure detection
3. **Offline threshold** - 180s (3 missed heartbeats) could be configurable per-server
4. **Notifications** - Slack-only initially is fine; simple webhook abstraction enables Discord/Telegram later

---

## Recommendations

### Do Not Migrate

| Component | Reason |
|-----------|--------|
| Docker Compose files | These are monitoring targets, not hub components |
| Ansible playbooks | Agent handles remediation via API, not playbooks |
| Environment files | New application, new config structure |

### Extract and Use

| Data | Usage in HomelabCmd |
|------|----------------------|
| Server inventory table (above) | Seed initial server registrations |
| Service mappings | Configure expected services per server |
| TDP estimates | Pre-populate cost calculation |
| Network topology | Informs multi-disk and DNS-aware features |

### Keep Separate

| Component | Reason |
|-----------|--------|
| ollama-bench | Useful utility but not part of monitoring platform |
| Ansible playbooks | May still be useful for initial server provisioning |

---

## Pending: DockerComposeScripts

The third project at `/home/darren/code/DarrenBenson/DockerComposeScripts` requires a git push from source before audit. Expected content: additional Docker service definitions (monitoring targets, not hub components).

---

## Appendix: Legacy Project Statistics

### HomeLab

| Metric | Value |
|--------|-------|
| Total files | 311 |
| Docker Compose files | 46 |
| Service categories | 25+ |
| Docker images | 38 |

### HomeLab-Ansible-Playbooks

| Metric | Value |
|--------|-------|
| Playbooks | 3 |
| Total YAML lines | ~514 |
| Managed hosts | 8 |
| Host groups | 2 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-18 | Initial audit (pre-PRD/TRD review) |
| 2026-01-18 | **Revised**: Reframed based on PRD/TRD context; legacy projects are monitoring targets, not components to recycle; extracted domain knowledge; added PRD/TRD feedback |
