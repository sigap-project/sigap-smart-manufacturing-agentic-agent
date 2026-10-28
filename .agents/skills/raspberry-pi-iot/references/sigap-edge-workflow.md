# Develop and deploy the SIGAP edge station

Run inference on the edge, send authenticated inspection events to the web API, and preserve local inspection evidence across network failures and release changes. Read [SSH recovery and diagnostics](ssh-and-diagnostics.md) before accessing a replacement board. All commands use the repository root unless stated otherwise.

## Follow implemented contracts

Use these repository sources, in descending authority when documentation conflicts:

- `ai_models/edge_inference_worker.py`: `SigapEdgeWorker`, `LocalQueueDB`, hardware alerts, CLI, upload behavior, and stdin lifecycle
- `ai_models/vision_runtime.py`: `ProductionRuntime`, JPEG integrity, classifier/detector sessions, and shape checks
- `ai_models/model-manifest.json`: current model filenames, SHA-256 values, thresholds, and preprocessing identity
- `app/api/internal/inspection-result/route.ts`: operational device authentication and ingestion responses
- `README.md` and `docs/SIGAP-Master-Context.md`: system architecture and intended hardware; older ordering, authentication, and timing prose may conflict with implementation

The Python edge worker performs inference and submits inspection events to `/api/internal/inspection-result`. The web platform handles database storage, evidence storage, reasoning, and downstream workflows. Database and cloud credentials do not belong on the Pi.

Classification determines disposition first. In `--mode both`, the detector localizes only `defect` or `unknown` outcomes; it does not decide OK/defect disposition. `ProductionRuntime(Path('ai_models'), threads=2)` verifies both model file hashes against the current manifest and enforces input/output shapes. Both models are required at startup even with `--mode classify`. Read current hashes from the manifest, not copied constants or `previousBaseline`. The runtime selects `CPUExecutionProvider`; do not claim GPU acceleration or old documentation timings as measured Pi results.

The web backend also needs the current `ai_models/model-manifest.json` in its deployed server artifact. Include it explicitly for `/api/internal/inspection-result` in `next.config.ts`; exclude ONNX weights, not the entire `ai_models` directory. A deployed error reporting the stale fallback hash can mean the manifest is absent or unreadable. Repair packaging and verify the deployed model identity before retrying a blocked event. Never falsify `modelVersion` or enable test mode to bypass this check.

Python manifest hashing normalizes integral floats to integers and emits UTF-8, matching JavaScript for the manifest's numeric fields. This prevents identities differing solely because Python serializes `1.0` while JavaScript serializes `1`. `test_manifest_identity()` in `scripts/test-phase-02-03-gate.py` covers nested whole/fractional numbers, signed zero, and UTF-8. Historical unaccepted-event corrections require explicit authorization, verified unchanged model provenance, a SQLite backup, and an audit; never rewrite queue identities merely to satisfy a server.

## Prepare an isolated Python environment

These are future provisioning instructions, not commands authorized by the skill-creation task. Obtain separate permission before installing packages. First inspect OS, architecture, Python version, free disk, and compatible wheels for all dependencies. Use a binary-only download/dry-run check in disposable storage when approved; if wheels or a native GPIO backend are unavailable, report the exact package/platform incompatibility. Do not force-build packages or claim physical mode works.

