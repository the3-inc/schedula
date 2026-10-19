# 製品Webのデザイン基準

会社の製品紹介はlanding-page、デモ・技術案内はこのリポジトリで保守する。製品用ヘッダーと会社サイトのヘッダーは、利用目的に合わせて別のメニューを持つ。
[会社・製品Webの方針](https://github.com/the3-inc/landing-page/blob/main/docs/product-web-architecture.md)に合わせ、デモ・技術案内には「the3合同会社の製品」と会社トップへの絶対URLを表示する。製品ロゴは維持し、紹介へ戻るリンクと導入相談先を残す。

共通の文字基準は`Helvetica Neue`、Arial、`Hiragino Kaku Gothic ProN`、`Noto Sans JP`、sans-serifの順とし、日本語表示に対応する。製品固有の文字サイズ・行間・情報密度は変えてよい。
余白は既存の8pxを基本とする段階を使い、会社との関係表示は8pxの間隔で製品名と分ける。フォーム・結果表示の密度まで会社ページに揃えない。
フォーカスは3pxの`currentColor`の線と6pxの外側余白で示す。本文への移動リンク、狭い画面での折り返し、`prefers-reduced-motion`を保つ。
製品のアクセントカラー、明るさのテーマ、ロゴ、メニュー項目は製品側で管理し、会社の`global.css`全体をコピーしない。共通パッケージや実行時の他サイトCSS取得は追加しない。

変更は`demo/landing.css`・`demo/style.css`とデモ・技術案内のHTMLへ反映し、公開ビルド・既存ブラウザーテストで確認する。会社への絶対URLが公開prefixへ書き換わらないことも公開テストで検査する。
