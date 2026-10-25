import json
import shutil
import subprocess

import pytest

from tests.test_playground_server import http_server as http_server
from web.brand import DIRECTORY, brand_css
from web.build import build


def test_pinned_css_is_included_in_the_public_asset_without_runtime_imports(tmp_path):
    product = build(tmp_path)
    css = next((product / "assets").glob("landing.*.css")).read_text()
    assert "--the3-accent: #087f83" in css
    assert "--accent: var(--the3-accent)" in css
    assert "@import" not in css
    for name in ("demo/index.html", "docs/index.html"):
        html = (product / name).read_text()
        assert 'data-theme="light"' in html
        assert "github.com/the3-inc/landing-page/releases/download/" not in html


@pytest.mark.parametrize("name", ["base.css", "tokens.css", "package.json"])
def test_modified_vendor_file_is_rejected(tmp_path, name):
    shutil.copytree(DIRECTORY, tmp_path / "preset")
    target = tmp_path / "preset" / name
    target.write_bytes(target.read_bytes() + b" ")
    with pytest.raises(ValueError, match="固定情報と一致"):
        brand_css(tmp_path / "preset")


def test_lock_cannot_read_paths_outside_the_preset_directory(tmp_path):
    shutil.copytree(DIRECTORY, tmp_path / "preset")
    target = tmp_path / "preset" / "preset.lock.json"
    lock = json.loads(target.read_text())
    lock["files"]["../outside"] = "0" * 64
    target.write_text(json.dumps(lock))
    with pytest.raises(ValueError, match="固定情報"):
        brand_css(tmp_path / "preset")


def test_missing_preset_fails_before_creating_public_files(tmp_path, monkeypatch):
    from web import build as public_build

    def missing():
        raise ValueError("missing preset")

    monkeypatch.setattr(public_build, "brand_css", missing)
    with pytest.raises(ValueError, match="missing preset"):
        public_build.build(tmp_path / "output")
    assert not (tmp_path / "output").exists()


def test_local_server_serves_the_fixed_css_imports(http_server):
    from tests.test_landing_page import get

    for name in ("base.css", "tokens.css"):
        status, media, content = get(http_server, f"/demo/brand-preset/{name}")
        assert status == 200 and media.startswith("text/css")
        assert content == (DIRECTORY / name).read_text()


def test_pinned_bytes_survive_git_crlf_checkout(tmp_path):
    repository = tmp_path / "source"
    preset = repository / "demo" / "brand-preset"
    shutil.copytree(DIRECTORY, preset)
    shutil.copyfile(DIRECTORY.parents[1] / ".gitattributes", repository / ".gitattributes")

    def git(*arguments):
        return subprocess.run(["git", *arguments], cwd=repository, check=True, capture_output=True)

    git("init", "-q")
    git("-c", "core.autocrlf=true", "add", ".")
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "preset")
    checkout = tmp_path / "checkout"
    git("clone", "-q", "-c", "core.autocrlf=true", str(repository), str(checkout))
    assert brand_css(checkout / "demo" / "brand-preset") == brand_css()
