---
categories:
  - Kubernetes
description: CNCF 的 Container Network Interface (CNI) Specification 導讀，包含 CNI SPEC 及 CNI Plugin
tags:
  - CNI
  - 文件翻譯
date: 2022-09-05
title: CNI-Spec-Guiding
---

## 前言

這次來嘗試寫寫看 spec 導讀，今天要講的是 [Container Network Interface (CNI) Specification](https://github.com/containernetworking/cni/blob/spec-v1.0.0/SPEC.md)。CNI 是 [CNCF](https://cncf.io/) 的一個專案，這個專案包含了今天要講的 CNI SPEC 以及基於這個 SPEC 開發出來 libraries 還有一系列的 CNI plugins。

<!-- more -->

CNI 定義了一套 plugin-based 的網路解決方案，包含了設定還有呼叫執行的標準，使用 CNI 最知名的專案應該就是 kubernetes 了，在 k8s 環境中，容器的網路並不是直接由 container runtime (ex. Docker) 處理的，container runtime 建立好容器後，kubelet 就會依照 CNI 的設定和通訊標準去呼叫 CNI plugin，由 CNI plugin 來完成容器的網路設置。

Container runtime 在執行容器建立時，會依據設定檔 (後續稱為 network configuration) 的指示，依序呼叫一個或多個的 CNI plugin 來完成網路功能的設置，一個網路功能的設置可能會需要多個 CNI plugins 之間的相互合作，或著由多個 CNI plugin 提供多個不同的網路功能。

<!-- more -->

## Overview

目前 CNI spec 的版本是 1.0.0，CNI 的 repository 裡面除了 spec 文件外也包含了基於 CNI spec 開發的 go library，用於 CNI plugin 的開發。不過 CNI spec 和 library 的版本號是獨立的，當前的 library 版本是 1.1.2。

首先要對幾個基本名詞定義

- container 是一個網路獨立的環境，在 linux 上通常透過 network namespace 的機制來切割，不過也可能是一個獨立的 VM。
- network 是 endpoints 的集合，每個 endpoint 都有著一個唯一是別的的地址 (通常是 ip address) 可用於互相通訊。一個端點可能是一個容器、VM 或著路由器之類的網路設備。
- runtime 指的是呼叫執行 CNI plugin 的程式，以 k8s 來說，kubelet 作為這個角色
- plugin 指的是一個用來完成套用特定網路設定的程式。

CNI Spec 包含五個部分

1. Network configuration format: CNI 網路設定的格式
2. Execution Protocol: runtime 和 CNI plugin 之間溝通的 protocol
3. Execution of Network Configurations: 描述 runtime 如何解析 network configuration 和操作 CNI plugin。
4. Plugin Delegation: 描述 CNI plugin 如何呼叫 CNI plugin。
5. Result Types: 描述 CNI plugin 回傳的結果格式。

## Section 1: Network configuration format

CNI 定義了一個網路設定的格式，這個格式用於 runtime 讀取的設定檔，也用於 runtime 解析後，plugin 接收的格式，通常來說設定檔是以 ** 靜態 ** 檔案的方式存在主機上，不會任意變更。

CNI 使用了 JSON 作為設定檔的格式，並包含以下幾個主要欄位

- `cniVersion` (string): 對應的 CNI spec 版本，當前是 1.0.0
- `name` (string): 一個在主機上不重複的網路名稱
- `disableCheck` (boolean): 如果 disableCheck 是 true 的話，runtime 就不能呼叫 `CHECK`，`CHECK` 是 spec 定義的一個指令用來檢查網路是否符合 plugin 依據設定的結果，由於一個網路設定可能會呼叫多個 CNI plugins，因此可能會出現網路狀態符合管理員預期，但是 CNI plugin 之間衝突檢查失敗的情況，這時就可以設定 disableCheck
- `plugin` (list): CNI plugin 設定 (Plugin configuration object) 的列表。

### **Plugin configuration object**

plugin configuration object 包含了一些明定的欄位，但 CNI plugin 可能根據需要增加欄位，會由 runtime 在不修改的情況下送給 CNI plugin。

- 必填：
  - `type` (string): CNI plugin 的執行檔名稱
- 可選欄位 (CNI protocol 使用):
  - `capabilities` (dictionary): 定義 CNI plugin 支援的 capabilities，後面在 section 3 會介紹。
- 保留欄位：這些欄位是在執行過程中，由 runtime 生成出來的，因此不應該在設定檔內被定義。
  - `runtimeConfig`
  - `args`
  - 任何 `cni.dev/` 開頭的 key
- 可選欄位：不是 protocol 定義的欄位，但是由於很多 CNI plugin 都有使用，因此具有特定的意義。
  - ipMasq (boolean): 如果 plugin 支援的話，會在 host 上替該網路設置 IP masquerade，如果 host 要做為該網路的 gateway 的話，可能需要該功能。
  - ipam (dictionary): IPAM (IP Address Management) 設置，後面在 section 4 會介紹。
  - dns (dictionary): DNS 設置相關設置
    - nameservers (list of strings): DNS server 的 IP 列表
    - domain (string): DNS search domain
    - search (list of strings),: DNS search domain 列表
    - options (list of strings): DNS options 列表
- 其他欄位：CNI plugin 自己定義的額外欄位。

設定檔範例

```java
{
  "cniVersion": "1.0.0",
  "name": "dbnet",
  "plugins": [
    {
      "type": "bridge",
      //plugin specific parameters
      "bridge": "cni0",
      "keyA": ["some more", "plugin specific", "configuration"],

      "ipam": {
        "type": "host-local",
        //ipam specific
        "subnet": "10.1.0.0/16",
        "gateway": "10.1.0.1",
        "routes": [
            {"dst": "0.0.0.0/0"}
        ]
      },
      "dns": {
        "nameservers": [ "10.1.0.1" ]
      }
    },
    {
      "type": "tuning",
      "capabilities": {
        "mac": true
      },
      "sysctl": {
        "net.core.somaxconn": "500"
      }
    },
    {
        "type": "portmap",
        "capabilities": {"portMappings": true}
    }
  ]
}
```

## Section 2: Execution Protocol

CNI 的工作模式是由 container runtime 去呼叫 CNI plugin 的 binaries，CNI Protocol 定義了 runtime 和 plugin 之間的溝通標準。

CNI plugin 的工作是完成容器網路介面的某種設置，大致上可以分成兩類

- Interface plugin: 建立容器內的網路介面，並確保其連接可用
- Chained plugin: 調整修改一個已建立的介面 (可能同時會需要建立更多額外的介面)

Runtime 透過兩種方式傳遞參數，一是透過環境變數，二是透過 stdin 傳遞 Section 1 定義的 configuration。如果成功的話，結果會透過 stdout 傳遞，如果失敗的話就會錯誤資訊會透過 stderr 傳遞。configuration 和結果、錯誤都是使用 JSON 格式。

Runtime 必須在 Runtime 的網路執行，大多數情況下就是在主機的預設 network namespace/dom0

### Parameters

Protocol 的參數都是透過環境變數來傳遞的，可能的參數如下

- CNI_COMMAND: 當前執行的 CNI 操作 (可能是 `ADD`, `DEL`, `CHECK`. `VERSION`)
- CNI_CONTAINERID: 容器的 ID
- CNI_NETNS: 容器網路空間的參考，如果是使用 namespaces 的方式來切割的話，就是 namespce 的路徑（e.g. `/run/netns/[nsname]` )
- CNI_IFNAME: 要建立在容器內的介面名稱，如果 plugin 無法建立該名稱則回傳錯誤
- CNI_ARGS: 其他參數，Alphanumeric 格式的 key-value pairs，使用分號隔開”e.g. `FOO=BAR;ABC=123`
- CNI_PATH: CNI plugin 的搜尋路徑，因為 CNI 存在 CNI plugin 呼叫 CNI plugin 的情況，所以需要這個路徑。如果包含多個路徑，使用 OS 定義的分隔符號分割。Linux 使用 `:` ，Windows 使用 `;`

