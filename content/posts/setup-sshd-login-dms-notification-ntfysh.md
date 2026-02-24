---
categories:
  - Linux
description: 簡短記錄一下，怎麼設定，當使用者登入時，直襲掛載自定義腳本並透過 **ntfy.sh** 發送即時通知。同場加映的是如何設置 Synology NAS DMS，同樣把訊息發送到 ntfy.sh
tags:
  - ssh
  - ntfysh
  - synology
date: 2025-10-04
title: SSHD 登入通知與 Synology通知串接 ntfy.sh
draft: false
---
簡短記錄一下，怎麼設定，當使用者登入時，直襲掛載自定義腳本並透過 **ntfy.sh** 發送即時通知。同場加映的是如何設置 Synology NAS DMS，同樣把訊息發送到 ntfy.sh

<!-- more -->

Pluggable Authentication Modules (PAM) 是 Linux 常見的一套驗證授權框架，sshd 等軟體依賴於 PAM 實現登入驗證與訪問控制。PAM 的強大之處在於它支援 **Hook** 功能。我們可以在驗證流程的特定階段插入自定義的模組，藉此修改 PAM 的行為。

首先我們需要修改 `/etc/pam.d/sshd` 文件，並在其中加入一行。

```
session optional pam_exec.so /usr/local/bin/login_notify.sh
```

首先第一欄表示要插入的模組類型，`session` 模組負責在使用者登入後到登出前所要做的工作（如掛載家目錄、記錄日誌等），其餘的類別還有 `account`（帳號權限）、`auth`（使用者驗證）、`password`（設定密碼）。

第二欄設定為 optional 表示如果該模組執行失敗不影響驗證流程。因為我們不希望通知服務暫時掛掉，就導致所有人無法登入伺服器。

pax_exec.so 就是我們要插入的模組，他提供了在登入登出前後執行特定腳本的功能，後面帶的是要執行的腳本路徑作為參數。

下面是實際的腳本，首先我們要判斷使用者是處在登入還是登出狀態，pam_exec.so 在執行時會把相關參數透過環境變數帶入，這邊我們驗證 `PAM_TYPE` 是 open_session 也就是登入成功後的狀態。

另外要組出發送的通知訊息，登入的使用者、IP 等資訊也可以透過`PAM_USER`, `PAM_RHOST`取得。

```bash
#!/bin/bash

exec >> /var/log/login_notify.log 2>&1

TIME=$(date '+%Y-%m-%d %H:%M:%S')
MESSAGE="User $PAM_USER Login Digital Ocean node from $PAM_RHOST @ $TIME"

if [[ "$PAM_TYPE" == "open_session" ]]; then
  curl \
    -H "Title: SSHD Login" \
    -H "Priority: default" \
    -d "$MESSAGE" \
    https://ntfy.sh/test_chennel
fi
```

接著我們把訊息發送到 `ntfy.sh` 的服務，ntfy.sh 是一個開源的通知推播平台，使用者可以透過簡單的 url 將訊息發送到 ntfy.sh 的 chennel 並透過 api 或手機 APP 接收通知，同時也支援自行架設 `ntfy.sh` server。

> 這邊範例沒有採用自架有一個考量是 andriod 還有 ios 通知如果要有較好的即時行需要通送訊息到 Firebase connected 或 Apple Push Notification service，但這會需要額外申請開發者帳號和複雜的設定。

這邊 `test_chennel` 就是唯一辨識 chennel 的一個字串，預設 ntfy.sh 是沒有權限保護的，因此這個字串要取一個夠長夠複雜的字串。

手機 app 上設定好 channel 後就可以收到通知訊息了。
![](/img/pages/setup-sshd-login-notification-1771944944084.jpeg)


## Synology DSM 設定

同樣我們可以設置 Synology NAS 的推波設定，把硬碟錯誤等資訊都推送到 ntfy.sh，首先到控制台 > 通知設定 > 推波服務 > 管理 Webhook > 新增。

![](/img/pages/setup-sshd-login-notification-1771935782706.png)

選擇自訂。

![](/img/pages/setup-sshd-login-dms-notification-ntfysh-1771945353126.png)

 web hook 網址填寫 `ntfy.sh` server 的網址並選 POST。

![](/img/pages/setup-sshd-login-notification-1771935707224.png)

header 這邊不用動。

![](/img/pages/setup-sshd-login-dms-notification-ntfysh-1771945460890.png)

主體這邊至少要有兩個值，`topic` 是 chennel 的 id，message 留空。

![](/img/pages/setup-sshd-login-dms-notification-ntfysh-1771945494151.png)

接著 message 選擇為通知內容

![](/img/pages/setup-sshd-login-dms-notification-ntfysh-1771945551942.png)

完成設置後可以點擊 `發送測試通知` 來測試。

![](/img/pages/setup-sshd-login-dms-notification-ntfysh-1771945574878.png)


