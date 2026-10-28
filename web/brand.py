"""Gitへ固定した共有デザインを検証し、公開CSSへまとめる。"""

from pathlib import Path

from scripts.update_design import read_vendor

DIRECTORY = Path(__file__).resolve().parents[1] / "web" / "vendor" / "the3-brand"


def brand_css(directory=DIRECTORY):
    _, contents = read_vendor(directory)
    return (
        contents["tokens.css"].decode()
        + "\n"
        + contents["base.css"].decode().replace('@import "./tokens.css";', "", 1)
    )
