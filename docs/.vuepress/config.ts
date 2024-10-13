/**
 * 提示：如您想使用JS版本的配置文件可參考：https://github.com/xugaoyi/vuepress-theme-vdoing/tree/a2f03e993dd2f2a3afdc57cf72adfc6f1b6b0c32/docs/.vuepress
 */
// import { resolve } from 'path';
import { defineConfig4CustomTheme, UserPlugins } from 'vuepress/config';
import { VdoingThemeConfig } from 'vuepress-theme-vdoing/types';
import dayjs from 'dayjs';
import htmlModules from './config/htmlModules'; // 自定義插入的html塊
import OpenGraph from './plugins/opengraph';
import GtagPlugin from './plugins/gtag';

const DOMAIN_NAME = 'blog.louisif.me'; // 域名 (不帶https)
const WEB_SITE = `https://${DOMAIN_NAME}`; // 網址

const DESCRIPTION =
  '在學習和踩坑的過程中留下一點記錄。你好，我是Louis。本部落格內容包含網路、開發技術還有各種踩坑記錄的分享。';

export default defineConfig4CustomTheme<VdoingThemeConfig>({
  theme: 'vdoing', // 使用npm主題包
  // theme: resolve(__dirname, '../../vdoing'), // 使用在地主題包

  description: DESCRIPTION,
  locales: {
    '/': {
      lang: 'zh-TW',
      title: "Louis Li's Blog",
      description: DESCRIPTION,
    },
  },
  // base: '/', // 預設'/'。如果你想將你的網站部署到如 https://foo.github.io/bar/，那麼 base 應該被設定成 "/bar/",（否則頁麵將失去樣式等文件）

  // 主題配置
  themeConfig: {
    // 導航配置
    nav: [
      { text: '首頁', link: '/' },
      { text: '分類', link: '/categories/' },
      { text: '標籤', link: '/tags/' },
      { text: 'Archives', link: '/archives/' },
      // {
      //   text: '前端',
      //   link: '/web/', //目錄頁鏈接，此處link是vdoing主題新增的配置項，有二級導航時，可以點選一級導航跳到目錄頁
      //   items: [
      //     // 說明：以下所有link的值隻是在相應md文件頭部定義的永久鏈接（不是什麼特殊編碼）。另外，註意結尾是有斜杠的
      //     {
      //       text: '前端文章',
      //       items: [
      //         { text: 'JavaScript', link: '/pages/8143cc480faf9a11/' },
      //       ],
      //     },
      //     {
      //       text: '學習筆記',
      //       items: [
      //         { text: '《JavaScript教程》', link: '/note/javascript/' },
      //         { text: '《JavaScript高級程式設計》', link: '/note/js/' },
      //         { text: '《ES6 教程》', link: '/note/es6/' },
      //         { text: '《Vue》', link: '/note/vue/' },
      //         { text: '《React》', link: '/note/react/' },
      //         {
      //           text: '《TypeScript 從零實現 axios》',
      //           link: '/note/typescript-axios/',
      //         },
      //         {
      //           text: '《Git》',
      //           link: '/note/git/',
      //         },
      //         {
      //           text: 'TypeScript',
      //           link: '/pages/51afd6/',
      //         },
      //         {
      //           text: 'JS設計模式總結',
      //           link: '/pages/4643cd/',
      //         },
      //       ],
      //     },
      //   ],
      // },
      // {
      //   text: '頁麵',
      //   link: '/ui/',
      //   items: [
      //     { text: 'HTML', link: '/pages/8309a5b876fc95e3/' },
      //     { text: 'CSS', link: '/pages/0a83b083bdf257cb/' },
      //   ],
      // },
      // {
      //   text: '技術',
      //   link: '/technology/',
      //   items: [
      //     { text: '技術文檔', link: '/pages/9a7ee40fc232253e/' },
      //     { text: 'GitHub技巧', link: '/pages/4c778760be26d8b3/' },
      //     { text: 'Nodejs', link: '/pages/117708e0af7f0bd9/' },
      //     { text: '部落格搭建', link: '/pages/41f87d890d0a02af/' },
      //   ],
      // },
      // {
      //   text: '更多',
      //   link: '/more/',
      //   items: [
      //     { text: '學習', link: '/pages/f2a556/' },
      //     { text: '麵試', link: '/pages/aea6571b7a8bae86/' },
      //     { text: '心情雜貨', link: '/pages/2d615df9a36a98ed/' },
      //     { text: '實用技巧', link: '/pages/baaa02/' },
      //     { text: '友情鏈接', link: '/friends/' },
      //   ],
      // },
      // { text: '關於', link: '/about/' },
      // {
      //   text: '收藏',
      //   link: '/pages/beb6c0bd8a66cea6/',
      //   // items: [
      //   //   { text: '網站', link: '/pages/beb6c0bd8a66cea6/' },
      //   //   { text: '資源', link: '/pages/eee83a9211a70f9d/' },
      //   //   { text: 'Vue資源', link: '/pages/12df8ace52d493f6/' },
      //   // ],
      // },
      // {
      //   text: '索引',
      //   link: '/archives/',
      //   items: [
      //     { text: '分類', link: '/categories/' },
      //     { text: '標簽', link: '/tags/' },
      //     { text: '歸檔', link: '/archives/' },
      //   ],
      // },
    ],
    sidebarDepth: 2, // 側邊欄顯示深度，預設1，最大2（顯示到h3標題）
    logo: '/img/logo512.png', // 導航欄logo
    repo: 'gamerslouis/gamerslouis.github.io', // 導航欄右側生成Github鏈接
    searchMaxSuggestions: 10, // 搜索結果顯示最大數
    lastUpdated: '上次更新', // 開啓更新時間，並配置前綴文字   string | boolean (取值為git提交時間)

    // docsDir: 'docs', // 編輯的檔案夾
    // docsBranch: 'master', // 編輯的文件所在分支，預設master。 註意：如果你的分支是main則修改為main
    editLinks: false, // 啓用編輯
    // editLinkText: '編輯',

    //*** 以下是Vdoing主題相關配置，文檔：https://doc.xugaoyi.com/pages/a20ce8/ ***//

    // category: false, // 是否打開分類功能，預設true
    // tag: false, // 是否打開標簽功能，預設true
    // archive: false, // 是否打開歸檔功能，預設true
    categoryText: '隨筆', // 碎片化文章（_posts檔案夾的文章）預設生成的分類值，預設'隨筆'

    // pageStyle: 'line', // 頁麵風格，可選值：'card'卡片 | 'line' 線（未設定bodyBgImg時才生效）， 預設'card'。 說明：card時背景顯示灰色襯托出卡片樣式，line時背景顯示純色，並且部分模塊帶線條邊框

    // bodyBgImg: [
    //   'https://fastly.jsdelivr.net/gh/xugaoyi/image_store/blog/20200507175828.jpeg',
    //   'https://fastly.jsdelivr.net/gh/xugaoyi/image_store/blog/20200507175845.jpeg',
    //   'https://fastly.jsdelivr.net/gh/xugaoyi/image_store/blog/20200507175846.jpeg'
    // ], // body背景大圖，預設無。 單張圖片 String | 多張圖片 Array, 多張圖片時隔bodyBgImgInterval切換一張。
    // bodyBgImgOpacity: 0.5, // body背景圖透明度，選值 0.1~1.0, 預設0.5
    // bodyBgImgInterval: 15, // body多張背景圖時的切換間隔, 預設15，單位s
    // titleBadge: false, // 文章標題前的圖示是否顯示，預設true
    // titleBadgeIcons: [ // 文章標題前圖示的地址，預設主題內置圖示
    //   '圖示地址1',
    //   '圖示地址2'
    // ],
    // contentBgStyle: 1, // 文章內容塊的背景風格，預設無. 1 方格 | 2 橫線 | 3 豎線 | 4 左斜線 | 5 右斜線 | 6 點狀

    // updateBar: { // 最近更新欄
    //   showToArticle: true, // 顯示到文章頁底部，預設true
    //   moreArticle: '/archives' // “更多文章”跳轉的頁麵，預設'/archives'
    // },
    // rightMenuBar: false, // 是否顯示右側文章大綱欄，預設true (屏寬小於1300px下無論如何都不顯示)
    // sidebarOpen: false, // 初始狀態是否打開左側邊欄，預設true
    // pageButton: false, // 是否顯示快捷翻頁按鈕，預設true

    // 預設外觀模式（用戶未在頁麵手動修改過模式時才生效，否則以用戶設定的模式為準），可選：'auto' | 'light' | 'dark' | 'read'，預設'auto'。
    // defaultMode: 'auto',

    // 側邊欄  'structuring' | { mode: 'structuring', collapsable: Boolean} | 'auto' | <自定義>    溫馨提示：目錄頁數據依賴於結構化的側邊欄數據，如果你不設定為'structuring',將無法使用目錄頁
    sidebar: 'structuring',

    // 文章預設的作者信息，(可在md文件中單獨配置此信息) string | {name: string, link?: string}
    author: {
      name: 'Louis', // 必需
      link: 'https://github.com/gamerslouis', // 可選的
    },

    // 博主信息 (顯示在首頁側邊欄)
    blogger: {
      avatar: '/img/avatar.jpg',
      name: 'Louis Li',
      slogan: '努力畢業的菸酒生',
    },

    // 社交圖示 (顯示於博主信息欄和頁腳欄。內置圖示：https://doc.xugaoyi.com/pages/a20ce8/#social)
    social: {
      // iconfontCssFile: '//at.alicdn.com/t/xxx.css', // 可選，阿裏圖示庫在線css文件地址，對於主題冇有的圖示可自己添加。阿裏圖片庫：https://www.iconfont.cn/
      icons: [
        {
          iconClass: 'icon-email',
          title: 'Email',
          link: 'mailto:me@louisif.me',
        },
        {
          iconClass: 'icon-github',
          title: 'GitHub',
          link: 'https://github.com/gamerslouis',
        },
        // {
        //   iconClass: 'icon-rss',
        //   title: 'RSS',
        //   link: '/atom.xml',
        // },
      ],
    },

    // 頁腳信息
    footer: {
      createYear: 2022, // 部落格創建年份
      copyrightInfo: 'Louis Li', // 部落格版權信息、備案信息等，支援a標簽或換行標簽</br>
    },

    // 擴展自動生成frontmatter。（當md文件的frontmatter不存在相應的字段時將自動添加。不會覆蓋已有的數據。）
    extendFrontmatter: {
      author: {
        name: 'Louis',
        link: 'https://github.com/gamerslouis',
      },
    },

    // 自定義hmtl(廣告)模塊
    htmlModules,
  },

  // 註入到頁麵<head>中的標簽，格式[tagName, { attrName: attrValue }, innerHTML?]
  head: [
    ['link', { rel: 'icon', href: '/img/favicon.ico' }], //favicons，資源放在public檔案夾
    [
      'meta',
      {
        name: 'keywords',
        content:
          '個人技術部落格,網路,Kubernetes,Linux',
      },
    ],
    ['meta', { name: 'theme-color', content: '#11a8cd' }], // 移動瀏覽器主題顔色
    ['meta', { name: 'charset', content: 'utf-8' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }],

  ],

  // 插件配置
  plugins: <UserPlugins>[
    [
      'sitemap', // 網站地圖
      {
        hostname: WEB_SITE,
        example: ['/404.html']
      },
    ],

    // 全文搜索。 ⚠️註意：此插件會在打開網站時多加載部分js文件用於搜索，導緻初次訪問網站變慢。如在意初次訪問速度的話可以不使用此插件！（推薦：vuepress-plugin-thirdparty-search）
    // 'fulltext-search',

    // 可以添加第三方搜索鏈接的搜索框（繼承原官方搜索框的配置參數）
    [
      'thirdparty-search',
      {
        thirdparty: [
          {
            title: '透過 Google 搜索',
            frontUrl: 'http://google.com/search?as_q=', // 搜索鏈接的前麵部分
            behindUrl: '&as_sitesearch=' + DOMAIN_NAME, // 搜索鏈接的後麵部分，可選，預設 ''
          },
        ],
      },
    ],
    [
      'one-click-copy', // 代碼塊複製按鈕
      {
        copySelector: ['div[class*="language-"] pre', 'div[class*="aside-code"] aside'], // String or Array
        copyMessage: '複製成功', // default is 'Copy successfully and then paste it for use.'
        duration: 1000, // prompt message display time.
        showInMobile: false, // whether to display on the mobile side, default: false.
      },
    ],

    [
      'demo-block', // demo演示模塊 https://github.com/xiguaxigua/vuepress-plugin-demo-block
      {
        settings: {
          // jsLib: ['http://xxx'], // 在線示例(jsfiddle, codepen)中的js依賴
          // cssLib: ['http://xxx'], // 在線示例中的css依賴
          // vue: 'https://fastly.jsdelivr.net/npm/vue/dist/vue.min.js', // 在線示例中的vue依賴
          jsfiddle: false, // 是否顯示 jsfiddle 鏈接
          codepen: true, // 是否顯示 codepen 鏈接
          horizontal: false, // 是否展示為橫嚮樣式
        },
      },
    ],
    [
      'vuepress-plugin-zooming', // 放大圖片
      {
        selector: '.theme-vdoing-content img:not(.no-zoom)', // 排除class是no-zoom的圖片
        options: {
          bgColor: 'rgba(0,0,0,0.6)',
        },
      },
    ],
    [
      'vuepress-plugin-comment', // 評論
      {
        choosen: 'gitalk',
        options: {
          clientID: '7ecfb7f57bf114d2d91a',
          clientSecret: '946b4c767f9744d9d2a4179929feaabc84b2186c',
          repo: 'gamerslouis.github.io', // GitHub 倉庫
          owner: 'gamerslouis', // GitHub倉庫所有者
          admin: ['gamerslouis'], // 對倉庫有寫權限的人
          // distractionFreeMode: true,
          pagerDirection: 'last', // 'first'正序 | 'last'倒序
          id: '<%- (frontmatter.permalink || frontmatter.to.path).slice(-16) %>', //  頁麵的唯一標識,長度不能超過50
          title: '「留言」<%- frontmatter.title %>', // GitHub issue 的標題
          labels: ['Gitalk', 'Comment'], // GitHub issue 的標簽
          body: '頁面：<%- window.location.origin + (frontmatter.to.path || window.location.pathname) %>', // GitHub issue 的內容
        },
      },
    ],
    [
      '@vuepress/last-updated', // "上次更新"時間格式
      {
        transformer: (timestamp, lang) => {
          return dayjs(timestamp).format('YYYY/MM/DD');
        },
      },
    ],
    ['vuepress-plugin-pangu'],
    [
      OpenGraph,
      {
        defaultImgPath: '/img/og_image.png',
      },
    ],
    [
      GtagPlugin,
      {
        ga: 'G-79VDS4QY8D'
      }
    ]
  ],

  markdown: {
    lineNumbers: true,
    extractHeaders: ['h2', 'h3', 'h4', 'h5', 'h6'], // 提取標題到側邊欄的級別，預設['h2', 'h3']
  },

  // 監聽文件變化並重新構建
  extraWatchFiles: ['.vuepress/config.ts', '.vuepress/config/htmlModules.ts'],
});
