# 入力インターフェースの比較調査

調査日: 2026-10-23（Asia/Tokyo）。対象は現在のPython公開APIと契約0.15。
実装・契約・設定は変更せず、コードとPython公式文書から比較した。
この文書の推奨は設計上の評価であり、利用者調査や作業時間の実測結果ではない。

## 結論

**保存・受け渡しはJSON、Python内の組み立て・呼び出しは既存の型付きdictを基本にするのが妥当。**
これは新しい方式への移行ではなく、現在の `Request` / `solve(request)` の使い方を明確にする提案である。
業務項目をすべて `solve(employees=..., demand=..., ...)` に展開する別APIや、
dataclassによる別の公開入力モデルは、現時点では追加しない。

判断の理由は、保存できる一つの業務入力を保ちながら、Python利用者にはJSON文字列の
手書き・生成・再パースを要求しなくて済むためである。現行の方針は
[Python公開API](../python-api.md)、[ADR-0001](../adr/0001-json-first-engine.md)、
[ADR-0010](../adr/0010-single-current-contract.md)と整合する。
JSON境界を廃止してPythonオブジェクトだけにする提案はADR-0001の再検討を必要とする。

## 比較する対象を分ける

「JSON」と「dict」は、同じ層の代替とは限らない。

| 対象 | 例・意味 | 現在の扱い |
| --- | --- | --- |
| JSON文字列・ファイル | `'{"schema_version":"0.15", ...}'` のようなテキスト | `load_json(text)`で読み取る。`solve`へ直接渡す契約ではない |
| JSON互換dict/list | `{"schema_version": "0.15", ...}` というPython値 | `solve(request)`へ直接渡す業務入力 |
| 型付きdict | `Request` / `Employee` などの `TypedDict` | 既存の公開型。実行時の値は通常のdict |
| クラスの入力モデル | dataclassの `RequestModel(...)` など | 公開入力には採用していない。内部モデルとは区別する |
| 業務項目ごとのキーワード引数 | `solve(employees=..., demand=..., ...)` | 未提供。既存の `num_workers` は実行設定のキーワード引数 |

