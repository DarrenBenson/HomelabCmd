# BG0019: Cannot use service discovery on agent install

> **Status:** Closed
> **Severity:** High
> **Priority:** P2
> **Reporter:** opencode
> **Assignee:** opencode
> **Created:** 2026-01-24
> **Updated:** 2026-01-27
> **Resolution:** Configuration (SSH key permissions)

## Summary

The "Discover Services" feature in the "Install Agent" modal fails to connect to the target host over SSH, reporting "All keys rejected" and "Unable to connect to port 22". This prevents users from automatically populating the monitored services list during agent deployment.

## Affected Area

- **Epic:** [EP0002: Agent Deployment and Management](../epics/EP0002-agent-deployment.md)
- **Story:** [US0024: Automated Agent Deployment via SSH](../stories/US0024-agent-ssh-deploy.md)
- **Component:** Backend SSH Service / Frontend Install Agent Modal

## Environment

- **Version:** 1.0.0
- **Platform:** Linux (Hub) / Target Host (studypi400)
- **Browser:** N/A (Image provided)

## Reproduction Steps

1. Open the "Install Agent" modal for a discovered server (e.g., 10.0.0.115).
2. Enter the Sudo Password (optional).
3. Click the "Discover Services" button.
4. Observe the error message in the "Monitored Services" section.

## Expected Behaviour

Clicking "Discover Services" should establish an SSH connection to the target host using available keys or provided credentials and return a list of running services.

## Actual Behaviour

The discovery fails with an error: "Failed to list services: All keys rejected. Last error: [Errno None] Unable to connect to port 22 on 10.0.0.115".

## Screenshots/Evidence

![Cannot use service discovery on agent install](input_file_0.png)

## Root Cause Analysis

The SSH key file `ssh-keys/darren_studypc` had permissions `664`. Paramiko and other SSH clients (like `SSHConnectionService`) explicitly require private keys to have restrictive permissions (usually `600`). If permissions are too open, the key is rejected for security reasons, leading to the "All keys rejected" error.

## Fix Description

Changed permissions of `ssh-keys/darren_studypc` from `664` to `600` using `chmod 600`. This ensures the key is accepted by the SSH service.

## Related Items

| Type | ID | Description |
|------|-----|-------------|
| Story | US0024 | Automated Agent Deployment via SSH |
| Bug | BG0018 | API 504 Gateway Timeout When Installing Agent via SSH |

## Notes

This bug affects the usability of the "Install Agent" workflow, making it more manual for users who need to type service names manually.

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-24 | opencode | Bug reported |
| 2026-01-24 | opencode | Fixed key permissions |
| 2026-01-27 | Claude | Closed as Configuration issue (not a code bug) |
