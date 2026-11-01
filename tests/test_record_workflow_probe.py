"""証拠取得用の入口が実APIの結果と上書き保護を維持することを確認する。"""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.repository
def test_probe_retains_real_results_and_refuses_existing_output(tmp_path):
    output = tmp_path / "evidence"
    command = [sys.executable, str(ROOT / "scripts/probe_record_workflow.py"), str(output)]
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
    assert result.returncode in (0, 2), result.stderr
    report = json.loads((output / "report.json").read_text())
    explicit = json.loads((output / "explicit.json").read_text())
    omitted = json.loads((output / "omitted.json").read_text())
    stats = next(d for d in omitted["response"]["diagnostics"] if d["code"] == "SEARCH_STATS")
    workers = next(f["value"] for f in stats["facts"] if f["name"] == "num_workers")
    assert workers == 1
    assert explicit["execution"]["num_workers"] == 1
    assert report["omitted_record_num_workers"] == omitted["execution"]["num_workers"]
    assert report["setting_consistent"] is (omitted["execution"]["num_workers"] == workers)
    assert result.returncode == (0 if report["setting_consistent"] else 2)
    assert report["normal_roundtrip_valid"] is True
    for name, digest in report["artifacts_sha256"].items():
        assert hashlib.sha256((output / name).read_bytes()).hexdigest() == digest
    saved = {p.name: p.read_bytes() for p in output.iterdir()}
    repeated = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
    assert repeated.returncode == 1
    assert "FileExistsError" in repeated.stderr
    assert {p.name: p.read_bytes() for p in output.iterdir()} == saved
