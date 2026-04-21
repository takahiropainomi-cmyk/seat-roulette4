# 🍺 座席ルーレット

飲み会の座席をランダムに決めるWebアプリです。

## 機能
- 2〜30人に対応
- プリセット配置（長テーブル・丸テーブル・コの字・島テーブル）
- カスタム配置エディタ（ドラッグ&ドロップで自由配置）
- テーブル配置図のリアルタイム更新

---

## Vercelへのデプロイ手順

### 1. GitHubにリポジトリを作成

1. [github.com](https://github.com) にログイン
2. 右上「＋」→「New repository」をクリック
3. Repository name: `seat-roulette`
4. 「Create repository」をクリック

### 2. このファイル一式をGitHubにアップロード

```bash
# ターミナルで実行（このフォルダ内で）
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/seat-roulette.git
git push -u origin main
```

**GitHubのWebサイトからアップロードする場合：**
1. 作成したリポジトリページで「uploading an existing file」をクリック
2. このフォルダ内の全ファイルをドラッグ&ドロップ
3. 「Commit changes」をクリック

### 3. Vercelにデプロイ

1. [vercel.com](https://vercel.com) にアクセス
2. 「Sign Up」→「Continue with GitHub」でGitHubアカウントで登録
3. 「Add New Project」をクリック
4. `seat-roulette` リポジトリを選択
5. 設定はすべてデフォルトのまま「Deploy」をクリック
6. 1〜2分でデプロイ完了！

### 4. URLを共有

デプロイ完了後、`https://seat-roulette-xxx.vercel.app` のようなURLが発行されます。
このURLを参加者に共有するだけで誰でも使えます🎉

---

## ローカルで動かす場合

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。
