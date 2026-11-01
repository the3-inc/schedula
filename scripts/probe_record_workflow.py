"""架空入力の記録往復を確認し、CPU設定の不一致を終了コード2で報告する。"""

import argparse
import hashlib
import json
import platform
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

from shift_schedula import (
    check_record,
    create_record,
    load_json,
    reverify_record,
    save_json,
    solve,
    validate,
)

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="存在しない新規の証拠ディレクトリ")
    output = parser.parse_args().output
    subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", "src", "examples", "pyproject.toml", "uv.lock"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    output.mkdir()
    started, clock = datetime.now(UTC), time.perf_counter()
    fixture = ROOT / "examples/linked_assignment.json"
    request = load_json(fixture.read_text(encoding="utf-8"))
    if validate(request)["status"] != "VALID":
        raise RuntimeError("架空入力の検証に失敗しました。")
    response = solve(request, num_workers=1)
    search = [d for d in response["diagnostics"] if d["code"] == "SEARCH_STATS"]
    if response["status"] != "OPTIMAL" or len(search) != 1:
        raise RuntimeError("実CP-SATの探索結果を確認できません。")
    facts = search[0]["facts"]
    stats = {f["name"]: f["value"] for f in facts}
    if len(stats) != len(facts) or stats.get("workers_applied") is not True:
        raise RuntimeError("実CP-SATの設定根拠を一意に確認できません。")
    if stats.get("num_workers") != 1:
        raise RuntimeError("指定した1 workerと探索結果が一致しません。")
    records = {
        "explicit": create_record(request, response, num_workers=1),
        "omitted": create_record(request, response),
    }
    for name, record in records.items():
        path = output / f"{name}.json"
        save_json(path, record)
        restored = check_record(load_json(path.read_text(encoding="utf-8")))
        current = reverify_record(restored)["current_verification"]
        if restored != record or current["verification"]["valid"] is not True:
            raise RuntimeError(f"{name}の保存・読込・独立検証に失敗しました。")
    explicit = records["explicit"]["execution"]["num_workers"]
    omitted = records["omitted"]["execution"]["num_workers"]
    if explicit != 1:
        raise RuntimeError("明示した記録設定が一致しません。")
    report = {
        "source_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "python": platform.python_version(),
        "platform": f"{platform.system()} {platform.machine()}",
        "dependencies": records["explicit"]["engine"],
        "started_at": started.isoformat(),
        "finished_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.perf_counter() - clock, 6),
        "fixture": "examples/linked_assignment.json",
        "fixture_sha256": hashlib.sha256(fixture.read_bytes()).hexdigest(),
        "probe_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "lock_sha256": hashlib.sha256((ROOT / "uv.lock").read_bytes()).hexdigest(),
        "response_status": response["status"],
        "response_num_workers": stats["num_workers"],
        "explicit_record_num_workers": explicit,
        "omitted_record_num_workers": omitted,
        "normal_roundtrip_valid": True,
        "setting_consistent": omitted == stats["num_workers"],
        "artifacts_sha256": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(output.glob("*.json"))
        },
    }
    save_json(output / "report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["setting_consistent"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
