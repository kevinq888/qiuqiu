// 页面模板：逐页复刻 myfreemp3ku.com 的 HTML 结构
const { seed, getSong, proxyMediaUrl } = require('./store');

const SITE = 'MyFreeMp3';
const SITE_TITLE = 'MyFreeMp3 - 在线音乐免费下载官网';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- 公共片段 ----------

function head({ title, keywords = '', description = '', extraCss = '', extraHead = '' }) {
  return `<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <meta name="keywords" content="${esc(keywords)}">
  <meta name="description" content="${esc(description)}">
  <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <meta name="apple-mobile-web-app-title" content="${SITE_TITLE}">
  <meta name="application-name" content="${SITE_TITLE}">
  <meta name="format-detection" content="telephone=no">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" type="text/css" rel="stylesheet" />
  <link rel="stylesheet" rev="stylesheet" href="/projects/source_code/css/site.css" type="text/css" media="all">
  ${extraCss}
  <script src="https://cdn.jsdelivr.net/npm/jquery@2.2.4/dist/jquery.min.js" type="text/javascript"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js" type="application/javascript"></script>
  ${extraHead}
</head>`;
}

function navbar() {
  return `
    <div class="container" style="max-width: 960px; ">
      <nav class="navbar navbar-expand-md navbar-light bg-white px-0 mb-1 font-weight-normal">
        <a class="navbar-brand font-weight-bolder" style="font-size: 1.3rem;color: #50514F;" href="/" title="${SITE_TITLE}">
          <img src="/projects/source_code/picture/logo.png" width="35" height="35" class="d-inline-block align-middle" alt="${SITE_TITLE}"> MyFreeMp3
          <span class="text-muted" style="font-size: smaller"></span>
        </a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav mr-0">
            <li class="nav-link-item"><a href="/" title="" class="nav-link reddot">首页</a></li><li class="nav-link-item"><a href="/navigation/2/" title="" class="nav-link reddot">合集</a></li><li class="nav-link-item"><a href="/hotsgr.html" title="歌手" class="nav-link reddot">歌手</a></li><li class="nav-link-item"><a href="/keyword.html" title="热搜" class="nav-link reddot">热搜</a></li>
          </ul>
        </div>
      </nav>
    </div>`;
}

// 首页大搜索框
function searchFormHome() {
  return `
    <form name="search" method="get" action="/search.php">
      <div class="input-group mb-2">
        <input type="text" id="s-input" name="q" class="form-control text-center border-primary rounded shadow-sm" placeholder="请输入歌名或歌手名">
        <div id="invalid-msg" class="invalid-feedback"></div>
      </div>
      <button class="btn btn-primary shadow-sm rounded-sm btn-block mb-1" id="s-btn" type="submit"> <span id="search">搜索 <i class="fa fa-search"></i></span> </button>
    </form>`;
}

// 内页行内搜索框
function searchFormInner(q = '') {
  return `
        <form name="search" method="get" action="/search.php">
      <div class="input-group mb-2 search-row"> <b class="search-img"></b>
        <input type="text" class="form-control text-muted border border-info rounded-left" id="s-input-line" placeholder=""
          name="q" value="${esc(q)}">
        <div class="input-group-append">
          <button class="btn btn-primary shadow-sm rounded-sm btn-block mb-1" id="s-btn" type="submit"> <span id="search">搜索 <i class="fa fa-search"></i></span> </button>
        </div>
      </div>
</form>`;
}

function footer() {
  return `  <footer class="bg-dark text-white text-center mt-4" style="line-height: 1.5rem; font-size:14px;">
    <div></div>
    <div>Copyright Your WebSite.Some Rights Reserved.MyFreeMp3音乐官网-mp3歌曲下载-myfreemp3在线音乐免费下载</div>
  </footer>`;
}

