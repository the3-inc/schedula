"""Gitへ固定した会社プリセットを検証し、公開CSSへまとめる。"""

import hashlib
import json
from pathlib import Path

DIRECTORY = Path(__file__).resolve().parents[1] / "demo" / "brand-preset"
FILES = {"package.json", "tokens.css", "base.css", "README.md"}


def brand_css(directory=DIRECTORY):
    lock = json.loads((directory / "preset.lock.json").read_text(encoding="utf-8"))
    if (
        lock.get("package") != "@the3/brand-preset"
        or lock.get("repository") != "the3-inc/landing-page"
        or lock.get("tag") != f"brand-preset-v{lock.get('version')}"
        or set(lock.get("files", {})) != FILES
    ):
        raise ValueError("共通プリセットの固定情報が不正です")
    contents = {}
    for name, expected in lock["files"].items():
        path = directory / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"共通プリセットが固定情報と一致しません: {name}")
        contents[name] = path.read_text(encoding="utf-8")
    package = json.loads(contents["package.json"])
    if package.get("name") != lock["package"] or package.get("version") != lock["version"]:
        raise ValueError("共通プリセットのバージョンが一致しません")
    return (
        contents["tokens.css"]
        + "\n"
        + contents["base.css"].replace('@import "./tokens.css";', "", 1)
    )