On a compatible Linux host, create the environment from the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install onnxruntime opencv-python-headless numpy requests gpiozero
```

If `venv` is absent, request OS-package installation authorization. Respect PEP 668 externally managed Python environments: no system-Python installation, `sudo pip`, or `--break-system-packages`. A workstation `.venv` must not be copied to the Pi. For the deployment layout below, create the shared Pi environment at `/home/dti/sigap/.venv` instead, then use its absolute interpreter path for installation and validation.

## Inspect the CLI before using examples

Run the existing no-state-change check with the selected interpreter:

```sh
python -B ai_models/edge_inference_worker.py --help
```

| Option | Supported values or meaning |
|---|---|
| `--capture-mode` | `manual` or `replay`; default `manual` |
| `--mode` | `both` or `classify`; no `detect` mode |
| `--led-mode` | `three`, `red`, or `none` |
| `--buzzer-type` | `active`, `passive`, or `disabled` |
| `--source` | Camera index or RTSP URL; default `0`, not video playback |
| `--source-image` | Existing static image used for explicit replay captures |
| `--device-id` | Actual registered device for operations |
| `--batch-id` | Actual device-bound batch for operations |
| `--api-url` | Explicit reachable ingestion endpoint ending `/api/internal/inspection-result` |
| `--queue-path` | SQLite outbox; default `data/edge_queue.db` relative to working directory |
| `--max-events`, `--max-bytes` | Unaccepted-event/JPEG limits; defaults 500 and 262144000 |

## Exercise replay without production or GPIO changes

Confirm `public/sample-frames/ok.jpeg` exists before starting: a missing replay image can fall through to camera capture. Use a disposable directory for the queue and an explicit loopback-only URL. Start a throwaway HTTP server bound to `127.0.0.1` on port `0`; have every GET/POST return 503 and suppress request/header logging. Read its assigned port. This isolates ingestion, heartbeat, and status requests from production.

Set shell variables `loopback_port` and `temporary_directory` from that disposable harness. Supply only a dummy, nonsecret `SIGAP_DEVICE_TOKEN=skill-smoke-not-a-device-token` to the child environment; never inherit a production token. Run:

```sh
python -B ai_models/edge_inference_worker.py \
  --capture-mode replay --source-image public/sample-frames/ok.jpeg \
  --device-id skill-smoke --batch-id skill-smoke \
  --api-url "http://127.0.0.1:${loopback_port}/api/internal/inspection-result" \
  --queue-path "${temporary_directory}/edge_queue.db" \
  --mode both --led-mode none --buzzer-type disabled
