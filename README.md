# 声海音乐

一个本地运行的免费音乐播放器。采用熟悉的桌面音乐客户端布局，使用独立品牌与原创界面，不使用 QQ 音乐的代码、图标或受版权保护的曲库。

## 启动

需要 Node.js 20 或更新版本。进入本目录运行：

```bash
npm start
```

然后打开 <http://127.0.0.1:4173>。无需安装 npm 依赖。

## 已实现

- 内置 30 首可直接播放的 Wikimedia Commons 开放曲目，覆盖 Scott Joplin、Kevin MacLeod、古典音乐与军乐；每首都链接回文件说明页查看许可与署名。
- 浏览器优先直接搜索 Openverse 音频索引，失败时回退到本地服务聚合 Openverse 与 Internet Archive Netlabels；Openverse API 支持匿名使用，但受速率和分页限制。
- 可选配置 Jamendo 的 `JAMENDO_CLIENT_ID`，搜索约 50 万首 Creative Commons 曲目；Jamendo 旧版公开测试 ID 已暂停，不能直接依赖。
- 提供 Radio Paradise 官方网页播放器入口；SomaFM Groove Salad、Drone Zone、Secret Agent 可从应用内直连官方 MP3 直播流。SomaFM Groove Salad 的官方网页播放器另提供 FLAC HLS。直播音频由浏览器直接连接电台，不经过本地搜索服务；播放是否可用取决于当前网络能否访问电台流域名。
- 播放源站音频文件；格式标签表示请求/源文件格式，不代表经验证的码率、母带质量或无损来源。
- 本地音频导入、播放队列、随机与循环、进度和音量控制。
- 收藏开放曲库歌曲，保存在本机浏览器。导入的本地文件只在当前页面会话可用，其收藏也不会跨刷新保存。
- 点击歌曲旁的 `↗` 打开源站页面，查看完整版权与署名信息。

## 使用边界

开放曲库的歌曲种类、授权和可访问性由来源站点决定；QQ 音乐会员曲库不能作为免费来源。Openverse API 可匿名搜索，但深度分页和速率有限；Jamendo 如配置自己的应用 ID，也不能保证命中主流唱片公司的热门歌。Jamendo API 按非商业用途条款使用，署名作者、Jamendo 并链接回曲目页。FLAC 是编码格式标签，不能单凭它保证母带真实无损。

此执行环境对 `archive.org` 和 `api.openverse.org` 的连接失败；Jamendo 官方测试 ID 返回应用已暂停。在线搜索暂时不可用时，内置 Commons 曲目和 SomaFM 电台仍可播放。开放曲库的流由来源站点直接提供，须在当前网络可访问对应域名。

如要用于公开服务，请增加更完整的授权校验、署名展示、源站访问规则检查和错误恢复机制。
