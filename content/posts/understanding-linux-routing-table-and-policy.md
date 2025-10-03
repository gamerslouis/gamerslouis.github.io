---
categories:
  - Linux
  - Networking
description: Linux 允許我們自定義多張 routing table，並透過 routing policy 來精準控制封包要依循哪一張路由表進行決策。這篇文章將從 ip route 的基本操作開始，逐步探討 Linux 中多重路由表 (local, main) 與路由策略 (ip rule) 的運作方式，並透過一個實用的 VPN 案例，展示如何應用網路路由策略。
tags:
  - 技術分享
date: 2025-09-30
title: 了解 Linux 多路由表與路由策略
draft: false
---
在比較複雜的網路架構及使用場景中，我們可能會需要更精細地控制網路封包的走向，例如讓特定的來源 IP 位址走指定的網路出口，或是設定 VPN 連線，讓部分流量通過 VPN 通道，其餘流量則走預設閘道。單純依賴一張路由表會比較難靈活地實現這些需求。

幸運的是，Linux 核心提供了強大的路由策略 (Routing Policy) 機制，允許我們建立多張路由表 (routing table)，並透過規則 (rule) 來決定在什麼條件下要使用哪一張路由表。這篇文章，我們將從大家熟悉的 `ip route` 指令開始，一步步深入了解 Linux 多重路由表與路由策略的運作原理，最終掌握如何運用這些工具來打造更具彈性的網路環境。

<!-- more -->

## 複習路由表基礎

首先，讓我們從最基本的 `ip route` 指令看起，這個指令能顯示出 Linux 預設的路由表。

```bash
$ ip route
default via 192.168.5.2 dev eth0 proto dhcp src 192.168.5.1 metric 200
172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1 linkdown
192.168.5.0/24 dev eth0 proto kernel scope link src 192.168.5.1 metric 200
192.168.5.2 dev eth0 proto dhcp scope link src 192.168.5.1 metric 200
```

首先看第二條路由，`172.17.0.0/16 dev docker0 ...`，這是一個在同一個 L2 網域的本地路由：
- `172.17.0.0/16`：這是目的地的 CIDR。當一個封包的目的 IP 位址符合這個範圍時，這條規則就會被匹配。    
- `dev docker0`：指示封包應該從 `docker0` 這個網路介面送出。
- `proto kernel`：代表這條路由規則的來源 (protocol)。
- `scope link`：代表目標應處在同一個 L2 網域。
- `linkdown`：表示該路由對應的 interface 處於 down 的狀態，這是 docker 建立的特殊 interface，如果是一般的介面，正常運作的狀態就不會顯示。

接著第一條 route 是我們的 default route，所以就會有 via 關鍵字來表示下一跳的位置，並且用 src 表示如果是本機封包根據該路由出去的時候，source ip 應該設置為`192.168.5.1`。

### proto 欄位 

`proto kernel` 表示這條路由是由 Linux 核心自動產生的。例如，當我們為某個網路介面設定 IP 位址和子網路遮罩時，核心就會自動建立一條對應的區域網路路由。

常見的還有 `static` (由管理者手動靜態設定) 和 `dhcp` (由 DHCP client 設定)。

`proto` 欄位本身是一個數字，`ip route` 會根據 `/etc/iproute2/rt_protos` 這個對照表來顯示其對應的名稱。

```bash
$ cat /etc/iproute2/rt_protos
#
# Reserved protocols.
#
0	unspec
1	redirect
2	kernel
3	boot
4	static
...
16	dhcp
...
```

值得注意的是，如果我們手動使用 `ip route add` 新增路由，預設的 `proto` 會是 `0 (unspec)`。如果希望明確標示為靜態路由，需要額外加上 `proto static` 關鍵字。

> `scope` 按照說明表示該 route 的作用範圍，主要的值是 `host`, `link`, `global`，`host`表示本機路由，`link` 表示同 L2 網域，在初步追蹤 kernel 的原始碼，看起來主要是在建立 route 的時候，會成為 gateway 是否有效的一個判斷依據，但是按照找到的資訊是說主要是 ipv6 比較會有影響，所以就不細追了，照理來說會被自動設置成合適的數值，應該是不太需要管

## 建立多重路由表

