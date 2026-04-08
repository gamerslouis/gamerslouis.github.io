---
categories:
  - Networking
  - 軟體分享
description: NetBird 是一套基於 WireGuard 的 mesh VPN 方案，透過 ICE 框架自動在節點之間找到可通訊的 IP pair，再建立 WireGuard tunnel。這篇文章從 WireGuard 的加密與握手機制講起，接著說明 ICE 的連線建立流程，最後把兩者串起來，看 NetBird 如何協同完成整個 peer-to-peer 連線。
tags:
  - 技術分享
  - 網路
  - VPN
  - Wireguard
date: 2026-04-08
title: NetBird 架構介紹：WireGuard + ICE 如何建立 Peer-to-Peer 連線
draft: false
---
NetBird 是一套基於 WireGuard 的 mesh VPN 方案，透過 ICE 框架自動在節點之間找到可通訊的 IP pair，再建立 WireGuard tunnel。這篇文章從 WireGuard 的加密與握手機制講起，接著說明 ICE 的連線建立流程，最後把兩者串起來，看 NetBird 如何協同完成整個 peer-to-peer 連線。

<!-- more -->

## WireGuard

首先我們要先從 WireGuard 也就是和核心的加密傳輸方式說起。

WireGuard 是一個基於 UDP 傳輸的 VPN 工具，並擁有一套自己定義的握手與加密機制，以下是他使用的一些密碼學技術。

