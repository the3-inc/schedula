# Python セットアップ

Python の依存管理は uv に統一する。セットアップ・パッケージ追加・実行の手順は、
利用者が指定した `python-setup-with-uv` skill を基準にした本書を正本とする。
参照資料に残る pip・手動 venv の手順より、本書を優先する。
uv 自体の導入は [公式のインストール手順](https://docs.astral.sh/uv/getting-started/installation/)に従う。

## Python と依存パッケージ

2026-10-28 に、3.14 系の最新パッチ **CPython 3.14.10** へ更新した。
[公式リリース](https://www.python.org/downloads/release/python-31410/)は証明書対応を含む
セキュリティ修正版である。`.python-version` で開発・CI の版を固定する。
配布の最低要件は `>=3.14` を維持し、利用者向けの許容範囲と開発用の固定版を分ける。
通常の CPython 3.14 で通常依存の隔離導入を検証する。
3.15 以降・free-threaded・他の Python 実装は未検証であり、
特に CP-SAT は対象 Python・OS の OR-Tools wheel が必要となる。
新しい安定版が出たら通常依存で測定し、依存が未対応なら結果と制限を課題に記録する。

uv は **0.13.6** を使用する。直接インストールした uv は `uv self update 0.13.6` で更新できる。
[uv 0.13.6](https://github.com/astral-sh/uv/releases/tag/0.13.6) は、
証明書ストア修正済みの uv と、pip 26.2.2 を含む Python ビルドを利用する。
旧版に固定された仮想環境は自動では移行しないため、更新後に `uv sync --locked` を実行する。
公開デモの Lambda イメージも `web/Dockerfile` の digest を更新した。
ただし AWS の最新イメージは Python 3.14.9 のため、コンテナー全体を 3.14.10 と同等とは扱わない。
証明書対応として pip を 26.2.2、uv を 0.13.6 へ明示的に更新する。
AWS が 3.14.10 を提供したら digest を再更新する。
Git hook 用の間接依存 virtualenv も 21.14.13 に更新し、古い pip の再導入を防ぐ。
更新前からある hook 環境では `uv run --locked pre-commit clean` を実行してから hook を再実行する。

| 用途 | パッケージ | 設定 |
| --- | --- | --- |
| JSON Schema 検証 | jsonschema | 実行依存 |
| IANA タイムゾーンデータ | tzdata | 実行依存（OSデータがない場合のfallback） |
| CP-SAT | ortools | 実行依存 |
| lint・format | ruff | 開発依存 |
| テストの入口 | pytest | 開発依存 |
| 公開typingのconsumer検証 | mypy | 開発依存 |
| コミット前の Ruff 実行 | pre-commit | 開発依存 |

依存定義は `pyproject.toml`、解決した版は `uv.lock` に記録し、両方を Git で管理する。
`.venv/` とツールのキャッシュは Git の対象外である。
独立した `assignment` と、担当時間・担当切替を扱う CP-SAT の実行コードを導入した。
勤務候補と担当配置を同時に決める `roster` も CP-SAT で実行できる。
パッケージは `src/shift_schedula/` に置き、
setuptools で版別 Schema を同梱する。利用・ビルドは [担当配置の手順](assignment.md)・
[勤務計画の手順](roster.md)を参照する。
利用・開発・CI とも `uv sync --locked` / `uv run --locked ...` で実行する。
OR-Tools は通常の実行依存として導入され、extra の指定は不要。

タイムゾーンは標準 `zoneinfo` がOSのTZDBを優先し、見つからなければ直接依存の `tzdata` を使う。
ライブラリはTZPATHを変更せず、データをネットワークから取得しない。
`PYTHONTZPATH=""` を設定した別プロセスではOSのデータを使わず、fallbackを再現できる。
WindowsのPowerShellでは `$env:PYTHONTZPATH = ""` としてから起動する。
再現時にはPython・OS・tzdataの版と、PYTHONTZPATHの設定を記録する。
存在しないゾーン名は `INVALID_INPUT` / `INVALID_TIMEZONE`、時刻データの欠落・破損・
読み取り障害は `INTERNAL_ERROR` / `TIMEZONE_DATA_UNAVAILABLE` となる。
CIの `timezone-distribution` でLinux/Windowsの通常依存を別環境で確認する。
2026-10-07、[CI実行](https://github.com/omitsuhashi/schedula/actions/runs/37582595920)で
4環境それぞれ87件、skip 0が成功した。OSのTZDBを使わないwheelの求解・独立検証・
Schema取得と、不正入力・データ障害の区別を含む。Windowsの全中核テストの結果ではない。

## 初回セットアップ

[公開リポジトリ](https://github.com/the3-inc/schedula)をcloneした後、
リポジトリ直下で実行する。既存の `pyproject.toml` と `uv.lock` を使うので、
`uv init` やパッケージの再追加は不要である。仮想環境の手動 activate も不要である。

```sh
uv python install
uv sync --locked
```

`uv python install` は `.python-version` を参照する。
`--locked` は依存定義と lock file の不一致をエラーにし、意図しない再解決を防ぐ。
`dependency-groups.dev` は通常の同期で含まれる。OR-Tools も通常依存として導入される。
旧手順の `--extra cp-sat` と wheel の `[cp-sat]` は削除する。

## ブラウザー検証用 Node.js

Node.js は **26.12.1** を `.nvmrc` に固定し、CI の `actions/setup-node` も同じファイルを読む。
[公式リリース](https://nodejs.org/en/blog/release/v26.12.1)はセキュリティ修正版である。
2026-10-25 時点では Current であり、本番の Node.js サーバーはこのリポジトリにない。
Node.js は Playwright によるブラウザー検証に使用する。ブラウザー利用者には不要である。
nvm を導入済みの開発環境では次を実行する。

```sh
nvm install
nvm use
```

## Git hook

`.pre-commit-config.yaml` には Ruff の `ruff-check`（`--fix`）と `ruff-format` を設定している。
`astral-sh/ruff-pre-commit` の `rev` は導入時の最新安定版 `v0.16.10` に固定した。
既存 hook の経路とファイルを確認し、衝突がない場合にインストールする。

```sh
git config --get core.hooksPath
git rev-parse --git-path hooks
uv run --locked pre-commit install --install-hooks
```

`core.hooksPath` が未設定の場合、最初のコマンドは終了コード1となる。
既存 hook と衝突する場合は上書きせず、手動検証を続ける。
依存に pre-commit を追加するだけでは Git commit 時に動かないため、clone 後に導入する。
Git worktree では hook 保存先を同じリポジトリ内で共有する。
この worktree では既存の `pre-commit` hook がないことを確認して導入した。
自動修正が入ると commit が止まるので、差分を確認してから `git add` し直す。

## 日常の検証

```sh
uv run --locked pre-commit run --all-files --show-diff-on-failure
uv run --locked pytest -q -ra --junitxml=test-results/pytest.xml
bash -n scripts/deploy
```

既存の `unittest` テストは pytest から収集・実行する。
テスト未作成やスキップは未検証として記録し、空のテスト実行を成功扱いしない。
hook を使わない場合は `uv run --locked ruff check .` と
`uv run --locked ruff format --check .` で確認する。
両方の経路で同じ Ruff 検証を繰り返す必要はない。

CI も uv 0.13.6 と `.python-version` を使い、`uv sync --locked` で環境を構築する。
Ruff hookとデプロイスクリプトの構文は毎回確認し、Python・配布・画面検証は並列ジョブで実行する。
PRでは変更内容に応じてジョブを選び、mainへのpushでは全探索比較・両バックエンド比較・
違反検出・依存不足を含む全検証を実行する。選択条件は[CIの検証範囲](ci.md)を参照する。
CP-SAT 導入下でスキップがあれば JUnit XML の確認を失敗させる。
pytest の `-ra` で失敗・スキップ理由を表示し、`pytest-results`・`distribution-results` artifact に
各ジョブの JUnit XML を成功・失敗時とも保存する。依存読み込みの失敗は収集エラーとなる。

wheel のテストは `uv export --locked --no-dev --no-emit-project` で
実行依存を取り出し、新しい `uv run --no-project --isolated` 環境へ wheel と一緒に導入する。
別の空環境では wheel をインストール対象とし、
export した実行依存は `uv pip install --constraints` によるバージョン制約としてのみ使う。
これにより、`Requires-Dist` の通常依存が欠落した場合は requirements による補完で見逃さない。
ソース checkout の import を避け、担当配置・勤務計画・不可能・不正入力のライブラリと CLI を確認する。
OR-Tools なしの別の隔離環境では最小費用流が動き、CP-SAT は `BACKEND_UNAVAILABLE` となることを確認する。
利用者向けのセットアップ・入力作成は [README](../README.md)、
今回の結果・評価入力・再測定手順は [実行評価](evaluations/runtime.md)を参照する。
CI 設定の導入と GitHub 上での実行成功は別であり、実行 URL と結果は PR に記録する。

## 依存の変更と更新

OR-Tools を含む実行時の依存は `uv add <package>`、
開発専用の依存は `uv add --dev <package>` で追加する。
変更後は `uv sync --locked` で環境を揃え、日常の検証を実行する。
依存版を更新するときは `uv lock --upgrade-package <package>` を使い、lock file の差分を確認する。
Ruff 更新時は `uv run pre-commit autoupdate` も実行し、
hook の `rev` と開発依存の Ruff を同じ版に揃える。
Python 更新時も、依存の対応と wheel を確認して `uv python pin <version>` で固定し直す。

mypyは公開typingのconsumer検証に導入した。内部実装全体を型チェックしたという意味ではない。
poethepoetは未導入で、`uv run ...` のコマンド整理が必要になったときだけ追加する。

## 2026-10-25 の更新確認

macOS ARM64 で Node.js 26.12.1、CPython 3.14.9、uv 0.13.5 を確認した。
Mac の nvm の default を 26.12.1、uv 管理の `python` / `python3` を 3.14.9 に更新した。
既存の npm 12.2.0 と Corepack 0.36.0 は新版の Node.js でも維持した。
既に起動しているターミナルでは、開き直すか `nvm use default` を実行して新版を選ぶ。

- `uv sync --locked` と `uv pip check` が成功。実行依存は据え置き、間接開発依存 virtualenv だけを更新した。
- `uv run --locked pytest -q -ra --junitxml=test-results/runtime-update.xml` が 2,297 件と 6 subtests 成功、skip 0。
  sdist 由来の wheel を空の環境へ導入した回帰検証も含む。追加の sdist 検査で `.nvmrc` の同梱と内容も確認した。
- `pre-commit run --all-files` の Ruff check / format が成功。
  Mac の Ruff v0.16.10 用 hook キャッシュも再生成し、Python 3.14.9、pip 26.2.2、certifi 2026.10.19 を確認した。
- Node.js 26.12.1 で `tests/analytics.cjs`、`tests/feature-state.cjs`、
  `tests/playground-browser.cjs`、`tests/landing-browser.cjs`、`tests/public-browser.cjs` が成功。
- Linux amd64 の Lambda コンテナーをビルドし、読み取り専用実行で `web.smoke` の3教材が成功。
  pip 26.2.2、同梱 certifi 2026.10.19、uv 0.13.5 と、問題の `emSign ECC Root CA - G3` の除去を確認した。
- `bash -n scripts/deploy`、workflow YAML の読み込み、バージョン指定の整合性、`git diff --check` が成功。

`ruff format --check .` は、未変更の `docs/io-contract-shift-counts.md`、
`docs/migrations/contract-0.15-adapter.md`、`docs/migrations/contract-0.15-data.md` の
既存コードブロックの整形差分を検出した。CI と同じ Python / pyi 対象の hook は成功している。
GitHub CI、Windows での今回の実行、本番デプロイは未実施。
AWS イメージの Python 本体は 3.14.8 のままであり、3.14.9 への更新は AWS の提供後に行う。

## セットアップ時の検証記録

2026-10-04、macOS ARM64 / Python 3.14.8 / uv 0.12.23 で確認した。
導入した版は jsonschema 4.26.0、OR-Tools 9.15.6755、Ruff 0.16.10、
pytest 9.1.1、pre-commit 4.6.2 である。

- Git hook のインストールと `pre-commit run --all-files`：Ruff の lint・format が成功。
- pytest：既存のデプロイ入口テスト2件が成功。
- jsonschema：参照入力3件と参照出力1件のスキーマ検証が成功。
- OR-Tools：整数変数の小規模 CP-SAT モデルで `OPTIMAL` と期待値7を確認。
- `bash -n scripts/deploy`、`git diff --check`、参照原本8件のハッシュと文書リンク：成功。

これらは環境と既存テストの確認であり、参照エンジン全体や勤務計画の検証ではない。
GitHub 上の更新後 CI はまだ実行していない。

## 参照 ZIP を評価する場合

`skillshift-starter-0.1.zip` を隔離ディレクトリに展開し、
`pyproject.toml` のある `skillshift-starter/` で実行する。
schedula 直下や `docs/reference/skillshift-starter-0.1/` には実行コードがない。
元パッケージの `dev` と `cp-sat` は extras なので、次のように両方を指定する。

```sh
uv sync --extra dev --extra cp-sat
uv run --extra dev --extra cp-sat pytest -q
uv run --extra dev --extra cp-sat python -m skillshift solve examples/assignment.json
uv run --extra dev --extra cp-sat python -m skillshift solve examples/linked_assignment.json
uv run --extra dev --extra cp-sat python -m skillshift solve examples/roster.json
```

元の `dev` extra と、新規の `uv add --dev` が作る `dependency-groups.dev` は別の宣言である。
毎回の実行で同じ extras を指定し、CP-SAT のテストが依存不足でスキップされないことを確認する。
環境・依存版・コマンド・結果・スキップ理由を評価記録に残す。
ZIP の過去の結果を、この手順による実測結果として扱わない。

2026-10-05 の [評価記録](evaluations/engine-introduction.md)に、取得した ZIP の照合、
Python 3.14.8 / OR-Tools 9.15.6755 での実行コマンド・結果・導入判断を記録した。
参照ソースは取り込まず、探索前の準備と出力構造検証の差分を後続実装の条件にした。

## 公式資料

- [uv のプロジェクト管理](https://docs.astral.sh/uv/guides/projects/)
- [依存管理と extras・dependency groups](https://docs.astral.sh/uv/concepts/projects/dependencies/)
- [uv のコマンドとオプション](https://docs.astral.sh/uv/reference/cli/)