### Errors

如果執行成功，CNI Plugin 應該回傳 0。如果失敗則回傳非 0，並從 stderr 回傳 error result type structure。

### CNI operations

### ADD

CNI plugin 會在 `CNI_NETNS` 內建立 `CNI_IFNAME` 介面或對該介面套用特定的設置

如果 CNI plugin 執行成功，應該從 stdout 回傳一個 result structure。如果 plugin 的 stdin 輸入包含 prevResult，他必些直接把 prevResult 包在 result structure 內或對他修改後在包在 result structure 內，runtime 會把前一個 CNI 輸出的 prevResult 包在下一個 CNI 的 stdin 輸入內。

如果 CNI plugin 嘗試建立介面時，該介面已經存在，應該發出錯誤。

Runtime 不應該在沒有 DEL 的情況下對一個 `CNI_CONTAINERID` 容器的一個 `CNI_IFNAME` 介面多次呼叫 ADD。不過可能對同一個 container 的不同介面呼叫 ADD。

必有的輸入包含 STDIN JSON configuration object、 `CNI_COMMAND`、`CNI_CONTAINERID` 、 `CNI_NETNS` 和 `CNI_IFNAME` 。 `CNI_ARGS` 和 `CNI_PATH` 為可選項。

### DEL

移除 `CNI_NETNS` 內的 `CNI_IFNAME` 介面，或還原 ADD 套用的網路設定

