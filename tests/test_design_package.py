"""固定版の整合性、安全な更新、ローカル・公開配信を検証する。"""

import hashlib
import io
import json
import tarfile

import pytest

from scripts.update_design import DESTINATION, FILES, MAX_BYTES, install
from web.build import build


def distribution(tmp_path, *, state="committed", mutate=None):
    contents = {name: (DESTINATION / name).read_bytes() for name in FILES}
    metadata = json.loads((DESTINATION / "provenance.json").read_text())
    metadata["source_state"] = state
    members = []
    for name, content in contents.items():
        info = tarfile.TarInfo(f"package/{name}")
        info.size = len(content)
        members.append((info, content))
    if mutate:
        mutate(members)
    archive = tmp_path / "design.tgz"
    with tarfile.open(archive, "w:gz") as tar:
        for info, content in members:
            tar.addfile(info, io.BytesIO(content) if info.isfile() else None)
    checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
    metadata["archive_sha256"] = checksum
    release = tmp_path / "release.json"
    release.write_text(json.dumps(metadata))
    return archive, release, checksum


def test_vendor_matches_the_recorded_package_and_source():
    metadata = json.loads((DESTINATION / "provenance.json").read_text())
    assert metadata["repository"] == "the3-inc/landing-page"
    assert metadata["tag"] == f"design-v{metadata['version']}"
    assert set(metadata["files"]) == FILES
    for name, checksum in metadata["files"].items():
        assert hashlib.sha256((DESTINATION / name).read_bytes()).hexdigest() == checksum


def test_verified_update_replaces_the_whole_package_and_records_provenance(tmp_path):
    archive, release, checksum = distribution(tmp_path)
    destination = tmp_path / "vendor"
    destination.mkdir()
    (destination / "obsolete.css").write_text("old")
    metadata = install(archive, release, checksum, destination)
    assert not (destination / "obsolete.css").exists()
    assert json.loads((destination / "provenance.json").read_text()) == metadata
    assert {
        p.relative_to(destination).as_posix() for p in destination.rglob("*") if p.is_file()
    } == (FILES | {"provenance.json"})


@pytest.mark.parametrize("failure", ["checksum", "file-checksum", "unpublished", "version"])
def test_invalid_update_keeps_existing_files(tmp_path, failure):
    archive, release, checksum = distribution(tmp_path)
    metadata = json.loads(release.read_text())
    if failure == "checksum":
        checksum = "0" * 64
    elif failure == "file-checksum":
        metadata["files"]["tokens.css"] = "0" * 64
    elif failure == "unpublished":
        metadata["source_state"] = "working-tree"
    else:
        metadata["version"] = "2.0.0"
        metadata["tag"] = "design-v2.0.0"
    release.write_text(json.dumps(metadata))
    destination = tmp_path / "vendor"
    destination.mkdir()
    (destination / "old.css").write_text("keep")
    with pytest.raises(ValueError):
        install(archive, release, checksum, destination)
    assert list(destination.iterdir()) == [destination / "old.css"]
    assert (destination / "old.css").read_text() == "keep"


def test_working_tree_import_requires_explicit_opt_in(tmp_path):
    archive, release, checksum = distribution(tmp_path, state="working-tree")
    metadata = install(archive, release, checksum, tmp_path / "vendor", allow_working_tree=True)
    assert metadata["source_state"] == "working-tree"


def test_failed_directory_swap_restores_the_previous_version(tmp_path, monkeypatch):
    from pathlib import Path

    archive, release, checksum = distribution(tmp_path)
    destination = tmp_path / "vendor"
    destination.mkdir()
    (destination / "old.css").write_text("keep")
    rename = Path.rename

    def fail_new_directory(path, target):
        if path.name == "new":
            raise OSError("ディレクトリの置換失敗")
        return rename(path, target)

    monkeypatch.setattr(Path, "rename", fail_new_directory)
    with pytest.raises(OSError):
        install(archive, release, checksum, destination)
    assert (destination / "old.css").read_text() == "keep"


@pytest.mark.parametrize(
    "kind", ["traversal", "absolute", "symlink", "hardlink", "duplicate", "missing", "oversized"]
)
def test_unsafe_or_incomplete_archives_never_get_extracted(tmp_path, kind):
    def mutate(members):
        info, content = members[0]
        if kind == "missing":
            members.pop()
        elif kind == "duplicate":
            members.append((info, content))
        elif kind == "traversal":
            info.name = "package/../../escaped"
        elif kind == "absolute":
            info.name = "/tmp/escaped"
        elif kind in {"symlink", "hardlink"}:
            info.type = tarfile.SYMTYPE if kind == "symlink" else tarfile.LNKTYPE
            info.linkname = "../../escaped"
            info.size = 0
        else:
            info.size = MAX_BYTES + 1
            members[0] = info, b"x" * info.size

    archive, release, checksum = distribution(tmp_path, mutate=mutate)
    with pytest.raises(ValueError):
        install(archive, release, checksum, tmp_path / "vendor")
    assert not (tmp_path / "vendor").exists()
    assert not (tmp_path / "escaped").exists()


def test_design_assets_are_hashed_and_copied_into_the_public_product(tmp_path):
    product = build(tmp_path)
    for name in ("tokens.css", "base.css"):
        data = (DESTINATION / name).read_bytes()
        checksum = hashlib.sha256(data).hexdigest()[:16]
        filename = f"the3-{name.removesuffix('.css')}.{checksum}.css"
        assert (product / "assets" / filename).read_bytes() == data
        for page in ("demo/index.html", "docs/index.html"):
            html = (product / page).read_text()
            assert filename in html
            assert "/vendor/" not in html
            assert 'data-theme="light"' in html
    assert len(list((product / "assets").glob("the3-the3-symbol.*.svg"))) == 1


def test_local_server_exposes_only_design_public_assets():
    from demo.server import FILES as served

    for name in ("tokens.css", "base.css", "assets/the3-symbol.svg"):
        path, media = served[f"/demo/vendor/the3-brand/{name}"]
        assert path.read_bytes() == (DESTINATION / name).read_bytes()
        assert media.startswith("image/svg+xml" if name.endswith("svg") else "text/css")
    assert not any("provenance" in url or "package.json" in url for url in served)
