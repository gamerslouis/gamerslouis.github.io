---
categories:
  - 學習 eBPF 系列
  - 2022 iThome鐵人賽
description: 2022 iThome鐵人賽 學習eBPF系列 介紹eBPF實例neighbor_sharing以及Linux tc子系統
tags:
  - eBPF
date: 2022-10-31
title: 學習 eBPF 系列 7 - tc & BCC neighbor_sharing
---

接續前一篇主題  `XDP`，今天我們要繼續來聊聊 eBPF 在 linux netowrk data path 上的另外一個進入點  `tc`，並同樣以 bcc 的  [neighbor_sharing](https://github.com/iovisor/bcc/blob/master/examples/networking/neighbor_sharing/)  作為範例。

<!-- more -->

## Linux tc 介紹

首先我們要先聊聊  `tc`  是什麼東西。Traffic Control (tc) 是 linux kernel 網路系統裡面和 netfilter/iptables 同等重要的一個組件。不過 netfilter 主要著重在 packet mangling (封包修改) 和 filter (過濾)。而 tc 的重點是在調控流量，提供限速、整形等功能。

tc 的工作時機點分成  `ingress tc`  和  `egress tc`，以  `ingress tc`  來說，他發生在 skb allocation 之後，進入 netfilter 之前。`ingress tc`  主要用於輸入流量控制，`egress tc`  則用於流量優先級、QoS 的功能。在傳統使用上，tc 更主要是用在  `egress tc`，`ingress tc`  本身有比較大的功能限制。

在  `tc`  裡面有三個主要的概念，`qdisc`、`class`  和  `filter (classifier)`。

tc 的基礎是 queue，封包要進出主機時，會先進入 queue，根據特定的策略重新排序、刪除、延遲後再交給網卡送出，或 netfilter 等系統收入。

`qdisc`  是套用在這個 queue 上面的策略規則。下列舉例一部份:

- 最基本的策略規則是 pfifo，就是一個簡單的 FIFO queue，只能設定 queue 的可儲存的封包大小和封包個數。
- 更進階的如 pfifo_fast，會根據 ip 封包內的  `ToS`  欄位將封包分成三個優先度，每個優先度內是走 FIFO 規則，但是會優先清空高優先度的封包。
- [sfq](https://man7.org/linux/man-pages/man8/tc-sfq.8.html)  則是會根據 tcp/udp/ip 欄位 hash 的結果區分出不同的連線，將不同連線的封包放入獨立的 bucket 內，然後 bucket 間使用輪尋的方式，來讓不同連線均等的輸出。
- ingress 是專門用在 ingress tc 的 qdisc 上面的 qdisc 都歸為 classless QDisc，因為我們不能透過自定義的方式對流量進行分類，提供不同的策略。

與 classless 相反的是 classful qdisc，在 classful qdisc 內，我們可以以定義出多個  `class`，針對不同的 class 設定不同的限速策略等規則。也可以將多個 class 附屬在另外一個 class 下，讓子 class 共用一個父 class 的最大總限速規則，但是子分類又獨立有限速規則等等。

而要對流量進行分類就會用到  `filter`, 對於某個 qdisc (classless/classful 皆可) 或著父 class 上的封包，如果滿足 filter 的條件，就可以把封包歸到某個 class 上。除了歸類到某個 class 上，filter 也可以設置為執行某個 action，包括丟棄封包、複製封包流量到另外一個網路介面上之類的…

對於 qdisc 和 class 在建立時需指定或自動分配一個在網卡上唯一的 handle 作為識別 id，格式是  `<major>:<minor>`(數字)，對於 qdisc 來說只有 major 的部分  `<major>:`，對 class 來說 major 必須與對應 qdisc 相同。

另外在 egress pipeline 可以有多個 qdisc，其中一個作為 root，其他的藉由 filter 從 root qdisc dispatch 過去，所以需要有 major 這個欄位。

在 linux 上面主要透過  `tc`  這個指令來設置  `qdisc`、`class`  和  `filter`。

```shell
#  添加 eth0 egress 的 root qdisc，類型是 htb，後面是 htb 的參數
tc qdisc add dev enp0s3 root handle 1: htb default 30
#  添加 eth 的 ingress qdisc
tc qdisc add dev enp0s3 ingress

#  設置一個 class，速度上下限都是 20mbps，附屬於 eth0 的 root qdisc (1:) 下
tc class add dev enp0s3 partent 1: classid 1:1 htb rate 20mbit ceil 20mbit

#  當封包為 ip, dst port 80 時分類到上述分類
tc filter add dev enp0s3 protocol ip parent 1: prio 1 u32 match ip dport 80 0xffff flowid 1:1
```

```shell
#  查看 egress filter
tc filter show dev eth0

#  查看 ingress filter
tc filter show dev eth0 ingress
```

## eBPF 與 tc

eBPF 在 tc 系統裡面是在  `filter`  的部分作用，並可分成兩種模式，classifier (BPF_PROG_TYPE_SCHED_CLS) 和 action (BPF_PROG_TYPE_SCHED_ACT)。

- classifier: 前者分析封包後，決定是否 match，並可以將封包分類給透過 tc 指令預設的 classid 或著重新指定 classid。
  - 0: mismatch
  - 1: match, 使用 filter 預設的 classid
  - 直接回傳一個 classid
- action: 作為該  `filter`  的 action，當 tc 設置的 filter 規則 match 後，呼叫 eBPF 程式決定 action 是 drop (2), 執行預設 action (-1) 等。下列是 action 的完整定義

```c
#define TC_ACT_UNSPEC	(-1)
#define TC_ACT_OK		0
#define TC_ACT_RECLASSIFY	1
#define TC_ACT_SHOT		2
#define TC_ACT_PIPE		3
#define TC_ACT_STOLEN		4
#define TC_ACT_QUEUED		5
#define TC_ACT_REPEAT		6
#define TC_ACT_REDIRECT		7
#define TC_ACT_JUMP		0x10000000
```

## BCC neighbor_sharing

### 介紹

這次要看的是  `examples/networking/neighbor_sharing`。([原始碼](https://github.com/iovisor/bcc/blob/master/examples/networking/neighbor_sharing/))

這次的 eBPF 程式會提供 QoS 的服務，對經過某張網卡的針對往特定的 IP 提供不同的限速群組。

```text
                         /------------\                        |
neigh1 --|->->->->->->->-|            |                        |
neigh2 --|->->->->->->->-|    <-128kb-|        /------\        |
neigh3 --|->->->->->->->-|            |  wan0  | wan  |        |
         | ^             |   br100    |-<-<-<--| sim  |        |
         | clsfy_neigh () |            |   ^    \------/        |
lan1 ----|->->->->->->->-|    <--1Mb--|   |                    |
lan2 ----|->->->->->->->-|            |   classify_wan ()       |
           ^             \------------/                        |
           pass ()                                              |
```

上圖是 neighbor_sharing 自帶的網路拓譜圖，neight1-3, lan1-2, wan0 是獨立的 network namespace 擁有獨立的 IP，neighbor_sharing 會在 wansim 到 br100 的介面上建立  `ingress tc`，針對 neigh1-3 的 IP 提供總共 128kb/s 的網路速度，對其他 IP 提供總共 1024kb/s 的網路速度。

首先在測試之前要先安裝 pyroute2 和 netperf，前者是 python 接接 tc 指令的 library，後者是用來測試網速的工具。另外要記得設置防火牆規則不然 br100 不會轉發封包

```shell
pip3 install pyroute2
apt install netperf
iptables -P FORWARD ACCEPT
sysctl -w net.ipv4.ip_forward=1
```

neight1-3 會被分配 172.16.1.100-102 的 IP, lan 則是 172.16.1.150-151。

```shell
sudo ip netns exec wan0 netperf -H 172.16.1.100 -l 2 -k
MIGRATED TCP STREAM TEST from 0.0.0.0 (0.0.0.0) port 0 AF_INET to 172.16.1.100 () port 0 AF_INET : demo
Recv   Send    Send
Socket Socket  Message  Elapsed
Size   Size    Size     Time     Throughput
bytes  bytes   bytes    secs.    10^6bits/sec

 131072  16384  16384    6.00      161.45
```

透過 netperf 可以測出來到 neight1 的封包流量被限制在約 161.45 kbits/sec。

```shell
ip netns exec wan0 netperf -H 172.16.1.150 -l 2 -f k
MIGRATED TCP STREAM TEST from 0.0.0.0 (0.0.0.0) port 0 AF_INET to 172.16.1.150 () port 0 AF_INET : demo
Recv   Send    Send
Socket Socket  Message  Elapsed
Size   Size    Size     Time     Throughput
bytes  bytes   bytes    secs.    10^3bits/sec

131072  16384  16384    2.67     1065.83
```

而到 lan1 大約是 1065.83kbits/sec，接近預先設置的規則。

### python 實作

這次會先看 python 的程式碼，由於這次的程式碼包含大量用來建立測試環境的部分，所以會跳過只看相關的內容。

```python
b = BPF (src_file="tc_neighbor_sharing.c", debug=0)

wan_fn = b.load_func ("classify_wan", BPF.SCHED_CLS)
pass_fn = b.load_func ("pass", BPF.SCHED_CLS)
neighbor_fn = b.load_func ("classify_neighbor", BPF.SCHED_CLS)
```

首先這次的 eBPF 程式包含三個部分，因此會分別載入，並且全部都是 classifier (BPF_PROG_TYPE_SCHED_CLS)

```python
ipr.tc ("add", "ingress", wan_if ["index"], "ffff:")
ipr.tc ("add-filter", "bpf", wan_if ["index"], ":1", fd=wan_fn.fd,
	   prio=1, name=wan_fn.name, parent="ffff:", action="drop",
	   classid=1, rate="128kbit", burst=1024 * 32, mtu=16 * 1024)
ipr.tc ("add-filter", "bpf", wan_if ["index"], ":2", fd=pass_fn.fd,
	   prio=2, name=pass_fn.name, parent="ffff:", action="drop",
	   classid=2, rate="1024kbit", burst=1024 * 32, mtu=16 * 1024)
```

接著會建立 wan_if 的 ingress qdisc (wan_if 是 wan0 接到 br100 的介面)，並且會 ingress qdisc 下建立兩條 filter，首先它的 type 指定為 bpf 並透過  `fd=wan_fn.fd`  選定 eBPF program，所以會交由 eBPF classifier 來決定是不是要 match。

> classifier match 後就會執行下屬的 policing action，跟 classid 無關，且在這次的範例中並不存在 class，所以 classid 其實是無意義的，不一定要設置。

後半段  `action="drop", rate="128kbit", burst=1024 * 32, mtu=16 * 1024`  定義了一條 policing action，只有當封包滿足 policy 條件時才會觸發具體的 action，這邊指定是流量超出 128kbit 時執行 drop，也就達到了限制 neigh 流量的效果。

第二條同理，match pass_fn 並且流量到達 1024kbit 時執行 drop，由於 pass_fn 顧名思義是無條件 match 的意思，所以等價於所有非 neigh 的流量共用這一條的 1024kbit 流量限制。

因此總結來說，eBPF 程式 wan_fn 透過某種方式判斷封包是否是往 neigh 的 ip，是的話就 match 第一條 filter 執行 policing action 來限流，不然就 match 第二條 filter 來做限流。

```python
ret = self._create_ns ("neighbor% d" % i, ipaddr=ipaddr,
                                  fn=neighbor_fn, cmd=cmd)
```

接著就會看到，在建立 neigh1-3 的 namespace 時，attach 了 neighbor_fn 到網卡上，因此就很好理解了 neighbor_fn 監聽了從 neigh 發出的封包，解析拿到 neigh 的 IP 後，透過 map share 給 wan_fn，讓 wan_fn 可以根據 ip 決定要不要 match 第一條 policing action。

### eBPF 實作

到這裡其實就分析出整個程式的執行邏輯了，我們接續來看看 neighbor_sharing 的 eBPF 程式，這次的 eBPF 程式分成三個部分，首先是接在每個 neigh ingress 方向的 classify_neighbor，接著是接在 wan0 ingress 方向的 classify_wan 和 pass。

前面說到出來  `classify_neighbor`  要做的事情就是紀錄 neigh1-3 的 IP，提供給  `classify_wan`  判斷是否要 match 封包，執行 128kbits 的流量限制。

```c
struct ipkey {
  u32 client_ip;
};

BPF_HASH (learned_ips, struct ipkey, int, 1024);
```

首先定義了一個 hash map 用 key 來儲存所有 neigh 的 IP

```c
int classify_neighbor(struct __sk_buff *skb) {
  u8 *cursor = 0;
  ethernet: {
    struct ethernet_t *ethernet = cursor_advance (cursor, sizeof(*ethernet));
    switch (ethernet->type) {
      case ETH_P_IP: goto ip;
      default: goto EOP;
    }
  }
  ip: {
    struct ip_t *ip = cursor_advance (cursor, sizeof(*ip));
    u32 sip = ip->src;
    struct ipkey key = {.client_ip=sip};
    int val = 1;
    learned_ips.insert (&key, &val);
    goto EOP;
  }
EOP:
  return 1;
}
```

接著  `classify_neighbor`  就會用 cursor 解析出 source ip，將其作為 hash map 的 key 放到 learned_ips 裡面，value 則都設為 1。不論如何都會 return 1 放行封包。雖然其實這是 neighbor ingress 方向上唯一的一條 filter，所以不論回傳值為多少其實都可以，不影響執行結果。

> 這邊就要提到第一次學習 tc 還有 classifier 時會感到很困惑的地方了，首先 classifier 的回傳值 0 表示 mismatch, 1 表示 match 並轉移到預設的 class，其餘回傳值表示直接指定 classid 為回傳的數值。接著不論 classid 是多少，都會執行 filter 上面綁定的 action。在這次的範例中，所有的 filter 其實都不存在任何的 class，因此 return 值唯一的意義是控制是否要執行 action。這邊 classify_neighbor 綁定的 action 是 ok，表示放行封包的意思

```c
int classify_wan(struct __sk_buff *skb) {
  u8 *cursor = 0;
  ethernet: {
    struct ethernet_t *ethernet = cursor_advance (cursor, sizeof(*ethernet));
    switch (ethernet->type) {
      case ETH_P_IP: goto ip;
      default: goto EOP;
    }
  }
  ip: {
    struct ip_t *ip = cursor_advance (cursor, sizeof(*ip));
    u32 dip = ip->dst;
    struct ipkey key = {.client_ip=dip};
    int *val = learned_ips.lookup (&key);
    if (val)
      return *val;
    goto EOP;
  }
EOP:
  return 0;
}
```

接著看到  `classify_wan`，他會提取封包的 dst ip address，並嘗試搜尋 learned_ips，如果找的到就表示這個是 neighbor 的 ip，回傳 map 對應的 value，前面提到所有的 value 都會設置為 1，因此表示 match 的意思，不然就跳轉到 EOP 回傳 0，表示 mismatch。同樣由於這邊不存在 class，因此 value 只要是非 0 即可，只是用來 match 執行 policing action。

```c
int pass(struct __sk_buff *skb) {
  return 1;
}
```

最後的  `pass`  其實就是一條無條件回傳 1 表示 match，來執行 wan0 方向第二條 1024kbits/sec 的限流政策用的。

## tc 與 XDP 比較

在 eBPF 裡面，XDP 和 TC 兩個功能常常被拿來一起討輪，前面有提到 eBPF 可以做為 tc actions 使用來達到封包過濾之類的效果，雖然實行效果上是比不上 XDP 的，但是 tc ingress 的 eBPF hook point 也在 kernel data path 的最早期，因此也能夠提供不錯的效能，加上 tc ebpf program 的 context 是  `sk_buff`，相較於  `xdp_buff`，可以直接透過  `__sk_buff`  取得和修改更多的 meta data，加上 tc 在 ingress 和 egress 方向都有 hook point，不像 XDP 只能作用在 ingress 方向，且 tc 完全不需要驅動支援即可工作，因此 tc 在使用彈性和靈活度上是比 XDP 更占優的。

> 不過 tc 其實也有提供 offload 的功能，將 eBPF 程式 offload 到網卡上面執行。

## Direct action

然而由於 tc 的 hook point 分成 classifier 和 action 因此無法透過單一個 eBPF 程式做到 match-action 的效果，然而大多數時候 eBPF tc 程式的開發並不是要利用 tc 系統的功能做限速等功能，而是要利用 tc 在 kernel path 極早期這點做 packet mangling 和 filter 等事項，再加上 tc 系統的使用學習難度相對高，因此 eBPC 在 tc 後引入了  [direct-action](https://git.kernel.org/cgit/linux/kernel/git/torvalds/linux.git/commit/?id=045efa82ff563cd4e656ca1c2e354fa5bf6bbda4)  和  [clsact](<https://blog.louisif.me/eBPF/Learn-eBPF-Serial-7-tc-BCC-neighbor-sharing/%5B%601f211a1b929c%60%5D(https://git.kernel.org/cgit/linux/kernel/git/torvalds/linux.git/commit/?id=1f211a1b929c804100e138c5d3d656992cfd5622)>)  這兩個功能。

首先介紹 direct-action (da)，這個是在 classifier (BPF_PROG_TYPE_SCHED_CLS) 可啟用的一個選項，如果啟用 da，classifier 的回傳值就變成是 action，和 BPF_PROG_TYPE_SCHED_ACT 相同，而原本的 classid 改成設置\_\_skb_buff->tc_classid 來傳輸。

> 在 kernel code 內使用 prog->exts_integrated 標示是否啟用 da 功能

透過 da 可以透過單一個 eBPF 程式完成 classifier 和 action 的功能，降低了 tc hook point 對原本 tc 系統框架的依賴，能夠透過 eBPF 程式簡潔的完成功能。

在 da 的使用上可以參考 bcc 的範例  `examples/networking/tc_perf_event.py`，使用上與普通的 classifer 幾乎無異，只要在載入時  `ipr.tc ("add-filter","bpf", me,":1", fd=fn.fd, ... ,direct_action=True)`  加上 direct_action 選項即可。

透過 tc 指令查看時也可以看到  `direct-action`  字樣。

```shell
tc filter show dev t1a
filter parent 1: protocol all pref 49152 bpf chain 0
filter parent 1: protocol all pref 49152 bpf chain 0 handle 0x1 flowid :1 hello direct-action not_in_hw id 308 tag 57cd311f2e27366b jited
	action order 1: gact action pass
	 random type none pass val 0
	 index 2 ref 1 bind 1
```

## clsact

後來 tc 加入了 clsact，clsact 是一個專為 eBPF 設計的偽 qdisc。首先 clsact 同時作用在 ingress 和 egress 方向，也進一步簡化了 ebpf 程式的掛載。

```shell
tc qdisc add dev em1 clsact
tc filter add dev em1 ingress bpf da obj tc-example.o sec ingress
tc filter add dev em1 egress bpf da obj tc-example.o sec egress
```

同時 clsact 工作在真的 qdisc 本身的 lock 之前，因此可以避免 lock 的開銷，預先完成比較複雜繁重的封包分類，在進入到真的 queue filter 時只根據更簡單的欄位 (如 tc_index) 做分類。另外 da 本來只能使用在 ingress 方向，透過 clsact，da 可以工作在 egress 方向。

關於 eBPF tc 的部分就大致上介紹到這裡，對於 tc 這個子系統相對來說是真的蠻陌生的，因此介紹這個部分的確是有比較大的難度和說不清楚的地方。

## 參考資料

- [Classifying packets with filters](https://tldp.org/HOWTO/Adv-Routing-HOWTO/lartc.qdisc.filters.html)
- [tc man page](https://man7.org/linux/man-pages/man8/tc.8.html)
- [用 tc qdisc 管理 Linux 网络带宽](https://arthurchiao.art/blog/lartc-qdisc-zh/)
- [TC (Traffic Control) 命令](https://cloud.tencent.com/developer/article/1409664)
- [Linux TC (Traffic Control) 简介](https://developer.aliyun.com/article/4000)
