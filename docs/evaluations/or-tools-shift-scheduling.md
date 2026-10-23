# OR-Tools公式勤務計画サンプルとschedulaの機能比較

2026-10-20に公式ソースとschedulaの入力契約・求解・独立検証・テストを静的に照合した。
**schedulaは公式サンプルの厳密な機能包含には達していない。**
特に勤務種別ごとの連続長の選好、期間回数の帯域・非対称ペナルティ、勤務種別間の遷移ペナルティ、
必要人数を超える勤務種別選択の評価が不足する。既存の目標勤務回数や目的順序は、これらと意味が異なる。
一方、実時間の勤務・休憩・技能別担当、再計画、独立検証などは比較対象のサンプルには含まれていない。
具体的な入口と実装順序は[勤務計画API改修案](../designs/roster-api-and-coverage.md)を参照する。

## 比較対象と判定方法

- 公式: [`google/or-tools`, `shift_scheduling_sat.py`](https://github.com/google/or-tools/blob/100f66e6242ab8bf8d32feb8f3bf086db66ae2b5/examples/python/shift_scheduling_sat.py)。`stable`の参照先をGitHub公開APIで取得し、commit `100f66e6242ab8bf8d32feb8f3bf086db66ae2b5`に固定した。ファイルは456行。取得日は2026-10-20。
- schedula: commit `3e96a5e37bacf434243c84172ec0d93d5386d717`、現行契約0.15。以下のリポジトリ相対リンクの行番号はこのcommitのソースに対するもの。
- 公式資料探索にはContext7の`/google/or-tools`を使用し、`add_soft_sequence_constraint`の最大連続区間の意味を確認した。Context7の結果は同じサンプルのnotebook版を含むため、最終判定と行番号は上記の固定Pythonファイルを正本とした。
- **同等**: 記載した範囲で同じ制約または評価を表現できる。操作数や使いやすさまで同じという意味ではない。
- **一部対応**: 近い機能または限定条件での変換はあるが、一般形をそのまま表現できない。
- **意味差あり**: 似た項目はあるが、対象・単位・境界または目的の比較方法が異なる。
- **未対応**: 現行の公開契約・モデル・独立検証に、その機能を直接表す経路がない。CP-SAT自体が実現できないという意味ではない。

この比較は**指定された公式サンプル**との比較である。OR-Tools全体の限界・他の公式サンプル・利用者が追加実装できる範囲を比較したものではない。
schedula自身も勤務計画にはOR-Tools CP-SATを使用している。

## 条件と評価の対応表

表の「独立検証」はschedulaの返却勤務・元入力からの検証経路を指す。
「テスト」は該当機能を対象にする既存テストの所在であり、今回実行したという意味ではない。

| 公式サンプルの機能 | 判定 | schedulaの入力・求解・独立検証と差 | 既存テストの証拠 |
| --- | --- | --- | --- |
| 従業員×日×勤務種別の選択。休み`O`を含めて毎日厳密に1個（公式309〜312行） | 一部対応・意味差あり | schedulaは同じ勤務開始日について候補を最大1個選び、選ばなければ勤務なし。[求解](../../src/shift_schedula/cp_sat.py#L48)、[検証](../../src/shift_schedula/verify.py#L124)。勤務種別そのものの排他的日次状態は持たない。勤務なしを`O`へ写像するなら非勤務を含めた1状態にはできるが、夜勤明けの完全休日とは異なる | [候補が別勤務ではなく選択肢であること](../../tests/test_roster.py#L162)、[夜勤の開始日での計数](../../tests/test_extended_roster.py#L83) |
| 勤務種別の集合`O/M/A/N`（公式209〜211行） | 意味差あり | `shift_categories`は原勤務と明示区間の重なり分数で判定し、一勤務が複数分類に該当できる。[分類実装](../../src/shift_schedula/shift_patterns.py#L38)。候補ID・役割・分類のどれも排他的な勤務種別と同義ではない | [重複分類・休憩・分割・待機](../../tests/test_shift_patterns.py#L222)、[分類閾値](../../tests/test_shift_counts.py#L112) |
| 指定従業員・勤務種別・日の固定（公式314〜316行） | 一部対応 | `continuity.committed_shifts`で原勤務を保持し、`baseline`と`fixed_parts`で勤務・休憩・非勤務・担当状態を保持できる。ただし「この日のN」1項目の直接指定ではない。固定部分には検証済み基準計画が必要。[入力検査](../../src/shift_schedula/extensions.py#L90)、[固定条件](../../src/shift_schedula/extensions.py#L216)、[求解](../../src/shift_schedula/extensions.py#L371)、[検証](../../src/shift_schedula/extensions.py#L240) | [確定勤務と候補の境界](../../tests/test_continuity.py#L150)、[固定との衝突を独立検証](../../tests/test_shift_patterns.py#L557) |
| 休みを固定する（公式215〜231行） | 一部対応 | 勤務可能時間からその日を外す、日別勤務日数を0にする、基準の非勤務状態を固定する方法はある。前日開始の夜勤がその日に重なるケースでは「当日開始勤務なし」と「その日の全時刻で非勤務」を区別する必要がある。[勤務日・占有日の別計数](../../src/shift_schedula/day_counts.py#L90)、[基準のoff固定](../../src/shift_schedula/extensions.py#L227) | [夜勤開始日と占有日の差](../../tests/test_day_counts.py#L232)、[日数条件と固定勤務](../../tests/test_day_counts.py#L396) |
| 希望勤務の報酬、回避勤務の罰点。選択Booleanに正負の重み（公式234〜244、318〜321行） | 一部対応・意味差あり | `prefer_work`/`avoid_work`は指定区間の未勤務分数/勤務分数への正の整数単価。`avoid_role`は担当分数への単価。勤務種別の選択1回に対する正負の整数係数ではない。[Schema](../../src/shift_schedula/schemas/0.15/request.schema.json#L1067)、[求解](../../src/shift_schedula/cp_sat.py#L246)、[検証](../../src/shift_schedula/verify.py#L420) | [希望は待機で満たせるが過剰担当は不可](../../tests/test_contract_04.py#L210)、[回避と不足の優先順](../../tests/test_contract_04.py#L227) |
| 同一勤務種別の最大連続区間ごとの必須最小長・最大長（公式61〜137行） | 一部対応 | `max_consecutive_days`は全勤務の開始日についての最大連勤、`min_consecutive_days_off`は完全休日の最大連続区間についての最小長。任意の勤務分類の連続長上下限をそろえた一般機能はない。[全勤務の最大連勤](../../src/shift_schedula/cp_sat.py#L114)、[休日最小連続長](../../src/shift_schedula/shift_patterns.py#L276)、[休日の独立検証](../../src/shift_schedula/shift_patterns.py#L402) | [履歴の連勤](../../tests/test_roster.py#L136)、[休日の最大連続区間と休日なし](../../tests/test_shift_patterns.py#L97) |
| 同一勤務種別の連続長に望ましい最小長・最大長、短すぎ/長すぎに別単価（公式107〜132、250〜255行） | 未対応 | 勤務パターンは必須条件のみ。夜勤連続1回は20、4回は5とするような連続長の選好定義・目的値・独立再集計がない。[受け付けるパターン](../../src/shift_schedula/shift_patterns.py#L11)、[Schemaの条件集合](../../src/shift_schedula/schemas/0.15/request.schema.json#L414) | 対応する公開機能・テストなし |
| 休みの連続長1〜2日を必須（公式250〜252行） | 一部対応、条件付きで変換可能 | 日跨ぎ勤務がなく`O`と完全休日が一致するなら、計画内の各連続3日区間に`days_off_bounds.max_days=2`を置けば最大2連休を表せる。最小1日は自明。1件で指定する専用ルールはなく、夜勤を入れると同値ではない。[休日数の上下限](../../src/shift_schedula/day_counts.py#L95) | [日数の全候補列挙](../../tests/test_day_counts.py#L435)。上記の公式用rolling変換自体の回帰テストは未作成 |
| 週ごとの休みの必須回数上下限（公式261〜265、342〜360行） | 一部対応、条件付き同等 | 週の00:00境界を明示した`days_off_bounds`で完全休日の必須上下限は表せる。公式の`O`は日次の選択肢で、実時間の定義を持たないため、日跨ぎ勤務の写像には別の定義が必要。[日数検査](../../src/shift_schedula/day_counts.py#L34)、[求解](../../src/shift_schedula/day_counts.py#L78)、[独立検証](../../src/shift_schedula/day_counts.py#L121) | [7日間と手編集の検証](../../tests/test_day_counts.py#L139)、[DSTの暦日](../../tests/test_day_counts.py#L300) |
| 週ごとの夜勤回数など勤務種別別の必須上下限（公式140〜182、261〜265行） | 未対応 | `shift_count_balance`は分類別の回数を数えるが、単点目標からの偏差であり必須下限/上限ではない。`work_days_bounds`は分類で絞れない。[回数の入力・目的対応](../../src/shift_schedula/shift_counts.py#L21)、[回数のモデル](../../src/shift_schedula/shift_counts.py#L71)、[勤務日数の式](../../src/shift_schedula/day_counts.py#L90) | [回数と勤務分数の違い](../../tests/test_shift_counts.py#L70)、[明示0と対象外](../../tests/test_shift_counts.py#L239) |
| 週ごとの回数に望ましい帯域、帯域の上下で別ペナルティ（公式184〜201行） | 未対応、近似機能あり | `shift_count_deviation`は`abs(actual-target)`。soft_minとsoft_maxの間を0にし、その上下で異なる単価を設定する機能ではない。勤務なしの`O`の回数は勤務件数でもない。[絶対偏差モデル](../../src/shift_schedula/shift_counts.py#L79)、[独立再集計](../../src/shift_schedula/shift_counts.py#L92) | [分類・履歴を独立集計](../../tests/test_shift_counts.py#L49)、[集計の改ざん拒否](../../tests/test_shift_counts.py#L316) |
| 翌日の勤務種別との禁止遷移。penalty=0が禁止（公式268〜274、362〜379行） | 一部対応、条件付き同等 | `forbidden_shift_successions`で分類Aの開始日の`day_offset=1`後に分類Bの開始を禁止できる。分類が公式勤務種別と一対一なら禁止N→Mを表現できる。ただし評価期間前後の余白・過去実績が必要で、公式の計画内だけの判定とは境界が異なる。[求解](../../src/shift_schedula/shift_patterns.py#L222)、[必要余白](../../src/shift_schedula/shift_patterns.py#L142)、[独立検証](../../src/shift_schedula/shift_patterns.py#L346) | [次の選択勤務ではなく暦日のoffset](../../tests/test_shift_patterns.py#L157)、[余白不足の拒否](../../tests/test_shift_patterns.py#L289)、[全候補列挙](../../tests/test_shift_patterns.py#L503) |
| 避けたいが許す遷移。A→Nに4点（公式270〜272、362〜379行） | 未対応 | `forbidden_shift_successions`は必須条件であり選好にできない。`role_switches`は隣接した担当時間枠の役割変更で、日単位の勤務種別遷移とは異なる。[担当切替の集計](../../src/shift_schedula/verify.py#L512)、[パターンの条件集合](../../src/shift_schedula/shift_patterns.py#L11) | [休憩・待機をまたぐ切替は数えない](../../tests/test_roster.py#L80)。勤務遷移ペナルティのテストなし |
| 勤務種別・日ごとの必須最低人数（公式381〜389行） | 一部対応・意味差あり | `demand.minimum_people`で時間帯・役割の最低担当人数を指定できる。公式は勤務種別を選んだ人数、schedulaは実際に役割を担当する人数であり、出勤・休憩・待機を区別する。`minimum_people`省略は0なので、公式と同じ必須充足には明示が必要。[求解](../../src/shift_schedula/cp_sat.py#L166)、[独立検証](../../src/shift_schedula/verify.py#L458) | [下限を必須として元需要も保持](../../tests/test_minimum_demand.py#L46)、[元需要から改ざんを検出](../../tests/test_minimum_demand.py#L293) |
| 最低人数を超える勤務種別選択を許容し、超過人数に種別別単価（公式289〜290、390〜396行） | 未対応・意味差あり | schedulaは役割への担当人数が`required_people`を超えることを禁止し、勤務の余剰は待機になり得る。`scheduled_minutes`や勤務費用は勤務全量の評価であり、勤務種別別の超過人数評価ではない。[担当の上限](../../src/shift_schedula/cp_sat.py#L183)、[超過担当の検証拒否](../../src/shift_schedula/verify.py#L497) | [待機を含む勤務量](../../tests/test_roster.py#L51)、[希望があっても担当超過しない](../../tests/test_contract_04.py#L210) |
| 全選好・超過・遷移の重み付き総和を最小化（公式398〜402行） | 意味差あり、同じ総和は未対応 | schedulaの`objectives`は辞書順。上位の最適値を等式固定して次を解く。不足総量とpriority群も指定目的より先。`preference_penalty`内の分単価は加算されるが、全種類の公式イベントをまとめた総和にはなっていない。[目的構築](../../src/shift_schedula/cp_sat.py#L276)、[最適値固定](../../src/shift_schedula/cp_sat.py#L414)、[独立評価](../../src/shift_schedula/verify.py#L556) | [小規模列挙と目的順序](../../tests/test_shift_counts.py#L180)、[上位未証明なら後続へ進まない](../../tests/test_roster_metrics.py#L503) |

## 実行・入出力の対応表

| 比較点 | 判定とschedulaの対応 | 証拠 |
| --- | --- | --- |
| データをコード内に記述し`solve_shift_scheduling(params, output_proto)`を呼ぶ（公式206〜290行） | schedulaは既にPythonの`dict`を`solve(request)`に直接渡せる。JSONファイルへの書き出しは必須ではない。ただし多くの入れ子を組み立てる必要がある | [Python公開API](../python-api.md)、[実装](../../src/shift_schedula/engine.py#L252)、[型](../../src/shift_schedula/__init__.pyi) |
| 任意のSatParameters文字列、既定10秒（公式25〜27、409〜414行） | 一部対応。Requestの時間制限・seed、Pythonの`num_workers`を提供。一般のCP-SATパラメータ文字列は公開していない。複数目的で一つの探索予算を共有し、準備時間は探索予算の外なので、同じ秒数で同じ探索量にはならない | [パラメータ設定と共有予算](../../src/shift_schedula/cp_sat.py#L339)、[公開オプション検査](../../src/shift_schedula/engine.py#L264)、[共有予算テスト](../../tests/test_minimum_demand.py#L551) |
| モデルprotoをファイルに出力（公式404〜407行） | 未対応。公開APIにモデル出力指定はない。公式の再現に必要な業務機能ではなく、開発者向け診断機能の差 | [公開API](../python-api.md)、[公開型](../../src/shift_schedula/__init__.pyi) |
| OPTIMAL/FEASIBLEなら表を表示、全状態でsolver統計（公式416〜448行） | 一部対応・追加機能あり。schedulaは構造化Responseで状態、元需要の不足、目的の証明範囲、計画を返す。PARTIALは不足ありで必須条件を守る計画。INFEASIBLEとUNKNOWNは区別。目的配列の最適性と不足の最小性は別。公式の単一総合点とは比較対象が異なる | [Response生成](../../src/shift_schedula/engine.py#L279)、[Schema](../../src/shift_schedula/schemas/0.15/response.schema.json)、[状態テスト](../../tests/test_roster.py#L227)、[不足付き計画と固定衝突](../../tests/test_partial_plans.py#L392) |
| 途中解コールバック、勤務種別の文字表、正負の罰点を表示（公式413、423〜445行） | 意味差あり。schedulaは構造化した計画・評価集計を返し、当該形式の標準文字表や公式の全項目別イベント罰点一覧は持たない。既存デモは別の表示経路 | [APIの返却契約](../python-api.md)、[独立集計](../../src/shift_schedula/extensions.py#L380) |
| 解を別経路で検証 | schedula側の追加機能。公式ファイルはCP-SAT解から表示し、独立した業務検証APIはない。schedulaの`verify(request, solution)`は探索せず、勤務・担当・評価・不足を再計算する。最適性を独立証明するものではない | [独立検証API](../../src/shift_schedula/verify.py#L59)、[元入力から候補を再展開](../../src/shift_schedula/verify.py#L129)、[目的改ざんを遮断](../../tests/test_verification.py#L95) |

## 公式の特定データを再現することと一般機能の違い

### 条件付きで既存機能を使える部分

8人・3週の対象日へ、M/A/Nの候補を各従業員に展開すること自体は既存の勤務テンプレートで行える。
ただし公式は時計時刻・勤務長・休憩を指定しない。schedulaへ写すにはこれらを比較側で新たに定義する必要があり、
「同じ入力をそのまま渡した」ことにはならない。

休みの必須週1〜3日、最大2連休は、日跨ぎのない比較用時刻を採用して`O`と完全休日を一致させれば、
週の日数上下限と3日ごとの休日数上限へ変換できる。
このような個別変換を一般の「勤務種別ごとの連続長・週回数対応済み」と数えない。

N→M禁止も分類の一対一対応と境界余白を定義すれば近づけられるが、公式は計画の最初と最後を境界とする。
現行の勤務パターンは前後の確認済み文脈を要求するため、存在しない期間の勤務なしを自動補完して同等と主張しない。
境界を内部へずらした場合は、比較しているルールの対象日が変わったことを明示する。

### 既存機能だけでは同じ評価を再現できない部分

- 夜勤が最大連続区間として1回なら20、4回なら5という評価。単純に夜勤回数を2または3へ近づけても、2回ずつ分かれた夜勤と4連続夜勤を区別できない。
- 週の休みは2日が望ましく、1日なら7、3日なら4という非対称評価。単点の絶対偏差では左右の単価が同じになる。
- 夜勤は週0回なら3、1〜4回なら0、5回以上は禁止という「望ましい帯域＋必須上限」。目標1回の絶対偏差なら2〜4回も罰してしまう。
- A→Nに4点。禁止へ変換すると解集合が変わり、担当切替へ変換すると対象が変わる。
- M/A/Nの必要人数超過へ2/2/5点。役割担当人数の上限や待機時間の評価は同じ量ではない。
- これらすべてと希望を同じ総合点で交換する目的。辞書順の順番を変えるだけでは同じ比較にならない。

希望を正負から非負へ変えること自体は可能である。希望イベント`x`への`-w*x`は
`w*(1-x)`と定数`-w`の差しかなく、最適解の比較順序は同じになる。
しかし、現行の希望は勤務分数でありイベント単位ではない。
勤務長が同じ限定例で単価をスケール変換できても、休憩・長さ違い・同日で区間が重なる候補へ一般化すると同等ではない。

また固定入力のコメントは「最初の2日」とするが、実データには`(6, 2, 3)`が含まれる
（公式222行）。再現用fixtureではコメントから意図を推測して修正せず、実際のタプルを保持する。

## schedula側に既にある付加価値

以下は今回の公式ファイルに実装されていない機能であり、OR-Toolsで追加実装できないという主張ではない。

| 領域 | schedulaの既存機能と証拠 |
| --- | --- |
| 実時間の勤務と担当 | 技能・担当資格、勤務可能時間、出退勤・休憩候補と担当を同時に選ぶ。[同時最適化の判断](../adr/0002-joint-roster-optimization.md)、[技能の検証](../../src/shift_schedula/verify.py#L380) |
| 夜勤・分割勤務・継続計画 | 原区間、実績・確定勤務、勤務間の休息、DST、勤務日と占有日の区別。[継続計画の判断](../adr/0006-continuity-original-intervals.md)、[実績と原区間の回帰](../../tests/test_continuity.py#L47) |
| 不足を伴う計画 | 元需要と必須下限を分け、不足総量・需要優先度・指定目的の順で比較。[下限の判断](../adr/0009-mandatory-demand-minimum.md)、[下限テスト](../../tests/test_minimum_demand.py#L46) |
| 作成後の運用 | 基準計画、勤務・担当の固定、変更最小化、固定再計画・全体再計画、手編集した計画の独立検証。[基準計画と検証の判断](../adr/0005-partial-baseline-and-independent-verification.md)、[公開API](../python-api.md) |
| 診断と明示的な変更案 | 不可能性の条件グループ、背景条件を保つ診断、許可された変更後の計画を元条件の解と区別。[診断実装](../../src/shift_schedula/diagnosis.py)、[条件グループの検証](../../tests/test_minimum_demand.py#L349) |
| 入力の再利用・保存 | 入力元の改訂・確認、確定入力への組み立て、実行記録の保存・再検証。[Adapter](../../src/shift_schedula/adapter.py)、[記録](../../src/shift_schedula/records.py) |

## 不足を埋めるために変える境界

既存の便利なPython入口を足すだけで解決するものと、入力契約の意味・モデル・検証を変えるものを分ける。
次の順序は実装を決めるための依存関係であり、今回コードを変更したものではない。

1. **日次の勤務種別状態を定義する。** 排他的な種別、候補との対応、勤務なしの状態、開始日帰属、完全休日との差、計画端と文脈の扱いを確定する。既存の重複可能な`shift_categories`の意味は流用して変えない。
2. **その状態から評価する必須条件と選好を定義する。** 種別別回数の必須上下限、最大連続区間の必須/望ましい上下限、遷移の禁止/選好、固定と希望のイベントを追加する。望ましい範囲のペナルティは`lower_cost*max(soft_min-value, 0) + upper_cost*max(value-soft_max, 0)`とし、回数・連続区間・境界をそれぞれ区別する。
3. **人数の意味を分ける。** 勤務種別を選んだ人数への需要・超過評価を追加する場合、既存の時間帯・役割への担当需要から分離する。既存の過剰担当禁止を解除して公式へ合わせることはしない。
4. **イベント評価を合算する目的を設ける。** 新しい勤務種別の希望・連続長・回数・遷移・超過を一つの整数ペナルティへ加算すれば、既存の辞書順の一目的として置ける。公式の総合点を再現する例では、この一目的だけを使用し、該当する全ペナルティと定数差を記録する。勤務費用・既存分数選好まで無断で混ぜない。
5. **同じ意味を公開境界から検証まで通す。** Request/Response Schema、公開型、正規化、モデル、独立検証、診断時の除去単位、基準計画の保存、Adapterの入力保持、CLI・デモ・fixture・配布を点検する。便利な入力関数は確定済み意味のRequestを作るだけにする。

受け入れは「サンプルが動く」だけにしない。小規模な日次状態を全列挙し、
必須条件の許容集合・各イベント罰点・合計点・最適解集合を直接計算して求解と独立検証へ照合する。
特に、0回、連続区間なし、計画端の短い区間、範囲内0点、非対称単価、禁止と罰点0の違い、
同じ回数で異なる並び、複数分類、夜勤明け、手編集の違反を入れる。
公式データの受け入れでは、符号を非負へ変えた際の定数差を補正して比較し、同じ最適目的値でも最適解が複数ある場合に勤務表の完全一致を要求しない。

## 今回確認した範囲と残る確認

- 固定した公式Pythonファイルの全文、schedulaの現行Schema、目的構築、勤務候補・勤務日・分類・回数・固定・需要・独立検証の実装、関連テストの定義を読んだ。
- 公式サンプルの実行、schedulaへの変換実装、同じ入力での目的値・実行時間比較、既存テストの再実行は行っていない。新しい依存の導入も行っていない。
- 「同等」は表に明記した局所的な機能の静的評価であり、公式の8人3週データを端から端まで再現して検証済みという意味ではない。
- 入力が短くなることと利用者が使いやすいことは別であり、使いやすさは最初の計算・条件追加・欠勤再計画を実装する利用者の操作確認が必要である。