// 排行榜表格（排名 + 歌曲名）
function rankTable(items, limit = 10) {
  const rows = items.slice(0, limit).map((x, i) => `
                <tr>
                  <th scope="row"><span class="badge badge-pill  badge-info ">${i + 1}</span> </th>
                  <td class="tdovhd">
                    <a href="/library/${x.id}.html" title="${esc(x.title)}" target="_blank" style=" overflow:hidden">${esc(x.title)}</a>
                  </td>
                </tr>`).join('');
  return `
            <table class="table">
              <thead class="thead-light">
                <tr>
                  <th scope="col" width="48" style="white-space:nowrap;">排名</th>
                  <th scope="col">歌曲名</th>
                </tr>
              </thead>
              <tbody>${rows}
              </tbody>
            </table>`;
}

// ---------- 首页 ----------

function homePage() {
  const hotTags = seed.hot_tags.map(t =>
    `                                 <a href="/library/${t.id}.html" target="_blank" style="color:${t.color};font-size: .9rem;">
                <strong>${esc(t.title)}&nbsp;&nbsp;&nbsp;</strong>
            </a>`).join('\n');

  const latest = seed.latest.map(x =>
    `         
        <div class="row mb-1 new-musics">
            <div class="col-12">
                <a href="/library/${x.id}.html" title="${esc(x.title)}" 
                   class="border-top-0 border-left-0 border-right-0 list-group-item list-group-item-action pl-0 text-primary d-flex justify-content-between align-items-center py-2" target="_blank" style="overflow: hidden;">
                    <div class="text-truncate limited-text" style="max-width: calc(100% - 80px);">
                        ${esc(x.title)}                    </div>
                    <span style="color: #fb430a;font-weight: bold;font-size: .85rem; flex-shrink: 0;">
                        ${esc(x.date)}                    </span>
                </a>
            </div>
        </div>`).join('\n');

  return `${head({
    title: SITE_TITLE,
    keywords: 'myfreemp3,音乐下载,mp3音乐下载,mp3免费下载,歌曲下载',
    description: 'myfreemp3是一个提供免费音乐在线服务的平台，其形态包括网站与移动端软件，myfreemp3全面支持高品质音乐下载、mp3音乐下载，界面简洁，操作方便。',
  })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}

${searchFormHome()}

    <div class="card shadow-sm mb-1">
      <div class="card-body">
        <h6 class="card-title">
          <i class="fa fa-fire" style="color: #FF6B6B;"></i> 热门音乐
          <small>
            <a class="float-right text-muted" href="/viewmor.html" rel="nofollow">
              更多
              <i class="fa fa-angle-right"></i>
            </a>
          </small>
        </h6>
        <p class="card-text">
        <div class="right hot-tags" style="width:100%">
${hotTags}
        </div>
      </div>
    </div>
    <div class="card mb-1">
    <div class="card-body">
        <h6 class="card-title">
            <i class="fa fa-history" style="color: #FF6B6B;"></i>
            最近更新
                <small>
                    <a class="float-right text-muted" href="/navigation/1/" target="_blank">更多 <i class="fa fa-angle-right"></i></a>
                </small>            
        </h6>
    <div class="latest-articles">
${latest}
    </div>
    </div>
 </div>    

    <div class="row">
      <div class="col-md-6 mb-1">
        <div class="card shadow-sm">
          <div class="card-body">
            <h6 class="card-title">
              <i class="fa fa-bar-chart"></i>
              推荐歌曲排行
              <small>
                <a class="float-right text-muted" href="/navigation/1/" title="推荐歌曲排行" target="_blank" rel="nofollow">
                  更多
                  <i class="fa fa-angle-right"></i>
                </a>
              </small>
            </h6>
            <p class="card-text">
            ${rankTable(seed.rank_recommend)}
            </p>
          </div>
        </div>
      </div>
      <div class="col-md-6 mb-1">
        <div class="card shadow-sm">
          <div class="card-body">
            <h6 class="card-title"> <i class="fa fa-bar-chart"></i> 热门歌曲排行<small>
                <a class="float-right text-muted" href="/down.html" title="更多热门歌曲排行" target="_blank" rel="nofollow">更多 <i class="fa fa-angle-right"></i>
                </a>
              </small>
            </h6>
            <p class="card-text">
            ${rankTable(seed.rank_hot)}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 搜索页 ----------

function highlight(title, q) {
  const idx = title.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0 || !q) return esc(title);
  return esc(title.slice(0, idx)) + '<strong>' + esc(title.slice(idx, idx + q.length)) + '</strong>' + esc(title.slice(idx + q.length));
}

function pagination(base, page, totalPages) {
  if (totalPages <= 1 && page <= 1) return '';
  const items = [];
  items.push(page <= 1
    ? '    <li class="disabled"><span>&laquo;</span></li>'
    : `    <li><a href="${base}&page=${page - 1}">&laquo;</a></li>`);
  const show = [];
  for (let p = 1; p <= Math.min(totalPages, 4); p++) show.push(p);
  for (const p of show) {
    items.push(p === page
      ? `    <li class="active"><span>${p}</span></li>`
      : `    <li><a href="${base}&page=${p}">${p}</a></li>`);
  }
  if (totalPages > 4) items.push('    <li class="disabled"><span>...</span></li>');
  items.push(page >= totalPages
    ? '    <li class="disabled"><span>&raquo;</span></li>'
    : `    <li><a href="${base}&page=${page + 1}">&raquo;</a></li>`);
  return `
          <div class="pagebar">
            <ul class="pagination">
${items.join('\n')}
</ul>
          </div>`;
}

function searchPage(query, results, page, perPage = 20) {
  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  page = Math.min(Math.max(1, page), totalPages);
  const pageItems = results.slice((page - 1) * perPage, page * perPage);

  const rows = pageItems.map(s => `
                    <div class="row">
            <div class="col-35 col-content"> <a href="/library/${s.id}.html" class="text-primary font-weight-bold" target="_blank" title="${highlight(s.title, query)} MP3歌曲免费下载">${highlight(s.title, query)} </a> </div>
            <div class="text-success col-34 col-content"> </div>
            <div class="col-33 col-content text-right"> <a href="/library/${s.id}.html" target="_blank" title="${highlight(s.title, query)} MP3歌曲免费下载"><u>下载</u></a> </div>
          </div>`).join('\n');

  const hotTags = seed.keywords.slice(0, 13).map(k =>
    `                                <li><a href="/search.php?q=${encodeURIComponent(k)}" title="${esc(k)}" class="tags2">${esc(k)}</a></li>`).join('\n');

  return `${head({ title: `搜索&nbsp;"${esc(query)}"_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <meta name="robots" content="noindex,nofollow,noarchive" />

${searchFormInner()}

    
    <div class="card mb-1">
      <div class="card-body" style="min-height:200px;">
        <div class="card-title clearfix font-weight-bolder">
          <h1 class="d-inline-block" style="font-size: 1rem">
            <mark>${esc(query)}</mark>
          </h1>
          <span>搜索结果</span> <small class="float-right badge badge-pill badge-warning ">共 ${total} 条</small>
        </div>
        <div class="card-text">
          <div class="row mb-3">
            <div class="col-35"><i class="fa fa-music"></i> 歌曲</div>              
            <div class="col-34"><i class=""></i> </div>
            <div class="col-33 text-right">操作</div>
          </div>${rows || '\n                    <div class="row"><div class="col-35 col-content">没有找到相关歌曲，换个关键词试试吧。</div></div>'}
                    ${pagination(`/search.php?q=${encodeURIComponent(query)}`, page, totalPages)}
        </div>
      </div>
    </div>
    <div class="card shadow-sm mb-1">
      <div class="card-body" style="min-height:300px;">
        <h6 class="card-title"> <i class="fa fa-history"></i> 热门搜索 <small> <a class="float-right text-muted" href="/keyword.html" title="更多热门搜索"> 更多 <i class="fa fa-angle-right"></i> </a> </small> </h6>
        <p class="card-text">
        <div class="right " style="width:100%">
          <dl id="divhottag">
            <dd class="function_c">
              <ul style="margin-left:1.5%">
${hotTags}
                              </ul>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 歌曲详情页 ----------

function songPage(song) {
  const { id, title, artist, song: songName, cover, lyrics } = song;
  const desc = `<strong>${esc(songName)}${artist ? '-' + esc(artist) : ''}</strong>：${esc(songName)}歌曲下载_MP3音乐免费下载${artist ? '，歌手:' + esc(artist) : ''}，语种:国语，同时网站提供${esc(songName)}${artist ? '-' + esc(artist) : ''}的QQ空间背景音乐歌曲链接，把这首歌曲的MP3链接地址推荐给你的朋友，可以让他们免费获得本歌曲音乐外链。`;

  const recommend = seed.rank_hot.slice(0, 8).map((x, i) => `
                        <tr>
              <th scope="row" width="48"><span class="badge badge-pill    badge-warning     badge-info   ">${i + 1}</span> </th>
              <td style="white-space:nowrap;">
                <a href="/library/${x.id}.html" title="${esc(x.title)}" target="_blank" style="white-space:nowrap; text-overflow:ellipsis; max-width:200px; display:inline-block;">${esc(x.title)}</a>
              </td>
            </tr>`).join('');

  return `${head({
    title: `${title}.mp3免费在线下载播放_搜歌找词来myfreemp3音乐网`,
    keywords: `${title},myfreemp3,mp3音乐下载`,
    description: `${title}mp3歌曲：${title}mp3下载，myfreemp3提供《${title}》mp3音乐下载外链，${title}LRC歌词下载；搜歌找词来myfreemp3音乐网。`,
    extraCss: `  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css">`,
    extraHead: `  <script src="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/lib/browser.min.js" type="application/javascript"></script>
  <script type="application/javascript">
  var bloghost = window.location.origin + '/';
  </script>`,
  })}

<body>
  <div class="container" style="max-width: 960px">

${navbar()}
${searchFormInner()}

    
    <div class="card shadow-sm mb-3">
      <div class="card-body" style="padding:1.25rem 0.5rem;">
        <div style="width:100%; text-align:center; overflow:hidden; ">
          <h1 style="font-size:26px; font-weight:blod;">${esc(title)}歌曲免费下载</h1>
        </div>
        <div class="container" style="margin-bottom:20px;">
          <div id="musiconlineplay" class="aplayer"></div>
        </div>
      </div>
    </div>

        <div class="card shadow-sm mb-2">
      <div class="card-body">
        <h5 class="card-title"> <i class="fa fa-file-text-o input-group-text"></i> 《${esc(title)}》歌曲详情</h5>
            <p style="text-indent: 2em;">${desc}</p>${cover ? `<p style="text-align: center;"><img class="ue-image" src="${esc(cover)}" width="200" height="200"/></p>` : ''}${lyrics ? `<p style="text-indent: 2em;"><span style="text-indent: 2em;">${esc(lyrics)}</span></p>` : ''}<h5 class="card-title"><em class="fa fa-download input-group-text"></em> 下载地址：</h5><p><div class="xc_wsee_hidecontent xc_wsee_hidecontent_is" id="dl-hidden" data-aid="${esc(id)}">此为隐藏内容，需人机验证后查看下载！</div></p>
        <div id="dl-content" style="display:none;">
          <a class="dl-link" id="dl-mp3" href="#" target="_blank" rel="nofollow"><i class="fa fa-cloud-download"></i><span></span></a>
          <a class="dl-link" id="dl-mp3-2" href="#" target="_blank" rel="nofollow"><i class="fa fa-link"></i><span></span></a>
          <div id="qrcode"></div>
          <p style="font-size:12px;color:#999;text-align:center;">手机扫码，随时随地听</p>
        </div>
      </div>
    </div>
    
    
    <div class="card shadow-sm mb-2">
      <div class="card-body">
        <h6 class="card-title"> <img src="/projects/source_code/picture/like.png" alt="热门歌曲推荐" onerror="this.style.display='none'"> 热门推荐</h6>
        <table class="table">
          <tbody>${recommend}
                      </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="xc_wsee_load" id="verify-mask">
    <div class="xc_wsee_alert">
      <div class="tip">人机验证</div>
      <button class="verify-btn" id="verify-btn">点击完成验证</button>
      <div class="sub">验证通过后显示下载地址</div>
    </div>
  </div>
  <script>
    var ap1 = new APlayer({
      element: document.getElementById('musiconlineplay'),
      narrow: false,
      autoplay: false,
      showlrc: false,
      music: {
        title: ${JSON.stringify(title)},
        author: ${JSON.stringify(artist || '')},
        url: ${JSON.stringify(proxyMediaUrl(title))},
        pic: '/projects/source_code/picture/logo.png'
      }
    });

    (function () {
      var mask = document.getElementById('verify-mask');
      var hiddenBox = document.getElementById('dl-hidden');
      var btn = document.getElementById('verify-btn');
      var aid = hiddenBox.getAttribute('data-aid');

      hiddenBox.addEventListener('click', function () {
        mask.style.display = 'block';
      });
      mask.addEventListener('click', function (e) {
        if (e.target === mask) mask.style.display = 'none';
      });
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = '验证中…';
        fetch('/api/reveal/' + encodeURIComponent(aid), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) throw new Error('verify failed');
            var links = data.links;
            var a1 = document.getElementById('dl-mp3');
            a1.href = links[0].url;
            a1.querySelector('span').textContent = links[0].label;
            var a2 = document.getElementById('dl-mp3-2');
            a2.href = links[1].url;
            a2.querySelector('span').textContent = links[1].label;
            mask.style.display = 'none';
            hiddenBox.style.display = 'none';
            document.getElementById('dl-content').style.display = 'block';
            if (window.QRCode && QRCode.toCanvas) {
              QRCode.toCanvas(location.href, { width: 150, margin: 2 }, function (err, canvas) {
                if (!err) document.getElementById('qrcode').appendChild(canvas);
              });
            }
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = '验证失败，请重试';
          });
      });
    })();
  </script>
