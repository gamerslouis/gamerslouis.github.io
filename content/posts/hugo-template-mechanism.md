---
categories:
  - 部落格
description: Hugo 是一個高效的靜態網站生成器，Template 是這類靜態網站生成器的核心功能。本篇文章將介紹 Hugo Template 機制的邏輯，包括 Go 的 Template 模組使用、頁面類型屬性（Kind、Type、Layout）、以及模板載入規則，幫助您靈活設計與擴展網站主題。
tags:
  - Hugo
  - Golang
date: 2025-01-19
title: 深入了解 Hugo 的 Template 機制：結構與渲染規則
---

## 前言

Hugo 是一個 Markdown 的靜態網站生成器。不同的 Markdown 靜態網站生成器本質上功能都是一樣的，都是將 Markdown 轉換成 HTML，然後生成一個靜態網站。不同靜態網站生成器的差異就在於它所使用的模板 (Template) 機制，hexo 使用的是 ejs 模板，vuepress 直接使用 Vue.js 搭配 SSR 來生成網站，而 Hugo 使用的是 Go 語言的 text/template 模組。不同的 Template 機制直接決定了怎麼去開發一個靜態網站的主題，以及怎麼去擴展主題的功能。這篇文章將會帶您了解 Hugo 的 Template 機制，了解如何去覆蓋、擴展主題的結構及樣式，增加自己的頁面、功能。

<!-- more -->

## golang text/template 模組

一個基本的部落個網頁 HTML 結構是由許多個小區塊所組成的，HTML 最基本的結構包含了 head 跟 body，而 body 根據網頁顯示的架構，通常又會分成 header, main, footer 等等區塊，不同的頁面可能會共用其中部分的區塊，也可能會有自己獨立的區塊，這些區塊如同拼圖一般的構成在一起。
```html
<!DOCTYPE html>
<html>
<head>
    ...
</head>
<body>
    <header>
        ...
    </header>
    <main>
        <article>
            ...
        </article>
    </main>
    <footer>
        ...
    </footer>
</body>
```

比如說，所有的"文章"頁面，基本上只是在內容上有所差異，所有介面的結構都是一樣的，可是首頁的整個 main 區塊就與文章頁面不同，但是 footer 跟 header 都有所不同。Hugo 就藉由了 Golang 的 template 模組，讓我們可以像拚拚圖一樣的把所有的不同區塊組合在一起，構成每個頁面。

### 基本介紹

Hugo 使用了 Go 的 template 模組，因此要了解 Hugo 的運作就必須要知道 golang 的 template 模組是怎麼運作的，但是這邊只會簡單的介紹一下，建議還是需要先去了解學習 Golang 的 template 模組。


在 Golang 的模板中，用雙大括號 `{{` `}}` 來標記帶有特殊功能的區塊，比如說變數、函數、條件判斷、迴圈等等。

```gotmpl
Hello, {{ .Title }}
```
比如說在這個範例中，`{{ .Title }}` 表示要渲染一個變數，名稱是`Title`，這個變數是在渲染模板時傳入的，假設傳入的數值是`World`，那麼這個模板就會渲染成`Hello, World`。

```gotmpl
{{ if .IsHome }}
    <h1>Home</h1>
{{ else }}
    <h1>Not Home</h1>
{{ end }}
```

在這個範例中，`{{ if .IsHome }}` 表示要進行一個條件判斷，如果`.IsHome`為真，則渲染`<h1>Home</h1>`，否則渲染`<h1>Not Home</h1>`。

### Block
為了要讓主題開發者，可以以拚積木的方式，我們需要一個方式去定義每一個積木的長相，然後定義如何將這些積木拼裝在一起。

在 golang 裡面，我們可以使用 `define` 來定義一個積木，然後在其他地方使用 `block` 來引用這個積木。

```gotmpl
{{ define "header" }}
  <header>
      ...
  </header>
{{ end }}
```

在這個範例中，我們定義了一個名為`header`的積木，然後在其他地方可以使用`block`來引用這個積木。

```gotmpl
<!DOCTYPE html>
<html>
{{ block "header" . }}default content{{ end }} 
</html>
```

最後渲染出來的結果就是
```html
<!DOCTYPE html>
<html>
  <header>
      ...
  </header>
</html>
```

一些使用過 golang template 的人比較熟悉可能是用 `{{ template "header" . }}` 來插入內容，差別在於在 block 中可以定義一個預設內容，如果沒有任何地方定義`header`，則會使用預設內容。

## Hugo Template 機制

### 渲染邏輯

Hugo 是建築在 Golang 的 template 模組之上的，Hugo 決定了一個對於一個 m arkdown 文件，要去使用哪一些 Template 檔案，以及如何去渲染這些模板，同時也規範了一些模板結構的原則。