通常來說，如果要釋放的資源已經不存在，DEL 也應該視為成功。例如容器網路已經不存在了，一個 IPAM plugin 應該還是要正常的釋放 IP 和回傳成功，除非 IPAM plugin 對容器網路存在與否有嚴格的要求。即便是 DHCP plugin，雖然執行 DEL 操作的時侯，需要透過容器網路發送 DHCP release 訊息，但是由於 DHCP leases 有 lifetime 的機制，超時後會自動回收，因此即便容器網路不存在，DHCP plugin 在執行 DEL 操作時，也應該該回傳成功。

如果重複對一個 `CNI_CONTAINERID` 容器的 `CNI_IFNAME` 介面執行多次 DEL 操作，plguin 都應該回傳，即便介面已經不存在或 ADD 套用的修改已經還原。

必有的輸入包含 STDIN JSON configuration object、 `CNI_COMMAND`、`CNI_CONTAINERID` 和 `CNI_IFNAME`。 `CNI_NETNS`、`CNI_ARGS` 和 `CNI_PATH` 為可選項。

### CHECK

Runtime 透過 `CHECK` 檢查容器的狀態，並確保容器網路符合預期。CNI spec 可以分為 plugin 和 runtime 的兩部分

Plugin:

- plugin 必須根據 `prevResult` 來判斷介面和地址是否符合預期
- plugin 必須接受其他 chained plugin 對介面修改的結果
- 如果 plugin 建立並列舉在 `prevResult` 的 CNI Result type 資源 (介面、地址、路由規則) 不存在或不符合預期狀態，plugin 應該回傳錯誤
- 如果其他不在 Result type 內的資源不存在或不符合預期也應該回垂錯誤。可能的資源如下
  - 防火牆規則
  - 流量控管 (Traffic shaping controls)
  - IP 保留 (Reservation)
  - 外部依賴，如連接所需的 daemon
- 如果發現容器網路是無法訪問的應該回傳錯誤
- plugin 必須在完成 `ADD` 後能夠立即處理 `CHECK` 指令，應此 plguin 應該要容忍非同步完成的網路設置在一定的時間內不符合預期。
- plugin 執行 `CHECK` 時，應該呼叫所有 delegated plugin 的 `CHECK`，並把 delegated plugin 的錯誤傳給 plugin 的呼叫者

Runtime:

- Runtime 不應該在未執行 `ADD` 前或已經 `DEL` 後沒在執行一次 `ADD` 的容器執行 `CHECK`
- 如果 configuration 的 disableCheck 為真，runtime 不應呼叫 disableCheck
- Runtime 呼叫 `CHECK` 時，configuration 必須在 `prevResult` 包含前一次 `ADD` 操作時最後一個 plugin 的 Result。Runtime 可能會使用 libcni 提供的 Result caching 功能。
- 如果其中一個 plugin 回傳錯誤，runtime 可能不會呼叫後面 plugin 的 `CHECK`
- Runtime 可能會在 `ADD` 完後的下一刻一直到 `DEL` 執行前的任何時間執行 `CHECK`
- Runtime 可能會假設一個 `CHECK` 失敗的容器會永久處於配置錯誤的狀態

必有的輸入包含 STDIN JSON configuration object、 `CNI_COMMAND`、`CNI_CONTAINERID`、`CNI_NETNS` 和 `CNI_IFNAME`。 `CNI_ARGS` 和 `CNI_PATH` 為可選項。

除了 `CNI_PATH` 以外的參數必須和 `ADD` 時一致。

### VERSION

Plugin 透過 stdout 輸出 JSON 格式的 version result type object，用於查看 CNI plugin 的版本。

Stdin 輸入的 JSON 物件只包含 `cniVersion`。
環境變數參數只需要 `CNI_COMMAND`。

