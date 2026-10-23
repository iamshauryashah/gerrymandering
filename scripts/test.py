#!/usr/bin/env python3
"""Runs the browser tests in parallel, each group (and each slice of a big group) in its own headless Chrome.

    python3 scripts/test.py                 the full suite (run this before deploying)
    python3 scripts/test.py --affected      only the groups whose code or tests changed since they last passed
    python3 scripts/test.py brush geometry  only the named groups
    python3 scripts/test.py --list          show the groups and what each one covers

Groups, the files they run, the source they cover and how many slices they are split into live in tests/groups.json.
A group that passes in full is remembered in .test-cache.json, so --affected skips it until something it covers changes.
Needs Python 3 and Google Chrome (set CHROME to use another binary). Exit status is 0 only when every test passed.
"""
import argparse
import hashlib
import http.server
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tests" / "groups.json"
CACHE = ROOT / ".test-cache.json"
TIMINGS = ROOT / ".test-timings.json"
# A test that took at least this long last time gets placed on purpose; the rest are spread by name.
SLOW_MS = 700


def find_chrome():
    candidates = [
        os.environ.get("CHROME"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
    ]
    for path in candidates:
        if path and Path(path).exists():
            return path
    sys.exit("Chrome was not found. Install Google Chrome or set CHROME to its path.")


def load_json(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def files_under(entry):
    path = ROOT / entry
    if path.is_dir():
        return sorted(p for p in path.rglob("*") if p.is_file() and p.suffix in {".js", ".html", ".css", ".json"})
    return [path] if path.is_file() else []


def group_hash(manifest, name):
    group = manifest["groups"][name]
    paths = [f"tests/{f}" for f in group["files"]] + group["covers"] + manifest["shared"]
    digest = hashlib.sha256()
    for entry in paths:
        for file in files_under(entry):
            digest.update(str(file.relative_to(ROOT)).encode())
            digest.update(file.read_bytes())
    return digest.hexdigest()


def job_key(group, shard):
    return f"{group}[{shard}]" if shard else str(group)


class Collector:
    """A tiny static server for the project that also receives each page's result."""

    def __init__(self):
        self.results = {}
        self.events = {}
        self.lock = threading.Lock()
        collector = self

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(ROOT), **kwargs)

            def log_message(self, *args):
                pass

            def end_headers(self):
                self.send_header("Cache-Control", "no-store")
                super().end_headers()

            def do_POST(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                if self.path == "/__result":
                    collector.deliver(json.loads(body))
                self.send_response(204)
                self.end_headers()

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def expect(self, key):
        with self.lock:
            self.events[key] = threading.Event()

    def deliver(self, data):
        key = job_key(data.get("group"), data.get("shard"))
        with self.lock:
            self.results[key] = data
            event = self.events.get(key)
        if event:
            event.set()

    def wait(self, key, timeout):
        return self.events[key].wait(timeout)


def name_hash(name):
    """The same FNV-1a hash of a test name that tests/test-runner.js uses (over UTF-16 code units)."""
    h = 0x811C9DC5
    units = name.encode("utf-16-le")
    for i in range(0, len(units), 2):
        h ^= units[i] | (units[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def plan_slices(known, count):
    """Spreads a group's known-slow tests over its slices, lightest slice first (tests not listed here land by hash).

    `known` maps test name to the milliseconds it took last time. Returns {hash: slice} for the slow tests only."""
    load = [0] * count
    for name, ms in known.items():
        if ms < SLOW_MS:
            load[name_hash(name) % count] += ms
    assign = {}
    for name, ms in sorted(known.items(), key=lambda kv: -kv[1]):
        if ms >= SLOW_MS:
            target = load.index(min(load))
            assign[name_hash(name)] = target
            load[target] += ms
    return assign


def run_job(collector, chrome, job, timeout):
    group, index, count, assign = job
    shard = f"{index}/{count}" if count > 1 else None
    key = job_key(group, shard)
    url = f"http://127.0.0.1:{collector.port}/tests/index.html?group={group}&report=1" + (f"&shard={shard}" if shard else "")
    if assign:
        url += "&assign=" + ",".join(f"{h}:{s}" for h, s in assign.items())
    collector.expect(key)
    profile = tempfile.mkdtemp(prefix="gerry-tests-")
    started = time.time()
    process = subprocess.Popen(
        [
            chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
            "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
            "--window-size=1400,1000", f"--user-data-dir={profile}", url,
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
    )
    try:
        arrived = collector.wait(key, timeout)
    finally:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
        shutil.rmtree(profile, ignore_errors=True)
    result = collector.results.get(key) if arrived else None
    return key, group, result, time.time() - started


def main():
    manifest = load_json(MANIFEST, None)
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("groups", nargs="*", help="group names to run (default: all)")
    parser.add_argument("--affected", action="store_true", help="skip groups that passed before and whose code and tests are unchanged")
    parser.add_argument("--list", action="store_true", help="list the groups and exit")
    parser.add_argument("--jobs", type=int, default=os.cpu_count() or 4, help="how many Chrome processes to run at once")
    parser.add_argument("--timeout", type=int, default=900, help="seconds to wait for one slice")
    args = parser.parse_args()

    names = list(manifest["groups"])
    if args.list:
        for name in names:
            group = manifest["groups"][name]
            print(f"{name:14} {group['shards']} slice(s)  runs {', '.join(group['files'])}  covers {', '.join(group['covers'])}")
        return 0
    unknown = [g for g in args.groups if g not in manifest["groups"]]
    if unknown:
        sys.exit(f"Unknown group(s): {', '.join(unknown)}. Groups: {', '.join(names)}")
    selected = args.groups or names
    cache = load_json(CACHE, {})
    hashes = {name: group_hash(manifest, name) for name in selected}
    if args.affected:
        skipped = [n for n in selected if cache.get(n) == hashes[n]]
        selected = [n for n in selected if n not in skipped]
        if skipped:
            print(f"Unchanged since they last passed, so skipped: {', '.join(skipped)}")
        if not selected:
            print("Nothing to run: every group is up to date.")
            return 0

    timings = load_json(TIMINGS, {})
    jobs = []
    for name in selected:
        count = manifest["groups"][name]["shards"]
        assign = plan_slices(timings.get("_groupTests", {}).get(name, {}), count) if count > 1 else {}
        jobs.extend((name, i, count, assign) for i in range(count))
    # The slowest slices start first so the last ones to finish are short.
    jobs.sort(key=lambda j: -timings.get("_jobs", {}).get(job_key(j[0], f"{j[1]}/{j[2]}" if j[2] > 1 else None), 0))
    chrome = find_chrome()
    collector = Collector()
    workers = max(1, min(args.jobs, len(jobs)))
    print(f"Running {len(jobs)} slice(s) of {len(selected)} group(s) on {workers} Chrome process(es)…", flush=True)
    started = time.time()
    outcomes = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(run_job, collector, chrome, job, args.timeout) for job in jobs]
        for future in futures:
            key, group, result, elapsed = future.result()
            outcomes.append((key, group, result, elapsed))
            if result is None:
                print(f"  ✗ {key}: no result within {args.timeout}s (the page did not finish)", flush=True)
            else:
                mark = "✓" if result["failed"] == 0 else "✗"
                print(f"  {mark} {key}: {result['passed']} passed, {result['failed']} failed, {result['ms'] / 1000:.1f}s of tests", flush=True)
    wall = time.time() - started

    passed = sum(r["passed"] for _, _, r, _ in outcomes if r)
    failed = sum(r["failed"] for _, _, r, _ in outcomes if r)
    crashed = [key for key, _, r, _ in outcomes if r is None]
    for key, _, result, _ in outcomes:
        for failure in (result or {}).get("failures", []):
            print(f"\nFAIL [{key}] {failure['name']}\n  {failure['message']}")
    every = sorted(((t["ms"], f"[{key}] {t['name']}") for key, _, r, _ in outcomes if r for t in r["timings"]), reverse=True)
    if every:
        print("\nSlowest tests:")
        for ms, name in every[:8]:
            print(f"  {ms / 1000:6.1f}s  {name}")
    serial = sum(r["ms"] for _, _, r, _ in outcomes if r) / 1000
    extra = f", {len(crashed)} slice(s) without a result" if crashed else ""
    print(f"\n{passed} passed, {failed} failed{extra}. Wall time {wall:.0f}s (the same tests one after another would take about {serial:.0f}s).")

    timings["_jobs"] = {key: r["ms"] for key, _, r, _ in outcomes if r}
    group_tests = timings.setdefault("_groupTests", {})
    for _, group, r, _ in outcomes:
        if r:
            group_tests.setdefault(group, {}).update({t["name"]: t["ms"] for t in r["timings"]})
    TIMINGS.write_text(json.dumps(timings, indent=1))
    for name in selected:
        mine = [r for key, group, r, _ in outcomes if group == name]
        if mine and all(r and r["failed"] == 0 for r in mine):
            cache[name] = hashes[name]
        else:
            cache.pop(name, None)
    CACHE.write_text(json.dumps(cache, indent=1))
    return 0 if failed == 0 and not crashed else 1


if __name__ == "__main__":
    sys.exit(main())
