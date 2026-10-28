---
name: raspberry-pi-iot
description: "Debug, develop, and deploy Raspberry Pi IoT and SIGAP edge stations. Use for SSH host-key changes, raspberrypi.local or IP connectivity, Python environments, USB cameras, GPIO LEDs and buzzers, ONNX inference, offline queues, and remote deployment."
---

# Operate Raspberry Pi IoT stations

Discover host and project state → verify identity → diagnose read-only → make the requested minimal change → exercise the changed path → report evidence and remaining blockers. Never treat a successful SSH login as proof of deployment or hardware health.

## Choose the reference

- [SSH recovery and read-only diagnostics](references/ssh-and-diagnostics.md): verify replacement-device identity, repair targeted host trust, distinguish connectivity/authentication failures, and inspect Python, camera, GPIO, power, and storage.
- [SIGAP edge development and deployment](references/sigap-edge-workflow.md): follow implemented inference and ingestion contracts, exercise isolated replay, preserve outbox/latch state, and deploy an interactive station with rollback.

Read the relevant reference before acting. Resolve repository-relative commands from the project root; inspect existing deployments before choosing paths. Prefer runtime implementation and current device observations over older hardware specifications or benchmark claims.

## Current connection evidence

| Field | Last observed value |
|---|---|
| SSH username | `dti` |
| Expected hostname | `raspberrypi.local` |
| IPv4 | `192.168.137.74`; DHCP may change it |
| IPv6 selected by Windows SSH | `fe80::da3a:ddff:fe07:ed95%6`; link-local scope is workstation-specific |
| Observed ED25519 fingerprint, both endpoints | `SHA256:+Qb0gmbZQiLmgcEKgl4N+BiCi0cg1nQ8fKWImSRsTuY` |
| Independently verified physical identity | Owner confirmed the exact fingerprint from the Pi's physical console during deployment |
| Local trust state | Verified hostname and IPv4 mappings repaired; unrelated records preserved byte-for-byte |
| Observed replacement | Raspberry Pi 4 Model B Rev 1.5; Debian 13 arm64; Python 3.13.5; Logitech C270 at `/dev/video0` |

The owner independently verified this recorded fingerprint; future changed keys require fresh independent verification. Re-resolve and recollect keys each session. Endpoint agreement or plan approval alone does not establish identity.

## Authorization and secrets

Completed owner-authorized actions included webcam-only provisioning/deployment, `pi-01` token rotation while retaining `final-ok`, one workpiece upload, backend manifest packaging, the `aws-sap` pool cap, one controlled RDS reboot, and an audited manifest-identity correction. These are historical approvals, not standing permission for future hardware actuation, reboots, network changes, or unrelated cloud changes.

Require separate authorization before package installation, file synchronization, service changes, reboot, hostname/network changes, or hardware actuation. Do not capture from a live camera, toggle GPIO, kill camera owners, change groups, or escalate privileges during read-only diagnosis.

Obtain passwords and device tokens through secure, interactive, non-echoing session input. Disable shell tracing and transcript recording before secret entry. Never put secrets in argv, shell history, terminal transcripts, saved scripts, skill files, or chat. Persist no passwords, private keys, `.env` contents, device tokens, or cloud credentials. If approval resets credentials, request secure re-entry; never infer a password from the username.

Preserve SSH host authentication: never use `StrictHostKeyChecking=no`, `UserKnownHostsFile=NUL`, Paramiko `AutoAddPolicy`, or `WarningPolicy`. Never solve an identity warning by deleting all host records, rotating server keys, changing DNS, or renaming a functioning host.

## Evidence required before completion

Report observed addresses, independent fingerprint-verification status, commands and exit codes, changed files, and remaining blockers. For authenticated access, record identity, architecture, Python, and relevant stderr. For SIGAP changes, exercise the changed path without unintended production requests or physical actuation. Distinguish simulated validation from physical validation and workstation results from measured Pi results.

## Local validation record

The initial workstation CLI/replay checks passed with a disposable queue and simulated GPIO. During deployment, both strict native SSH checks matched the verified key; password-authenticated checks through hostname and IPv4 exited 0. The seven staged files matched local SHA-256 values. Pi runtime/CLI checks, OK/defect replay, and a live 640 × 480 webcam review capture passed with GPIO disabled; disposable smoke state was removed. The new skill may require a session reload for discovery.

## Current Pi deployment

- Release: `/home/dti/sigap/releases/20261028T173602578193Z`; active link: `/home/dti/sigap/current`
- Interpreter: `/home/dti/sigap/.venv/bin/python`; tmux session: `sigap-edge`
- Device/batch: `pi-01` / `final-ok`; device token rotated with owner approval and retained only in session memory
- Queue: `/home/dti/.local/state/sigap/edge_queue.db`; preserve it and any sidecars
- Camera: manual capture from source `0`; LEDs, buzzer, and sensor are not connected; keep `--led-mode none --buzzer-type disabled`
- Commissioning event: `0da1d284-acfd-426a-80aa-4c0cd4746e45`; accepted as inspection `INS-205356-0d98`; the same 640 × 480 JPEG was verified in S3

Reconnect with `ssh dti@raspberrypi.local`, then `tmux attach -t sigap-edge`. The resumed worker reported pending 0, blocked 0, offline false, and simulated outputs. A real SSH PTY attach/status/detach check passed. A detached tmux session preserves the terminal, not reboot persistence; losing that session requires secure token re-entry or an authorized rotation.

The commissioning result is `unknown` / `low_confidence` at 69.6%, with `Pending Review`; batch `final-ok` is held. The history dashboard displays the accepted inspection, but its existing “Passed (OK)” badge is misleading for this unknown outcome. Trust canonical outcome/review state, not that badge. Private evidence images require authenticated access.

Backend packaging fix commit `e615976774f4e72ff5f4ec8f3308a9a42504aa71` deployed successfully. Amplify `aws-sap` job 11 also applied `connection_limit=3`; RDS recovered after the separately authorized reboot. Python and JavaScript now agree on manifest identity `d02adab2cefeeadba1da48ad5324a0f45178bf7193383f55b7f7930accd0df7d`.

Before correcting the unaccepted event's serialization-derived identity, SQLite's backup API preserved `/home/dti/.local/state/sigap/edge_queue.before-canonical-20261028T173602578193Z.db`. The corresponding `edge_queue.canonical-migration-20261028T173602578193Z.jsonl` records the audit. IDs, JPEG, measurements, and latch state were preserved. Keep these audit artifacts; do not restore their obsolete blocked state over the accepted queue.

The original release `/home/dti/sigap/releases/20261028T151512408429Z` remains for audit, but its canonicalization defect makes it unsuitable for operational rollback against the current backend. There is no previously working compatible Pi release. If startup fails, stop the worker with `quit`, preserve external queue/latch state, and deploy a verified compatible release; never delete state or falsify model identity.
