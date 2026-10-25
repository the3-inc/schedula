# 製品Webのデザイン基準

会社の製品紹介はlanding-page、デモ・技術案内はこのリポジトリで保守する。製品用ヘッダーと会社サイトのヘッダーは、利用目的に合わせて別のメニューを持つ。
[会社・製品Webの方針](https://github.com/the3-inc/landing-page/blob/main/docs/product-web-architecture.md)に合わせ、デモ・技術案内には「the3合同会社の製品」と会社トップへの絶対URLを表示する。製品ロゴは維持し、紹介へ戻るリンクと導入相談先を残す。

共通の色・本文書体・フォーカスの正本は、landing-pageが配布する`@the3/brand-preset`です。
現在は`brand-preset-v0.1.0`を`demo/brand-preset/`へ取り込み、`preset.lock.json`でアーカイブと各ファイルのSHA-256を固定します。
取得は更新時だけ実行し、通常の開発・CI・公開ビルドはコミット済みのCSSを使います。Node.jsやレジストリ認証は追加しません。
[導入・更新・切り戻し手順](https://github.com/the3-inc/landing-page/blob/brand-preset-v0.1.0/docs/brand-preset-distribution.md)を参照してください。

製品の`demo/landing.css`は基本スタイルを読み込み、既存の配色名を共通トークンへ対応付けます。
`web/brand.py`が固定情報とファイルの整合を検査し、公開ビルドは共通CSSを製品CSSへまとめて既存の内容hash付きアセットへ含めます。
稼働中の会社サイトの最新CSSへ依存しません。プリセットのファイルを手編集せず、製品固有のルールはその外側に置きます。

既存デモ・技術案内は明るい画面を前提とするため、`html`に`data-theme="light"`を明示します。
製品固有の文字サイズ・行間・情報密度、メニュー構成、注意・エラー等の意味を持つ色は製品側で管理します。
主要操作の色と文字色は共通の組を使い、専用のフォーカス色は文字色から独立させます。
本文への移動リンク、狭い画面での折り返し、`prefers-reduced-motion`を保ちます。

変更は`demo/landing.css`・`demo/style.css`とデモ・技術案内のHTMLへ反映し、公開ビルド・既存ブラウザーテストで確認する。会社への絶対URLが公開prefixへ書き換わらないことも公開テストで検査する。