在討論不同的頁面類型之前，我們先看一個最基本的範例，hugo 的所有模板都放在`layouts`資料夾中，其中最基礎的是 `layouts/_default/baseof.html`跟`layouts/_default/single.html`。

`layouts/_default/baseof.html` 是 hugo 渲染所有 html 頁面的時候的基礎模版 (Base Template)，這個模板定義了網頁的最基礎結構，hugo 產生 HTML 頁面就是去渲染這個基礎模板。
```gotmpl
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{ block "title" . }}
      <!-- Blocks may include default content. -->
      {{ .Site.Title }}
    {{ end }}</title>
  </head>
  <body>
    <!-- Code that all your templates share, like a header -->
    {{ block "main" . }}
      <!-- The part of the page that begins to differ between templates -->
    {{ end }}
    {{ block "footer" . }}
    <!-- More shared code, perhaps a footer but that can be overridden if need be in  -->
    {{ end }}
  </body>
</html>
```
比如說，在 hugo [文件](https://gohugo.io/templates/base/)中的這個範例，定義了一個最基本框架。
`.Site.Title`等變數是在渲染時 hugo 傳入的資訊。

同時這個模板填入了 main 和 footer 這兩個 block。Hugo 會按照特定的規則、載入去尋找可能定義這些積木的檔案，搜尋的規則我們稍後在討論。對於文章頁面，hugo 會載入 `layouts/_default/single.html` 這個檔案。
```gotmpl
{{ define "main" }}
  <article>
    <h1>{{ .Title }}</h1>
    {{ .Content }}
  </article>
{{ end }}
```
因此，我們可以在 `layouts/_default/single.html` 中定義 main 這個 block。可以看到這邊填入了`Content`這個變數，這個變數是 hugo 將 markdown 轉換成的 html 內容，這邊我們將其帶入到`<article>`標籤中，就可以顯示文章的內容，當然 markdown 文件具體要怎麼被渲染成 html，也是可以控制的，這個我們後面再談。

這樣一來，當我們打開一篇文章的網址時，hugo 就可以完成 html，並看到 markdown 文件的內容了。

### Markdown 文件屬性
現在我們知道了 hugo 是如何去渲染一個頁面的，但是一個部落格文章不只是由文章頁面所組成，還包含了首頁、分類頁、標籤頁等等，因此我們需要由不同的檔案去定義對應的 "main" block，然後由 hugo 根據不同的頁面類型去載入不同的檔案。

Hugo 部落格的內容由 `content` 目錄下的 markdown 文件所組成，對於每個 markdown 文件，都會有各自的 `Kind`，`Type`，`Layout` 三個屬性去共同決定了，這個 markdown 文件要載入哪一些模板檔案，完成渲染。

#### Kind
Kind 是指幾個 hugo 定義的特定類型 `home`, `page`, `section`, `taxonomy`, or `term`。

+ home 代表的是首頁，`content/_index.md` 就會被設定成 `Kind: home`。
+ page 就是基本的獨立頁面和文章頁面，比如說 `content/about.md` 就會被設定成 `Kind: page`。
+ section 代表的是一個列表頁，一般子目錄中的 `_index.md` 會被設定成 `Kind: section`，比如說 `content/posts/_index.md`。
+ taxonomy 代表的是一個分類列表頁，在常見的部落格框架中，我們會使用 `tag` 或 `category` 來分類文章，這些分類的列表頁就會被設定成 `Kind: taxonomy`，比如說 `content/tags/_index.md`。
+ term 代表的是一個分類頁，比如說有一個 tag 是 python，那 `content/tags/hugo.md` 就會被設定成 `Kind: term`。

#### Type
type 是對文章的一種分類方式，hugo 會預設使用 content 下，頂層目錄的名稱作為 type，不過也可以使用 front matter 中的 `type` 來指定。最常見的 `content/posts` 目錄下的文章會被設置為 `Type: posts`，而直接放在 `content` 目錄下的文章會被設置為 `Type: page`，如 `content/about.md`。

#### Layout
layout 則是專門用來控式頁面樣式的變數，預設情況下 layout 是空的，要透過 front matter 來指定。

### 模板載入規則
一個 markdown 文件的 Kind, Type, Layout 這三個屬性共同決定了 hugo 要載入哪一些模板檔案。

在 hugo 的[文件](https://gohugo.io/templates/lookup-order/)中有完整的列舉範例說明，這邊我們只取一個來當作範例說明。

假設我們有一篇文章的頁面 `content/cool/introduce-python.md`並透過 front mater 指定了 `layout: demolayout`，那麼 hugo 會依序尋找以下檔案：
1. layouts/cool/demolayout.html.html
2. layouts/cool/single.html.html
3. layouts/cool/demolayout.html
4. layouts/cool/single.html
5. layouts/_default/demolayout.html.html
6. layouts/_default/single.html.html
7. layouts/_default/demolayout.html
8. layouts/_default/single.html

因為 Kind 是 page，所以會搜尋 single.html。其他的 Kind 會有不同的搜尋順續，在這邊不一一列舉。

另外對於基礎模板，hugo 也會按照一定的規則去尋找：
1. layouts/cool/single-baseof.html.html
2. layouts/cool/baseof.html.html
3. layouts/cool/single-baseof.html
4. layouts/cool/baseof.html
5. layouts/_default/single-baseof.html.html
6. layouts/_default/baseof.html.html
7. layouts/_default/single-baseof.html
8. layouts/_default/baseof.html

hugo 會載入第一個找到的模板檔案，並利用第一個找到的基礎模板去渲染，要特別注意只有第一個找到的模板檔案和基礎模板檔案會被載入。

### Partials
如同上面所說，hugo 只會載入第一個找到的模板檔案，但是這樣我們就沒辦法在不同的 layout 和頁面類型中去共用一些模板片段，這時候就可以使用 partials 來解決這個問題。

`partials` 是放在 `layouts/partials` 目錄下的模板片段，這些片段不需要使用 define 包裝，而是直接整個檔案代表一個模板片段。

我們可以在任何地方使用 `partial` 來引用這些模板片段。

```gotmpl
{{ partial "header.html" . }}
```

這樣一來，我們就可以在不同的模板中共用一些片段了。

### 主題覆蓋覆蓋

hugo 的主題，就是透過定義不同的 layouts 檔案來完成主題的開發。藉由 hugo 的特性我們可以在不需要修改主題原始檔案的情況下，去覆蓋主題的樣式、結構，甚至是功能。

我們可以透過在`layouts`目錄下定義與 `themes/<theme>/layouts` 同名的檔案來蓋掉主題的樣式，這樣一來，hugo 就會使用我們定義的檔案來渲染頁面，我們也不需要直接去修改主題。

這樣的機制帶來了兩個好處。首先，我們可以從`layouts`目錄得知明確知道我們修改了哪些檔案，而不是去翻遍整個主題目錄。其次，我們可以保持 theme 目錄不修改，這樣一來，我們就可以很方便的更新主題，也不用擔心我們的修改會被覆蓋。

### 其他特殊頁面
除了上述的 home 以外，其實還有 RSS、404、sitemap 等特殊頁面，這些頁面的模板檔案也是可以自定義的，只要在 layouts 目錄下定義對應的檔案即可。

## Markdown 處理

### Render Hooks

前面，我們講述了 hugo 怎麼透過模板機制建立整個網頁的框架，接下來我會說明一下那 markdown 文件的內容是怎麼被轉換成 html 的，並且我們要怎麼去修改這個轉換過程。

hugo 會解析 markdown 文件的內容，並解析成一個個的元素。
```markdown
[Hugo](https://gohugo.io)

![kitten](kitten.jpg)
```
比如說這個 markdown 文件，hugo 會解析成一個連結元素，一個圖片元素等等，接著對於每個元素，hugo 就同樣可以透過模板去渲染。

對於每個元素類型應該怎麼去渲染，在 hugo 中稱之為 render hooks，我們同樣可以透過自定義的模板去覆蓋掉預設的 render hooks，來修改元素的渲染方式。

render hooks 放置在 `layouts/_default/_markuip/render-<element>.html` 中，比如說對於連結元素，我們可以在 `layouts/_default/_markup/render-link.html` 中定義如何去渲染連結元素。

對於每個元素 hugo 會傳入什麼參數，可以參考 hugo 的[文件](https://gohugo.io/render-hooks/)。

```gotmpl
<a href="{{ .Destination | safeURL }}"
  {{- with .Title }} title="{{ . }}"{{ end -}}
>
  {{- with .Text }}{{ . }}{{ end -}}
</a>
```
這是一個渲染連結元素的範例。

### Shortcodes
[Shortcodes](https://gohugo.io/templates/shortcode/) 則是讓我們可以額外定義，可以在 mardown 文件中可以使用的自定義元素。

假設建立了一個 `layouts/shortcodes/audio.html`
```gotmpl
{{ with resources.Get (.Get "src") }}
  <audio controls preload="auto" src="{{ .RelPermalink }}"></audio>
{{ end }}
```

那們我們就可以在 markdown 文件中使用 `{{ < audio src="audio/test.mp3" >}}` 來插入一個音樂播放器。

hugo 會把它渲染成`<audio controls preload="auto" src="/audio/test.mp3"></audio>`。

## 結論

Hugo 的模板機制非常強大，它讓我們可以很方便的去定義網頁的結構、樣式，並且可以很方便的去擴展主題的功能。但是需要去熟悉一下 golang 的 Template 模組，還有 hugo 的執行規則，才能夠更好的去開發我們的部落格。
