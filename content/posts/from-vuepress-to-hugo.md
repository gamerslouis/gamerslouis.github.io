---
categories:
  - 部落格
description:
  本文介紹了從 VuePress 遷移到 Hugo 的過程，強調了 Hugo 的快速編譯速度、Golang
  模板的熟悉度、主題擴展的便利性以及內建功能的優勢。選擇了 Blowfish 主題，並詳細說明了安裝、設定、文章搬遷及主題修改的步驟，最終成功建立了一個
  Hugo 靜態部落格。
tags:
  - Hugo
date: 2024-10-17
title: 從 VuePress 跑到 Hugo
---

## 前言

部落格廢棄了一年多的時間，終於有空來好好整理整理我的部落格了。原本是使用 VuePress 來產生我的部落格，但是在這次整理的過程中發現了 VuePress 的一些缺點，想了想，研究了一下現在幾款的 Markdown 靜態網站生成框架，最後決定從 VuePress 搬遷到 Hugo 並使用了 Blowfish 這個主題。

## 起因

大概在兩年前，開始使用 Markdown 生成器來建立靜態部落格。最早有短暫使用 Hexo。後來就接觸到 VuePress 這個框架，發現 Vuepress 能夠直接在頁面裡面寫 Vue.js 來擴充功能，未來能夠比較方便在部落格裡面加一堆功能，所以就跳到 VuePress 了。

但是一直以來這個部落格就有 SEO 的問題，很多頁面沒有辦法被 Google Index。所以這次嘗試要去解決 SEO 相關的問題，為了解決這些問題，需要去修改 VuePress 的 Theme。但是就發現修改 VuePress 的 theme 是一件有點痛苦的事情。因為相對於 Hexo 這種純粹生成靜態網頁的工具，VuePress 使用的是直接建立一個基於 Vue.js 前端框架的網頁，然後每篇文章使用 Server Side Rendering 的方式去產生靜態內容，並且 Theme 也是直接以 Vue module 的方式插入的。這導致 VuePress 框架本身、theme 還有頁面的程式碼全部都會混在一起，導致開發上會有點難除錯。

為了省心，就決定準備從 VuePress 搬遷回 Hexo 這種單純模板式的靜態網頁生成器。在找新主題的過程中就發現了 Hugo 這個基於 Golang 開發的靜態網頁生器，並被它的幾個特性給吸引。

1. 超快的編譯速度：Hugo 是一個使用 Golang 開發的生成器，Hugo 的執行速度非常之快，以我目前 19 篇文章來說，hugo 編譯的時間是 100 ms，基本上是可以順開。原本在 VuePress 就要好幾秒，超級久。
2. Golang 模板：每個框架都提供了模板引擎，來提供對網頁主題及內容客製化的功能。Hexo 使用 ejs 模板引擎來渲染，VuePress 基於前端框架的特性，使用 Vue.js 的程式碼來建立模板。Hugo 則是使用 Golang 本身提供的模板引擎。相較於從來沒用過的 ejs，我對 Golang 的模板引擎比較熟悉。
3. 容易擴展主題：靜態部落格相對來說不是一個很複雜的網站，所以相對於 VuePress 直接提供前端框架的擴充彈性，擴充的容易度對目前的我來說比較重要。Hugo 可以在不修改主題檔案的情況下，很容易地透過額外的檔案來覆蓋主題，修改主題行為和增加功能。
4. 省心的內建功能：Hugo 本身就提供了對 Google Analytics 和 Open Graph 等在 Hexo 和 VuePress 都需要額外模組才能提供的功能。相對來說非常省心。
5. 比較穩定的編譯結果：這個是 VuePress 修改主題的時候的一個小缺點，因為 VuePress 的所有主題和插件本質上都是 JS 程式碼，最後會被 VuePress 編譯成一些 js bundle，通常會是 `assets/js/23.501c2967.js` 這樣的檔案，並且會經過 js uglify 跟 minify。重新編譯後整個檔案就可能亂掉，對於用 Github Page 來管理部落格的我來說，不是很喜歡。

## 主題選擇

