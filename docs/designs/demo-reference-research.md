# 「まず試す」デモの参考サイト調査

確認日: 2026-10-25（日本時間）。本書は schedula のデモ設計を検討するための参考資料であり、
既存の教材仕様 [demo-redesign.md](demo-redesign.md) を置き換えない。

## 調査の範囲

公式公開ページ・公式ヘルプ・公式リポジトリを対象に、入口、操作、結果、やり直し、導入への接続を調べた。
本書の確認方法は **Web取得による本文・コントロール名の確認と公式説明の読解**。
ブラウザで実操作して測定したものではなく、全サイトの登録不要性・現時点の正常動作・応答速度・
モバイル品質は未確認。以下の「応用」は調査者の設計上の推論であり、各社が有効性を実証したという意味ではない。
取得結果が JavaScript の外枠だけだった場合も明記する。

比較の問いは「触れるサイトか」だけでなく、**自分の操作が何を変えたか説明できるか**とする。

## 参考サイト8件

| サイト・直接の入口 | 公式情報から確認できた体験 | schedula に取り入れること | そのまま移さないこと・未確認点 |
| --- | --- | --- | --- |
| [FullCalendar Demos](https://fullcalendar.io/demos) | 月・週・リソースなどの実例を並べ、イベントを動かしてから各例の `Code` を見る導線を説明。テーマ選択と色の項目があり、最後に `Get started` へ接続する。[S1] | 条件を触って効果を見てから、同じ例の入力・実装を見る。主題別の画面へ直接入れる。 | 複数例を縦に大量表示すると schedula の44主題では長くなる。初回は代表例に絞る。勤務表のドラッグがそのまま最適化になるとは扱わない。Reset の有無と操作後の挙動は未確認。 |
| [AG Grid Inventory Demo](https://www.ag-grid.com/example-inventory/) | 在庫管理という業務画面に対し、セル内編集と状態フィルターを提供すると説明。`See On GitHub`、`Video Tour`、`Contact Us`、`Community vs. Enterprise` が隣接する。[S2] | 機能名の羅列に先立ち、架空だが業務を想像できる勤務表を見せる。試した内容からソース・導入相談へつなぐ。 | 企業向けグリッドの高密度な全機能配置を初回体験に移さない。公開ページのアプリ本体は取得テキストに現れず、編集・リセット・登録条件は未操作。 |
| [Algolia E-commerce Demo](https://instantsearchjs.netlify.app/examples/js/e-commerce/) | 公式 Ecommerce Starter からデモとソースへ移動できる。公式説明には絞り込み、価格範囲、切替、URL routing、responsive UI がある。[S3] | 「条件を一つ変える→結果を見る」を同じ画面で往復させる。直接リンクから対象の教材に入れるようにする。 | 多数のフィルターを勤務条件へ一括転用しない。対象デモの取得結果は見出しと Filters のみで、実際の絞り込み・URL復元・Reset は未操作。 |
| [Typesense E-commerce Store](https://ecommerce-store.typesense.org/) | 公式デモ一覧から到達。店舗データを用いたカテゴリー・ブランド・価格・評価の項目、類似商品機能の説明、`Source Code` を取得できた。[S4] | 同じエンジンを業務に近い題材で体験させ、技術説明は必要な場所に置く。入力用語を利用者の業務用語にする。 | デモ内の分散構成・ベクトル検索などの説明量をそのまま初回画面に置かない。商品カードの動作とResetは未確認。 |
| [Desmos Graphing Calculator](https://www.desmos.com/calculator) | 公式ヘルプでは式の数値を変数にすると slider を提案し、値・範囲・stepを操作して図の変化を探索できる。公式ヘルプから操作例へ移動できる。[S5] | 連勤上限など、一つの条件と一つの変化を近くに置く。範囲・単位を明示し、何を触るべきか迷わせない。 | 求解を slider の移動ごとに走らせる判断は別途必要。計算待ちや同率解がある schedula では即座の連続変形と同じ印象を約束しない。calculator 本体は取得テキストが空で、実操作・Reset・保存条件は未確認。 |
| [regex101](https://regex101.com/?lang=en_gb) | 入力欄と `Explanation`、`Match Information`、`Quick Reference` があり、入力に応じた説明を出すと公式ページに記載。公式ガイドはハイライトされた入力と詳細を照合する手順を示す。[S6] | 勤務表だけで終わらず、変えた条件・観察すべき指標・その結果の説明を対応させる。説明は結果の横または直下に置く。 | engine flavor、複数モード、専門用語の密度は初回には持ち込まない。未計算の入力と古い結果を混同しない。Reset・保存制約は未確認。 |
| [Mermaid Live Editor](https://mermaid.live/) | 公式ガイドにはサンプル選択、CodeとPreview、Configuration、ブラウザ内の履歴、PNG/SVG/Markdown出力がある。[S7] | 最初から動くサンプルを渡す。人が読む結果を主にしながら、同じ入力を後から取り出せるようにする。 | JSON入力を初回の主操作にしない。公式ガイドの履歴機能は確認したが、Resetや現在のエディター動作は未操作。本体は取得テキストが空。 |
| [Mapbox Geocoding Playground](https://docs.mapbox.com/playground/geocoding/) | `Try an example`、`Reset`、検索種別、入力、optional parameters、`Request URL`、`Response` を確認。アドレス検索と地図クリックの用途を説明している。[S8] | 「例を入れる」「元に戻す」を常に見つけられる位置に置き、技術者は生成されたRequest/Responseまで辿れるようにする。 | `access_token` 欄があるため、完全に準備不要の手本とは断定しない。取得結果にはWebGL要件の文言もある。複雑なAPIパラメーターの一覧を入口にしない。地図・API実行は未確認。 |

## 同業の比較として分けるもの

[Timefold Employee Shift Scheduling](https://app.timefold.ai/) は、勤務割当という題材の近さから参考になる。
ただし公式の [Hello world](https://docs.timefold.ai/employee-shift-scheduling/latest/) は、
登録と有効な tenant を前提としている。手順はデータ作成、投稿、結果取得と明快であり、UIでは
サンプルJSONのアップロードとRun、APIではPOST/GETを案内する。
これは開発者が導入検証する段階の参考であり、ホームページから準備なしで効果を理解する入口とは区別する。
登録後の画面は操作していない。[S9]

## schedula への設計上の示唆

### 最初の一周を小さくする

入口で全44主題から選ばせず、「必要人数を変える」などの代表教材へ直接入れる。
架空のデータと計算済みの初期状態を明示し、利用者は一つの数字を変え、再計算し、変化を読む。
既存の [demo-redesign.md](demo-redesign.md) にある「入力差分→主題の指標→勤務表の差分」と整合する。
この順序を確認することが優先であり、新しいエンジン機能や複雑なデモ用CMSを増やす必要はない。

### 結果を読む支援をデモの中心に置く

勤務表だけでは、並びが変わった理由や、何が改善したかは伝わらない。
「必要人数2→4人」「12:00–13:00の不足0→60人分」のように、触った条件とその教材の指標を対応させる。
同率解の全セル差分を唯一の因果と説明しない。結果が変わらないときもその事実を説明する。
これはDesmosの一変数探索とregex101の入力・説明の対応から得た設計仮説であり、利用者評価で検証する。

### やり直しと技術者向けの出口を分かりやすくする

`初期条件に戻す` を主要操作の近くに常設する。復元対象は入力全体と比較元とし、画面の数値だけを戻さない。
`入力JSONを見る`、`APIで試す`、`導入を相談する` は結果理解の後に進める出口として置く。
FullCalendar、AG Grid、Algolia、Typesenseに見られる「体験と実装素材をつなぐ」構造を応用する。
登録・APIキー・自社データ準備を初回の学習より先に要求しない構成を提案する。

### 色・レイアウトは機能の意味を守る

色の具体値は、schedula とホームページの現在の画面を確認してから決める。
この比較だけでは既存ブランドとの調和を評価できない。
方向性として、主要操作のブランド色、勤務種別の識別色、未充足・入力エラーの状態色を用途で分ける。
変更点は色だけでなくラベル・アイコン・数値でも示す。役割色の追加によって警告色の意味を奪わない。
参考サイトの見た目をコピーするより、操作と結果が同時に見える領域を優先する。

## 次に実画面で検証すること

- 初めて来た人が、説明なしで触る箇所を選び、一回の操作の意味を説明できるか。
- 計算中・未反映の入力・前回結果・失敗状態を区別できるか。
- 一条件を変更し、元に戻す一周がマウス・キーボードで完了するか。
- 狭い画面で、横長の勤務表と操作部を往復しても比較元を見失わないか。
- 指標を理解した利用者が、次の教材・JSON/API・相談のいずれかを自分で選べるか。

## 出典

以下はいずれも2026-10-25取得。ページ内の説明を短く要約し、利用者評価の結果とは扱っていない。

- S1: [FullCalendar Demos](https://fullcalendar.io/demos)。操作案内、テーマ・色、各例のCode、Get started。
- S2: [AG Grid Inventory Demo](https://www.ag-grid.com/example-inventory/)、[公式のデモ紹介](https://www.ag-grid.com/blog/ag-grid-showcase-examples-demos-samples-and-extensions/)。業務別実例、編集・フィルター、ソース・相談への導線。
- S3: [Algolia Ecommerce Starter](https://www.algolia.com/developers/code-exchange/ecommerce-starter)、[そこからリンクされたデモ](https://instantsearchjs.netlify.app/examples/js/e-commerce/)。公式が提供するサンプル、機能、ソースと実行例。
- S4: [Typesense Live Demos](https://typesense.org/docs/overview/demos.html)、[E-commerce Store](https://ecommerce-store.typesense.org/)。業務・データセット別の選択肢、絞り込み、Source Code。
- S5: [Desmos Sliders and Movable Points](https://help.desmos.com/hc/en-us/articles/202529069-Sliders-and-Movable-Points)、[Calculator](https://www.desmos.com/calculator)。変数・範囲・step・図の関係。
- S6: [regex101](https://regex101.com/?lang=en_gb)、[公式の画面構成ガイド](https://docs.regex101.com/editor/layout/)、[公式の入力と結果の読解例](https://support.regex101.com/editor/groups/)。入力・説明・詳細と狭い画面の構成。
- S7: [Mermaid公式User Guide](https://mermaid.js.org/intro/getting-started.html)、[Live Editor](https://mermaid.live/)。サンプル、Code/Preview、履歴、出力。
- S8: [Mapbox Geocoding Playground](https://docs.mapbox.com/playground/geocoding/)。例、復元、入力、Request/Response、tokenとWebGLに関する表示。
- S9: [Timefold Models](https://app.timefold.ai/)、[公式Hello world](https://docs.timefold.ai/employee-shift-scheduling/latest/)。登録・tenantの前提、UIとAPIの最初の実行手順。
