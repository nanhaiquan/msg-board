# 部署步骤

## 1. 注册 Railway

1. 打开 https://railway.com
2. 点击 "Sign in with GitHub" — 用你的 GitHub 账号登录
3. 授权后进入控制台

## 2. 上传代码

1. 在 Railway 控制台点 **"New Project"**
2. 选 **"Deploy from GitHub repo"**
3. 授权 Railway 访问你的 GitHub
4. 新建一个 GitHub 仓库（名字随便，比如 msg-board）
5. 把 C:\Users\zg520\msg-board 里的所有文件上传到这个仓库（去掉 node_modules 文件夹）
6. 回到 Railway，选择你刚建的仓库

## 3. 部署

Railway 会自动检测 Node.js 项目并部署，等 1-2 分钟出现 `✓ http://...` 就完成了。
它会给你一个 `https://msg-board.railway.app` 类似的网址，这就是你的线上地址。

## 4. 数据持久化

Railway 重启后文件系统会清空，所以 SQLite 数据会丢。
要持久保存留言，需要加一个 Railway Volume：

1. 在项目页面点 **"Volumes"**
2. **"Add Volume"** → 挂载路径填 `/data`
3. 部署后数据存在 volume 里，重启不会丢

## 5. 完成

把 Railway 给你的网址发给朋友，他们就能访问了。
