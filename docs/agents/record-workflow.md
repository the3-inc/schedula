# 実行記録の操作・検証と証拠保存

[開発手順 #201](https://github.com/the3-inc/schedula/issues/201)の入口。
既存の架空入力で実CP-SATと実行記録を操作する。製品の合否は
[#170](https://github.com/the3-inc/schedula/issues/170)の受入条件で判断する。
本手順の動作確認は#170の修正・実開発の比較試行・デプロイを開始する指示ではない。

## 起動から後片付けまで

独立worktreeのリポジトリ直下で実行する。セットアップの正本は
[Pythonセットアップ](../python-setup.md)、APIの意味は[入力Adapter](../input-adapter.md)。
Pythonとuvは `.python-version` と同セットアップの指定版を使用する。
必要な版がなければ作業用領域へ隔離して用意し、ユーザーの実行環境やOS設定の更新は別判断とする。

| 機能・段階 | 操作の入口 | 期待・観測と停止条件 |
| --- | --- | --- |
| 起動 | `uv sync --locked` | 既存lockから同期。取得/起動不能なら実行不能として停止 |
| 状態確認 | `git rev-parse HEAD`、`git status --short`、`uv --version`、`uv run --locked python --version` | Issueの対象SHA・版・変更範囲と照合。異なれば再開条件を確認 |
| 入力 | `examples/linked_assignment.json` → 公開`validate` | 既存の架空入力だけを使い、VALIDを確認 |
| 求解 | 公開`solve(request, num_workers=1)` | OPTIMAL、SEARCH_STATSが一件、実CP-SAT・1 workerを確認 |
| 保存・読込 | 公開`create_record`、`save_json`、`load_json`、`check_record` | 明示値1と省略値を別の新規ファイルに保存し、元記録を照合 |
| 独立検証 | 公開`reverify_record`、CLI `adapter verify-record` | 現在の解の有効性を確認。最適性の再証明やCPU設定照合と混同しない |
| 証拠 | `scripts/probe_record_workflow.py` | 実記録2件とreportにSHA・時刻・依存・入力/記録hash・期待と実際を保持 |
| 後片付け | 保存先を新規archiveへコピー後、今回作った一時領域だけを削除 | archiveのhash・CLI検証を再確認。元入力・既存成果物は削除/上書きしない |

## 一機能を実際に通す

probeは上記の公開APIを順に呼ぶ小さな確認用スクリプトで、製品コードの変更・ネットワーク・
実データ読取は行わない。Git checkoutが必要で、`src`・`examples`・依存定義に未コミット差分が
あれば停止する。将来#170を修正した場合は変更をコミットしてから証拠を採る。
出力ディレクトリは存在しないものを指定する。同じ場所の再実行は既存証拠を保護して失敗する。

```sh
scratch=$(mktemp -d)
uv run --locked python scripts/probe_record_workflow.py "$scratch/evidence"
```

終了0は正常往復と省略時のCPU設定一致、終了2は正常往復を確認した上でCPU設定が不一致。
その他の非ゼロ、report未生成、例外は実行/検証経路の失敗であり、不一致の検出と区別する。
終了2を#170の合格へ読み替えない。reportの`setting_consistent`と、元記録の
SEARCH_STATS/`execution.num_workers`から不一致を再確認する。

証拠を残す場合は、新しいarchive名を決めてコピーする。`archive`の既存ディレクトリへは
コピーしない。コマンドを続ける前にprobeの終了状態と生成物を確認する。

```sh
archive=docs/evaluations/results/m1-record-workflow/manual-run
test ! -e "$archive" && cp -R "$scratch/evidence" "$archive"
# コピーとhash照合が済んだ後、今回作った一時領域だけを片付ける。
uv run --locked python - "$archive" <<'PY'
import hashlib, json, sys
from pathlib import Path
archive = Path(sys.argv[1])
report = json.loads((archive / "report.json").read_text())
for name, digest in report["artifacts_sha256"].items():
    assert hashlib.sha256((archive / name).read_bytes()).hexdigest() == digest
print("archive hashes verified")
PY
rm -r "$scratch"
uv run --locked python -m shift_schedula adapter verify-record "$archive/explicit.json"
```

後片付け後にも同じhash照合とCLIを実行する。証拠には既存の架空入力に由来する記録だけを含め、
資格情報・環境変数一覧・端末名・個人の会話本文を追加しない。

## 確認済みの結果と意味

2026-11-01、main `72d0c5a21a5a804132b0e2e49c518ebf48276774` の製品コード、
Python 3.14.10・uv 0.13.6・既存uv.lockで現行手順の調査・再現を観測した。
[baseline](https://github.com/the3-inc/schedula/blob/b7b91cf8dc32518006c37dca8a47d2c5e7b62c87/docs/evaluations/results/m1-record-workflow/baseline/summary.json)には時刻・操作・版・
入力hash・原記録hashがある。明示値1の正常往復は成功、省略は2で#170の合否は不合格だった。
この結果は実API/CP-SATを動かした証拠であり、実在の従業員データの受入ではない。
手順自体の確認結果は同じディレクトリの`probe/`へ保存する。

## 保守と確認

`records.py`・`engine.py`・公開API/CLI・record Schema・架空入力・依存版の変更時は、
上表の該当段階とprobe/testを照合してから、固定コミットで一連の操作を再実行する。
期待どおり動かない場合は、文書の古さは本書、観測入口の不足はprobe、製品の不一致は#170等の
所有Issueへ戻す。合格条件を弱めて隠さない。

```sh
uv run --locked pytest -q tests/test_record_workflow_probe.py tests/test_adapter.py
uv run --locked ruff check scripts/probe_record_workflow.py tests/test_record_workflow_probe.py
uv run --locked ruff format --check scripts/probe_record_workflow.py tests/test_record_workflow_probe.py
git diff --check
```

入口テストは実APIの観測値と終了状態、原記録hash、既存出力への再実行時の保護を確認する。
#170が修正された後は省略値1と終了0に変わる。設定照合の全受入条件は#170側で追加検証する。