跟大部分的靜態部落格生成器一樣，Hugo 也有廣大的開元社群提供了各式各樣的主題，除了從 [hugo 官網](https://themes.gohugo.io/)，以外也從 Github 和 Google 去找了幾個感興趣主題。這邊也順便把這幾個分享給大家。

- [Toha](https://github.com/hugo-toha/toha): Toha 是我找到第一個感興趣的主題，他的首頁很好看，也提供了一些如 Skills、Code Notes 之類我感興趣的功能。可惜的是他只提供了基於 Tag 的分類方式，不支援 Category，所以與我原有的部落格不太相容，文章頁面也設計沒那麼吸引我。
- [blog.coolapso.sh](https://blog.coolapso.sh/): 這個作者最酷的地方是提供了一個假 shell 的形式的[履歷網頁](https://coolapso.sh/)。
- [hexo-theme-next](https://github.com/next-theme/hexo-theme-next): 本來是打算從 VuePress 搬到 Hexo + Next，所以就找到這個把 Hexo Next 主題遷移到 Hugo 的版本。
- [hexo-theme-aomori](https://github.com/lh1me/hexo-theme-aomori): 這個是 Hexo 的主題但是很好看。
- [archie](https://github.com/athul/archie): 經典的極簡主題。
- [hugo-theme-tailwind](https://github.com/tomowang/hugo-theme-tailwind): 基於 tailwind CSS 的主題。想選這個是考慮到如果要修改主題、增加頁面，有 tailwind CSS 可能會比較好改。
- [hugo-theme-bootstrap](https://github.com/razonyang/hugo-theme-bootstrap): 另外一個基於 BootStrap。

最後，我選擇的是 [Blowfish](https://blowfish.page/)這個主題，blowfish 很好看，而且功能完善，基本上可以滿足我所有功能需求，所以後期要額外加的功能也比較少，不用花太多時間。

## 專案初始化

### 安裝 Hugo

因為 Hugo 是基於 Golang 開發的，比較好的安裝方式是安裝 Golang 來編譯最新版本。

```shell
sudo su
wget https://go.dev/dl/go1.23.2.linux-amd64.tar.gz
rm -rf /usr/local/go && tar -C /usr/local -xzf go1.23.2.linux-amd64.tar.gz

# Add to .bashrc/.zshrc
export PATH=$PATH:/usr/local/go/bin
```

安裝完 Golang 後就可以安裝 hugo。

```shell
go install -tags extended github.com/gohugoio/hugo@latest
# 如果用 non root 安裝會在 $HOME/go/bin/
# 也需要加到環境變數
# export PATH=$PATH:$HOME/go/bin/
```

### 建立部落格及安裝主題

接著初始化 hugo 專案。

```shell
hugo new site <folder>
cd <folder>
```

在 hugo 架構下，主題要放在 `themes` 目錄下，所以要將主題 clone 到 `themes/blowfish`。

```shell
git init
git submodule add -- https://github.com/nunocoracao/blowfish.git themes/blowfish
```

接著要將主題提供的設定檔複製到部落格設定檔目錄之下，也就是`config/_default`。

```shell
rm hugo.toml
mkdir -p config/_default/
cp themes/blowfish/config/_default/* config/_default/
```

接著要修改 `config/_default/hugo.toml`，把`theme`的註解`#`拿掉，主題才能生效。

```toml
# theme = "blowfish" # UNCOMMENT THIS LINE
```

然後啟動 `hugo`的測試伺服器。

```shell
hugo server
```

就能訪問到空白的主題網頁了！

![](/img/pages/29425379a3e39403ff1af9ea44e92cf5.png)

## 設定與搬遷

接著就要把網站變成我們想要的樣子，然後把文章搬過來了。修改設定的時候，可以把網站用 `hugo server` 跑起來，hugo 偵測到檔案變更會自己重編譯，而且因為 Hugo 編譯可很快，可以即時看到修改結果。

### 設定主題

網頁的自訂化主要還是由主題提供的設定，前面已經把主題的設定檔複製到 `config/_default` 目錄下，接下來就只要一個接著一個修改。

```shell
# ls config/_default/
hugo.toml  languages.en.toml  markup.toml  menus.en.toml  module.toml  params.toml
```

因為 blowfish 支援多語系網站，所以在設定部分 `languages` 跟 `memus` 這兩個檔案是語系獨立的，因為我要主要是繁體中文。所以把原有的英文語系設定檔案刪掉，改成中文。

```shell
# ls config/_default/
hugo.toml  languages.zh-tw.toml  markup.toml  menus.zh-tw.toml  module.toml  params.toml
```

接下來就是打開每個設定檔，參考主題的說明文件，把網站調整成自己想要的樣子。

- [Getting Started · Blowfish](https://blowfish.page/docs/getting-started/)
- [Configuration · Blowfish](https://blowfish.page/docs/configuration/)

因為大部分的設定內容都只需要看著設定檔和說明文件設定，這邊就不贅述。

### 文章搬遷

文章搬遷反而是整個過程中最簡單的步驟，Hugo 完全兼容我文章原有的 front matter。所以只要把文章複製到 `content/posts` 目錄下，就可以完成搬遷了。

## 主題修改

### 調整程式碼區塊配色

整體來說，原本 Blowfish 主題的配色就讓我很滿意了，我唯一覺得有問題的地方是程式碼區塊的配色，Blowfish 客製化的語法高量主題好看，但是就不夠清楚，不太好閱讀。

![](/img/pages/c433e6b7d53b378420389b0df086220d.png)

Hugo 利用 [chroma](https://github.com/alecthomas/chroma) 這個工具來產生程式碼區塊，Blowfish 做的事情是透過 CSS 去調整不同關鍵字的配色和區塊底色。因此，可以透過調整 CSS 來修改整個配色。Chroma 內建了許多的[配色主題](https://xyproto.github.io/splash/docs/)，我挑了其中的 onedark 這個主題。

可以直接只用 hugo 指令生成主題的 CSS 設定。

```text
mkdir -p assets/css/
hugo gen hugo gen chromastyles --style=onedark > assets/css/custom.css
```

跟據 Blowfish [文件](https://blowfish.page/docs/advanced-customisation/) ，寫入到 `assets/css/custom.css`的 css 因為檔案順序的關係，優先度比較高，可以直接覆蓋掉主題的 CSS 設定，這樣就不需要直接修改主題的檔案。

![](/img/pages/d4fe7ac2c27f1c80f01e52970ea03227.png)

不過這樣只會修改到淺色模式下的主題，如果要對暗色模式生效，就需要複製一份整個 chroma 的 CSS，然後每個後面添加 `is(.dark *)` 選擇器。

```css
# Light mode .prose .chroma {
  color: #abb2bf;
  background-color: #232631;
}

# Dark mode .prose .chroma:is(.dark *) {
  color: #abb2bf;
  background-color: #232631;
}
```

### 中文化

Blowfish 本來就已經有完整的繁體中文支援，唯一沒支援到的地方是 `/posts`, `/tags`, `/categories`這三個目錄的標題沒有修改。

![](/img/pages/cf58100bbd2f1690706794e807b8d11a.png)

要修改也比較簡單，建立 `content/posts/_index.md`, `content/tags/_index.md`, `content/categories/_index.md` 這三個檔案，然後打上標題即可。

```markdown
---
title: 標籤
---
```

### 修改 404 頁面

接著要調整的是 404 頁面，這是原本的 404 頁面：

![](/img/pages/38c48e0c96ce55d547c23f90b6642260.png)

主要是我想要將我畫的 404 圖片放進來，原本的主題沒有提供在 404 頁面置入圖片的功能，所以需要去修改模板。

這邊就要介紹 hugo 很強大的主題覆蓋功能，當 hugo 需要搜尋一個模板時，會依序在 `layouts`, `themes/xxxx/layouts`去找到對應的檔案。所以當我們想要修改主題模板時，只要將模板複製到 layouts 中修改，就可以在完全不更動主題檔案的情況下完成修改。

```shell
cp themes/blowfish/layouts/404.html layouts
```

然後就可以簡單的置入 404.png。

```html
{{ define "main" }}
<h1 class="mb-3 text-4xl font-extrabold">
  {{ i18n "error.404_title" | emojify }}
</h1>
<div class="prose dark:prose-invert">
  <p>{{ i18n "error.404_description" | emojify }}</p>
</div>
<div
  class="mt-8 mb-12 border border-2 border-neutral-200 dark:border-neutral-700 rounded shadow-2xl"
>
  <img alt="404" src="/404.png" />
</div>
{{ end }}
```

這個圖檔要放在 `static/404.png` ，hugo 在編譯時會自動把 static 目錄中的檔案搬遷到編譯結果

### Logo 大小

另外網站 Logo 的部分也做了調整，原本主題是將 Logo 大小設定成圖檔大小的一半，但是我覺得還是太大了。

![](/img/pages/84f803466c2d11616ea9980adb28a922.png)

所以就一樣，把 Header 對應的模板拿出來然後去修改。在 hugo 的資料夾組織中，組成網頁的元素都會放在 partials 這個目錄下。

```text
mkdir layouts/partials/headers
cp themes/blowfish/layouts/partials/headers/basic
```

直接改成 32X32 即可。

```html
<img
  src="{{ $logo.RelPermalink }}"
  width="32"
  height="32"
  class="logo max-h-[5rem] max-w-[5rem] object-scale-down object-left nozoom"
  alt="{{ .Site.Title }}"
/>
```

### Open Graph Image

另外一個比較大的改動是 open graph image。

Open graph 的功能是提供社群網站顯示的資訊，比如把連結貼到 Facebook 會顯示出一張圖片跟一些簡單的描述。這些是透過特殊的 html header tag 達成的。其中 og:image 是提供 facebook 分享時顯示的大圖。

```html
<meta
  property="og:url"
  content="http://localhost:1313/posts/proxmox-hard-disk-replacement-and-expansion/"
/>
<meta property="og:site_name" content="Louis Li&#39;s Blog" />
<meta property="og:title" content="Proxmox硬碟更換及擴容" />
<meta
  property="og:description"
  content="在這篇文章中，我們將探討如何在Proxmox上將舊的2TB SSD硬碟升級至4TB，並無需重新安裝系統或移動虛擬機的操作步驟和方法。"
/>
<meta property="og:locale" content="zh_tw" />
<meta property="og:type" content="article" />
<meta property="og:image" content="http://localhost:1313/og_image.png" />
```

在 hugo 提供的模板中，會使用文章的第一張內嵌圖片連結作為 og:image，但是如果文章沒有圖片那就不會自動產生 og:image，圖片也限定於放在 contents/pages/文章目錄下的圖片。

所以我希望能夠修改，讓他使用我之前設計好的圖片，當成所有沒有 og image 網頁的預設 og image。

去看主題模板會發現，他使用 Hugo 內建的 opengraph 模板。

```go
# themes/blowfish/layouts/partials/head.html
{{ template "_internal/opengraph.html" . }}
```

因此這裡修改比較麻煩，首先我們需要把這個內置的模板複製一份到 layouts/partials 目錄，這個檔案我找不到要怎麼取得，最後是直接到 hugo 的 repository 去抓。

另外我們也需要複製一份 head.html 模板，因為要把原本渲染內建 opengraph.html 變成渲染我們改過的版本。

```go
# layouts/partials/head.html
{{ partial "opengraph.html" . }}
```

最後就是修改 opengraph 模板，當模板找不到圖片的時候使用一個預設的圖片連結。

```go
{{- with partial "_funcs/get-page-images" . }}
  {{- range . | first 6 }}
    <meta property="og:image" content="{{ .Permalink }}">
  {{- end }}
{{- else }}
    <meta property="og:image" content="{{ site.Params.defaultOpenGraphImage | absURL }}">
{{- end }}
```

然後再設定裡面加入這個圖片的連結，並把圖片放到 `static` 目錄。

```toml
# config/_default/hugo.toml
[params]
  defaultOpenGraphImage = "/og_image.png"
```

## 成果

到這邊我的整個 Hugo 靜態部落格就建立完成拉。

![](/img/pages/922a2d2c4b97977433ef3f7dc8903273.png)

PageSpeed Insights 行動裝置能夠拿到 97 分，真舒適。

![](/img/pages/91216d207cb96689164012adedbf4226.png)