實際上，Linux 預設就擁有多張路由表。每張路由表是由一個數字代表，然後有些特定的表，有慣例的名稱，我們可以透過 `/etc/iproute2/rt_tables` 檔案看到這些預設的對應關係。

```bash
cat /etc/iproute2/rt_tables
#
# reserved values
#
255	local
254	main
253	default
0	unspec
#
# local
#
#1	inr.ruhep
```

Linux 預設有三張主要的路由表：`local`、`main` 和 `default`。

- **`main` (ID: 254)**：這是我們最常操作的路由表，`ip route` 指令預設顯示的就是這張表的內容。
- **`local` (ID: 255)**：這張表由核心自動維護，存放著本地介面位址和廣播位址的路由。所有送往本機的封包都會在這裡被匹配，確保本機通訊的正常運作。    
- **`default` (ID: 253)**：這張表預設是空的，通常作為一個備用的路由表。
    
我們可以透過 `ip route show table <table_id/name>` 來查看不同路由表的內容。

```bash
$ ip route show table local
local 127.0.0.0/8 dev lo proto kernel scope host src 127.0.0.1
local 127.0.0.1 dev lo proto kernel scope host src 127.0.0.1
...
local 192.168.5.1 dev eth0 proto kernel scope host src 192.168.5.1
```

可以看到，`local` 表中存放的都是指向本機 `lo` 介面或特定介面自身 IP 的路由。

### 新增路由表

當我們需要使用自訂的路由表時，其實不需要特別「建立」一張路由表，只要在建立 route 的時候給定路由表的 ID 就可以了。

```bash
# 將一條路由新增到 ID 為 123 的路由表中
ip route add 10.0.0.1 dev eth0 table 123
```

當然，如果希望能夠更好理解路由表 ID 的意義，也可以去修改 `rt_tables` 檔案，幫路由表取一個別名。

## 路由策略：決定封包該走哪條路

既然有多張路由表，那麼核心是如何決定一個封包到來時，應該查詢哪一張表呢？這就是路由策略 (Routing Policy) 發揮作用的地方，我們可以使用 `ip rule` 指令來查看和管理它。

```bash
$ ip rule
0:	from all lookup local
32766:	from all lookup main
32767:	from all lookup default
```

`ip rule` 的輸出顯示了系統中所有的路由策略規則，每一條規則都由三個主要部分組成：

1. **優先級 (Priority)**：前面的數字 (如 `0`, `32766`)。核心會從數字最小的規則開始依序匹配。
2. **選擇器 (Selector/Condition)**：例如 `from all`，用來定義匹配封包的條件。
3. **行為 (Action)**：例如 `lookup local`，指示在滿足條件後應該執行的操作，最常見的就是去查詢 (`lookup`) 某一張路由表。

當 Linux Kernel 要路由一個封包的時候，會從 priority 低的 policy 開始匹配，如果滿足選擇器，就會去查 policy 對應的那張 routing table。如果 routing table 內有符合的路由，那 Linux 就會直接使用該結果。如果都不滿足，才會嘗試去匹配下一條 routing policy。

根據預設的規則，一個封包的路由決策流程如下：

1. **Priority 0**：查詢 `local` 表。如果目的地是本機 IP，封包會在這裡找到匹配的路由，決策過程結束。
2. **Priority 32766**：如果 `local` 表中找不到匹配，接著查詢 `main` 表。大部分的網路流量，包括走預設閘道 (default gateway)，都會在這張表裡找到出路。
3. **Priority 32767**：如果 `main` 表也找不到匹配，最後查詢 `default` 表（雖然它通常是空的）。

這個流程確保了本地流量的優先處理，然後才是一般的網路流量。

## 進階控制：打造自己的路由規則

`ip rule` 的強大之處在於我們可以自訂規則，利用豐富的選擇器來實現精細的流量控制。常見的選擇器包括：

- `from <source_prefix>`：根據來源 IP 位址匹配。
- `to <destination_prefix>`：根據目的 IP 位址匹配。
- `iif <interface_name>`：根據封包進入的網路介面 (input interface) 匹配。
- `fwmark <mark>`：根據 `netfilter` (iptables/nftables) 設定的防火牆標記 (firewall mark) 來匹配。這提供了一個絕佳的機制，讓我們可以在防火牆層面對封包進行分類標記，然後在路由層根據標記決定其走向。