```

Replay is not an automatic file stream. Enter these commands on stdin, in order:

```text
capture skill-smoke-001
status
quit
```

For a scripted walkthrough, use the current local Python interpreter, `PYTHONDONTWRITEBYTECODE=1`, UTF-8 output, and a 60-second subprocess timeout. Require exit 0, `SIGAP STATION READY.`, simulated hardware status, and `[STATION SHUTDOWN] Worker safely stopped.` Inspect the disposable SQLite database: exactly `skill-smoke-001` exists as pending/nonaccepted, its JPEG decodes, and the event's `frame.sha256` matches the JPEG bytes. Then shut down the loopback server and remove disposable state with the temporary-directory context. This exercises model load, replay capture, inference, and persistence, not real GPIO, camera access, or operational API ingestion.

Explicitly close the SQLite inspection connection before leaving `TemporaryDirectory`, for example with `contextlib.closing(sqlite3.connect(queue_path))`. A SQLite connection's transaction context manager does not close it; Windows can otherwise refuse disposable-database deletion.

## Operate the interactive station

The worker requires stdin; use these commands inside its terminal:

| Command | Effect |
|---|---|
| `capture <item-id>` | Inspect one explicitly identified workpiece or replay image |
| `capture <item-id> review` | Record unsupported-input review without normal classifier disposition |
| `status` | Show device/batch, hardware mode, latch, pending/blocked counts, and offline state |
| `pause` / `resume` | Block/allow new captures; synchronization continues |
| `retry <event-id>` | Reset a blocked outbox row to pending, only after resolving its underlying server conflict |
| `ack` | Silence the buzzer; does not clear the persisted red latch or release a hold |
| `quit` | Stop the worker safely |

Never delete queue or latch data to clear an alarm. Authorized latch release comes from server status, matching batch/binding, newer case or batch version, no pending/blocked events, and no capture in progress. `ack` affects audible state; do not assume it replaces server-authorized release or remains effective across every restart.

`SigapEdgeWorker.run()` calls `sys.stdin.readline()` and exits on EOF. A normal noninteractive systemd unit would stop or restart-loop and cannot receive capture commands. Do not provide a daemon template, invented autonomous flag, FIFO workaround, or closed-stdin background process. Boot-time autonomous operation requires a separately requested runtime change.

## Authenticate ingestion and preserve the outbox

Operational ingestion requires a registered `SIGAP_DEVICE_TOKEN`, actual matching device/batch binding, and an explicitly reachable `--api-url`. `localhost` on the Pi means the Pi, not the workstation. Obtain the token through non-echoing input in the station session; never pass it in argv or persist it in these files. Keep database/cloud credentials off the Pi.

Older `EDGE_CAMERA_API_KEY` examples and the worker's internal-key fallback do not supply operational device authentication. The route rejects non-device actors outside explicit test mode. Never set `SIGAP_TEST_MODE=1` to bypass authorization.

The persistent outbox defaults to `data/edge_queue.db` with pending, accepted, and blocked states. Configured limits are 500 unaccepted events and 250 MiB of unaccepted JPEGs; the enqueue path checks 100 MiB disk headroom when available. This is not a total-database size cap or a substitute for checking disk space. The database also stores inspected-item history and the defect latch. Heartbeats run about every 10 seconds; device status polling runs about every 2 seconds.

| Evidence | Triage without data loss |
|---|---|
| `401` / `403` | Check token validity, device, and binding. Database connection exhaustion can also surface as failed authentication; verify database availability before rotating a matching token. The uploader retries after 30 seconds. |
| `409 MODEL_VERSION_MISMATCH` | Compare canonical manifest identity with server expectations; resolve the conflict before retry |
| `409 STALE_BINDING_VERSION` | Inspect actual device/batch binding and version |
| `409 EVENT_CONFLICT` / `ITEM_ALREADY_INSPECTED` | Investigate event/item identity; do not invent new IDs to evade duplicate protection |
| `400`, `422`, `413`, `404` | Inspect blocked validation/size/path error before retry |
| Network exception / server failure | Preserve pending rows; inspect reachability and backoff, not credentials alone |

Recognized conflict codes mark rows blocked; a blocked batch head pauses synchronization. Accepted rows retain inspection history while JPEG blobs are cleared. Preserve the SQLite database and any `-wal`/`-shm` sidecars during deployment. Never raw-copy a live database; use SQLite's backup API for a live snapshot. Do not run two workers against the same station/queue.

An `unknown` / `low_confidence` result requires review even when a legacy UI badge says “Passed (OK)”. Confirm canonical `outcome` and `status`, batch hold state, and stored evidence. Viewing private evidence in the dashboard requires an authenticated session.

## Confirm physical wiring before enabling outputs

Use `docs/wiring-diagram.svg` and section 11 of `docs/SIGAP-Master-Context.md` for intended project wiring:

| Function | BCM GPIO | Physical pin |
|---|---|---|
| Red LED | 17 | 11 |
| Yellow LED | 27 | 13 |
| Green LED | 22 | 15 |
| Buzzer | 18 | 12 |

LEDs require series resistors; the project specifies 330 Ω. Use common ground and compatible buzzer drive circuitry. GPIO is 3.3 V and is not 5 V tolerant. The documented Pi 4, 64-bit OS, and USB webcam are intended hardware, not observed properties of the replacement board. Confirm actual board, wiring, backend, permissions, and operator authorization before GPIO smoke or live camera capture. Simulated mode proves no physical output behavior.

## Deploy a release with an interactive terminal

This is one future, separately authorized deployment recipe. None of these locations or sessions is asserted to exist:

| Purpose | Proposed location |
|---|---|
| Root | `/home/dti/sigap` |
| Immutable release | `/home/dti/sigap/releases/<UTC timestamp>` |
| Active symlink | `/home/dti/sigap/current` |
| Shared Pi virtual environment | `/home/dti/sigap/.venv` |
| Persistent state | `/home/dti/.local/state/sigap` |
| Interactive terminal | tmux session `sigap-edge` |

### Preflight the existing station

First verify SSH identity using the other reference, then inspect these paths, symlink targets, processes, state location, and `tmux ls`. Check OS/architecture/Python/wheels, disk capacity, and availability of `bash`, `sha256sum`, `readlink`, GNU `mv -T`, and tmux. Inspect/attach an existing `sigap-edge` session instead of starting a second writer. If tmux is missing, request permission to install it with the observed OS package manager; do not substitute a daemon.

If `current` is a real directory or any deployment is unfamiliar, stop and request migration authorization. Do not replace it. Confirm whether an old station uses the repository-relative queue: reusing this proposed external path without migrating that state would lose inspection history/latch continuity. Arrange a separately authorized, safely stopped migration or SQLite-backup-based migration before continuing. Do not start with an empty queue to bypass existing state.

### Stage only the required artifacts

On the Windows workstation, use PowerShell from the repository root. Reuse strict SSH trust; the KEX option is per-command for the observed server:

```powershell
$pi = 'dti@raspberrypi.local'
$strict = @('-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no',
  '-o', 'KexAlgorithms=curve25519-sha256', '-o', 'HostKeyAlgorithms=ssh-ed25519')
