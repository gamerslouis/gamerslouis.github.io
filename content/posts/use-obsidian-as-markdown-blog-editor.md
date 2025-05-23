---
categories:
  - 部落格
description: 
tags:
  - Obsidian
date: 2025-05-24
title: 使用 Obdidian 作為 markdown 部落格的編輯器
draft: false
---
繼將部落格框架從 Hexo 換到 Vue 再換到 Hugo，我的部落格撰寫流程也迎來了一個重大的改變。從原本使用 Notion 來管理及撰寫文章，轉換到使用 Obsidian 來完成。今天，我將介紹是什麼促使我從 Notion 轉換到 Obsidian，並且說明在使用 Obsidian 搭配 Hugo 撰寫 Markdown 部落格時，應該如何進行設定與整合。
<!-- more -->
![](/img/pages/use-obsidian-as-markdown-blog-editor-1747750848334.png)


## 選擇 Markdown 部落格的理由

首先要說明為什麼，我選擇以 Markdown 為基礎的部落格框架。使用 Markdown 作為部落格的基礎，最大的優勢就是它所提供的極高彈性。由於內容基於 Markdown 檔案，只要任何框架能接收 Markdown 格式並生成部落格網頁，就可以不受平台限制地自由切換。這也是為什麼我能從 Hexo 快速轉移到 VuePress，再到現在的 Hugo。此外，這類部落格工具在功能強大的基礎上，透過模板等機制提供了便捷的修改空間，讓主題更換或特殊功能添加變得輕而易舉。

同樣地，對於文章的撰寫工具，只要它最終能產出 Markdown 文件，就能夠遷移到任何平台，甚至是直接使用文字編輯器進行寫作。而對於 Markdown 編輯器，我認為最重要的一點是要解決圖片上傳的問題。對於 Markdown 部落格而言，圖片通常會上傳到圖床並將連結嵌入 Markdown 文件中，或者將圖片放在本地的 `static` 資料夾，然後同樣將路徑放置於 Markdown 文件內。

使用一般的文字編輯器來撰寫部落格，除了無法預覽之外，我覺得最大的問題是增加圖片的動作會過於繁瑣，嚴重打亂寫作流程。

其次，當然是要提供良好的寫作體驗。這包括軟體本身的反應速度、預覽功能，甚至是所見即所得（WYSIWYG）的編輯模式，以及字體大小、樣式等可自定義的選項。

最後一點是 Frontmatter 的管理功能。對於 Markdown 部落格，我們需要使用 Frontmatter 來管理文章的 metadata，例如設定標籤、標記為草稿等。如果編輯器能夠提供相關的管理功能，那無疑是個加分項。

## 使用 Notion 的工作流

回顧我的部落格撰寫歷程，最早我是使用 VSCode 來撰寫部落格，並將文章保存在 GitHub Repo 中，配合 GitHub Actions 自動編譯成 GitHub Pages。

當時 VSCode 的 Markdown 編輯器尚未提供貼上圖片自動儲存至同資料夾的功能，因此每次增加圖片都非常麻煩。由於我本身有在使用 Notion，便萌生了能否使用 Notion 來撰寫部落格的想法。首先，Notion 的主要功能與 Markdown 格式相容，可以匯出 Markdown 文件，同時也提供了所見即所得的編輯器和圖片上傳功能。此外，得力於 Notion 的看板功能和資料庫功能，我可以方便地管理文章的 metadata。

![](/img/pages/use-obsidian-as-markdown-blog-editor-1747750129922.png)

為了將 Notion 與部落格整合，我在網路上找到了一個由他人提供的 GitHub Actions 流程，可以將文章下載下來並提交為 Markdown 文件，同時提供自動將圖片轉傳到圖床的功能。由於我不喜歡將圖片上傳到圖床，所以我對其進行了修改，讓圖片下載到儲存庫中，並以 MD5 值作為檔名。

就這樣，我的第一代部落格編輯器工作流誕生了。

![](/img/pages/use-obsidian-as-markdown-blog-editor-1747750546436.png)

## 遇見 Obsidian

大約在使用 Notion 後不久，我接觸到了 Obsidian 這個 Markdown 筆記工具。對我來說，Obsidian 最大的重點在於其速度及可調整性。Notion 基於網頁的架構，導致即使下載了 Notion 軟體，每次打開應用程式和切換頁面還是會有肉眼可見的時間延遲。此外，Notion 有限的字體和主題也讓我有些不滿。還有一點是 Notion 基於區塊（block）的結構，有時在修改文章、複製貼上時常常會發生誤操作。

