# Recover SSH and diagnose a Raspberry Pi

Resolve the endpoint, verify physical identity, then repair only stale trust records. Keep diagnosis read-only until a specific mutation is authorized. See the [skill entrypoint](../SKILL.md) for current connection evidence and authorization boundaries.

## Distinguish the failing layer

The observed hostname resolves successfully, but its saved identity differs. Replacement or reimaging can cause this; the warning does not rule out interception.

| Symptom | Read-only check | Next action |
|---|---|---|
| Name not resolved | DNS/mDNS lookup | Inspect local-link reachability and advertised names |
| TCP timeout | Port 22 connection test | Inspect address, route, power, and firewall evidence |
| Connection refused | Port 22 connection test | Confirm intended host and whether SSH listens at its console |
| Changed/unknown host key | Inspect saved record and unauthenticated public key | Obtain independent console fingerprint before changing trust |
| Permission denied | Strict host-key match followed by authentication rejection | Check username and authorized authentication method separately |

On Windows PowerShell, inspect resolution, TCP reachability, and effective SSH options:

```powershell
[System.Net.Dns]::GetHostAddresses('raspberrypi.local')
Test-NetConnection -ComputerName 192.168.137.74 -Port 22
ssh -G dti@raspberrypi.local
ssh-keygen -F raspberrypi.local -f C:/Users/Rayka/.ssh/known_hosts
ssh-keygen -F 192.168.137.74 -f C:/Users/Rayka/.ssh/known_hosts
```

`.local` normally uses multicast DNS (mDNS) on the local link. Windows may select IPv6 before IPv4. Link-local IPv6 requires an interface scope, such as the observed `%6`; another workstation may need a different scope. Duplicate default hostnames can identify different boards, and DHCP can change addresses. Compare both endpoint keys and console identity. Do not infer an Internet Connection Sharing gateway from `192.168.137.*`, add an SSH alias, or rename a functioning host to fix a key mismatch.

## Verify identity before changing trust

Use these steps in order; approval of a repair plan does not authenticate the device.

1. Re-resolve the hostname and inspect ED25519 keys from both the hostname and current intended IPv4 address. Abort trust changes if resolution changes unexpectedly or endpoints disagree.
2. At the physical Pi console, confirm the conventional host public-key path exists, then run:

   ```sh
   ssh-keygen -l -E sha256 -f /etc/ssh/ssh_host_ed25519_key.pub
   ```

   If absent, inspect `sshd -T` HostKey paths at that console and fingerprint the corresponding public key. If permissions block inspection, request authorization rather than silently using `sudo`. Never generate or rotate host keys to bypass the warning. A result delivered through another independently trusted channel is also acceptable.
3. Compare the console fingerprint with both endpoint fingerprints and the collected public key bytes. The current candidate is:

   ```text
   SHA256:+Qb0gmbZQiLmgcEKgl4N+BiCi0cg1nQ8fKWImSRsTuY
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEbPj2uinjWA6H0OdY5XXKeQ/veV+L9m7DwZs05kWGv8
   ```

4. Proceed only when all agree. If evidence is missing or differs, preserve trust unchanged and report all nonsecret addresses/fingerprints. Continue independent local work, but do not claim SSH repaired.

Native Windows `ssh-keyscan -T 5 -t ed25519` failed here with `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com`. Do not rerun it as a workaround, install another client, or change global crypto policy. Installed Paramiko can collect keys without authentication or file writes. Run this through the existing Python interpreter:

```python
import base64
import hashlib
import socket
import paramiko

for host in ("raspberrypi.local", "192.168.137.74"):
    with socket.create_connection((host, 22), timeout=10) as sock:
        transport = paramiko.Transport(sock)
        try:
            transport.start_client(timeout=10)
            key = transport.get_remote_server_key()
            digest = hashlib.sha256(key.asbytes()).digest()
            fingerprint = base64.b64encode(digest).decode().rstrip("=")
            print(host, sock.getpeername(), "SHA256:" + fingerprint)
            print(key.get_name(), key.get_base64())
        finally:
            transport.close()
```

This handshake observes a key; it neither authenticates nor trusts it. Native SSH can diagnose this server with per-command `-o KexAlgorithms=curve25519-sha256`; do not persist a global override.

## Repair only verified target mappings

After independent verification, re-read `C:/Users/Rayka/.ssh/known_hosts` immediately before editing. The previously observed hostname record was line 7; never treat that as a fixed coordinate. The saved hostname fingerprint was `SHA256:PrHnRSM8skTG+XbTcgJ+rziFe7rP1Ez/I4vW5NLjcZQ`.

1. Capture original bytes and unrelated-record bytes/hash in memory. Create a unique sibling backup `known_hosts.before-raspberrypi-<UTC timestamp>.bak` using exclusive creation. Preserve original bytes; never overwrite any backup, including `known_hosts.old`.
2. Surgically replace only the stale `raspberrypi.local` ED25519 mapping. Add the separately verified `192.168.137.74` mapping if absent. Already-correct records are a no-op. If either target has another stale record, inspect and replace that exact target only; retain unrelated tokens in combined-host records. Preserve comments, line endings, all other records, and previous Pi addresses.
3. If the current candidate is independently verified, the resulting records must be:

   ```text
   raspberrypi.local ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEbPj2uinjWA6H0OdY5XXKeQ/veV+L9m7DwZs05kWGv8
   192.168.137.74 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEbPj2uinjWA6H0OdY5XXKeQ/veV+L9m7DwZs05kWGv8
   ```

