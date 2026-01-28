# User Personas

**Project:** HomelabCmd
**Version:** 1.0.0
**Last Updated:** 2026-01-18

This document defines the user personas for HomelabCmd. These personas are used when generating user stories to ensure features are designed with specific users in mind.

---

## Darren (Homelab Operator)

**Role:** Primary User / System Administrator
**Technical Proficiency:** Expert
**Primary Goal:** Monitor and maintain the homelab with minimal daily effort

### Background

Technical professional who has built and operates a homelab with 11+ servers including OpenMediaVault NAS boxes, Raspberry Pis, and mini PCs. Runs services like Plex, Nextcloud, Pi-hole (dual for redundancy), WireGuard VPN, Home Assistant, and Ollama for AI experiments.

Currently uses Heimdall for service links and UptimeKuma for basic uptime monitoring, but finds these tools insufficient for proactive management. Comfortable with Linux, Docker, and SSH, but values efficiency - wants automation to handle routine tasks.

Works full-time in a non-homelab role, so maintenance is done in evenings and weekends. The homelab serves both personal productivity and family entertainment needs.

### Needs & Motivations

- Single dashboard showing entire fleet status at a glance
- Proactive alerting before problems cause service outages
- Understanding of resource utilisation across all servers
- Visibility into running costs (electricity)
- Ability to fix common issues without SSH-ing into each server
- Confidence that critical services (Pi-hole DNS, Plex) are running
- Historical data to understand trends and plan capacity

### Pain Points

- Too many dashboards and SSH sessions to check daily
- Discovers disk full issues only when services fail
- No visibility into which server is consuming resources
- Manual service restarts are tedious but frequent
- Family complains when Plex is down
- No idea what the homelab actually costs to run
- Transient devices (laptops, phones) have no audit trail

### Typical Tasks

- **Daily (2-5 min):** Quick glance at fleet health
- **Weekly:** Review alerts, check disk trends, plan maintenance
- **Monthly:** Review costs, capacity planning, updates
- **Ad-hoc:** Troubleshoot service issues, audit devices, add new servers

### Technical Environment

- Primary access via desktop browser (1920x1080+)
- Occasionally checks on tablet or phone
- Receives Slack notifications on mobile
- SSH access to all servers via terminal
- pfSense firewall with DHCP reservations

### Quote

> "I want to spend 5 minutes a day knowing everything is fine, not 30 minutes discovering what's broken."

---

## Sarah (Family Member)

**Role:** Secondary User / Service Consumer
**Technical Proficiency:** Non-technical
**Primary Goal:** Use homelab services without interruption

### Background

Family member who relies on homelab services for daily activities. Uses Plex for media streaming, shared folders for photos and documents, and benefits from Pi-hole ad-blocking without knowing it exists. Has no interest in how things work - just wants them to work.

When services fail, asks Darren to fix them. Has limited patience for technical explanations and just wants to know "is it working?" or "when will it be fixed?"

### Needs & Motivations

- Services (especially Plex) available when wanted
- Fast file access for photos and documents
- No ads while browsing (Pi-hole)
- Assurance that problems are being handled

### Pain Points

- Plex not working during movie night
- Slow file transfers
- Not knowing if a problem is being fixed or ignored
- Technical jargon in error messages

### Typical Tasks

- Stream media via Plex (daily)
- Access shared files (weekly)
- Report problems to Darren (occasionally)

### Technical Environment

- Smart TV with Plex app
- iPhone for Plex mobile
- Laptop for file access
- No access to homelab management tools

### Quote

> "I don't care how it works. I just want to watch my show."

### Relevance to HomelabCmd

Sarah doesn't directly use HomelabCmd, but her needs drive several requirements:

1. **Proactive monitoring** - Fix issues before Sarah notices
2. **Service-focused alerts** - Prioritise Plex, file shares
3. **Fast remediation** - Minimise downtime for consumer services
4. **Future consideration:** Simple status page showing "All Systems Operational"

---

## Future Persona: Remote Administrator

**Role:** Potential Future User
**Technical Proficiency:** Intermediate
**Primary Goal:** Help manage the homelab remotely

### Background

A technically-inclined friend or family member who could assist with homelab management when Darren is unavailable (e.g., on holiday). Would need limited, supervised access to approve certain actions or view status.

### Relevance

This persona is **out of scope for v1.0** but informs:
- Single-user design decisions (can be extended later)
- API key authentication (could support multiple keys)
- Audit logging (track who did what)

---

## Persona Summary

| Persona | Role | Frequency | Key Needs | Priority |
|---------|------|-----------|-----------|----------|
| **Darren** | Operator | Daily | Unified view, proactive alerts, remediation | Primary |
| **Sarah** | Consumer | N/A (indirect) | Service uptime, fast fixes | Secondary |
| **Remote Admin** | Helper | Future | Limited access, approval workflow | Future |

---

## How Personas Inform User Stories

When writing user stories, reference personas to ensure features serve real needs:

**Good:** "As **Darren**, I want to see all servers on one dashboard so I can check fleet health in under 2 minutes."

**Bad:** "As a user, I want to see servers." (Too vague, doesn't capture motivation)

### Persona-to-Epic Mapping

| Epic | Primary Persona | Secondary |
|------|-----------------|-----------|
| EP0001: Core Monitoring | Darren | - |
| EP0002: Alerting | Darren | Sarah (indirect) |
| EP0003: Service Monitoring | Darren | Sarah (indirect) |
| EP0004: Remediation | Darren | - |
| EP0005: Cost Tracking | Darren | - |
| EP0006: Ad-hoc Scanning | Darren | - |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-18 | Initial personas created from PRD |