相反地，Obsidian 的效率非常高，開啟速度極快（我還曾使用 Logseq 作為筆記工具，但其啟動時間和不太直觀的區塊結構讓我卻步）。Obsidian 同樣支援貼上圖片，並提供了方便的主題及字體調整功能。在撰寫 [Linux Kernel 網路巡禮 :: 2024 iThome 鐵人賽](https://ithelp.ithome.com.tw/users/20152703/ironman/8006 "null") 的過程中，我就是先在 Obsidian 寫完再貼到 iThome 的編輯器。此後，一部分的部落格文章，也是先在 Obsidian 寫完再貼到 Notion 管理。

## 整合 Obsidian 與 Hugo

原本我只是將 Obsidian 當作單純的筆記軟體來使用，直到最近比較大量地使用 Obsidian 並研究其插件功能之後，我才想到：為什麼我不直接使用 Obsidian 來編輯 Hugo 儲存庫資料夾，直接將 Obsidian 作為部落格編輯器呢？

前面提到使用 Obsidian 的諸多好處：高效快速、可自定義的主題讓人感到非常舒適，以及插件和屬性（properties）可以方便地管理 Frontmatter，還有模板等插件可以提升寫作效率。對我來說，本地化儲存也不是缺點，反正最終都會保存到 Git Repo。

使用 Obsidian 作為部落格編輯工具，說起來並不難。直接將 `posts` 資料夾作為 Vault 打開即可開始撰寫，這得益於 Obsidian 完全基於 Markdown 文件的特性。

### 圖片上傳及其他問題

然而，說簡單還是有一個很大的問題需要解決，那就是圖片上傳的問題。雖然 Obsidian 支援圖片貼上並保存到特定資料夾，但對於 Hugo 這類部落格系統而言，我們放在 `static/images` 目錄下的圖片，實際出現在文章中的連結是 `/images/xxxx.png`，而放在 `content/posts/` 中的文章實際網址是 `posts/xxxxx/`。因此，Obsidian 的預設圖片處理方式無法正常運作。

網路上有一些解決方案：

- 透過插件將圖片上傳到圖床，然後嵌入連結。然而，一方面我不希望上傳到圖床，另一方面這會導致舊文章無法正常顯示圖片。
    
- 在根目錄建立一個 `images` 目錄，然後指定 Obsidian 將圖片保存到這個目錄下，並在 Hugo 的 `config.toml`中進行設定。這樣放在 `images` 中的圖片，就會被 Hugo 視為放在 `static` 目錄下。但是同樣地，這會導致舊圖片無法被讀取，而且這樣會增加一個資料夾，讓結構顯得有些雜亂。
    
    ```
    [[module.mounts]] 
    source = 'images' 
    target = 'static/images'
    ```
    

此外，還有兩個不太相關的小問題：預設的圖片名稱是 `Pasted image <timestage>`，非常不美觀；而且即使設定為絕對路徑模式，Obsidian 插入的連結也不會有最前面的斜線，例如 `images/xxxx` 而不是 `/images/xxxx`。這樣的格式 Hugo 是不接受的，因為會被當作相對路徑，而非網站的絕對路徑。

還有一個不太相關的小問題是，如果將整個儲存庫當作 Vault 打開，Obsidian 裡面會看到一堆不相干的資料夾，顯得很雜亂。

### 解決問題

最終，我想到的解決方案就是將 repo 與 Vault 分離，而且要做到這點非常容易，只需使用軟連結（symlink）功能即可。首先將 repo 保存在 `blog` 資料夾，然後建立另外一個 `blog-obsidian` 作為 Obsidian 的 Vault 目錄。

```
# mac
cd blog-obsidian
ln -s ../blog/static/img
ln -s ../blog/content/posts
```

建立這兩個連結，前者是我放置圖片的目錄（我的文章圖片統一放在 `static/img/pages`），後者是文章的目錄。這樣在 Obsidian 打開後，就可以正常看到所有舊文章的圖片了！而且 Obsidian 的目錄會非常乾淨，不會看到其他不相干的東西。

![](/img/pages/use-obsidian-as-markdown-blog-editor-1747750589998.png)

### 圖片保存設定

接著，我們要調整圖片保存的位置和格式。我們需要將圖片放到 `img/pages/` 資料夾，使用更好的檔案名稱取代 `Pasted image <timestage>`，並且採用 Markdown 連結而不是 Obsidian 的 `![[]]` 格式。

這邊我們不修改 Obsidian 的預設設定，而是直接安裝 `Image converter` 這個插件。

![](/img/pages/use-obsidian-as-markdown-blog-editor-1747569184331.png)

首先，我們在插件設定裡面指定使用 `link format`。我們定義一個新的格式 `markdown-abs`，選擇 `Markdown`、`Absolute`。這樣圖片就會以 Markdown 連結格式的絕對路徑嵌入到 Markdown 文件中，並且是帶有最前面斜線的 `/img/xxx..`，解決了預設貼上的問題。

> 注意：建立完按 Save 後，還要點一下新建的選項，不然還是會使用其預設設定。

 ![](/img/pages/use-obsidian-as-markdown-blog-editor-1747569157114.png)

接著，`Filename` 使用預設提供的 `NoteName-Timestamp` 即可。雖然我原本是使用 MD5 hash 作為檔案名稱，但是這個插件沒有提供以內容 hash 作為檔案名稱的功能，而且會遇到建立多個同名檔案的問題，所以乾脆採用這種方式，還可以從檔案名稱看出最初來源於哪篇文章，還不錯。

![](/img/pages/use-obsidian-as-markdown-blog-editor-1747569111907.png)

最後，`location` 就指定到我的 `img/pages` 目錄。

這樣，圖片上傳的問題就完全解決了。

## 其他推薦的 plugin

除了上述的設定，這裡額外推薦一些實用的 Obsidian 插件：

- Auto Link Title: 當貼上連結時，會自動抓取網站的標題作為連結文字。
    
- QuickAdd: 透過設定快速鍵，可以快速建立新文章頁面到 `content/posts` 目錄下。它還提供了許多其他功能，這裡不多做介紹。我會搭配我的模板使用，模板內容如下：
    
    ```
    ---
    categories:
    description:
    tags:
    date: {{date:YYYY-MM-DD}}
    title:
    draft: true
    ---
    
    ```
    
- Dataview: 可以透過類似 SQL 的指令抓取 Frontmatter 的資料。你可以建立一個首頁（homepage），然後提供所有草稿的列表，方便查閱。
    
    ```
    list
    file.frontmatter.title
    from "posts"
    WHERE file.frontmatter.draft = true
    ```
    
    只要貼上這段程式碼即可。
![](/img/pages/use-obsidian-as-markdown-blog-editor-1747750714587.png)

## 其他待解決的問題

儘管目前的設定已經非常流暢，但仍有一些問題有待解決：

1. Obsidian 不支援中間帶空白的標籤（tag）。例如，我有一個標籤是 `2022 IThome 鐵人賽 - 學習 EBPF 系列`，會被 Obsidian 切成 `2022`、`IThome` 等好幾個標籤。我的解決方案是在 Markdown 文件中使用 `_` 替代空白，然後在編譯 Hugo 部落格的 CI/CD 流程中再將其替換回來。
    
2. 目前貼上的圖片如果後來文章中移除，圖片仍然會保留在儲存庫中，需要手動刪除。雖然點擊圖片可以選擇 `Delete Link and Image`，但擔心遺忘而未刪除乾淨。未來會研究是否有更好的方法處理這個問題。
    
3. Obsidian 獨立成一個目錄後，真的要保存檔案時還是需要到 repo 那邊進行 `commit`/`push` 操作。現階段而言，我覺得這並不麻煩，而且可以在上傳前進行最終檢查。不過理想情況是能在 Obsidian 裡面新增一個按鈕，按下去後自動 `commit` 並將 `draft` 狀態改為 `false`。得益於強大的插件機制，相信這是可以實現的。
    
4. 最後，Hugo 有一個 `lastmod` 欄位來表示最後上傳時間。同樣希望能夠藉由 Obsidian 自動更新這個欄位，不過也有考慮應該放在 GitHub Actions 的 CI/CD 流程中處理會比較合適，所以也等待未來再解決。

## 結語

總的來說，從 Notion 轉換到 Obsidian 進行部落格撰寫，雖然在初期設定上需要一些調整，但其帶來的高效、彈性和可自定義性，大幅提升了我的寫作體驗。期待未來能進一步探索更多自動化與效率提升的可能性。希望這篇文章能為同樣在尋找理想部落格撰寫流程的你，提供一些有價值的參考。