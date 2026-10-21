# 秋秋音乐部署指南

本项目是零 npm 依赖的 Node.js 站点，需要持续运行的 Web 服务。代码仓库可以放在 GitHub 或阿里云 Codeup；仅把文件上传到静态网站托管服务，无法运行实时搜索、榜单抓取和音频代理。

## 当前部署

| 项目 | 配置 |
| --- | --- |
| 当前重建服务地址 | <https://qiuqiumusic-2lkp.onrender.com/> |
| 要求的正式域名 | <https://qiuqiumusic.onrender.com/>（尚未分配，当前返回 404） |
| 托管平台 | Render Web Service，Free，新加坡区域 |
| 服务管理 | <https://dashboard.render.com/web/srv-dbc2a7tg1s2s73bj5dfg/settings> |
| 部署源码 | GitHub `kevinq888/qiuqiumusic` 的 `main` 分支 |
| 部署方式 | 手动部署；当前服务通过公共 Git 仓库地址创建，推送代码不会自动部署 |
| 运行环境 | Node.js 22 或更新版本 |
| 构建命令 | `node --check server.js` |
| 启动命令 | `npm start` |
| 健康检查 | `/healthz`，成功时返回 `ok` |

2026-10-21 已按确认删除旧服务 `srv-dbbosnnavr4c738b0jt0`，从新仓库重建。Render 仍分配带后缀的域名；创建表单没有提供单独指定默认子域名的选项。此处记录实际结果，不代表正式域名已恢复。桌面客户端仍以要求的正式域名为默认地址，域名恢复前不发布依赖该地址的新安装包。

Codeup 仓库是同一项目的代码副本。线上服务从上述 GitHub 分支拉取代码；推送 GitHub 或 Codeup 后，都需要在当前 Render 服务中手动部署最新提交。

## 本地启动与检查

安装 Node.js 22 或更新版本。在仓库根目录运行：

```sh
npm start
```

默认访问 <http://localhost:3000/>。如需改端口，可设置 `PORT` 环境变量：

```sh
PORT=3100 npm start
curl -f http://localhost:3100/healthz
```

项目没有需要安装的 npm 包，部署时不必运行 `npm install`。服务监听 `0.0.0.0`，端口由平台注入的 `PORT` 决定，未设置时使用 3000。

## 在 Render 新建服务

已有线上服务时，不要再次导入 Blueprint 创建同名服务；直接在现有服务中查看部署或更新配置。

1. 将代码推送到 GitHub。在 Render 中连接能访问该仓库的 GitHub 账号，或者使用公开仓库 URL。
2. 在 Render 创建 **Web Service**，选择仓库及 `main` 分支。
3. 选择 **Node**，填写上表中的构建命令、启动命令和健康检查路径；选择合适的区域与实例规格。当前线上服务使用 Free 和 Singapore。
4. 提交创建，等待部署状态变为 **Live**。通过公开仓库 URL 创建的服务需要手动触发后续部署；若需要按提交自动部署，请连接 Git 提供商，或按 Render 的 Blueprint 方式配置。
5. 打开分配的 `onrender.com` 地址，检查首页与 `/healthz`。当前项目也提供根目录的 [`render.yaml`](../render.yaml)，可用于首次通过 Render Blueprint 创建服务。

无需设置应用密钥或数据库环境变量。若自定义域名、修改源码分支或调整实例规格，请在 Render 服务设置中同步修改。

## 使用 Docker

仓库根目录的 [`Dockerfile`](../Dockerfile) 提供 Node.js 22 Alpine 镜像构建方式，适用于支持 Docker 的平台。部署平台仍需把外部流量转发到容器监听端口，并在运行时提供其要求的 `PORT`。

本地验证示例：

```sh
docker build -t qiuqiumusic .
docker run --rm -p 3000:3000 qiuqiumusic
```

随后访问 <http://localhost:3000/healthz>。容器重建会清除容器内未挂载的数据。

## 缓存与用户数据

- 搜索结果和榜单源页按需抓取，写入 `data/cache/`，有效期为 6 小时。该目录已被 Git 忽略，不应提交到仓库。
- Render Free 的文件系统不会跨休眠或重新部署保留缓存；重启后的首次访问会重新抓取。若业务需要持续保留服务器缓存，应使用支持持久存储的部署方式并挂载该目录。
- 收藏、播放清单和皮肤偏好目前存在访问者的浏览器本地存储中。它们不会随代码部署迁移，也尚未与账号同步；清理浏览器站点数据会丢失这些偏好。
- 站点支持安装为 PWA。HTTPS 线上地址打开后，点击右上角“安装”；支持网页安装提示的浏览器会弹出系统确认。iPhone/iPad Safari 需用“分享 → 添加到主屏幕”，Mac Safari 可用“文件 → 添加到程序坞”。浏览器不允许网页静默安装，用户仍需确认。安装后的应用与浏览器站点数据是否共用取决于平台，当前收藏和播放清单尚未跨设备同步。
- 搜索、榜单及播放音频依赖外部上游站点和 CDN。上游不可用时，搜索或部分歌曲可能暂时无法使用；已有服务器缓存可在抓取失败时提供部分旧结果。

## 更新与排障

更新线上站点：将经过检查的更改推送到 GitHub `kevinq888/qiuqiumusic` 的 `main` 分支，然后在当前 Render 服务的 **Deploys** 页面手动部署最新提交。确认新提交部署为 **Live** 后，再访问首页和 `/healthz`。更新 Codeup 副本时，推送到 Codeup 对应分支即可；它不会改变线上 Render 服务。

当前本地远程名为 `github`（GitHub）和 `origin`（Codeup）。从本地 `mp3` 分支同步这两个仓库的示例：

```sh
git push github HEAD:main
git push origin HEAD:mp3
git push origin HEAD:main
```

推送前先拉取并检查各远端分支；只有目标分支能够正常快进时才执行这些命令，不要使用强制推送。Codeup 的默认分支为 `main`，同时保留 `mp3` 分支供现有开发流程使用。

部署失败时，优先查看 Render 的 **Deploys** 构建日志与 **Logs** 运行日志。常见检查项：

| 现象 | 检查项 |
| --- | --- |
| 构建失败 | Node 版本是否满足 `>=22`，`server.js` 语法检查是否通过 |
| 服务未就绪 | 启动命令是否为 `npm start`，平台是否提供有效 `PORT`，`/healthz` 是否返回 200 |
| 首次打开较慢 | Free 实例闲置后会休眠，等待实例唤醒再试 |
| 搜索或榜单缺失 | 检查运行环境到上游站点的网络、上游响应及服务日志；缓存过期后会重新抓取 |
| 音频无法播放 | 检查音频 CDN 是否可达、上游响应和浏览器网络面板 |
