# 共有デザインの利用と更新

正本は`the3-inc/landing-page`の`packages/brand/`です。会社サイト・製品・別リポジトリで共有する通常のCSSとSVGを、`web/vendor/the3-brand/`へ固定保存します。通常の開発・ビルド・閲覧では配布元へ接続せず、Node.jsも不要です。

## 現在の取り込み

版・元コミット・タグ・SHA-256・各ファイルのhashは`web/vendor/the3-brand/provenance.json`に記録します。`source_state=working-tree`は未コミットのパッケージから作った未発行の検証用配布物です。正式Releaseの発行を意味しません。初版発行後に下記の手順で正式版へ更新します。

既存の`/brand-preset/base.css` URLを維持し、`base.css`が相対importする`tokens.css`も同じ場所から配信します。公開ビルドでは両CSSをまとめます。背景・本文・補足文・境界線・フォント・フォーカス・本文スキップを共有し、製品アクセント・フォーム・結果表・業務状態色は製品側が管理します。最新mainのテーマ追従とティール配色、共有クラス、画面改善を維持します。

会社ロゴはパッケージに含めてローカル・公開ビルドで配信可能にします。製品ロゴを会社ロゴへ置き換える変更は含めません。

## 正式版への更新

1. 配布元の`design-vMAJOR.MINOR.PATCH` Releaseで変更内容、元コミット、アーカイブのSHA-256を確認します。
2. 同じMacの`gh`ログインが配布元を読めることを確認します。トークンをファイルへ保存する必要はありません。
3. 確認したSHA-256を指定して更新します。

```sh
python3 scripts/update_design.py 1.0.0 --sha256 確認した64桁のSHA256
```

ローカルの検証用配布物は次のように明示して取り込みます。

```sh
python3 scripts/update_design.py 1.0.0 --sha256 確認した64桁のSHA256 \
  --archive /tmp/design/the3-brand-1.0.0.tgz \
  --metadata /tmp/design/release.json --allow-working-tree
```

スクリプトは指定版・配布元・チェックサム・許可ファイル・展開サイズを検証し、すべて成功してから既存版を置き換えます。リンクやパストラバーサルを含むアーカイブは拒否します。vendorを手編集せず、配布元で修正して新しい版から取り直してください。

更新PRでは`provenance.json`とCSS差分を確認し、以下を実行します。

```sh
uv run --locked pytest -q tests/test_design_package.py tests/test_landing_page.py tests/test_public_demo.py
node tests/landing-browser.cjs
node tests/public-browser.cjs
```

ブラウザーテストのPlaywright設定は既存CIに従います。公開ビルドは共有CSS・SVGへも内容hashを付けて製品の`assets/`へ出力します。ソース配布にも固定ファイルと配布条件を含めます。Python wheelには引き続きエンジンだけを含めます。

切り戻しは更新コミットを戻し、前の固定ファイル一式と`provenance.json`を復元します。パッケージは`UNLICENSED`であり、schedula自身のMITライセンスとは別です。配布条件はvendor内の`LICENSE`を参照してください。

旧`brand-preset-v0.2.0`の固定配置から`design-v1.0.0`へ移行します。通常ビルド時の取得や認証は追加しません。
