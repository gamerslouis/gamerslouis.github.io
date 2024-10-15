---
categories:
  - eBPF
description: 2022 iThome鐵人賽 學習eBPF系列 介紹eBPF實例xdp_redirect_map以及XDP技術
tags:
  - 2022 iThome鐵人賽 - 學習 eBPF 系列
  - 技術分享
date: 2022-10-31
title: 學習 eBPF 系列 6 - XDP & BCC xdp_redirect_map
---

這篇文章會介紹 eBPF 一個比較知名的用途，express data path (XDP)，並使用 bcc 的  [xdp_redirect_map.py](https://github.com/iovisor/bcc/tree/master/examples/networking/xdp/xdp_redirect_map.py)  作為範例。

<!-- more -->

## XDP 介紹

會說 linux 的網路慢主要是因為封包在進出 linux 設備時要經過 linux kernel 的 network stack，經過大家熟悉的 iptables, routing table.. 等網路子系統的處理，然而經由這麼多複雜的系統處理就會帶來延遲，降低 linux 網路的效能。

![Linux network stack ingress](/img/pages/18be2bafe0ce034c553d1ab285368b06.png)

上圖是封包在經由 linux 網路子系統到進入路由前的截圖，可以看到在封包剛進入到 linux kernel，甚至連前面看過，linux 用來維護每一個封包的 skb 結構都還沒建立前，就會呼叫到 XDP eBPF 程式，因此如果我們能夠在 XDP 階段就先過濾掉大量的封包，或封包轉發、改寫，能夠避免掉進入 linux 網路子系統的整個過程，降低 linux 處理封包的成本、提高性能。

前面提到 XDP 工作在封包進入 linux kernel 的非常早期，甚至早於 skb 的建立，其實 XDP 的 hook point 直接是在 driver 內，因此 XDP 是需要 driver 特別支援的，為此 XDP 其實有三種工作模式: `xdpdrv`, `xdpgeneric`,`xdpoffload`。`xdpdrv`  指的是 native XDP，就是標準的 XDP 模式，他的 hook point 在 driver 層，因此是網卡接收到封包送至系統的第一位，可以提供極好的網路性能。`xdpgeneric`: generic XDP 提供一個在 skb 建立後的 XDP 進入點，因此可以在 driver 不支援的情況下提供 XDP 功能，但也由於該進入點比較晚，所以其實不太能提供好的網路效能，該進入點主要是讓新開發者在缺乏支援網卡的情況下用於測試學習，以及提供 driver 開發者一個標準用。`xdpoffload`: 在某些網卡下，可以將 XDP offload 到網卡上面執行，由於直接工作在網卡晶片上，因此能夠提供比 native XDP 還要更好的性能，不過缺點就是需要網卡支援而且部分的 map 和 helper function 會無法使用。

XDP 的 return 數值代表了封包的下場，總共有五種結果，定義在 xdp_action

```c
enum xdp_action {
	XDP_ABORTED = 0,
	XDP_DROP,
	XDP_PASS,
	XDP_TX,
	XDP_REDIRECT,
};
```

- XDP_ABORTED, XDP_DROP 都代表丟棄封包，因此使用 XDP 我們可以比較高效的丟棄封包，用於防禦 DDoS 攻擊。不過 XDP_ABORTED 同時會產生一個 eBPF 系統錯誤，可以透過 tracepoint 機制來查看。

  ```shell
  echo 1 > /sys/kernel/debug/tracing/events/xdp/xdp_exception/enable
  cat /sys/kernel/debug/tracing/trace_pipe
  systemd-resolve-512     [000] .Ns.1  5911.288420: xdp_exception: prog_id=91 action=ABORTED ifindex=2
  ...
  ```

- XDP_PASS 就是正常的讓封包通過不處理。
- XDP_TX 是將封包直接從原始網卡送出去，我們可以透過在 XDP 程式內修改封包內容，來修改目的地 IP 和 MAC，一個使用前景是用於 load balancing，可以將封包打到 XDP 主機，在修改封包送去後端主機。
- XDP_REDIRECT 是比較後來新加入的一個功能，它可以將封包
  - 直接轉送到另外一張網路卡，直接送出去
  - 指定給特定的 CPU 處理
  - 將封包直接送給特定的一個 AF_XDP 的 socket 來達到跳過 kernel stack 直接交由 user space 處理的效過

最後，前面提到 XDP 早於 skb 的建立，因此 XDP eBPF program 的上下文不是**skb**buff，而是使用自己的  `xdp_md`

```c
struct xdp_md {
	__u32 data;
	__u32 data_end;
	__u32 data_meta;
	/* Below access go through struct xdp_rxq_info */
	__u32 ingress_ifindex; /* rxq->dev->ifindex */
	__u32 rx_queue_index;  /* rxq->queue_index  */
};
```

可以看到 xdp_md 是一個非常精簡的資料結構，因為 linux 還沒對其做解析提取出更多資訊。

## xdp_redirect_map 介紹

這次使用的 eBPF program type 理所當然是  `BPF_PROG_TYPE_XDP`。

這隻程式的功能很簡單，執行時指定兩個 interface `in_intf`  和  `out_intf`，所有從  `in_intf`  進入的封包會直接從  `out_intf`  送出去，並且交換 src mac address 和 dst mac address，同時記錄每秒鐘通過該介面的封包個數。

從 out_intf 進入的封包則正常交給 linux network 系統處理。

![XDP example topology](/img/pages/a9331d34d2290f91b34005ca93083999.png)

首先我們一樣要先驗證程式的執行，首先建立一個 network namespace net0。然後把兩個網卡 `veth_in_intf` , `veth_out_intf`

放進去，作為 xdp_redirect_map 使用的網卡。為了方便打流量，我們幫 `in_intf` 指定一個 ip 10.10.10.1，並幫加入一個不存在的遠端 ip 10.10.10.2，接著我們就可以透過 ping 10.10.10.2 來從 in_intf 打流量，透過 tcpdump 捕捉 out_intf 的封包，應該就可以看到從 10.10.10.1 過來的封包，同時 mac address 被交換了，所以可以看到 src mac 變成 ee:11:ee:11:ee:11。

```shell
ip netns add net0
ip link add in_intf type veth peer name veth_in_intf
ip link add out_intf type veth peer name veth_out_intf
ip link set veth_in_intf netns net0
ip link set veth_out_intf netns net0
ip link set in_intf up
ip link set out_intf up
ip netns exec net0 ip link set veth_in_intf up
ip netns exec net0 ip link set veth_out_intf up
ip address add 10.10.10.1/24 dev in_intf
ip neigh add 10.10.10.2 lladdr ee:11:ee:11:ee:11 dev in_intf
```

> 目前這個部分其實沒有驗證成功，雖然根據 xdp redirect 的 log，封包是真的有成功被轉送到 veth_out_intf 的，然後透過 tcpdump 卻沒有在 out_intf 上收到封包，可惜的是具體原因沒能確定。

## xdp_redirect_map 實作

### eBPF 實作

這次的程式非常簡短，首先是一個 swap_src_dst_mac 函數，用於交換封包的 src mac address 和 dst mac address。

```c
static inline void swap_src_dst_mac(void *data)
{
    unsigned short *p = data;
    unsigned short dst [3];
    dst [0] = p [0];
    dst [1] = p [1];
    dst [2] = p [2];
    p [0] = p [3];
    p [1] = p [4];
    p [2] = p [5];
    p [3] = dst [0];
    p [4] = dst [1];
    p [5] = dst [2];
}
```

由於 mac address 在 ethernet header 的前 12 個 bit 所以可以很簡單地進行交換。

接著就直接進入到了 attach 在 in interface 上的 XDP 函數

```c
int xdp_redirect_map(struct xdp_md *ctx) {
    void* data_end = (void*)(long) ctx->data_end;
    void* data = (void*)(long) ctx->data;
    struct ethhdr *eth = data;
    uint32_t key = 0;
    long *value;
    uint64_t nh_off;
    nh_off = sizeof(*eth);
    if (data + nh_off  > data_end)
        return XDP_DROP;
    value = rxcnt.lookup (&key);
    if (value)
        *value += 1;
    swap_src_dst_mac (data);
    return tx_port.redirect_map (0, 0);
}
```

首先 data 及 data_end 是分別指到封包頭尾的指標，由於封包頭都是 ethernet header，因此可以直接將 data 轉成  `ethhdr`  指標。首先對 ethernet 封包做一個完整性檢查，`data + nh_off > data_end`  表示封包大小小於一個 ethernet header，表示封包表示不完整，就直接將封包透過  `XDP_DROP`  丟棄。

接著  `rxcxt`  是預先定義的一個  `BPF_PERCPU_ARRAY (rxcnt, long, 1);`，PER_CPU map 的特性是每顆 CPU 上都會保有一份獨立不同步的資料，因此可以避免 cpu 之間的 race condition，減少 lock 的開銷。這邊指定每個 CPU 上的 array 長度為 1，可以參考 Day11 有介紹過，是一個特別的使用技巧，可以簡單看成一個可以跟 user space share 的全域變數。

```c
uint32_t key = 0;
value = rxcnt.lookup (&key);
if (value)
	*value += 1;
```

這邊的用途是用來統計經過的封包個數，因此這邊非常簡單，統一使用 0 當作 key 去存取唯一的 value，然後每經過一個封包就將 value 加一，這邊可以注意到 lookup 回傳的是 pointer，因此可以直接對他做修改即可保存。

```c
swap_src_dst_mac (data);
return tx_port.redirect_map (0, 0);
```

最後會呼叫  `swap_src_dst_mac`  來交換封包，然後透過  `redirect_map`  來將封包送到對應的 out interface。

BPF_MAP_TYPE_DEVMAP 和 BPF_MAP_TYPE_CUPMAP 是用來搭配 XDP_REDIRECT，將封包導向透定的 CPU 或著從其他 interface 送出去的。

而這邊的 redirect_map 在編譯時會被修改為呼叫 bpf_redirect_map 這個 helper function。其定義為  `long bpf_redirect_map (struct bpf_map *map, u32 key, u64 flags)`，透過接收 map 可以根據對應到的 value 來將封包導向到 interface 或著 CPU，設置方法會在後面的 python code 介紹。由於我們今天只為有一個 out interface，因此可以很簡單的指定 key 為 0

後面的 flags 目前只有使用最後兩個 bit，可以當作 key 找不到時 redirect_map 的回傳值，因此以本次的 code 來說，預設的回傳數值是 0，也就對應到 XDP_ABORTED。

```c
int xdp_dummy(struct xdp_md *ctx) {
    return XDP_PASS;
}
```

最後一段程式碼  `xdp_dummy`  是用來皆在 out interface 上的 XDP 程式，但他就只是簡單的  `XDP_PASS`，讓進入的封包繼續交由 linux kernel 來處理。

### python 實作

接下來就進入到 python code 的部分

```python
in_if = sys.argv [1]
out_if = sys.argv [2]

ip = pyroute2.IPRoute ()
out_idx = ip.link_lookup (ifname=out_if)[0]
```

首先將兩張網卡的名稱讀進來，接著透過 pyroute2 的工具去找到 out interface 的 ifindex

```python
tx_port = b.get_table ("tx_port")
tx_port [0] = ct.c_int (out_idx)
```

接著是設定 tx_port 這張 DEVMAP 的 key 0 為 out interface 的 index，因此所有經過 eBPF 程式的封包都會丟到 out interface

```python
in_fn = b.load_func ("xdp_redirect_map", BPF.XDP)
out_fn = b.load_func ("xdp_dummy", BPF.XDP)
b.attach_xdp (in_if, in_fn, flags)
b.attach_xdp (out_if, out_fn, flags)
```

接著就是將 eBPF 程式 attach 到兩張網卡上

```python
rxcnt = b.get_table ("rxcnt")
prev = 0
while 1:
	val = rxcnt.sum(0).value
	if val:
		delta = val - prev
		prev = val
		print("{} pkt/s".format(delta))
	time.sleep (1)
```

將 eBPF 程式 attach 上去之後就完成了封包重導向的工作，剩下的部分是用來統計每秒鐘經過的封包的，這邊的做法很簡單，每秒鐘都去紀錄一次通過封包總量和前一秒鐘的差異就可以算出來這一秒內經過的封包數量。這邊比較特別的是  `rxcnt.sum`，前面提到 rxcnt 是一個 per cpu 的 map，因此這邊使用 sum 函數將每顆 cpu 的 key 0 直接相加起來，就可以得到經過所有 CPU 的封包總量。