$release = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ')
$stage = "/home/dti/sigap/releases/$release"
$manifest = Get-Content ai_models/model-manifest.json -Raw | ConvertFrom-Json
$files = @('ai_models/edge_inference_worker.py', 'ai_models/vision_runtime.py',
  'ai_models/model-manifest.json', "ai_models/$($manifest.classifier.modelPath)",
  "ai_models/$($manifest.detector.modelPath)",
  'public/sample-frames/ok.jpeg', 'public/sample-frames/defect.jpeg')
$files | ForEach-Object { Get-FileHash -Algorithm SHA256 $_ }
```

Record these local hashes and the release identifier. Require a new stage directory; abort on collision. Create only the authorized target directories, then transfer each exact relative file:

```powershell
ssh @strict $pi "mkdir -p /home/dti/sigap/releases /home/dti/.local/state/sigap && mkdir '$stage' && mkdir -p '$stage/ai_models' '$stage/public/sample-frames'"
if ($LASTEXITCODE -ne 0) { throw 'Release directory creation failed' }
foreach ($file in $files) {
  scp @strict $file "${pi}:${stage}/$file"
  if ($LASTEXITCODE -ne 0) { throw "Transfer failed: $file" }
}
ssh @strict $pi "cd '$stage' && sha256sum $($files -join ' ')"
if ($LASTEXITCODE -ne 0) { throw 'Remote hashing failed' }
```

Compare every remote hash against its local counterpart before activation. Both ONNX names come from the current manifest. Do not transfer `.env`, `.git`, `node_modules`, a workstation venv, SSH keys, cloud credentials, or queue data. The seven staged files are the two Python modules, manifest, both manifest-referenced ONNX files, and both sample JPEGs.

If authorized and not already provisioned compatibly, create `/home/dti/sigap/.venv` on the Pi and install the dependencies using its interpreter. Never replace an unfamiliar existing environment without authorization. From the staged root, verify the runtime and CLI using that shared environment:

```sh
cd "/home/dti/sigap/releases/$release"
/home/dti/sigap/.venv/bin/python -B -c \
  "from pathlib import Path; from ai_models.vision_runtime import ProductionRuntime; r = ProductionRuntime(Path('ai_models'), threads=2); print(r.model_version)"
/home/dti/sigap/.venv/bin/python -B ai_models/edge_inference_worker.py --help
```

Set remote `release` to the exact recorded workstation identifier, not a new timestamp. Require both commands to exit 0. Run the isolated replay walkthrough from the staged root with a disposable queue and loopback 503 server before activation. Do not validate against a production ingestion URL or live hardware.

### Stop safely and activate atomically

Arrange operator-authorized safe shutdown of any existing station through its terminal, then verify the old worker stopped. `pause` alone does not stop uploads. Preserve the existing external state and sidecars. Record the previous symlink target in operator notes and the deployment shell; keep the prior release available.

In a remote shell, after setting `release` to the recorded identifier:

```sh
root=/home/dti/sigap
stage="$root/releases/$release"
if [ -e "$root/current" ] && [ ! -L "$root/current" ]; then
  printf '%s\n' 'Migration authorization required: current is not a symlink'
  exit 1
