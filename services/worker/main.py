from __future__ import annotations

import os
import signal
import socket
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

from handlers import HANDLERS

load_dotenv(Path(__file__).with_name(".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

POLL_SECONDS = float(os.environ.get("WORKER_POLL_SECONDS", "10"))
WORKER_ID = os.environ.get("WORKER_ID") or f"{socket.gethostbyname()}:{os.getpid()}"

_shutdown = False

def _handle_signal(signum, _frame):
    global _shutdown
    _shutdown = True
    print(f"[{WORKER_ID}] signal {signum} received; finishing current job then exiting")

def client() -> Client:
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        raise SystemExit(1)
    return create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {msg}", flush=True)

def claim(sb: Client) -> dict | None:
    rows = sb.rpc("claim_job", {"p_worker": WORKER_ID}).execute().data or []
    return rows[0] if rows else None

def finish(sb: Client, job_id: str, result: dict) -> None:
    sb.table("jobs").update(
        {
            "status": "succeeded",
            "result": result,
            "error": None,
            "finished_at": "now()",
        }
    ).eq("id", job_id).execute()

def fail(sb: Client, job: dict, exc: Exception) -> None:
    attempts = int(job.get("attempts") or 3)
    max_attempts = int(job.get("max_attempts") or 3)
    exhausted = attempts >= max_attempts

    message = f"{type(exc).__name__}: {exc}"[:2000]
    sb.table("jobs").update(
        {
            "status": "failed" if exhausted else "queued",
            "error": message,
            "finished_at": "now()" if exhausted else None,
            "claimed_by": None
        }
    ).eq("id", job["id"]).execute()

    log(f"job {job['id']} ({job['job_type']}) fail on attempt {attempts}/{max_attempts}: {message}")
    if not exhausted:
        log(f"  -> requeued for retry")

def run_once(sb: Client) -> bool:
    job = claim(sb)
    if not job:
        return False

    job_type = job.get("job_type")
    handler = HANDLERS.get(job_type)
    log(f"claimed {job['id']} ({job_type}, attempt {job.get('attempts')})")

    if handler is None:
        fail(sb, job, ValueError(f"no handler for job_type {job_type!r}"))
        return True

    try:
        result = handler(sb, job.get("payload") or {})
        finish(sb, job["id"], result if isinstance(result, dict) else {"result": result})
        log(f"  done: {result}")
    except Exception as exc:
        traceback.print_exc()
        fail(sb, job, exc)
    return True

def main() -> int:
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    sb = client()
    log(f"worker {WORKER_ID} starting (poll {POLL_SECONDS}s)")

    try:
        recovered = sb.rpc("requeue_stale_jobs", {}).execute().data

        if recovered:
            log(f"requeued {recovered} stale job(s)")
    except Exception as exc:
        log(f"stale-job sweep failed (continuing): {exc}")

    while not _shutdown:
        try:
            worked = run_once(sb)
            if not worked:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            break
        except Exception as exc:
            log(f"poll error (continuing): {exc}")
            time.sleep(POLL_SECONDS)

    log("worker stopped")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())