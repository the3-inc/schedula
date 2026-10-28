"""landing-pageの固定版デザインを検証して取り込む。通常ビルドは通信しない。"""

import argparse
import hashlib
import json
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "web/vendor/the3-brand"
FILES = {
    "package.json",
    "tokens.css",
    "base.css",
    "assets/the3-symbol.svg",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
}
VERSION = r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
MAX_BYTES = 2 * 1024 * 1024


def read_vendor(directory=DESTINATION):
    """管理外ファイル・改変・リンクがない固定版だけを読み込む。"""
    directory = Path(directory)
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError("共有デザインの固定ディレクトリが不正です")
    entries = list(directory.rglob("*"))
    if (
        any(path.is_symlink() for path in entries)
        or {path.relative_to(directory).as_posix() for path in entries}
        != FILES | {"provenance.json", "assets"}
        or {path.relative_to(directory).as_posix() for path in entries if path.is_file()}
        != FILES | {"provenance.json"}
        or {path.relative_to(directory).as_posix() for path in entries if path.is_dir()}
        != {"assets"}
    ):
        raise ValueError("共有デザインの管理対象外ファイルは上書きしません")
    metadata = json.loads((directory / "provenance.json").read_text(encoding="utf-8"))
    if (
        metadata.get("repository") != "the3-inc/landing-page"
        or metadata.get("tag") != f"design-v{metadata.get('version')}"
        or metadata.get("source_state") not in {"committed", "working-tree"}
        or set(metadata.get("files", {})) != FILES
    ):
        raise ValueError("共有デザインの固定情報が不正です")
    contents = {}
    for name, checksum in metadata["files"].items():
        data = (directory / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != checksum:
            raise ValueError(f"共有デザインが固定情報と一致しません: {name}")
        contents[name] = data
    package = json.loads(contents["package.json"])
    if package.get("name") != "@the3/brand" or package.get("version") != metadata["version"]:
        raise ValueError("共有デザインのバージョンが一致しません")
    return metadata, contents


def install(archive, release, sha256, destination=DESTINATION, *, allow_working_tree=False):
    archive, release, destination = Path(archive), Path(release), Path(destination)
    if not re.fullmatch(r"[a-f0-9]{64}", sha256):
        raise ValueError("SHA-256は64桁の小文字16進数で指定してください")
    if archive.stat().st_size > MAX_BYTES or release.stat().st_size > MAX_BYTES:
        raise ValueError("配布物がサイズ上限を超えています")
    if hashlib.sha256(archive.read_bytes()).hexdigest() != sha256:
        raise ValueError("アーカイブのSHA-256が一致しません")
    metadata = json.loads(release.read_text(encoding="utf-8"))
    version = metadata["version"]
    if (
        not re.fullmatch(VERSION, version)
        or metadata["repository"] != "the3-inc/landing-page"
        or metadata["tag"] != f"design-v{version}"
        or not re.fullmatch(r"[a-f0-9]{40}", metadata["source_commit"])
        or metadata["archive_sha256"] != sha256
        or set(metadata["files"]) != FILES
        or metadata["source_state"] not in {"committed", "working-tree"}
    ):
        raise ValueError("配布元・版・ファイル一覧が不正です")
    if metadata["source_state"] != "committed" and not allow_working_tree:
        raise ValueError("未発行の検証用配布物です。明示的な許可が必要です")

    contents = {}
    total = 0
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar:
            name = member.name.removeprefix("package/")
            if (
                member.name != f"package/{name}"
                or name not in FILES
                or name in contents
                or not member.isfile()
                or member.size > MAX_BYTES
                or member.size < 0
            ):
                raise ValueError("許可されていないアーカイブ要素です")
            total += member.size
            if total > MAX_BYTES:
                raise ValueError("展開後のサイズが上限を超えています")
            data = tar.extractfile(member).read()
            if hashlib.sha256(data).hexdigest() != metadata["files"][name]:
                raise ValueError(f"ファイルのSHA-256が一致しません: {name}")
            contents[name] = data
    if set(contents) != FILES:
        raise ValueError("必要な配布ファイルが欠落しています")
    manifest = json.loads(contents["package.json"])
    if manifest["name"] != "@the3/brand" or manifest["version"] != version:
        raise ValueError("パッケージ名または版が一致しません")

    if destination.exists() or destination.is_symlink():
        read_vendor(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".design-update-", dir=destination.parent) as temp:
        stage = Path(temp) / "new"
        stage.mkdir()
        for name, data in contents.items():
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        (stage / "provenance.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        backup = Path(temp) / "previous"
        if destination.exists():
            destination.rename(backup)
        try:
            stage.rename(destination)
        except OSError:
            if backup.exists():
                backup.rename(destination)
            raise
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version")
    parser.add_argument("--sha256", required=True, help="確認した配布アーカイブのSHA-256")
    parser.add_argument("--archive", type=Path, help="ローカル検証用tgz（通常はReleaseから取得）")
    parser.add_argument("--metadata", type=Path, help="ローカル配布物のrelease.json")
    parser.add_argument("--allow-working-tree", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(VERSION, args.version):
        parser.error("MAJOR.MINOR.PATCH形式の版を指定してください")
    if bool(args.archive) != bool(args.metadata):
        parser.error("--archiveと--metadataは両方指定してください")
    with tempfile.TemporaryDirectory(prefix="the3-design-download-") as directory:
        if not args.archive:
            filename = f"the3-brand-{args.version}.tgz"
            subprocess.run(
                [
                    "gh",
                    "release",
                    "download",
                    f"design-v{args.version}",
                    "--repo",
                    "the3-inc/landing-page",
                    "--dir",
                    directory,
                    "--pattern",
                    filename,
                    "--pattern",
                    "release.json",
                ],
                check=True,
            )
            args.archive = Path(directory) / filename
            args.metadata = Path(directory) / "release.json"
        # 指定版との一致も、既存版を書き換える前に確認する。
        if json.loads(args.metadata.read_text(encoding="utf-8"))["version"] != args.version:
            raise ValueError("指定版と配布物の版が一致しません")
        metadata = install(
            args.archive, args.metadata, args.sha256, allow_working_tree=args.allow_working_tree
        )
    print(f"@the3/brand {metadata['version']} ({metadata['source_state']}) を取り込みました")


if __name__ == "__main__":
    main()