此外，我們還可以在規則中加入一些進階設定來拒絕某些匹配結果：

- `suppress_prefixlength <length>`：如果匹配到的路由其子網路遮罩長度**小於**指定值，則忽略這次匹配，繼續處理下一條規則。一個經典用法是 `suppress_prefixlength 0`，這意味著如果在這張表中只匹配到了預設路由 (prefix length 為 0)，就當作沒找到，讓封包有機會去查詢下一張路由表。 
- `suppress_ifgroup <group>`：如果匹配到的路由其出口介面屬於某個特定的介面群組，則忽略這次匹配。

## 實戰應用：VPN 路由分流

讓我們透過一個常見的 VPN 應用場景，來實際操作一下路由策略。假設我們有以下需求：

1. 本地區域網路的流量 (`192.168.5.0/16`) 應該直接從 `eth0` 出去，不經過 VPN。
2. 一些不在同一個 L2 網域，但是也在本地的流量 (`192.168.4.0/24`) 也應該直接直接從 `eth0` 出去到 gateway。
3. VPN 系統會定義一些網段 (`192.168.4.0/30`, `192.168.3.0/24`)，在這些網段的流量應該走到 VPN 介面 `tun0`，但是 VPN 網段可能會跟本地網段重疊。
4. 都不匹配，最終走到預設閘道
    

首先，`main` 路由表中已經有我們的本地路由和預設閘道。

```bash
# main table
$ ip route show table main
default via 192.168.5.254 dev eth0
192.168.5.0/24 dev eth0 proto kernel scope link src 192.168.5.1
192.168.4.0/24 via 192.168.5.254 dev eth0 proto static scope link 
```

接著，我們為 VPN 建立一張新的路由表，ID 設為 `100`，並在其中加入對應的路由。
```bash

ip route add 192.168.4.0/30 dev tun0 table 100
ip route add 192.168.3.0/24 dev tun0 table 100
```

現在，我們需要新增一條路由策略，讓封包去查詢這張新的 `vpn_table` (ID 100)。我們設定一個比 `main` 表（32766）更高的優先級，例如 `10000`。

Bash

```
# 新增規則：所有封包都去查詢 table 100
ip rule add prio 10000 lookup 100
```

這樣一來，路由決策流程就變成了：`local` -> `vpn_table` -> `main`。所有非本地流量都會優先嘗試走 VPN。這樣的好處是我們可以把 VPN 相關的路由都在一張獨立的 vpn_table 管理。

但是，對於 `192.168.4.1` 而言，他會先 match `vpn_table` 裡面的 `192.168.4.0/30`，就不滿足我們希望 main 裡面有定義 `192.168.4.0/24`的情況下，優先走本地的路由到 eth0。

這時 `suppress_prefixlength` 就派上用場了。我們可以修改 `main` 表的查詢規則：

Bash

```bash
# 新增一條規則，查詢 main 表，但忽略預設路由
ip rule add prio 5000 suppress_prefixlength 0 lookup main

# 再新增一條規則，專門用來處理預設路由
ip rule add prio 32766 lookup main
```

現在 routing policy 長這樣：
```bash
$ ip rule
0:	    from all lookup local
5000:	from all lookup main suppress_prefixlength 0
10000:  from all lookup 100
32766:	from all lookup main
32767:	from all lookup default
```

這樣，我們就實現了更複雜的邏輯：`local` -> `main` (僅本地路由) -> `vpn_table` -> `main` (預設閘道)。

當然，這樣有重複的 route 可能會有點奇怪，但實際使用上，我們可能是希望 VPN table 裡面包含通用的一些 route，然後我們本地透過 main table 實現一些特殊路由規則。

## 總結

透過本文的探討，我們了解了 Linux 網路不僅僅只有一張路由表。其核心是一個由 `ip rule`（路由策略）和多張 `ip route`（路由表）組成的強大決策系統。封包首先由 `ip rule` 根據其優先級和選擇器進行匹配，決定要去哪一張 `ip route` 表中尋找路由，最終確定其離開本機的介面。

掌握了路由策略，你就能夠在 Linux 環境下實現來源路由、策略路由、VPN 分流等各種複雜的網路需求，讓你的網路配置更加靈活與強大。