## Section 3: Execution of Network Configurations

這個章節描述了 runtime 如何解析 network configuration，並執行 CNI plugins。Runtime 可能會想要新增、刪除、檢查 configuration，並對應到 CNI plugin 的 `ADD`, `DELETE`, `CHECK` 操作。這個章節也定義 configuration 是如何改變並提供給 plugin 的。

對容器的 network configuration 操作稱之為 attachment，一個 attachment 通常對應到一個特定 `CNI_CONTAINERID` 容器的 `CNI_IFNAME` 介面。

### 生命週期

- Runtime 必須在呼叫任何 CNI Plugin 之前，為容器建立新的 network namespace
- Runtime 一定不能同時在一個容器執行多個 plugin 命令，但是同時處理多個容器是可以的。因此 plugin 必須能夠處理多容器 concurrency 的問題，並在共享的資源 (e.g. IPAM DB) 實作 lock 機制
- Runtime 必須確保 `ADD` 操作後必定執行一次 `DEL` 操作，即便 `ADD` 失敗。唯一可能的例外是如結點直接丟失之類的災難性事件。
- `DEL` 操作可能連續多次執行
- network configuration 在 ADD 和 DEL 操作之間，以及不同的為 attachment 之間應該保持一致不變
- runtime 必須負責清除容器的 network namespace

### Attachment Parameters

Network configuration 在不同的 attachments 間應該保持一致。不過 runtime 會傳遞其他每個 attachment 獨立的參數。

- Container ID: 對應到 Section 2 `CNI_CONTAINERID` 環境變數
- Namespace: 對應到 `CNI_NETNS` 環境變數
- Container interface name: 對應到 `CNI_IFNAME` 環境變數
- Generic Arguments: 對應到 `CNI_ARGS` 環境變數
- Capability Arguments:
- CNI plugins search path: 對應到 `CNI_PATH` 環境變數

### Adding an attachment

對 configuration 的 `plugins` 欄位的每個 plugin configuration 執行以下步驟

1. 根據 `type` 欄位尋找 CNI plugin 的執行檔，如果找不到則回傳錯誤
2. 根據 plugin configuration 生成送給 plugin sdtin 的 configuration

- 只有第一個執行的 plugin 不會帶 prevResult 欄位，後續執行的 plugin 都會把前一個的 plugin 的結果放在 prevResult

1. 執行 plugin 的執行檔。設置 `CNI_COMMAND=ADD`，提供前面定義的環境變數，以及透過 standard in 傳輸生成出來的 configuration
2. 如果 plugin 回傳錯誤，中斷執行並回傳錯誤給 caller

Runtime 必須持久保存最後一個 plugin 的結果，用於 check 和 delete 操作。

### Deleting an attachment

刪除 attachment 和添加基本上差不多的，差別是

- plugin 的執行順序是反過來的，從最後一個開始
- `prevResult` 欄永遠是上一次 add 操作時，最後一個 plugin 的結果

對 configuration 的 `plugins` 欄位反序的每個 plugin configuration 執行以下步驟

1. 根據 `type` 欄位尋找 CNI plugin 的執行檔，如果找不到則回傳錯誤
2. 根據 plugin configuration 和上次 ADD 執行的 result 生成送給 plugin sdtin 的 configuration
3. 執行 plugin 的執行檔。設置 `CNI_COMMAND=DEL`，提供前面定義的環境變數，以及透過 standard in 傳輸生成出來的 configuration
4. 如果 plugin 回傳錯誤，中斷執行並回傳錯誤給 caller

### Checking an attachment

如同 Section 2 所述，Runtime 會透過 CNI plugin 檢查每個 attachment 是否正常運作中。
需注意的是 Runtime 必須使用和 add 操作時一致的 attachment parameters

檢查和添加只有兩個差別

- `prevResult` 欄永遠是上一次 add 操作時，最後一個 plugin 的結果
- 如果 network configuation 中 `disableCheck` 為真，則直接回傳成功

對 configuration 的 `plugins` 欄位的每個 plugin configuration 執行以下步驟

1. 根據 `type` 欄位尋找 CNI plugin 的執行檔，如果找不到則回傳錯誤
2. 根據 plugin configuration 和上次 ADD 執行的 result 生成送給 plugin sdtin 的 configuration
3. 執行 plugin 的執行檔。設置 `CNI_COMMAND=CHECK`，提供前面定義的環境變數，以及透過 standard in 傳輸生成出來的 configuration
4. 如果 plugin 回傳錯誤，中斷執行並回傳錯誤給 caller

