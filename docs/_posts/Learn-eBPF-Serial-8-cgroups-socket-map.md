---
categories:
  - 學習 eBPF 系列
  - 2022 iThome鐵人賽
description: 2022 iThome鐵人賽 學習eBPF系列 介紹eBPF socket map以及Linux cgroups
tags:
  - eBPF
date: 2022-10-31
title: 學習 eBPF 系列 8 - cgroups & socket map
---

本篇是 BCC 學習歷程的最後一篇，這篇文章會介紹 linux cgroups、eBPF socketmap 的功能，並以  [sockmap.py](https://github.com/iovisor/bcc/blob/master/examples/networking/sockmap.py)  作為範例。

<!-- more -->

## cgroups 介紹

cgroups 是 Linux kernel 內建的一個機制，可以以進程為最小單位，對可使用的 CPU、memory、裝置 I/O 等資源進行限制、分割。

> cgroups 目前有 v1 和 v2 兩個版本，在分組策略架構上有所差異，這邊介紹只以 v1 為主

在 cgroup 的架構內，我們可以針對不同的資源類型進行獨立管理 (稱為不同的 subsystem 或 controller) ，一些可能的資源類型和一部份的功能簡介如下

- cpu: 對一定時間週期內，可使用的 cpu 時間長度限制
- memory: 限制記憶體使用上限以及超出上限時的行為
- blkio: 控制對硬碟等設備的訪問速度上限
- cpuacct: 用來統計目前的 CPU 使用情況
- devices: 控制可以訪問那些 device
- pids: 限制 cgroup 內可建立的 pid 數量，也就是進程數量

接著是  `hierarchy`，cgroup 使用樹狀結構來管理資源，一個  `hierarchy`  預設會有一個根結點，所有的 process (pid 都會 attach 在這個節點上)。

一個  `hierarchy`  可以對應到零個或多個上述的 subsystem，並在一個節點內設置上述的那些限制，那這些限制就會套用到在這個節點內的所有 process。

可以在  `hierarchy`  內建立子節點，那子節點就會預設套用父節點的所有設置，然後可以只針對有興趣的項目作更細緻的調正。

一個 process 在一棵  `hierarchy`  只能 attach 在一個節點上，可以對 process 設定所在的節點。從 process fork 出來的 process 會在同一個節點上，但是搬運 process 到不同的節點，並不會影響子 process。

Linux 透過虛擬檔案系統來提供修改調整 cgroups 的 user space 介面。通常來說介面會被掛載在  `/sys/fs/cgroup`  這個路徑下。

我們可以透過 mount 來建立  `hierarchy`  並把他關連到一個或多個 subsystem

```shell
#  關連到 CPU
mkdir /sys/fs/cgroup/cpu
mount -t cgroup -o cpu none /sys/fs/cgroup/cpu
#  關連到 CPU 和 CPUACCT
mkdir /sys/fs/cgroup/cpu,cpuacct
mount -t cgroup -o cpu,cpuacct none /sys/fs/cgroup/cpu,cpuacct
#  不過 /sys/fs/cgroup 目錄可能會被系統設置為 < span class="hljs-built_in">read only，避免隨意變更，而且通常不需要增減 hierarchy 本身，只是在 hierarchy 內增減節點管理
```

查看所有目前的 hierarchy

```shell
ls /sys/fs/cgroup/-l
total 0
dr-xr-xr-x 4 root root  0  十  11 22:50 blkio
lrwxrwxrwx 1 root root 11  十  11 22:50 cpu -> cpu,cpuacct
lrwxrwxrwx 1 root root 11  十  11 22:50 cpuacct -> cpu,cpuacct
dr-xr-xr-x 4 root root  0  十  11 22:50 cpu,cpuacct
dr-xr-xr-x 2 root root  0  十  11 22:50 cpuset
dr-xr-xr-x 4 root root  0  十  11 22:50 devices
dr-xr-xr-x 2 root root  0  十  11 22:50 freezer
dr-xr-xr-x 2 root root  0  十  11 22:50 hugetlb
dr-xr-xr-x 4 root root  0  十  11 22:50 memory
dr-xr-xr-x 2 root root  0  十  11 22:50 misc
lrwxrwxrwx 1 root root 16  十  11 22:50 net_cls -> net_cls,net_prio
dr-xr-xr-x 2 root root  0  十  11 22:50 net_cls,net_prio
lrwxrwxrwx 1 root root 16  十  11 22:50 net_prio -> net_cls,net_prio
dr-xr-xr-x 2 root root  0  十  11 22:50 perf_event
dr-xr-xr-x 4 root root  0  十  11 22:50 pids
dr-xr-xr-x 2 root root  0  十  11 22:50 rdma
dr-xr-xr-x 5 root root  0  十  11 22:50 systemd
dr-xr-xr-x 5 root root  0  十  11 22:50 unified
```

接著查看 cpu 的根結點

```shell
ls /sys/fs/cgroup/cpu/-l
total 0
-rw-r--r--  1 root root 0  十  11 21:39 cgroup.clone_children
-rw-r--r--  1 root root 0  十  11 21:39 cgroup.procs
-r--r--r--  1 root root 0  十  11 21:39 cgroup.sane_behavior
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.stat
-rw-r--r--  1 root root 0  十  11 21:39 cpuacct.usage
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.usage_all
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.usage_percpu
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.usage_percpu_sys
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.usage_percpu_user
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.usage_sys
-r--r--r--  1 root root 0  十  11 21:39 cpuacct.usage_user
-rw-r--r--  1 root root 0  十  11 21:39 cpu.cfs_period_us
-rw-r--r--  1 root root 0  十  11 21:39 cpu.cfs_quota_us
-rw-r--r--  1 root root 0  十  11 21:39 cpu.shares
-r--r--r--  1 root root 0  十  11 21:39 cpu.stat
drwxr-xr-x  4 root root 0  八  24 14:50 docker
-rw-r--r--  1 root root 0  十  11 21:39 notify_on_release
-rw-r--r--  1 root root 0  十  11 21:39 release_agent
drwxr-xr-x 96 root root 0  十  11 06:05 system.slice
-rw-r--r--  1 root root 0  十  11 21:39 tasks
drwxr-xr-x  2 root root 0  十  11 21:31 user.slice
```

由於前面可以看到 cpu 被 link 到 cpu,cpuacct，所以可以同時查看到 cpu._ 和 cpuacct._ 的選項。

透過 cpu.cfs_quota_us 和 cpu.cfs_period_us 我們就能控制這個節點上所有 process 在 period 內可使用的 CPU 時間 (quota)。

透過  `cat tasks`  我們可以看到所有 attach 在這個節點上的 pid。

可以看到有三個資料夾  `docker`, `system.slice`, `user.slice`，是三個 hierarchy 上的子節點，我們可以簡單的透過  `mkdir`  的方式建立子節點。由於這台設備上有跑 docker，所以 docker 會在 /sys/fs/cgroup/cpu/docker/ 目錄下為每個 container 建立獨立的子節點，透過 cgroup 的方式限制容器的資源使用量。

```shell
docker ps --format="{{.ID}}"
90f64cb70ee0
177d1a3920ec

ls /sys/fs/cgroup/cpu/docker -l
total 0
drwxr-xr-x 2 root root 0  八  24 14:50 177d1a3920ec9....
drwxr-xr-x 2 root root 0  八  24 14:50 90f64cb70ee068...
-rw-r--r-- 1 root root 0  十  11 21:39 cgroup.clone_children
-rw-r--r-- 1 root root 0  十  11 21:39 cgroup.procs
...
```

> 在許多發行版上使用 systemd 來做為核心系統管理程式，也就會透過 systemd 來管理 cgroup，因此在設置 kubelet 時會建議將 cgroup driver 從 cgroupfs 改成 systemd，統一由 systemd 來管理，避免同時有兩個系統在調整 cgroup

cgroup v2 調整了管理介面的結構，只保留了單一個 hierarchy (/sys/fs/cgroup/unified) 管理所有的 subsystem，因為切出多個 hierarchy 來管理的方式被認為是不必要且增加系統複雜度的。

到這邊大概介紹完了 cgroup，由於這次 sockmap.py 使用的 program type 的 hook point 會在 cgroup 上，所以趁這個機會詳細了解了一下 cgroup。

## socketmap 介紹

這邊我們拿 Cilium CNI [介紹](https://www.slideshare.net/ThomasGraf5/accelerating-envoy-and-istio-with-cilium-and-the-linux-kernel)  的一張圖來說明。

![無 socket redirect 架構](/img/pages/8b86be37f7cbdec6c7d97c3b0bcb34d1.png)

圖中是一個使用 envoy sidecar 的 kubernetes pod 網路連線示意圖，簡單來說 kubernetes 上面容器 (Pod) 服務 (Service) 的網路流量會透過 iptables 的機制全部重新導向到跑在同一個容器內的 sidecar，透過 sidecar 當作中介完成網路監控、服務發現等功能後才會真正離開容器。進入容器的流量同樣先都重導向到 sidecar 處理。

這樣的好處是可以完全不對 service 本身修改，完全由獨立的 sidecar 來提供附加的網路功能，但是也有一個很明顯的問題，一個封包在傳輸的過程中，要經過 3 次 Linux kernel 的 network stack 處理，大大降低了封包的傳輸效率。

其中由於都是在同一台設備的同一個網路空間內傳輸，因此 TPC/IP/ethernet 等底層網路完全可以省略。

![socket redirect 架構](/img/pages/688dfb0d59d389e0d1df77d8d99401d0.png)

因此我們可以透過 eBPF 的 socket redirect 技術來簡化這個封包的傳輸過程，簡單來說，在同一個設備的兩個 socket 間的傳輸，我們完全可以直接跳過底層的網路堆疊，直接在 socket layer 將封包內容從一個 socket 搬到另外一個 socket，跳過底層 TCP/IP/ethernet 處理。

## sockmap.py 介紹

bcc 的  `sockmap.py`  提供的就是 socket redirect 的功能，他會監聽機器上的所有 socket，將 local to local 的 tcp 連線資料封包直接透過 socket redirect 的方式進行搬運。

> socket redirect 機制好像同時也節省了 packet 在 userspace 和 kernel space 之間複製搬運的過程，不過這件事情沒有完全確定。

我們一樣先看看執行起來怎麼樣，我們透過 python 建立一個 http server 並透過 curl 來測試

```shell
python3 -m http.server &
curl 127.0.0.1:8000
```

接著是 eBPF 程式的執行結果

```shell
python3 sockmap.py -c /sys/fs/cgroup/unified/
b'curl-3043    [000] d...1  7164.673950: bpf_trace_printk: remote-port: 8000, local-port: 46246'
b'curl-3043    [000] dN..1  7164.673973: bpf_trace_printk: Sockhash op: 4, port 46246 --> 8000'
b'curl-3043    [000] dNs11  7164.673985: bpf_trace_printk: remote-port: 46246, local-port: 8000'
b'curl-3043    [000] dNs11  7164.673988: bpf_trace_printk: Sockhash op: 5, port 8000 --> 46246'
b'curl-3043    [000] d...1  7164.674643: bpf_trace_printk: try redirect port 46246 --> 8000'
b'python3-3044    [000] d...1  7164.675211: bpf_trace_printk: try redirect port 8000 --> 46246'
b'python3-3044    [000] d...1  7164.675492: bpf_trace_printk: try redirect port 8000 --> 46246'
```

> 這邊可以看到 sockmap 要指定一個 - c 的參數，後面是指定一個 cgroup，sockmap 只會監控在這個 cgroup 節點上的 socket 連線。這邊 unified 是 cgroup v2 的 hierarchy，在 cgroup v2 只有 unified 一個 hierarchy，所有 subsystem 都在這個 hierarchy 上。

首先是  `curl remote-port: 8000, local-port: 46246' Sockhash op: 4, port 46246 --> 8000'`，這兩條是 curl 發起連線時，記錄下來的 socket 連線請求。

接著  `curl remote-port: 46246, local-port: 8000' Sockhash op: 5, port 8000 --> 46246'`，是 curl 跟 http server 之間連線建立成功後，返回給 curl 的 socket 通知。

接著可以看到 3 條  `try redirect`  是 curl 傳遞 http request 和 http server 返回 http response 的 msg，直接透過 socket redirect 的方式在兩個 socket 之間交互。

這邊我們使用 tcpdump 去監聽  `lo` interface 的方式來驗證 socket redirect 有真的運作到。同樣是透過  `curl 127.0.0.1:8000`  發起連線傳輸資料。在沒有啟用 sockmap 的情況下 tcpdump 捕捉到 12 個封包。而開啟 socketmap 後只會捕捉到 6 個封包。

透過封包內容會發現，在 socketmap 啟動後，只能夠捕捉到帶  `SYN`、`FIN`  等 flag 的 TCP 控制封包，不會捕捉到中間純粹的資料交換封包。

## SOCK_OPS program type

完成驗證後，我們接著來介紹這次用到的兩種 eBPG program type，分別是  `BPF_PROG_TYPE_SOCK_OPS`  和  `BPF_PROG_TYPE_SK_MSG`。

`BPF_PROG_TYPE_SOCK_OPS`  可以 attach 在一個 cgroup 節點上，當該節點上任意 process 的 socket 發生特定事件時，該 eBPF program 會被觸發。可能的事件定義在  [bpf.h](https://elixir.bootlin.com/linux/v6.0/source/include/uapi/linux/bpf.h)。其中 CB 結尾的表示特定事件完成後觸發，例如  `BPF_SOCK_OPS_TCP_LISTEN_CB`  表示在 socket tcp 連線轉乘 LISTEN 狀態後觸發。有些則是觸發來透過回傳值設置一些控制項，`BPF_SOCK_OPS_TIMEOUT_INIT`  是在 TCP Timeout 後觸發，透過 eBPF 的 return value 設置 RTO，-1 表示使用系統預設。

```c
enum {
	BPF_SOCK_OPS_VOID,
	BPF_SOCK_OPS_TIMEOUT_INIT,
	BPF_SOCK_OPS_RWND_INIT,
	BPF_SOCK_OPS_TCP_CONNECT_CB,
	BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB,
	BPF_SOCK_OPS_PASSIVE_ESTABLISHED_CB,
	BPF_SOCK_OPS_NEEDS_ECN,
	BPF_SOCK_OPS_BASE_RTT,
	BPF_SOCK_OPS_RTO_CB,
	BPF_SOCK_OPS_RETRANS_CB,
	BPF_SOCK_OPS_STATE_CB,
	BPF_SOCK_OPS_TCP_LISTEN_CB,
	BPF_SOCK_OPS_RTT_CB,
	BPF_SOCK_OPS_PARSE_HDR_OPT_CB,
	BPF_SOCK_OPS_HDR_OPT_LEN_CB,
	BPF_SOCK_OPS_WRITE_HDR_OPT_CB,
};
```

這邊要特別介紹的是  `BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB`  和  `BPF_SOCK_OPS_PASSIVE_ESTABLISHED_CB`  分別是在主動建立連線時 (發送 SYN，tcp 三手交握第一手)，和被動建立連線時 (發送 SYN+ACK，tcp 三手交握第二手) 觸發。

觸發後會拿到 bpf_sock_ops 上下文，並根據事件不同，eBPF 回傳值也代表不同的意義。其中  `bpf_sock_ops->op`  對應到上述的事件類型。args 則是不同 op 可能帶的一些特殊參數。

```c
struct bpf_sock_ops {
	__u32 op;
	union {
		__u32 args [4];		/* Optionally passed to bpf program */
		__u32 reply;		/* Returned by bpf program	    */
		__u32 replylong [4];	/* Optionally returned by bpf prog  */
	};
	__u32 family;
	__u32 remote_ip4;	/* Stored in network byte order */
	__u32 local_ip4;	/* Stored in network byte order */
	__u32 remote_ip6 [4];	/* Stored in network byte order */
	__u32 local_ip6 [4];	/* Stored in network byte order */
	__u32 remote_port;	/* Stored in network byte order */
	__u32 local_port;	/* stored in host byte order */
	__u32 is_fullsock;
	...
```

## SK_MSG SK_SKB program type

接著要介紹另外兩個 program type `BPF_PROG_TYPE_SK_SKB`  和  `BPF_PROG_TYPE_SK_MSG`。

首先他們不 attach linux 本身的某個地方而是 attach 在一個 eBPF map 上，這個 map 必須是  `BPF_MAP_TYPE_SOCKMAP`  或  `BPF_MAP_TYPE_SOCKHASH`。兩個 map 都是某個 key 對應到 socket，可以使用 sock_hash_update 更新 sockhash map，將 sock_ops 的上下文 bpf_sock_ops 結構當作 value 去插入。

當 sockmap 裡面的 socket 有訊息要送出，封包要被放到 socket 的 TXQueue 時會觸發  `BPF_PROG_TYPE_SK_MSG`，而當封包從外界送入被主機接收，要放到 socket 的 RXQueue 時則會觸發  `BPF_PROG_TYPE_SK_SKB`。

以這次會用到的  `BPF_PROG_TYPE_SK_MSG`  來說，當 userspace 呼叫 sendmsg 時，就會被 eBPF 程式攔截。

可以透過回傳  `__SK_DROP`, `__SK_PASS`, `__SK_REDIRECT`  來決定是要丟棄、接收或做 socket redirect。

透過 socket redirect，封包會從發送端 socket 直接被丟到接收端 socket RXQ。

> 目前 redirect 的功能只能用於 TCP 連線。

## sockmap 實作

### eBPF 實作

大致上的概念介紹完了就讓我們回到 bcc sockmap 的程式碼。

首先一樣先看 eBPF 的程式碼。

```c
#define MAX_SOCK_OPS_MAP_ENTRIES 65535
struct sock_key {
    u32 remote_ip4;
    u32 local_ip4;
    u32 remote_port;
    u32 local_port;
    u32 family;
};
BPF_SOCKHASH (sock_hash, struct sock_key, MAX_SOCK_OPS_MAP_ENTRIES);
```

這邊定義了一個  `sock_key`，作為 BPF_SOCKHASH socket map 的 key，透過 five tuple (IP src/dst, sct/dst port 及 TCP/UDP) 來定位一個連線。

接著我們看到第一種 program type `SOCK_OPS`  的入口函數。

```c
int bpf_sockhash (struct bpf_sock_ops *skops) {
    u32 op = skops->op;
    /* ipv4 only */
    if (skops->family != AF_INET)
	return 0;
    switch (op) {
        case BPF_SOCK_OPS_PASSIVE_ESTABLISHED_CB:
        case BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB:
            bpf_sock_ops_ipv4 (skops);
            break;
        default:
            break;
    }
    return 0;
}
```

這邊做的事情很簡單，在 socket 建立連線 (ACTIVE_ESTABLISHED_CB) 和接收連線 (PASSIVE_ESTABLISHED_CB) 時，呼叫 bpf_sock_ops_ipv4 將 socket 放到 sock map 內，讓 socket 被第二個 program type `SK_MSG`  的程式能夠在 socket 呼叫 sendmsg 等 API 時被攔截處理。由於 socker redirect 只能處裡 TCP 連線，所以非  `AF_INET`  的連線會被過濾掉。

```c
static __always_inline void bpf_sock_ops_ipv4(struct bpf_sock_ops *skops) {
    struct sock_key skk = {
        .remote_ip4 = skops->remote_ip4,
        .local_ip4  = skops->local_ip4,
        .local_port = skops->local_port,
        .remote_port  = bpf_ntohl (skops->remote_port),
        .family = skops->family,
    };
    int ret;
    bpf_trace_printk (...);
    ret = sock_hash.sock_hash_update (skops, &skk, BPF_NOEXIST);
    if (ret) {
        bpf_trace_printk ("bpf_sock_hash_update () failed. % d\\n", -ret);
        return;
    }
    bpf_trace_printk (...);
}
```

這邊的 bpf_sock_ops_ipv4 其實也很簡單，從 sock_opt 裡面提取出 IP 地址 / TCP port 的資訊，填充 sock_key 結構，然後呼叫 sock_hash_update 把 key-value piar 塞進去 sock_hash。後面的 flag 有  `BPF_NOEXIST`, `BPF_EXIST`, `BPF_ANY`。`BPF_NOEXIST`  表示只有 key 不在 map 裡面的時候可以插入。

接著是  `BPF_PROG_TYPE_SK_MSG`  的入口函數。

```c
int bpf_redir(struct sk_msg_md *msg) {
    if (msg->family != AF_INET)
        return SK_PASS;
    if (msg->remote_ip4 != msg->local_ip4)
        return SK_PASS;
    struct sock_key skk = {
        .remote_ip4 = msg->local_ip4,
        .local_ip4  = msg->remote_ip4,
        .local_port = bpf_ntohl (msg->remote_port),
        .remote_port = msg->local_port,
        .family = msg->family,
    };
    int ret = 0;
    ret = sock_hash.msg_redirect_hash (msg, &skk, BPF_F_INGRESS);
    bpf_trace_printk (...);
    if (ret != SK_PASS)
        bpf_trace_printk (...);
    return ret;
}
```

首先一樣我們只能處裡 TCP 連線所有把非  `AF_INET`  的連線透過  `return SK_PASS;`  交回 linux kernel 處理。

接著由於 socket redirect 只在本機起作用，所以這邊簡單判斷 src ip 和 dst ip 相不相同，來判斷是否是 local to local 連線。

接著由於 socket redirect 時要從發送端的 socket redirect 到接收端的 socket，因此我們要從 socket map 中找到接收端的 socket，對發送端和接收端的 socket 來說 src addres 和 dst address 的是顛倒的，所以這邊在生 sock_key 時會把 local 和 remote 顛倒。

接著這邊的  `msg_redirect_hash`  是對  `bpf_msg_redirect_hash` helper function 的包裝，會嘗試從 socket map 找到對應的 socket，然後完成 redirect 的設置，不過成功是回傳是 SK_PASS 而不是 SK_REDIRECT。

到這邊就完成 eBPF 程式的部分了，接下來 python 的部分就很簡單，只是把 eBPG 程式掛進去。

### python 實作

```python
examples = """examples:
    ./sockmap.py -c /root/cgroup # attach to /root/cgroup
"""
parser = argparse.ArgumentParser (
        description="pipe data across multiple sockets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=examples)
parser.add_argument ("-c", "--cgroup", required=True,
        help="Specify the cgroup address. Note. must be cgroup2")
args = parser.parse_args ()
```

前面有提到 SOCK_OPS 要掛在一個 cgroup 下面，所以先吃一個 cgroup 路徑參數來。

```python
bpf = BPF (text=bpf_text)
func_sock_ops = bpf.load_func ("bpf_sockhash", bpf.SOCK_OPS)
func_sock_redir = bpf.load_func ("bpf_redir", bpf.SK_MSG)
```

編譯 eBPF 程式，取得兩個入口函數

```python
# raise if error
fd = os.open(args.cgroup, os.O_RDONLY)
map_fd = lib.bpf_table_fd (bpf.module, b"sock_hash")
bpf.attach_func (func_sock_ops, fd, BPFAttachType.CGROUP_SOCK_OPS)
bpf.attach_func (func_sock_redir, map_fd, BPFAttachType.SK_MSG_VERDICT)
```

前面提到 cgroup 介面是一個虛擬檔案系統，所以當然要透過 open 去取得對應的 file descriptor。接著就是 attach func_sock_ops 到 SOCK_OPS。由於 func_sock_redir 要 attach 到 sock map，所以先透過 bcc 的 API 取得 sock_hash map 的 file descripter，然後 attach 上去。

這樣就完成 sockemap 的設置，可以成功提供 socket redirect 的服務了！

## 參考文件

- [cgroups man page](https://man7.org/linux/man-pages/man7/cgroups.7.html)
- [第一千零一篇的 cgroups 介紹](https://www.google.com/url?sa=t&rct=j&q=&esrc=s&source=web&cd=&cad=rja&uact=8&ved=2ahUKEwjx6a-q-eH9AhUjS2wGHZlPAbcQFnoECA4QAQ&url=https%3A%2F%2Fmedium.com%2Fstarbugs%2F%25E7%25AC%25AC%25E4%25B8%2580%25E5%258D%2583%25E9%259B%25B6%25E4%25B8%2580%25E7%25AF%2587%25E7%259A%2584-cgroups-%25E4%25BB%258B%25E7%25B4%25B9-a1c5005be88c&usg=AOvVaw10RsC5HM91QrnN5fKUCIld)
- [Cgroups 中的资源管理 hierarchy 层级树](https://blog.csdn.net/qq_46595591/article/details/107634756)
