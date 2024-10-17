---
categories:
  - eBPF
description: 2022 iThome 鐵人賽 學習 eBPF 系列 介紹 eBPF 的基本概念
tags:
  - 2022 iThome 鐵人賽 - 學習 eBPF 系列
  - 技術分享
date: 2022-10-31
title: 學習 eBPF 系列 2 - 基本概念
---

本篇文章將會介紹包含 program type, map 等重要概念還有 eBPF 的載入流程

<!-- more -->

## Program Type

我們可以把 eBPF 程式區分成不同的 BPF program type，不同的 program type 代表實現不同功能的 eBPF 程式。通常不同的 program type 也會有不同 hook point，eBPF 程式的輸入和輸出格式也不同，也就影響到不同的 kernal 組件。

到目前 Linux kernal 5.19 版，linux 總共定義了 32 種的 program type。在 linux kernal source code 的 [include/uapi/linux/bpf.h](https://github.com/torvalds/linux/blob/master/include/uapi/linux/bpf.h) 中定義了 `bpf_prog_type` 列舉，列舉了所有的 program type。

```c
enum bpf_prog_type {
	BPF_PROG_TYPE_UNSPEC,
	BPF_PROG_TYPE_SOCKET_FILTER,
	BPF_PROG_TYPE_KPROBE,
	BPF_PROG_TYPE_SCHED_CLS,
	BPF_PROG_TYPE_SCHED_ACT,
	BPF_PROG_TYPE_TRACEPOINT,
	BPF_PROG_TYPE_XDP,
	BPF_PROG_TYPE_PERF_EVENT,
	BPF_PROG_TYPE_CGROUP_SKB,
	BPF_PROG_TYPE_CGROUP_SOCK,
	...
};
```

以 `BPF_PROG_TYPE_XDP` 為例，XDP 是 `Express Data Path` 的縮寫，XDP 程式會在封包從網路卡進入到 kernal 的最早期被觸發。

一個 eBPF 程式大致上可以看成一個 c 的 function，在 XDP program type 下，kernal 會帶入 xdp_md 資料結構作為 eBPF 程式的輸入，包含了封包的內容、封包的來源介面等資訊。

```c
//include/uapi/linux/bpf.h

/* user accessible metadata for XDP packet hook */
struct xdp_md {
    __u32 data;
    __u32 data_end;
    __u32 data_meta;

    /* Below access go through struct xdp_rxq_info */
    __u32 ingress_ifindex; /* rxq->dev->ifindex */
    __u32 rx_queue_index;  /* rxq->queue_index  */
    __u32 egress_ifindex;  /* txq->dev->ifindex */
};
```

eBPF 程式必須回傳一個 `xdp_action` 的 enum，其中 `XDP_PASS` 表示封包可以繼續通過到 kernal network stack，`XDP_DROP` 表示直接丟棄該封包。

```c
//include/uapi/linux/bpf.h

enum xdp_action {
    XDP_ABORTED = 0,
    XDP_DROP,
    XDP_PASS,
    XDP_TX,
    XDP_REDIRECT,
};
```

透過這樣的 eBPF 程式，我們就可以在封包剛進入 kernal 的時候直接丟棄非法封包，能夠比較高效的處理 DDos 攻擊等問題。

以此可以寫出一個極簡單的 eBPF 程式範例 (只包含最主要的部份，完整的程式寫法會在後面提到)

```c
int xdp_prog_simple (struct xdp_md *ctx)
{
    return XDP_DROP;
}
```

這個 eBPF 程式可以被 attach 到某一個 interface 上，當封包進來時會被呼叫。由於無條件回傳 XDP_DROP，因此會丟棄所有的封包。

## 使用流程

eBPF 程式碼要被編譯成 eBPF 虛擬機的 bytecode 才能夠執行。
以 XDP 為例，最底層的做法是直接使用 LLVM 編譯這段 eBPF 程式碼。
首先需要補齊使用 LLVM 編譯時，需要的 header file 和資訊。

```c
#include <uapi/linux/bpf.h>

SEC ("xdp_prog")
int  xdp_program(struct xdp_md *ctx)
{
	return XDP_DROP;
}

char _license [] SEC ("license") = "GPL";
```

接著使用 LLVM 編譯成 ELF 格式文件

```shell
clang -c -target bpf xdp.c -o xdp.o
```

然後使用 `bpf` system call 將 bytecode 載入到 kernal 的 eBPF 虛擬機內，並取得對應的 file descriptor。最後透過 netlink socket 發送一個 `NLA_F_NESTED | 43` 訊息來把 interface index 與 ebpf 程式的 file descriptor 綁定。就能夠讓 eBPF 程式在對應的 interface 封包處理過程中被呼叫。

iproute2 有實作載入 eBPF 的功能，因此可以透過下指令

```shell
ip link set dev eth1 xdp xdp.o
```

可能會注意在程式碼的最後一行。特別標註了 GPL licence。由於 eBPF 程式會嵌入到 kernel，與 kernel 緊密的一起執行 (共用 address space、權限等)，在法律判斷獨立程式的邊界時，eBPF 程式和相關的 kernel 組件會被視為一體，因此 eBPF 程式會受到相關的 licence 限制。

而這邊提到的內核組件指的是 eBPF helper function。helper function 是 eBPF 程式與 kernel 溝通的橋梁，由於 eBPF 程式是在 eBPF 虛擬機內執行，因此如果要取得 kernel 的額外資訊或改變 kernel 的行為，必須透過虛擬機提供的 helper function 接口。

一部份的 helper function 基於 GPL 授權，因此當 eBPF 程式使用了 GPL 授權的 helper function 就必須標示為 GPL 授權，否則將 eBPF 程式載入到 kernel 時，會直接被 kernel 拒絕。

直接使用最底層的方法開發相對來說是不方便和困難的，不同 program type 的載入方式可能還完全不一樣，因此許多抽象的框架和 SDK 被發出來。雖然還是需要編寫 eBPF 的 c code，但是編譯、載入、溝通等工作被包在 SDK 裡面，可以方便的直接使用。

這邊舉例 BPF Compiler Collection (BCC) 這套工具，BCC 將 eBPF 的編譯和載入動作包裝成了 python 的 API，因此能夠簡單的完成 eBPF 的編譯和執行。

```python
from bcc import BPF
import time

b = BPF (text = """
#include <uapi/linux/bpf.h>
int xdp_prog1 (struct xdp_md *ctx)
{
    return XDP_DROP;
}
""")
fn = b.load_func ("xdp_prog1", BPF.XDP)
b.attach_xdp ("wlp2s0", fn, 0)

try:
	while True:
		time.sleep (1)
except KeyboardInterrupt:
	pass

b.remove_xdp ("wlp2s0", 0)
```

## 使用條件

在開始玩 eBPF 之前，我們要先確定一下我們的環境能夠使用 eBPF。最早在 kernal 3.15 版加入了 eBPF 功能。後續在 3.15 到現在的 5.19 版間，eBPF 陸陸續續加入了許多新的功能，因此開發的時候，如果不是使用最新版的作業系統，就可能會需要確認一下版本是否支援，各個功能支援的版本可以在 [這邊](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md) 參考

另外就是 eBPF 的功能需要在編譯 kernel 的時候啟用，大部分的發行版應該都直接啟用了，不過如果使用時出現問題可能還是到 `/proc/config.gz` 或 `/boot/config-<kernel-version>` 檢查內核編譯的設定，是否有開啟 `CONFIG_BPF`, `CONFIG_BPF_SYSCALL`, `CONFIG_BPF_JIT` 還有其他 BPF 相關 Kernal 選項。
設定可以參考 bcc 的 [安裝需求](https://github.com/iovisor/bcc/blob/master/INSTALL.md#kernel-configuration)

## 載入流程

當 eBPF 程式編譯完成後，就需要透過 `bpf` system call ([原始碼](https://elixir.bootlin.com/linux/v5.13/source/kernel/bpf/syscall.c#L4369))，將編譯後的 bytecode 載入 kernel 內執行。

為了安全性考量，要掛載 eBPF 程式需要 root 權限或 `CAP_BPF` capability，不過目前也有在設計讓非 root 權限帳號能載入 eBPF 程式，因此將 `kernel.unprivileged_bpf_disabled` sysctl 設置為 false 的情況下，非 root 帳號是有能力能夠使用 `BPF_PROG_TYPE_SOCKET_FILTER` 的 eBPF 程式。

eBPF 程式需要嵌入到 kernel 執行，因此 eBPF 程式的安全性是極為重要的，也要避免 eBPF 程式的錯誤有可能會導致 kernel 崩潰或卡死，因此每個載入 kernel 的 eBPF 程式都要先經過接著 verifier 檢查。

首先 eBPF 程式必須要在有限的時間內執行完成，不然就會造成 kernel 卡死，因此在早期的版本中 verifier 是拒絕任何 loop 的存在的，整個程式碼必須是一張 DAG (有向無環圖)。不過在 kernel 5.3 版本開始，verifier 允許了有限次數的循環，verifier 會透過模擬執行檢查 eBPF 是不是會在有限次數內在所有可能的分支上走到 `bpf_exit`。

接著 eBPF 程式的大小也存在限制，早期只一個 eBPF 程式只允許 4096 個 ebpf vm 的 instruction s，在設計比較複雜的 eBPF 程式上有些捉襟見肘，因此後來在 [5.2 版](https://github.com/torvalds/linux/commit/c04c0d2b968ac45d6ef020316808ef6c82325a82) 這個限制被放寬成 1 million 個指令，基本上是十分夠用了，也還是能確保 ebpf 程式在 1/10 秒內執行完成。

然後程式的 stack 也存在大小限制，目前限制是 512。

當然 verifier 檢查的項目不只如此，前面提到 non-GPL licence eBPF 程式使用 GPL licence 的 helper function，也會被 verifier 拒絕，並收到一個 `cannot call GPL-restricted function from non-GPL compatible program` 的錯誤。

此外 verifier 也會針對 helper function 的函數呼叫參數合法性，暫存器數值合法性，或其他無效的使用方式、無效的回傳數值、特定必須的資料結構是否定義、是否非法存取修改數據、無效的 instruction 參數等等做出檢查以及拒絕存在無法執行到的程式碼。

具體的 verifier 可以參考 1 萬 5 千行的 [原始碼](https://github.com/torvalds/linux/blob/master/kernel/bpf/verifier.c)

## JIT

當 eBPF 程式通過 verifier 的驗證之後會進行 JIT (Just In Time) 的二次編譯。之前一直提到 eBPF 是一個執行在 kernel 內的虛擬機，因此編譯出來的 bytecode 需要再執行的過程中在轉換成 machine code，才能夠真正在 CPU 上面執行，然而這樣的虛擬化和轉換過程，會造成 eBPF 程式的執行效率，比直接執行 machine code 要低上很多。

因此 eBPF 加入了 JIT 的功能，簡單來說就是把 eBPF 的 bytecode 預先在載入的時候，直接編譯成 CPU 可執行的 machine code，在執行 eBPF 程式的時候就可以直接執行，而不用再經過 eBPF 虛擬機的轉換，使 eBPF 可以達到原生程式的執行效率。

由於 JIT 需要編譯出 machine code，因此針對不同的 CPU 平台他的支援是分開的，不過當然到了現在，基本上大部分主流的 CPU 架構 (x86, ARM, RISC, MIPS…) 都已經支援了，具體的支援情況可以參考這張 [表](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md#jit-compiling)。

同樣 JIT 是 eBPF 的一個可開關的獨立功能，透過設置 bpf_jit_enable 來啟用 JIT 的功能

```shell
systcl -w net.core.bpf_jit_enable=1
```

(設置為 2 的話，可以在 kernel log 看到相關日誌)

到此 eBPF 程式就就完成載入了，雖然在 eBPF 程式的載入過程中還會完成一些資料結構的建立和維護，但是這個部分就不再本文的範圍內了。

當然到此 eBPF 程式只是載入到了內核之中，並未連接到任何的 hook point，因此到此為 eBPF 程式還未能真正被執行，不過這就是後面的故事了。

> 從 kernel source code 來看，在 eBPF 程式載入的過程中會呼叫 [bpf_prog_select_runtime](https://elixir.bootlin.com/linux/v5.13/source/kernel/bpf/core.c#L1840) 來判斷是否要呼叫 JIT compiler 去編譯，有興趣可以去 trace 這部分的 code。

## 生命週期

在透過 `bpf (BPF_PROG_LOAD, ...)` system call 將 eBPF 程式載入內核的過程 (可以參考 [原始碼](https://elixir.bootlin.com/linux/v5.13/source/kernel/bpf/syscall.c#L2079))，會替該 eBPF 程式建立 `struct bpf_prog` [結構](https://elixir.bootlin.com/linux/v5.13/source/include/linux/filter.h#L550)，其中 `prog->aux->refcnt` 計數器記錄了該 eBPF 程式的參考數量，載入的時候會透過 `atomic64_set (&prog->aux->refcnt, 1);` 將 refcnt 設置為一，並返為對應的 file descriptor。

當 refcnt 降為 0 的時候，就會觸發 unload，將 eBPF 程式資源給釋放掉。([原始碼](https://elixir.bootlin.com/linux/v5.13/source/kernel/bpf/syscall.c#L1714))
因此如果呼叫 `BPF_PROG_LOAD` 的程式沒有進一步操作，並直接結束的話，當 file descriptor 被 release，就會觸發 refcnt–，而變成 0 並移除 eBPF 程式。

要增加 eBPF 程式 refcnf 大致上有幾種方式

- 透過 bpf systemcall 的 BPF_BTF_GET_FD_BY_ID 等方式取得 eBPF 程式對應的 file descriptor
- 將 eBPF 程式 attach 到事件、Link 上，使 eBPF 程式能真的開始工作。
  - 因此當 eBPF 被 attach 到 hook points 上之後，即便原始載入程式結束也不會導致 eBPF 程式被回收，而可以正常繼續工作。
  - Link 是 eBPF 後來提供的新特性，因此暫時超出了本文的討論範圍
- 透過 bpf systemcall 的 BPF_OBJ_PIN，將 eBPF 程式釘到 BPFFS 上。
  - BPFFS 是 BPF file system，本質上是一個虛擬的檔案系統，一樣透過 bpf system call 的 BPF_OBJ_PIN，我們可以把 eBPF 程式放到 `/sys/fs/bpf/` 路徑下的指定位置，並透過 `open` 的方式直接取得 file descriptor。PIN 同樣會增加 refcnt，因此 PIN 住的程式不會被回收
  - 要釋放 PIN 住的程式，可以使用 unlink 指令移除虛擬檔案，即可取消 PIN。

透過以上的操作都會增加 refcnt，相反的，對應的資源釋放則會減少 refcnt。因此只要確保有任何一個 eBPF 程式的參考存在，即可保證 eBPF 程式一直存在 kernel 內。

## Helper Funtions

之前在介紹 eBPF 的 GPL 授權的時候，有提到 eBPF helper function 這個東西，接下來我們來比較仔細的介紹一下。

之前提到 eBPF 程式是在 eBPF 虛擬機內執行，由於 eBPF 程式會嵌入 kernel 內，在 kernel space 執行，所以為了安全性考量我們不能讓 eBPF 程式任意的存取和修改 kernel 記憶體和呼叫 kernel 函數，因此 eBPF 的解決方案是提供了一系列的 API，讓 eBPF 程式只能夠過限定的 API 去與 kernel 溝通，因此可以讓 eBPF 程式對 kernel 的操作限制在一個可控的範圍，也可以透過 verifier 和 API 後面的實作去確保 API 呼叫的有效和安全性。

在 eBPF 裡這一系列的 API 就稱之為 eBPF helper funtions。

另外不同的對於 eBPF program type 的 eBPF 程式，由於他們執行的時機點和在 kernel 的位置不同，因此他們能夠取得的 kernel 資訊也就不同，他們可以呼叫執行的 helper funtions 也就不同。具體每個不同 program type 可以執行的 helper function 可以參考 bcc 的 [文件](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md#program-types)

下面列幾舉個所有 program type 都可以呼叫的 helper function

- u64 bpf_ktime_get_ns (void)
  - 取得從開機開始到現在的時間，單位是奈秒
- u32 bpf_get_prandom_u32 (void)
  - 取得一個 random number

接著我們舉例在 BPF_PROG_TYPE_SOCKET_FILTER 下才能使用的 helper function

- long bpf_skb_load_bytes (const void *skb, u32 offset, void *to, u32 len)
  - 由於 socket filter 的功能就是對 socket 的流量做過濾，因此我們可以透過 skb_load_bytes 來取得 socket 傳輸的封包內容

完整的 helper function 列表還有每個函數具體的定義以及使用說明描述可以在 [bpf.h](https://github.com/torvalds/linux/blob/master/include/uapi/linux/bpf.h) 查找到。

另外特別要注意的是受限於 eBPF 虛擬機的限制，eBPF helper function 的參數數量最多只可以有五個，在使用不定參數長度的參數時，最多也只能有 5 個參數 (如之後會提到的 trace_printk)。

因此雖然 eBPF 非常強大能夠非常方便的動態對 kernel 做修改，但為了安全，他可以執行的操作是訂定在一個非常嚴格的框架上的，在開發時需要熟習整個框架的限制和可利用的 API 資源。

## Debug Tracing

在將 eBPF 程式載入 kernel 工作後，我們勢必需要一些手段來與 eBPF 程式做溝通，一方面我們需要輸出偵錯訊息，來對 eBPF 程式 debug，一方面我們可能會希望能夠實時透過 eBPF 程式取得 kernel 的某些資訊又或著動態調整 eBPF 程式的執行規則。

如果只是需要 eBPF 程式單方面的輸出訊息，讓我們可以偵錯，可以使用比較簡單的手段。eBPF 有提供一個 helper function `long bpf_trace_printk (const char *fmt, u32 fmt_size, ...)`，可以輸入一個格式化字串 `fmt`，及最多三個變數 (參數個數的限制)。輸出結果會被輸出到 `/sys/kernel/debug/tracing/trace_pipe` 中。.

可以透過指令查看輸出結果：

```shell
sudo cat /sys/kernel/debug/tracing/trace_pipe
```

輸出的格式如下：

```text
telnet-470   [001] .N.. 419421.045894: 0x00000001: <formatted msg>
```

- 首先是 process name `telnet`，然後是 PID 470。
- 接續的 001 是指當前執行的 CPU 編號。
- .N.. 的每個字元對應到一個參數
  - irqs 中斷是否啟用
  - `TIF_NEED_RESCHED` 和 `PREEMPT_NEED_RESCHED` 是否設置 (用於 kernel process scheduling)
  - 硬中断 / 軟中断是否發生中
  - level of preempt_disabled
- 419421.045894 時間
- 0x00000001: eBPF 內部的指令暫存器數值

雖然 trace_printk 可以接收格式化字串，但是支援的格式字元比較少，只支援 `% d, % i, % u, % x, % ld, % li, % lu, % lx, % lld, % lli, % llu, % llx, % p, % s`。

另外有一個 bpf_printk 巨集，會使用 sizeof (fmt) 幫忙填上第二個 fmt_size。因此使用 bpf_printk 可以省略 fmt_size。

在比較新的版本提供了 bpf_snprintf 和 bpf_seq_printf 兩個新的 print 函數，前者是把資料寫入預先建立好的 buffer 內，後者可以寫入在特定 program type 下可以取得的 seg_file，兩者皆用陣列存放後面的參數列，因此可以打破 helper funtion 5 個參數的限制。

最後要特別注意的是使用 trace_printk 會大幅拖慢 eBPF 程式的執行效率，所以 trace_printk 只適用於開發時用來 debug 使用，不適用於正式環境當中。

## Map

接著介紹 eBPF 的另外一個重要組件 `map`，前面提到 trace_printk 只適合用在除錯階段，輸出 eBPF 的執行資訊到 user space，然而我們需要一個可以在正式環境內，提供 user space 程式和 eBPF 程式之間雙向數據交換的能力，另外每次觸發 eBPF 程式都可看作獨立執行 eBPF 程式，所以也需要在多次呼叫 eBPF 程式時共享資料的功能。因此 eBPF 程式引入了 `map`。

eBPF map 定義了一系列不同的不同的資料結構類型，包含了 hash, array, LRU hash, ring buffer, queue 等等，另外也提供 per-cpu hash, per-cpu array 等資料結構，由於每顆 CPU 可以獲得獨立的 map，因此可以減少 lock 的需求，提高執行效能。所有的 map type 一樣可以參考 [bpf.h](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/include/uapi/linux/bpf.h#n880) 的 `enum bpf_map_type`。

```c
struct bpf_map_def SEC ("maps") map = {
	.type = BPF_MAP_TYPE_ARRAY,
	.key_size = sizeof (int),
	.value_size = sizeof (__u32),
	.max_entries = 4096,
};
```

首先要先在 eBPF 程式內定義 map 的資料結構，在 eBPF 程式內定義一個 map 時，基本需要定義四個東西分別是該資料結構的 map type, key 和 value 的大小以及資料結構內最多有含多少 entry，如果超出 max_entries 上限則會發生錯誤回傳 (-E2BIG)。

eBPF 提供了 `bpf_map_lookup_elem`, `bpf_map_update_elem`, `bpf_map_delete_elem` 等 helper functions 來對 map 資料做操作。lookup 的完整定義是 `void *bpf_map_lookup_elem (struct bpf_map *map, const void *key)`，透過 key 去尋找 map 裡面對應的 value，並返回其指標，由於返回的是指標，所以會指向 map 真實儲存的記憶體，可以直接對其值進行更新。

當然除了幾個基本的 helper function 外，不同的 map type 可能會支援更多的操作或功能，例如 bpf_skb_under_cgroup 是給 BPF_MAP_TYPE_CGROUP_ARRAY 專用的。

### 原始碼解析

linux kernel 定義了 [struct bpf_map_ops](https://elixir.bootlin.com/linux/latest/source/include/linux/bpf.h#L64)，來描述 map 可能會支援的所有功能。

```c
struct bpf_map_ops {
	/* funcs callable from userspace (via syscall) */
	int (*map_alloc_check)(union bpf_attr *attr);
	struct bpf_map *(*map_alloc)(union bpf_attr *attr);
	void (*map_release)(struct bpf_map *map, struct file *map_file);
	void (*map_free)(struct bpf_map *map);
	int (*map_get_next_key)(struct bpf_map *map, void *key, void *next_key);
	void (*map_release_uref)(struct bpf_map *map);
	void *(*map_lookup_elem_sys_only)(struct bpf_map *map, void *key);
	...
}
```

不同的 map 再根據需要去實作對應的操作，在 [include/linux/bpf_types.h](https://github.com/torvalds/linux/blob/master/include/linux/bpf_types.h) 定義。以 `BPF_MAP_TYPE_QUEUE` 這個 map type 來說對應到 queue_map_ops。

```c
//kernel/bpf/queue_stack_maps.c

const struct bpf_map_ops queue_map_ops = {
	.map_meta_equal = bpf_map_meta_equal,
	.map_alloc_check = queue_stack_map_alloc_check,
	.map_alloc = queue_stack_map_alloc,
	.map_free = queue_stack_map_free,
	.map_lookup_elem = queue_stack_map_lookup_elem,
	.map_update_elem = queue_stack_map_update_elem,
	.map_delete_elem = queue_stack_map_delete_elem,
	.map_push_elem = queue_stack_map_push_elem,
	.map_pop_elem = queue_map_pop_elem,
	.map_peek_elem = queue_map_peek_elem,
	.map_get_next_key = queue_stack_map_get_next_key,
	.map_btf_name = "bpf_queue_stack",
	.map_btf_id = &queue_map_btf_id,
};
```

當呼叫 bpf_map_push_elem 時，就會呼叫 bpf_map_ops.map_push_elem 來調用 queue 的 queue_stack_map_push_elem 完成。

而具體每個 map 支援什麼 help function 可能就要參考 [helper function 文件描述](https://man7.org/linux/man-pages/man7/bpf-helpers.7.html)

### 使用範例

這邊我們一個特別的使用實例來看

```c
struct elem {
    int cnt;
    struct bpf_spin_lock lock;
};

struct bpf_map_def SEC("maps") counter = {
	.type = BPF_MAP_TYPE_ARRAY,
	.key_size = sizeof(int),
	.value_size = sizeof(elem),
	.max_entries = 1,
};
```

首先我們定義了一個特別的 ARRAY map，它的 array size 只有 1，然後 value 是一個包含 u32 整數和一個 lock 的資料結構。

```c
SEC ("kprobe/sys_clone")
int hello_world(void *ctx) {
  u32 key = 0;
  elem *val;
  val = bpf_map_lookup_elem (&counter, &key);

  bpf_spin_lock (&val->lock);
  val->cnt++;
  bpf_spin_unlock (&val->lock);

  bpf_trace_printk ("sys_clone count: % d", val->cnt);

  return 0;
}
```

由於 key 我們固定是 0，透過 bpf_map_lookup_elem 我們永遠會取得同一筆資料，因此可以簡單看成我們把 `counter` 當作一個單一的容器來存放 cnt 變數，並使用 lock 避免 cnt 更新時的 race condition。

我們將這個程式附加到 kprobe/sys_clone，就可以用來統計 sys_clone 呼叫的次數。

和其他 eBPF 的操作一樣，我們透過 `bpf` 的 system call 去與 kernel 進行溝通。跟 helper fuction 類似，bpf systemcall 提供了 `BPF_MAP_LOOKUP_ELEM`, `BPF_MAP_UPDATE_ELEM`, `BPF_MAP_DELETE_ELEM` 等參數來提供搜尋、更新、刪除 map 數值的方法。另外為了減少 system call 的開銷，也提供 `BPF_MAP_LOOKUP_BATCH`, `BPF_MAP_LOOKUP_AND_DELETE_BATCH`, `BPF_MAP_UPDATE_BATCH`, `BPF_MAP_DELETE_BATCH` 等方法來在單次 system call 內完成多次 map 操作。

必要要注意的是 map 並不是 eBPF program 的附屬品，在 eBPF 虛擬機內，map 和 program 一樣是獨立的物件，每個 map 有自己的 refcnt 和生命週期，eBPF 程式的生命週期和 map 不一定是統一的。

### map 載入流程

在透過函式庫將 eBPF 程式載入 kernel 時，先做的其實是建立 map，對每張 map 會呼叫 `bpf system call` 的 BPF_MAP_CREATE，並帶入 map type, key size, value size, max entries, flags 等資訊來建立 map，建立完成後會返回 map 對應的 fire descripter。

接著函數庫會修改編譯過的 ebpf bytecode 裡面參考到 map 變數的地方 (例如 lookup 等 helper function 的參數部分)，將原先流空的 map 地址修改成 map 對應的 file descripter。

接著一樣呼叫 `bpf` BPF_PROG_LOAD 來載入 eBPF bytecode，在載入過程中，verifier 會呼叫到 replace_map_fd_with_map_ptr 函數，將 bytecode 裡面 map 的 file descripter 在替換成 map 的實際地址。

### Map 持久化

如前面所述，map 在 eBPF 虛擬機內和 prog 同等是獨立的存在，並且具有自己的 refcnt，因此和 prog 一樣，我們可以透過 `bpf` BPF_OBJ_PIN 將 map 釘到 BPFFS 的 `/sys/fs/bpf/` 路徑下，其他程式就一樣能透過 open file 的方式取得 map 的 file descripter，將 map 載入到其他的 eBPF 程式內，達成了多個 eBPF 程式 share 同一個 map 的效果。

## Tail call

最後我們要來聊的是 tail call 的功能。

tail call 簡單來說就是在 eBPF 程式內執行另外一個 eBPF 程式，不過和一般的函數呼叫不一樣，eBPF 虛擬機在跳轉到另外一個 eBPF 程式後就不會再回到前一個程式了，所以他是一個單向的呼叫。

另外雖然他會直接複用前一個 eBPF 程式的 stack frame，但是被呼叫的 eBPF 程式不能夠存取前呼叫者的暫存器和 stack，只能透取得在呼叫 tail call 時，透過參數傳遞的 `ctx`。

使用 tail call 可以透過拆解簡化一個 eBPF 程式，打破單個 eBPF 程式只能有 512bytes 的 stack、1 million 個指令的限制。

一個使用範例是先使用一個 eBPF 程式作為 packet dispatcher，然後根據不同的 packet ether type 之類的欄位，將 packet 轉發給對應處理的 eBPF 程式。

另外一個就是將 eBPF 程式視為多個模組，透過 map 和 tail call 去動態的任意重整排序執行結構。

為了避免 eBPF 程式交替呼叫彼此導致卡死的狀況，kernel 定義了 `MAX_TAIL_CALL_CNT` 表示在單個 context 下最多可呼叫的 tail call 次數，目前是 32。如果 tail call 因為任何原因而執行失敗，則會繼續執行原本的 eBPF 程式。

### 如何使用

tail call 的 helper function 定義如下 `long bpf_tail_call (void *ctx, struct bpf_map *prog_array_map, u32 index)`。在使用的時候我們要一個 `BPF_MAP_TYPE_PROG_ARRAY` type 的 map，用來保存一個 eBPF program file descriptor 的陣列。在呼叫 tail call 的時候傳遞進去執行。

## 參考資料

- [BPF: A Tour of Program Types](https://blogs.oracle.com/linux/post/bpf-a-tour-of-program-types)
- [BPF 程序（BPF Prog）类型详解](https://arthurchiao.art/blog/bpf-advanced-notes-1-zh/)
- [Lifetime of BPF objects](https://facebookmicrosites.github.io/bpf/blog/2018/08/31/object-lifetime.html)
- [difference between loading, attaching, and linking?](https://stackoverflow.com/questions/68278120/ebpf-difference-between-loading-attaching-and-linking)
- [eBPF map](https://vvl.me/2021/02/eBPF-3-eBPF-map/)
- [BPF Map 内核实现](https://arthurchiao.art/blog/bpf-advanced-notes-3-zh/)
- [BPF 环形缓冲区](https://www.ebpf.top/post/bpf_ring_buffer/)
- [BPF 技术介绍及学习分享](https://blog.csdn.net/M2l0ZgSsVc7r69eFdTj/article/details/108612744)
- [揭秘 BPF map 前生今世](https://www.ebpf.top/post/map_internal/)
- [BPF 数据传递的桥梁 ——BPF MAP（一）](https://davidlovezoe.club/wordpress/archives/1044)
- [bpf-helpers man page](https://man7.org/linux/man-pages/man7/bpf-helpers.7.html)
- [introduce bpf_tail_call () helper](https://lwn.net/Articles/645169/)
- [從 BPF to BPF Calls 到 Tail Calls](https://www.readfog.com/a/1663618518017478656)