- [ChaCha20-Poly1305](https://tools.ietf.org/html/rfc7539) 做對稱加密與認證
- [Curve25519](https://cr.yp.to/ecdh.html) 做 ECDH 金鑰交換
- [BLAKE2s](https://tools.ietf.org/html/rfc7693) 做 hashing
- [SipHash24](https://131002.net/siphash/) 做 hashtable key
- [HKDF](https://tools.ietf.org/html/rfc5869) 做 key derivation

### 封包加密流程

當封包進入 WireGuard 的虛擬介面（如 `wt0`，NetBird 使用的介面名稱，一般 WireGuard 慣例是 `wg0`）後，會被加密，再透過實體介面（如 `eth0`）以 UDP 封包送出。對面的 wireguard 監聽特定 Port (通常是 51820)，收到封包後會先解密，然後把原始封包從虛擬介面送出。

![WireGuard 封包加密流程](/img/pages/netbird-architecture-intro-wg-encrypt.png)

### 握手與 Key Rotation

WireGuard 使用 1-RTT 握手來交換對稱加密金鑰，用於後續實際的封包加密傳輸：

![WireGuard 1-RTT 握手](/img/pages/netbird-architecture-intro-wg-handshake.png)

握手完成後就可以開始傳輸資料。不過 wireguard 特別的地方是，對稱金鑰不是一直用下去的，單一 key 的有效時間只有 3 分鐘，每發送 2^60 個封包或每 120 秒，WireGuard 會自動重新握手並交換新的 key，然後過渡到新的 key，

幾個值得留意的行為：

- `wt0` 收到封包時如果還沒建立 session，會先把封包放進 queue，同時觸發握手
- 握手送出後 5 秒沒收到回應就重試，持續嘗試 90 秒仍失敗的話就丟掉 queue 裡的封包
	- 只要有人又透過 `wt0` 送封包，就會重新啟動握手流程
- 沒有設定 `PersistentKeepalive` 的話，沒有封包的時候就完全不會有任何流量

### 設定檔結構

一個典型的 WireGuard 設定長這樣：

```ini
[Interface]
ListenPort = 51820
PrivateKey = <base64-encoded-private-key>

[Peer]
PublicKey = <base64-encoded-public-key>
AllowedIPs = 100.64.0.1/32, 10.0.20.0/23
Endpoint = 198.51.100.10:51820
PersistentKeepalive = 25

[Peer]
PublicKey = <base64-encoded-public-key>
AllowedIPs = 100.64.0.2/32, 10.0.30.0/23
Endpoint = 203.0.113.20:51820
PersistentKeepalive = 25
```

各欄位的用途：

| 欄位 | 說明 |
|------|------|
| `ListenPort` | 本地監聽 WireGuard 封包的 port |
| `PrivateKey` | 這台機器唯一的靜態私鑰 |
| `PublicKey` | 對方的公鑰，用來識別 peer |
| `AllowedIPs` | 哪些目的 IP 的封包要送往這個 peer，同時也限制對方能送過來的來源 IP |
| `Endpoint` | 對方的外部 IP 和 port，讓加密封包知道要送去哪裡 |
| `PersistentKeepalive` | 每隔幾秒發送一個 keepalive 封包 |

> `Endpoint` 允許其中一邊不填。這時候只能等對方先送第一個封包過來，再用對方封包的 source IP 作為 endpoint，通常用於 server client 架構的模式，這樣只需要 client 設定 server 的 IP，client 可以在任何地方使用任意 IP 連線。

這邊就有個問題，WireGuard 的設定是靜態的，我們需要事先知道所有機器的 public key、endpoint IP 和 AllowedIPs，生成每台機器的設定，在節點數量多、IP 會變動的環境下，手動維護這些設定基本上是不可能的。

這就是 NetBird, Tailscale 這些方案要解決的問題之一，如何讓設備間自動交換 public key 等資訊以及 IP 設定，但在談 NetBird 之前，我們先來看它用到的另一個關鍵技術：ICE。

## ICE (Interactive Connectivity Establishment)

ICE 是一個用來「穿透防火牆」的框架，讓位於 NAT 後方的設備也能彼此建立連線。它的核心思路很單純：找到一組雙方都能互通的 IP pair，然後用這對 IP 通訊。

在複雜的網路場景中，ICE 會搭配 STUN 和 TURN 等通訊協定實現 NAT 穿透或著 relay 的方式來通訊。

> NAT 不是本文的重點，所以 NAT 穿透的部分不會花太多時間介紹，假設所有機器都有 Public IP，重點會放在連線建立的流程上。

### 連線流程

ICE 的連線建立分成三步：

**第一步：蒐集候選位址 (Gathering Candidates)**

Candidate 是一個可用的本機 IP。不考慮 NAT 的情況下，就是這台機器上所有介面綁定的 IP。

**第二步：交換候選位址 (Exchange Candidates)**

雙方透過 Signaling Server 交換彼此蒐集到的 candidate 清單。

**第三步：連通性檢查 (Connectivity Checks)**

把兩邊的 candidate 清單做排列組合，產生所有可能的 candidate pair，然後逐一嘗試發送封包，檢測哪一組 IP pair 可以通訊。

### 範例

假設有兩台 server：

- server1 的 IP：`10.4.1.11`、`8.8.8.8`
- server2 的 IP：`10.5.2.64`、`1.1.1.1`

排列組合後產生四組 candidate pair：

| Local | Remote |
|-------|--------|
| `10.4.1.11` | `10.5.2.64` |
| `10.4.1.11` | `1.1.1.1` |
| `8.8.8.8` | `10.5.2.64` |
| `8.8.8.8` | `1.1.1.1` |

逐一測試後發現 `8.8.8.8` <-> `1.1.1.1` 這組可以通，後續通訊就走這對 IP pair。

### Keep-alive 與 ICE Restart

連線建立後，ICE 會持續發送 keep-alive 封包來維持 NAT mapping 並檢測線路是否正常。一旦發現線路失效，就會重新執行整個 ICE 連線建立流程。

## NetBird 架構與工作原理

有了 WireGuard 和 ICE 的基礎，我們可以來看 NetBird 怎麼把它們串起來。

NetBird 的架構可以分成兩大塊：

- **NetBird Management**：由 Management Server 和 Signal Server 組成等微服務組成。
- **NetBird Agent/Peer**：跑在每台節點上的一個 single binary，內部可以看成 NetBird Client、WireGuard (如果使用 userspace mode, kernel mode 這塊就被 kernel 的 wireguard 模組取代) 和 ICE 三個模組

![NetBird 架構總覽](/img/pages/netbird-architecture-intro-architecture-overview.png)


### 步驟一：Sync Call — 取得 Peer 清單

![NetBird 架構細部](/img/pages/netbird-architecture-intro-architecture-detail.png)

NetBird client 啟動後，會連上 Management Server 呼叫 Sync call。這是一個 gRPC stream——Management Server 透過這個 stream 提供這個 agent 可以建立連線的 peer 清單 (包含 Public IP 等基本資料但不包含 IP)，當清單有更新時也會即時推送。

![Sync Call 建立](/img/pages/netbird-architecture-intro-sync-call.png)
### 步驟二：Signal Offer — 發起連線請求
![Sync Stream 推送](/img/pages/netbird-architecture-intro-sync-stream.png)


除了連接到 Management Server，client 也都會連接到 singal server。當一個 client 決定要和某個 peer 建立連線時，會透過 Signal Server 發送 Offer。如果目標的 client 也在線上，Signal Server 就可以把這個 Offer 轉發給對方的 client。

### 步驟三：ICE Candidate 交換

![Signal Offer](/img/pages/netbird-architecture-intro-signal-offer.png)

雙方的 NetBird client 啟動 ICE 模組 (建立一個新的 ICE instance)。ICE 透過 netlink 取得本機的網路介面清單（即 local candidates），再透過 Signal Server 把 candidate 清單送給對方。

![ICE Candidate 交換](/img/pages/netbird-architecture-intro-ice-candidates.png)

### 步驟四：ICE Connectivity Checks

就緒後，雙方的 ICE 模組開始對所有 candidate pair 執行 connectivity check。

在這裡會有兩個狀態機，一個是整個 ICE 的執行狀態 (ConnectionState)，一個是每個 condidate pair 的狀態 (CondidatePairState)。

#### Candidate Pair 的狀態機

每個 candidate pair 的檢查邏輯：

- 發送不超過 `maxBindingRequests` 個 request 封包
- 如果收到 response，標記為 **succeeded**
- 一但發送完 maxBindingRequests 沒有收到，這組 pair 就會標記為 **failed**

![ICE Connectivity Checks](/img/pages/netbird-architecture-intro-ice-checks.png)


#### ICE Connection 的狀態機

從整個 ICE 模組的角度來看，首先會進入 Checking 狀態，接著當：

- 任何一個 pair 進入 succeeded → ICE 進入 **ConnectionStateConnected**
- 所有 pair 在 failure timeout 內都沒成功 → ICE 進入 **ConnectionStateFailed**
- 連線建立後，如果超過 failure timeout 沒收到 heartbeat → 也會進入 **ConnectionStateFailed**


![Candidate Pair 狀態](/img/pages/netbird-architecture-intro-candidate-pair-state.png)



### 步驟五：WireGuard Peer 設定寫入

ICE 模組會把狀態變化通知 NetBird client，client 據此操作 WireGuard：

- **ICE 進入 Connected**：取得成功的 candidate pair IP，把對方寫入 WireGuard 的 peer 設定，tunnel 建立完成
- **ICE 進入 Failed**：移除該 peer 的 WireGuard 設定，重置 ICE 模組，再透過 Signal Server 重新嘗試建立連線

![ICE Connection 狀態](/img/pages/netbird-architecture-intro-connection-state.png)

這就是 NetBird 的核心功能——把原本需要手動維護的 WireGuard peer 設定，變成透過 Management Server + Signal Server + ICE 自動完成。