### Deriving execution configuration from plugin configuration

在 add, delete, check 操作時，runtime 必須根據 network configuration 生成出 plugin 可以存取的 execution configuration (基本對應到 plugin configuration)，並填入內容。

如同 section 2 所述，execution configuration 使用 JSON 格式並透過 stdin 傳給 CNI plugin。

- 必要的欄位如下：
  - cniVersion: 同 network configuraion 中 cniVersion 的值
  - name: 同 network configuraion 中 name 的值
  - runtimeConfig: runtime 需要和 plugin 可提供的 capabilities 的聯集 (capability 會在後面討論)
  - prevResult: CNI plugin 回傳的 Result type 結果
- `capabilities` 欄位必須被移除
- 其他 plugin configuration 的欄位應該被放入 execution configuration

### Deriving runtimeConfig

相對於靜態的 network configuration 來說，runtime 可能會需要根據每個不同的 attachment 產生動態參數。
雖然 runtime 可以透過 `CNI_ARGS` 傳遞動態參數給 CNI plugin，但是我們沒辦法預期說 CNI plugin 會不會接收這個參數。透過 capabilities 欄位，可以明定 plugin 支援的功能，runtime 根據 capabilities 及需求，動態生成設定並填入 `runtimeConfig`。CNI spec 沒有定義 capability，但是比較通用的 capability 有列舉在另外一份 [文件](https://github.com/containernetworking/cni/blob/main/CONVENTIONS.md#dynamic-plugin-specific-fields-capabilities--runtime-configuration)。

以 kubernetes 常用的 Node port 功能來說，需要 CNI plugin 支援 portMappings 這個 capability。
在 section 1 的定義中，plugin configuration 包含了 `capabilities` 欄位，在這個欄位填入 `portMappings`，讓 runtime 知道可以透過該 plugin 處理 port mapping。

```json
{
  "type": "myPlugin",
  "capabilities": {
    "portMappings": true
  }
}
```

Runtime 執行 CNI plugin 時，會根據 `capabilities` 生成 `runtimeConfig`，並填入對應的動態參數。

```json
{
  "type": "myPlugin",
  "runtimeConfig": {
    "portMappings": [
      {
        "hostPort": 8080,
        "containerPort": 80,
        "protocol": "tcp"
      }
    ]
  }
  ...
}
```

## Section 4: Plugin Delegation

雖然 CNI 的主要的架構是一系列的 CNI plkugin 依次執行，但這樣的方式有些時候沒辦法滿足 CNI 的需求。CNI plugin 可能會需要將某些功能委託給另外一個 CNI plugin，並存在 plugin 呼叫 plugin 的情況，最常見的案例就是 IP 地址的分配管理。

通常來說，CNI plugin 應該要指定並維護容器的 IP 地址以及下達必要的 routing rules，雖然由 CNI plugin 自主完成可以讓 CNI plugin 有更大的彈性但是也加重了 CNI plugin 的職責和開發難度，讓不同的 CNI plugin 需要重複開發相同的 IP 地址管理邏輯，因此許多 CNI 將 IP 管理的邏輯委託給另一個獨立的 plugin，讓相關邏輯可以直接被複用。對此除了前面提到的 interface plugin 和 chanined plugin，我們定義了第三類的 plugin - IP Address Management Pligin (IPAM plugin)。

由主要的 CNI plugin 去呼叫 IPAM plugin，IPAM plugin 判斷網路介面的 IP 地址、gateway、routing rules，並回傳資訊給主要的 CNI plugin 去完成相對應設置。(IPAM plugin 可能會透過 dhcp 之類的 protocl, 儲存在本地的檔案系統資訊或 network configuration 的 ipam section 取得資訊)

### Delegated Plugin protocol

和 Runtime 執行 CNI plugin 的方式一樣，delegated plugin 也是透過執行 CNI plugin 可執行程式的方式。主要的 plugin 在 `CNI_PATH` 路徑下搜尋 CNI plugin。delegated plugin 必須接收和主要 plugin 完全一致的環境變數參數，以及主要 plugin 透過 stdin 接收到的完整 execute configuration。
如果執行成功則回傳 0，並透過 stdout 返回 Success result type output。

### Delegated plugin execution procedure

- 當 CNI plugin 執行 delegated plugin 時：
  - 在 `CNI_PATH` 路徑下搜尋 plugin 的可執行程式
  - 使用 CNI plugin 的環境變數參數和 execute configuration，作為 delegated plugin 的輸入
  - 確保 delegated plugin 的 stderr 會輸出到 CNI plugin 的 stderr
- 當 plugin 執行 delete 和 check 時，必須執行所有的 delegated plugin，並將 delegated plugin 的錯誤回傳給 runtime
- 當 ADD 失敗時，plugin 應該在回傳錯誤前，先執行 delegated plugin 的 `DEL`

## Section 5: Result Types

- Plugin 的回傳結果使用 JSON 格式，並有三種
  - Success
  - Error
  - Version

### Success

- 如果 plugin 的輸入包含 `prevResult`，輸出必須包含該欄位的值，並加上該 plugin 對網路修改的資訊，如果該 plugin 沒有任何操作，則該欄位必須保持原輸入內容。

Success Type Result 的欄位如下

- cniVersion: 同輸入的 `cniVersion` 版本
- interfaces: 一個該 plugin 建立的 interface 資訊的陣列，包含 host 的 interface。
  - name: interface 的名子
  - mac: interface 的 mac address
  - sandbox: 該介面的網路環境參考，例如 network namespace 的路徑，如果是 host 介面則該欄位為空，容器內的介面該值應為 `CNI_NETNS`
- ips: 該 plugin 指定的 ip
  - address: CIDR 格式的 ip address (e.g. 192.168.1.1/24)
  - gateway: default gateway (如果存在的話)
  - interface: 介面的 index，對應到前述 interfaces 陣列
- routes: plugin 建立的 routing rules
  - dst: route 的目的 (CIDR)
  - gw: nexthop 地址
- dns
  - nameservers: DNS server 位置陣列 (ipv4 或 ipv6 格式)
  - domain: DNS 搜尋的 local domain
  - search (list of strings): 有優先度的 search domain
  - options (list of strings): 其他給 dns resolver 的參數
- Delgated plugin 可能會忽略不需要的欄位
  - IPAM 必須回傳一個 abbreviated Success Type result (忽略 interfaces 和 ips 裡面的 interface 欄位)

### Error

plugin 回傳的錯誤資訊，欄位有 `cniVersion`, `code`, `msg`, `details`。

```json
{
  "cniVersion": "1.0.0",
  "code": 7,
  "msg": "Invalid Configuration",
  "details": "Network 192.168.0.0/31 too small to allocate from."
}
```

Error code 0-99 被保留給通用的錯誤，100 以上是 plugin 自定義的錯誤。

| Error code | 描述                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| 1          | 不支援的 CNI 版本                                                               |
| 2          | 不支援的 network configuration 欄位，error message 會包含不支援的欄位名稱和數值 |
| 3          | 未知或不存在的容器，這個錯誤同時代表 runtime 不需要執行 DEL 之類的清理操作      |
| 4          | 無效的環境環境變數參數，error message 會包含無效的欄位名稱                      |
| 5          | IO 錯誤，例如無法讀取 stdin 的 execute configuration                            |
| 6          | 解析錯誤，例如無效的 execute configuration JSON 格式                            |
| 7          | 無效的 network configuration                                                    |
| 11         | 稍後在嘗試，存在暫時無法操作的資源，runtime 應該稍後重試                        |

- 此外，stderr 也可被用於非 JSON 結構的錯誤訊息，如 log

### Version

- Version Type Result 的欄位如下
  - cniVersion: 同輸入的 `cniVersion` 版本
  - supportedVersions: 一個支援的 CNI 版本陣列

```json
{
  "cniVersion": "1.0.0",
  "supportedVersions": ["0.1.0", "0.2.0", "0.3.0", "0.3.1", "0.4.0", "1.0.0"]
}
```

## Appendix:

在 CNI SPEC 裏面包含了一些 configuration 和執行過程中 plugin 輸入輸出的範例，可以參考 [原始文件](https://github.com/containernetworking/cni/blob/spec-v1.0.0/SPEC.md#appendix-examples)
另外還有一份 CNI 的文件 [CONVENTIONS](https://github.com/containernetworking/cni/blob/main/CONVENTIONS.md)，描述許多 spec 裡面沒有定義但是許多 plugin 常用的欄位。

## 小節

以上是對 [CNI spec 1.0.0](https://github.com/containernetworking/cni/blob/spec-v1.0.0/SPEC.md) 的導讀，希望對大家有幫助。
