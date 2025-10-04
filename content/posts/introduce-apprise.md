---
categories:
  - 軟體分享
description: 今天要來介紹 Apprise，一款開源、跨平台的通知發送工具與 Python 函式庫，它提供了一個統一的方式，來把通訊息發送到 Discord 群組、Telegram 頻道、Slack 頻道，Apprise 都能以統一、簡單的語法進行設定與發送，省去了研究與適配不同平台 API 的過程。
tags:
date: 2025-10-04
title: 介紹 Apprise - 一個跨平台通知串接工具
draft: false
---
今天要來介紹 [Apprise](https://github.com/caronc/apprise?tab=readme-ov-file#sms-notifications)，一款開源、跨平台的通知發送工具與 Python 函式庫，它提供了一個統一的方式，來把通訊息發送到 Discord 群組、Telegram 頻道、Slack 頻道，Apprise 都能以統一、簡單的語法進行設定與發送，省去了研究與適配不同平台 API 的過程。


<!-- more -->

## 簡介

Apprise 特點是
1. 支援數十種不同的平台 (Discord, Telegram, Slack, Synology Chat, ) 以及 email, SMS 等平台的訊息發送
2. 提供三種使用方式
	+ Web 服務：部署成一個獨立的 web 服務，讓使用者透過 API 發送訊息
	+ CLI 工具：直接透過 CLI 指令發送訊息
	+ python package：透過 python 腳本來發送訊息
3. Tag 機制允許使用者將不同的平台、頻道標上 Tag，當使用者要發送訊息時，可以根據 Tag 來切換發送到不同的頻道

## 使用教學
我會先以 CLI 的方式來介紹如何使用 apprise 發送通知訊息到 discord。

### 安裝
Apprise 可以直接使用 pip 安裝，我這邊使用 uv 建立 venv 來裝，簡單一點就直接 `pip install apprise`：

```bash
uv venv
source .venv/bin/active
uv tool install apprise
apprise --version
Apprise v1.9.5
Copyright (C) 2025 Chris Caron <lead2gold@gmail.com>
This code is licensed under the BSD 2-Clause License.
```

### 發送管道
Apprise 使用 URL 來標示一個發送的目標，比如 discord 的發送 URL 長這樣：

```
discord://{botname}@{WebhookID}/{WebhookToken}/
```

其中 botname 是我們想在聊天室顯示的 bot 名稱，後面 WebhookID 和 WebhookToken 是從 Discord 申請的 webhook URL 拿到的資訊。

從 Apprise Readmd 頁面，可以看到所有支援的發送對象，點開後，可以看到詳細的設定說明，比如說這是 Discord 的[說明頁面](https://github.com/caronc/apprise/wiki/Notify_discord)。

Apprise 透過 URL 參數來提供一些設定選項，不同的平台提供的設定項目會不太一樣。
比如説控制 discord bot 的頭像：
```
discord://{botname}@{WebhookID}/{WebhookToken}/?avatar_url=https://i.imgur.com/FsEpmwg.jpeg&footer=true
```

### Discord 設定教學
首先，點開*伺服器設定* ，找到*整合/Webhook*，點擊*新 Webhook*，就可以建立一個 bot 然後設定他要發送到哪一個頻道。
![](/img/pages/introduce-apprise-1759572733567.png)

接著點擊 *複製 Webhook 網址*，可以拿到這一串：
```
https://discord.com/api/webhooks/3337232384238212/tFsNJEFEIFWFDOEW81-VJwEIQOQO8PO
```

 根據文件說明，其實好像可以直接使用這個 URL，但我喜歡轉換成標準格式：

```
discord://mybot/3337232384238212/tFsNJEFEIFWFDOEW81-VJwEIQOQO8PO
```

接著我們就可以透過 apprise 指令來發送訊息了：

```
apprise -b '測試訊息' 'discord://mybot/3337232384238212/tFsNJEFEIFWFDOEW81-VJwEIQOQO8PO'
```

這樣就會在 Didcord 頻道看到一條：
![](/img/pages/introduce-apprise-1759572991999.png)

對 Discord 而言，我們還可以發送 markdown 格式的內容

```
cat << EOF | apprise -vv 'discord://mybot/3337232384238212/tFsNJEFEIFWFDOEW81-VJwEIQOQO8PO?format=markdown&footer=true'
# 標題

測試訊息
+ 123
+ 456
EOF
```

![](/img/pages/introduce-apprise-1759573438201.png)

也可以發文同時 tag 人

```
apprise -b '測試訊息 <@207047256698912768>' 'discord://mybot/3337232384238212/tFsNJEFEIFWFDOEW81-VJwEIQOQO8PO'
```

### 使用設定檔
可以發現，目前我們每次發送訊息的時候都需要帶入目標 URL，這樣顯得繁瑣也不好管理，因此我們就要用設定檔的方式來管理了。完整的說明可以參考 [wiki](https://github.com/caronc/apprise/wiki/config)。

Apprise 支援 YAML 跟 Text 兩種設定格式，這邊我們以 Text 為例。

```
# Use pound/hashtag (#) characters to comment lines
# The syntax is <tags>=<url> or just <url> on each line
#
# Here is an example of a very basic entry (without tagging):
mailto://someone:theirpassword@gmail.com

# Now here is an example of tag associations to another URL
# The equal sign (=) delimits the tag from the actual URL:
desktop=gnome://

# If you have more then one tag you'd like to associate with it,
# simply use a comma (,) and or space to delimit your tags.
# The same rules apply afterwards; just use an equal sign (=)
# to mark the end of your tagging definitions and start your
# notification service URL:
tv,kitchen=kodi://myuser:mypass@kitchen.hostame
tv,basement=kodi://myuser:mypass@basement.hostame
```

其實格式很單純，就是每一行是一個發送 URL，如果想要加上 tag 就使用 `tag1,tag2=<url>`的格式。

```
# Group Example #1

# Define your URLs as per normal
user1=mailto://credentials
user2=mailto://credentials

# Then define a group
friends = user1, user2

include http://localhost:8080/get/apprise
include more_configuration.cfg
include /etc/apprise/cfg
```

然後，也可以把 tag 聚合成一個群組，或著導入網路上或本地的其他設定檔案。

你可以把設定檔案放在[指定位置](https://github.com/caronc/apprise/wiki/config#cli)或著透過`-c <path>` 來指定路徑，然後就可以簡化發送指令。
```
apprise -b 'hello' -c /tmp/apprise.conf
```

如果想要發送給特定的 tag 就加上`-t <tag>`。

### Web 服務
當然，如果有很多台機器都可能發送通知，那除了在所有機器上安裝 apprise 以外，也可以用 apprise 的 web 模式。

可以直接用官方的 docker [image](https://hub.docker.com/r/caronc/apprise) 部署：
```bash
docker run --name apprise \
   -p 8000:8000 \
   -v /var/lib/apprise/config:/config \
   -d caronc/apprise:latest
```

然後就可以 post 請求來發送通知：
```
curl -X POST -d 'urls=discord://mybot/3337232384238212/tFsNJEFEIFWFDOEW81-VJwEIQOQO8PO&body=test message' \
    http://localhost:8000/notify
```

也有一個簡單的 web 介面來管理設定檔

![](/img/pages/introduce-apprise-1759579766190.png)

也可以直接透過網頁發送通知：

![](/img/pages/introduce-apprise-1759579778331.png)

從上面的圖片標題可以看到，apprise api 會設定檔提供一個 ID，如 `apprise`。

```
curl -X POST -d '{"tag":"dev", "body":"bug #000123 is back :("}' \
    -H "Content-Type: application/json" \
    http://localhost:8000/notify/apprise
```

所以發送時，如果要用設定檔，API 要帶 ID KEY。

```
/add/{KEY}
/del/{KEY}
/get/{KEY}
/notify/{KEY}
```

當然，也可以透過 API 來修改保存在 web 服務的設定檔。

### Web Service 限制
apprise 提供的 web api 有一個比較大的缺點就是沒有支援 authentication，所以如果要支援驗證功能的話，就需要自己在前面加一層 ingress 來處理。

## Plugin 擴充
apprise 透過 plugin 的方式來定義不同的平台，因此我們也可自行擴充，只要撰寫對應的 python 腳本即可。

## 總結
Apprise 算是一個實用的羹句，可以降低我們串接不同通知服務的成本，不需要研究對應的 API 如何串接，不過他能提供的功能算是比較有限，就是做好串接這件事情，有需要可以玩玩看。