${footer()}
</body>

</html>`;
}

// ---------- 合集页 /navigation/2/ ----------

function collectionsPage() {
  const items = seed.collections.map(x => `
                            <li class=" list-group-item list-group-item-action dblistys">
                <a href="/library/${x.id}.html" style="width:100%;" title="${esc(x.title)}">
                  <i class="fa fa-music"></i> ${esc(x.title)} <i class="d-none d-md-inline-block dbicoys">
                    <i class="fa fa-download"> </i> 下载 </i>
                </a>
              </li>`).join('');

  return `${head({ title: `合集_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <div class="card shadow-sm">
      <div class="card-body">
        <div class="jumbotron" style="background-color:#7C00F9;height:100px;padding:30px;">
          <h1 class="text-light text-center" style="font-size: 1.75rem">热门歌曲打包下载 </h1>
        </div>

${searchFormInner()}

    
        <div class="dblist_h">
          <div class="card-body">

            <ul class="list-group list-group-flush">${items}
              <div class="pagebar mt-5">
                <ul class="pagination">
    <li class="disabled"><span>&laquo;</span></li>
    <li class="active"><span>1</span></li>
    <li class="disabled"><span>&raquo;</span></li>
</ul>
              </div>

            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 歌手页 /hotsgr.html ----------

function artistsPage() {
  const rows = seed.artists.map((name, i) => `
            <tr>
              <th scope="row"><span class="badge badge-pill ${i === 0 ? 'badge-success' : 'badge-info'}  ">${i + 1}</span> </th>
              <td><a href="/search.php?q=${encodeURIComponent(name)}" title="${esc(name)}_歌曲免费下载" >${esc(name)}_歌曲免费下载</a></td>
            </tr>`).join('\n              ');

  return `${head({ title: `歌手_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <div class="card shadow-sm">
      <div class="card-body">
        <div class="jumbotron" style="background-color:#F06">
          <h1 class="text-light text-center" style="font-size: 1.75rem"> 热门歌手排行(Top50) </h1>
        </div>
        
${searchFormInner()}

    
        <table class="table table-striped table-borderless">
          <thead class="thead-light">
            <tr>
              <th scope="col" width="48" style="white-space:nowrap;">排名</th>
              <th scope="col">歌手名</th>
            </tr>
          </thead>
          <tbody>
              ${rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 热搜页 /keyword.html ----------

function keywordsPage() {
  const rows = seed.keywords.map((k, i) => `
                        <tr>
              <th scope="row"><span class="badge badge-pill  ${i === 0 ? 'badge-success' : 'badge-info'} ">${i + 1}</span> </th>
              <td><a href="/search.php?q=${encodeURIComponent(k)}" title="${esc(k)}" rel="nofollow">${esc(k)}</a></td>
            </tr>`).join('');

  return `${head({ title: `热搜_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <div class="card shadow-sm">
      <div class="card-body">
        <div class="jumbotron" style="background-color:#93C">
          <h1 class="text-light text-center" style="font-size: 1.75rem"> 关键词搜索排行(Top50) </h1>
        </div>
${searchFormInner()}

    
        <table class="table table-striped table-borderless">
          <thead class="thead-light">
            <tr>
              <th scope="col" width="48" style="white-space:nowrap;">排名</th>
              <th scope="col">关键词</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 最近更新 /navigation/1/ ----------

function recentPage() {
  const rows = seed.nav1.map(x => `
                    <a href="/library/${x.id}.html" class="text-primary font-weight-bold"  title="mp3歌曲免费下载">
            <div class="row">
              <div class="col-25 col-content">${esc(x.title)}</div>
              <div class="col-32 col-content">${esc(x.quality || '高品质')}</div>
              <div class="col-32 col-content text-right"> ${esc(x.date || '')}</div>
            </div>
          </a>`).join('');

  return `${head({ title: `最近更新_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <div class="card shadow-sm">
      <div class="card-body">
        <div class="jumbotron" style="background-color:#17a2b8;height:100px;padding:30px;">
          <h1 class="text-light text-center" style="font-size: 1.75rem">最近更新 </h1>
        </div>
${searchFormInner()}
        <div class="card-text">
          <div class="row mb-3 ">
            <div class="col-25 col-title nopc"><i class="fa fa-music"></i> 歌曲名</div>
            <div class="col-32 col-title nopc"><i class="fa fa-file-audio-o"></i> 音质</div>
            <div class="col-32 col-title text-right nopc"><i class="fa fa-clock-o"></i> 日期</div>
          </div>${rows}
        </div>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 热门音乐更多 /viewmor.html ----------

function viewmorPage() {
  const rows = seed.viewmor.map((x, i) => `
                        <tr>
              <th scope="row" width="48"><span class="badge badge-pill    badge-warning     badge-info   ">${i + 1}</span> </th>
              <td style="white-space:nowrap;">
                <a href="/library/${x.id}.html" title="${esc(x.title)}" target="_blank" style="white-space:nowrap; text-overflow:ellipsis; max-width:200px; display:inline-block;">${esc(x.title)}</a>
              </td>
            </tr>`).join('');

  return `${head({ title: `热门音乐_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <div class="card shadow-sm">
      <div class="card-body">
        <div class="jumbotron" style="background-color:#FF6B6B;height:100px;padding:30px;">
          <h1 class="text-light text-center" style="font-size: 1.75rem">热门音乐 </h1>
        </div>
${searchFormInner()}
        <table class="table">
          <tbody>${rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

// ---------- 热门歌曲排行 /down.html ----------

function downPage() {
  const rows = seed.down.map((x, i) => `
                        <tr>
              <th scope="row" width="48"><span class="badge badge-pill    badge-warning     badge-info   ">${i + 1}</span> </th>
              <td style="white-space:nowrap;">
                <a href="/library/${x.id}.html" title="${esc(x.title)}" target="_blank" style="white-space:nowrap; text-overflow:ellipsis; max-width:200px; display:inline-block;">${esc(x.title)}</a>
              </td>
            </tr>`).join('');

  return `${head({ title: `热门歌曲排行_${SITE_TITLE}` })}

<body>
  <div class="container" style="max-width: 960px">
${navbar()}    <div class="card shadow-sm">
      <div class="card-body">
        <div class="jumbotron" style="background-color:#fb430a;height:100px;padding:30px;">
          <h1 class="text-light text-center" style="font-size: 1.75rem">热门歌曲排行 </h1>
        </div>
${searchFormInner()}
        <table class="table">
          <tbody>${rows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
${footer()}
</body>

</html>`;
}

module.exports = {
  homePage,
  searchPage,
  songPage,
  collectionsPage,
  artistsPage,
  keywordsPage,
  recentPage,
  viewmorPage,
  downPage,
};