実際の入口は[公開stub](../../src/shift_schedula/__init__.pyi)の
`solve(request: Request, *, num_workers: int = 2) -> Response`。
[公開型](../../src/shift_schedula/types.py)の `Request` は `Request015` の別名である。
`TypedDict` はキーと値の型を静的検査へ伝える仕組みで、実行時に別クラスの値へ変換しない。
この点は[Python 3.14のTypedDict文書](https://docs.python.org/3.14/library/typing.html#typing.TypedDict)でも確認した。

## 利用場面ごとの長短

以下の「扱いやすい」「負担」は、確認した構造からの設計上の推論である。

| 方式 | 扱いやすい場面・利点 | 制約・負担 |
| --- | --- | --- |
| JSON文字列・ファイル | CLI、Web境界、他言語、入力の保存・共有・差分確認 | Pythonで動的に作るにはテキストへの変換が余分。テキスト内のキーや値にPythonの型検査を適用できない |
| 型を付けないdict | DB結果やフォーム値から組み立て、そのまま呼び出す | キーの綴り・必須項目・値の型を静的に検査しにくく、実行時の診断に頼る |
| 既存の型付きdict | Pythonライブラリ利用。JSONと同じ構造を保ちつつ型検査やIDE支援を利用する | 型を文脈に付ける必要がある。実際の補完品質はエディタ次第で、日時・ID参照等の意味検証は別途必要 |
| dataclass等の別モデル | 属性アクセスやモデル固有の操作を中心にするPythonアプリ | 現契約への変換と対応維持が必要。標準dataclassを使うだけでは業務入力の実行時検証にならない |
| 業務項目を個別引数へ展開 | 入力項目が少なく安定した操作。関数シグネチャから項目を見つけやすい | 現在のRequestは入れ子・任意項目が多く、トップレベルの引数化だけでは内部のdict/listは残る。全構造を引数化するとAPI面が増える |

型注釈は実行時には強制されないこと、dataclassは `__init__` 等を生成するが原則として
フィールド注釈の型を調べないことは、
[typing](https://docs.python.org/3.14/library/typing.html)と
[dataclasses](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.dataclass)の公式文書による。
dataclassを選んでも、IDの参照整合や時間の整合を確認する既存の検証は必要になる。

別モデルを導入するなら、クラスの項目名・既定値・省略とnull・日時表現・エラー位置・
Schemaとの対応を維持する必要がある、というのがこの調査での評価である。
同じ意味を複数の公開表現で保守する負担に対して、現時点の具体的な利用上の問題は未確認である。

## 既存APIでどこまでできるか

Pythonコードでは、JSON文字列を経由せず、既存の入れ子型を使って値を作れる。
次は従業員一件の構築例で、完全なRequestではない。

```python
from shift_schedula.types import Employee, Interval

availability = Interval(
    start="2026-10-23T09:00:00+09:00",
    end="2026-10-23T18:00:00+09:00",
)
employee = Employee(
    id="alice",
    label="Aさん",
    skills=[],
    availability=[availability],
)
```

この `Employee(...)` は独立したモデルのインスタンスではなく、dictを作る書き方である。
`employee: Employee = {...}` というdictリテラルの書き方も使える。
トップレベルは `request: Request = {...}` として組み立てれば、呼び出しは
`solve(request, num_workers=1)` のままでよい。
公開型とmypy利用方法は[Python公開API](../python-api.md)、
外部JSONから検証して使う例は[typed_api.py](../../examples/typed_api.py)にある。

「関数の引数として渡したい」が「ファイルを必須にしたくない」という意味なら、既存APIで満たせる。
「項目名を補完してほしい」という意味なら、まず既存の `TypedDict` を試すのが最小の選択である。
「datetimeやDB行を変換せず渡したい」という意味なら、現在のJSON互換dictとは別の要求になる。

## バリデーションと互換性

入口がdictでも、無制約なPythonオブジェクトを受理するわけではない。
[check_json / validate_request](../../src/shift_schedula/contract.py)はJSON互換性を確認し、
tuple、日時オブジェクト、文字列でないキー、非有限数、循環参照を拒否する。
その後のSchema検証と[normalize](../../src/shift_schedula/model.py)による意味検証は、
[validate / solve](../../src/shift_schedula/engine.py)の双方から使われる。
`Request` と注釈したり、`cast(Request, value)` しただけでは検証済みにならない。

外部JSON文字列は既存の `load_json` を使う。Python標準 `json.loads` は既定で
重複キーの最後の値を採用し、NaN等も受理するため、schedulaの厳密読み取りと同等ではない。
一度dictに変換した後では、失われた重複キーは検出できない。
[Python json文書](https://docs.python.org/3.14/library/json.html#standard-compliance-and-interoperability)、
[既存のstrict読み取り実装](../../src/shift_schedula/contract.py)、
[入力契約テスト](../../tests/test_input_contract.py)を根拠とする。

JSONのobjectはdict、arrayはlistへ対応するため、テキストとdictで業務構造を共通化できる。
ただし任意のdictの往復が常に同じ値になるわけではなく、例えば文字列でないキーはJSON変換時に変わり得る。
[Python jsonの変換表と注意点](https://docs.python.org/3.14/library/json.html)に基づき、
推奨するのはJSON互換の値を持つdictに限る。
dictへ切り替えても、契約0.15・版必須・未知項目拒否などの既存条件を緩めない。

## 次の判断に必要な確認

推奨は現状の公開APIを基本とし、必要なら使い方の例を改善すること。
別APIの追加判断は、具体的な組み込みコードで困る点を確認してからにする。
調査開始時点の[Python公開API](../python-api.md)と[型付き利用例](../../examples/typed_api.py)は
JSON読み取りから始まる例が中心である。Python値から構築できることが伝わりづらい可能性はあるが、
これは文書を読んだ上での仮説であり、利用者による確認はしていない。
本調査を受け、Python公開API文書にJSONを経由せず型付きdictを構築し、`solve`へ渡す完全な例を追加した。

| 確認したい困りごと | 最初に試す対応 |
| --- | --- |
| PythonからJSONファイルを作る手間がある | `Request` と入れ子の `TypedDict` を直接構築して `solve` へ渡す |
| キーの補完が出ず間違える | 使用中のエディタで型付きリテラル・ `Employee(...)` 等の補完を比較する |
| マスターと今回の条件を再利用したい | [既存Adapter](../input-adapter.md)の `RequestDraft` / `assemble` が合うか確認する |
| datetime、DataFrame、DB行を入力にしたい | 利用アプリ側で現契約へ明示変換する具体例を作り、共通化する必要があるか確認する |
| 少数の定型引数だけで呼びたい | その用途に必要な引数と、隠してよい既定値を先に定める。全機能版APIへ一般化しない |

## 調査・検証の範囲

Python 3.14公式文書を使用した。Context7で `/python/cpython` をresolveして
json・TypedDict・dataclassesを個別照会した後、main由来の将来版要素が混じるため、
上記リンクの3.14文書で採用した事実を確認した。
ローカルの公開API・型・入力検証・CLI/Web呼び出し経路と既存テストを読んだ。
CPython 3.14.8の既存依存環境から `PYTHONPATH` で現在のcheckoutを読み込み、
`examples/assignment.json` に対して次をassertで確認した。

- `load_json` の結果はdictで、`validate` は `VALID`、`solve(..., num_workers=1)` は `OPTIMAL`。
- dictの直接入力と、JSONテキストに変換して `load_json` で戻した入力で、solutionが同じ。
- 求解後の元入力はdeep copyとの比較で不変。
- JSON文字列を直接 `solve` に渡すと `INVALID_INPUT`。

公開API・入力契約の既存テストを限定実行し、11件成功、76件対象外だった。
対象は `tests/test_public_api.py` と `tests/test_input_contract.py` の
`public_validation_reuses_entry_checks_without_solving`、
`public_types_match_version_fields_and_literals`、`strict_json_reader`、
`non_json_and_cyclic_library_input`。
公開型とSchemaの対応、共通検証、重複キー・非有限数・非JSON・循環入力の拒否を確認した。

Python公開API文書へ追加したdict構築例はコードブロックを抽出して `mypy --strict` に通し、
入力が `VALID`、結果が `OPTIMAL`、独立検証成功、従業員1人の1時間の担当配置であることをassertで確認した。

依存環境は既存venvを流用し、lockからの同期・配布物検証は行っていない。
全体テスト、エディタ上の補完、実利用者の入力作業時間、JSON変換コストの測定は実施していない。
JSON変換の省略で求解全体が体感できるほど速くなるとは主張しない。
