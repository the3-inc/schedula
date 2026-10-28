"""Gitへ固定した共有デザインを検証し、公開CSSへまとめる。"""

import hashlib
import json
from pathlib import Path

from scripts.update_design import FILES

DIRECTORY = Path(__file__).resolve().parents[1] / "web" / "vendor" / "the3-brand"


def brand_css(directory=DIRECTORY):
    lock = json.loads((directory / "provenance.json").read_text(encoding="utf-8"))
    if (
        lock.get("repository") != "the3-inc/landing-page"
        or lock.get("tag") != f"design-v{lock.get('version')}"
        or lock.get("source_state") not in {"committed", "working-tree"}
        or set(lock.get("files", {})) != FILES
    ):
        raise ValueError("共有デザインの固定情報が不正です")
    contents = {}
    for name, expected in lock["files"].items():
        path = directory / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"共有デザインが固定情報と一致しません: {name}")
        contents[name] = path.read_text(encoding="utf-8")
    package = json.loads(contents["package.json"])
    if package.get("name") != "@the3/brand" or package.get("version") != lock["version"]:
        raise ValueError("共有デザインのバージョンが一致しません")
    return (
        contents["tokens.css"]
        + "\n"
        + contents["base.css"].replace('@import "./tokens.css";', "", 1)
    )