4. Inspect each mapping with `ssh-keygen -F <host> -f <known_hosts>`. Assert both target keys equal the verified candidate and unrelated record content remains byte-for-byte identical. Reapplying must not duplicate records.

The standard alternative is `ssh-keygen -R <host> -f <known_hosts>` followed by adding only that host's verified key. Use it only after independent verification and backup. Inspect combined-host records first; preserve their unrelated hosts. Never remove the entire file or unrelated old IP entries. See the [OpenBSD ssh-keygen manual](https://man.openbsd.org/ssh-keygen) for `-F`, `-R`, and fingerprinting with `-l`.

Do not modify `known_hosts.old`, private keys, client configuration, DNS, Avahi, or the Pi hostname. Do not disable host checking or use Paramiko auto-add/warning policies.

## Prove trust and authentication separately

After repairing verified mappings, run strict native checks for both targets in Windows PowerShell:

```powershell
ssh -vv -o BatchMode=yes -o StrictHostKeyChecking=yes `
  -o UpdateHostKeys=no -o ConnectTimeout=8 `
  -o KexAlgorithms=curve25519-sha256 -o HostKeyAlgorithms=ssh-ed25519 `
  dti@raspberrypi.local true
$LASTEXITCODE
ssh -vv -o BatchMode=yes -o StrictHostKeyChecking=yes `
  -o UpdateHostKeys=no -o ConnectTimeout=8 `
  -o KexAlgorithms=curve25519-sha256 -o HostKeyAlgorithms=ssh-ed25519 `
  dti@192.168.137.74 true
$LASTEXITCODE
```

Require log evidence that the server key matches the saved key, without changed/unknown-host errors. `BatchMode=yes` may reject authentication when passwordless login is unavailable; that is not proof of a working login.

For password-authenticated verification, obtain the password through non-echoing secure input outside recorded tool arguments. Keep it only in memory. With installed Paramiko 5.0.0, create a fresh `SSHClient` per endpoint and call:

```python
client.load_host_keys("C:/Users/Rayka/.ssh/known_hosts")
client.connect(
    host, username="dti", password=password,
    allow_agent=False, look_for_keys=False,
    timeout=10, banner_timeout=10, auth_timeout=10,
)
stdin, stdout, stderr = client.exec_command(
    "whoami; hostname; hostname -I; uname -m; python3 --version",
    timeout=10,
)
print(stdout.read().decode(), stderr.read().decode())
print("exit:", stdout.channel.recv_exit_status())
```

Retain the default RejectPolicy and close every client in `finally`. Compare both paths: username `dti`, consistent hostname, current IPv4, architecture, and Python. A compound command's exit code describes its final command; inspect every result and stderr. If authentication fails, preserve the independently verified trust records and report authentication separately. Do not reset passwords or copy local SSH keys without authorization.

Finally, have the owner reconnect normally with `ssh dti@raspberrypi.local`, entering the password privately if needed. Require a normal authentication/session rather than a host-key warning. If secure password input is unavailable, provide that owner-run check and state authenticated access remains unverified.

## Inspect an authenticated host without actuation

Run a baseline only after identity verification and authenticated access. Capture each command's stdout, stderr, and exit code:

```sh
whoami
hostname
hostname -I
uname -m
python3 --version
id
df -h
free -h
uptime
cat /etc/os-release
if [ -r /proc/device-tree/model ]; then
  tr -d '\000' < /proc/device-tree/model; printf '\n'
fi
```

Check tool availability before invoking optional commands:

```sh
for tool in python3 v4l2-ctl vcgencmd gpioinfo fuser tmux; do
  command -v "$tool" || printf '%s unavailable\n' "$tool"
done
for node in /dev/video* /dev/gpiochip*; do
  [ ! -e "$node" ] || ls -l "$node"
done
```

Where available, inspect `v4l2-ctl --list-devices`, `vcgencmd measure_temp`, and `vcgencmd get_throttled`. Missing commands mean unavailable tooling, not failed hardware. Decode throttling flags using documentation for the observed board; distinguish current undervoltage/throttling from historical flags. Do not assume this replacement is a Pi 4 or has the documented OS/Python.

| Concern | Read-only evidence | Boundary |
|---|---|---|
| Camera permissions/ownership | Device node owner/group, `id`, available `fuser /dev/video0`, process identity | No live camera open, capture, process kill, or group changes |
| GPIO backend/permissions | `/dev/gpiochip*` ownership, installed gpiozero/backend availability, existing error text | No pin requests/toggles; physical smoke needs wiring confirmation and permission |
| Power/thermal instability | Temperature, throttling flags, uptime, accessible logs | Do not overclock, reboot, or change power configuration |
| Disk/RAM pressure | `df -h`, `free -h`, queue storage location | Do not delete queue/latch data or artifacts to hide capacity errors |
| Deployment state | Known paths, symlink targets, `tmux ls` if available | Inspect/attach existing station; never start a second queue writer |

Do not run privileged commands without permission. Report addresses, fingerprint verification status, observed board/OS/architecture/Python, relevant error and exit code, and the next minimal action. An SSH login does not establish camera health, physical GPIO operation, model performance, or deployment readiness.