fi
previous=$(readlink "$root/current" || true)
printf 'Previous release: %s\n' "$previous"
test -d "$stage" || exit 1
next="$root/.current-$release"
ln -s "$stage" "$next" && mv -T "$next" "$root/current"
```

Require successful activation before starting a worker. The temporary sibling symlink makes the final rename atomic on the same filesystem; it does not stop an old process. Do not remove release or queue state as part of activation.

### Start or attach the interactive worker

If no station session exists and the old writer has stopped, run:

```sh
tmux new-session -s sigap-edge
```

Inside that session, use Bash only after confirming it is available. Disable shell tracing and external terminal transcription before token input. Read actual registered device/batch and reachable API values interactively; do not invent production identifiers:

```bash
cd /home/dti/sigap/current || exit 1
set +x
read -r -p 'Registered device ID: ' SIGAP_DEVICE_ID
read -r -p 'Bound batch ID: ' SIGAP_BATCH_ID
read -r -p 'Reachable ingestion URL: ' SIGAP_API_URL
read -r -s -p 'Device token: ' SIGAP_DEVICE_TOKEN
printf '\n'
: "${SIGAP_DEVICE_ID:?Registered device ID required}"
: "${SIGAP_BATCH_ID:?Bound batch ID required}"
: "${SIGAP_DEVICE_TOKEN:?Device token required}"
case "$SIGAP_API_URL" in
  http://*/api/internal/inspection-result|https://*/api/internal/inspection-result) ;;
  *) unset SIGAP_DEVICE_TOKEN; printf '%s\n' 'Invalid ingestion URL'; exit 1 ;;
esac
export SIGAP_DEVICE_TOKEN
/home/dti/sigap/.venv/bin/python -B ai_models/edge_inference_worker.py \
  --device-id "$SIGAP_DEVICE_ID" --batch-id "$SIGAP_BATCH_ID" \
  --api-url "$SIGAP_API_URL" --source 0 --mode both \
  --queue-path /home/dti/.local/state/sigap/edge_queue.db \
  --led-mode none --buzzer-type disabled
unset SIGAP_DEVICE_TOKEN
```

Require nonempty operator inputs and an API URL ending `/api/internal/inspection-result` before starting. Keep the token in session environment only, never command-line literals or saved scripts. Detach with tmux's `Ctrl-b d`; reconnect with `tmux attach -t sigap-edge`. If the session exists, inspect/attach instead of starting another writer.

Require station readiness, `status`, expected binding and outbox continuity, and authorized operational evidence before calling deployment healthy. Keep `--led-mode none --buzzer-type disabled` until wiring and physical actuation are approved. Do not issue production captures merely to document deployment.

### Roll back code without reverting inspection state

If startup fails, safely stop any failed new worker and verify it stopped. If a prior target exists, restore it from the deployment shell using another unique sibling symlink:

```sh
test -n "$previous" || { printf '%s\n' 'No prior release to restore'; exit 1; }
rollback="$root/.rollback-$release"
ln -s "$previous" "$rollback" && mv -T "$rollback" "$root/current"
```

Restart that prior release in the same interactive-session procedure, with the same external queue, actual binding, and privately supplied token. Do not revert or delete queue/latch data, sidecars, or accepted-item history. If there is no prior release, report the failed first deployment and preserve state. If compatibility is uncertain, stop and report it rather than resetting the database.

## Use development gates without overstating results

Existing tools are `scripts/test-phase-02-03-gate.py` and:

```sh
python ai_models/evaluate_runtime.py --benchmark --samples 200 --threads 2
```

These are development/evaluation tools, not production checks to run for this documentation task. Read actual metrics and stderr before claiming gates passed. The evaluator can report missed box-precision or latency targets without a failing exit code. Workstation latency is not measured Pi latency. Record hardware, model identity, input domain, and metric values when benchmarking is separately requested.
