---
categories:
  - 學習 eBPF 系列
  - 2022 iThome鐵人賽
description: 2022 iThome鐵人賽 學習eBPF系列 介紹eBPF實例tcpconnect以及kprobe
tags:
  - eBPF
date: 2022-10-31
title: 學習 eBPF 系列 4 - BCC tcpconnect
---

我們要來看 BCC 的  `tools/tcpconnect.py`  這支程式。原始碼在  [這邊](https://github.com/iovisor/bcc/blob/master/tools/tcpconnect.py)。

<!-- more -->

## tcpconnect 介紹

這隻程式會追蹤紀錄 kernel 發起的 TCP 連線，可以看到發起連線的 pid, 指令名稱，ip version, IP 地址和目標 port 等資訊。

執行結果如下：

```shell
python3 tools/tcpconnect
Tracing connect ... Hit Ctrl-C to end
PID     COMM         IP SADDR            DADDR            DPORT
2553    ssh          4  10.0.2.15        10.0.2.1         22
2555    wget         4  10.0.2.15        172.217.160.100  80
```

## tcpconnect 實作

首先透過  `argparse`  定義了指令的參數輸入，主要是提供 filter 的選項，讓使用者可以透過 pid, uid, namespace 等參數去 filter 連線紀錄。

```python
parser = argparse.ArgumentParser (
    description="Trace TCP connects",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog=examples)
parser.add_argument ("-p", "--pid",
    help="trace this PID only")
...
args = parser.parse_args ()
```

接著就來到主要的 eBPF 程式碼的定義

```c
bpf_text = """
#include <uapi/linux/ptrace.h>
#include <net/sock.h>
#include <bcc/proto.h>

BPF_HASH (currsock, u32, struct sock *);
...
```

首先可以看到  `BPF_HASH`，這是 BCC 提供的一個巨集，用來定一個 hash type 的 map，對於不同 map type BCC 都定義了對應的巨集來建立 map。具體列表可以參考  [這邊](https://github.com/iovisor/bcc/blob/master/docs/reference_guide.md#maps)。第一個參數是 map 的名稱，這邊叫做 currsock，同時這個變數也用於後續程式碼中對 map 的參考和 API 呼叫，例如  `currsock.lookup (&tid);`  就是對 currsock 這個 map 進行 lookup 操作。接著兩個欄位分別對應 key 和 value 的 type，key 是一個 32 位元整數，value 則對應到 sock struct 指標。sock 結構在  [net/sock.h](https://elixir.bootlin.com/linux/latest/source/include/net/sock.h#L352)  內定義，是 linux kernel 用來維護 socket 的資料結構。

```c
struct ipv4_data_t {
    u64 ts_us;
    u32 pid;
    u32 uid;
    u32 saddr;
    u32 daddr;
    u64 ip;
    u16 lport;
    u16 dport;
    char task [TASK_COMM_LEN];
};
BPF_PERF_OUTPUT (ipv4_events);

struct ipv6_data_t {
...
```

接著分別針對 ipv4 和 ipv6 定義了一個 data_t 的資料結構，用於 bpf 和 userspace client 之間傳輸 tcp connect 的資訊用。

這邊可以看到另外一個特別的巨集  `BPF_PERF_OUTPUT`。這邊用到了 eBPF 提供的 perf event 機制，定義了一個 per-CPU 的 event ring buffer，並提供了對應的 bpf_perf_event_output helper function 來把資料推進 ring buffer 給 userspace 存取。在 bcc 這邊則使用  `ipv4_events.perf_submit (ctx, &data, sizeof (data));`  的 API 來傳輸資料。

```c
//separate flow keys per address family
struct ipv4_flow_key_t {
    u32 saddr;
    u32 daddr;
    u16 dport;
};
BPF_HASH (ipv4_count, struct ipv4_flow_key_t);
```

接著又是一個 HASH map，tcpdconnect 提供一個功能選項是統計各種 connection 的次數，所以這邊定義了一個 ipv4_flow_key_t 當作 key 來作為統計依據，`BPF_HASH`  在預設情況下 value 的 type 是  `u64`，一個 64 位元無號整數，因此可以直接拿來統計。

接著就來到了 bpf 函數主體，這個函數會被 attach 到 tcp_v4_connect 和 tcp_v6_connect 的 kprobe 上，當呼叫 tcp_v4_connect 和 tcp_v6_connect 時被觸發。

```c
int trace_connect_entry(struct pt_regs *ctx, struct sock *sk)
{
    if (container_should_be_filtered ()) {
        return 0;
    }
    u64 pid_tgid = bpf_get_current_pid_tgid ();
    u32 pid = pid_tgid >> 32;
    u32 tid = pid_tgid;
    FILTER_PID
    u32 uid = bpf_get_current_uid_gid ();
    FILTER_UID
    //stash the sock ptr for lookup on return
    currsock.update (&tid, &sk);
    return 0;
};
```

首先它接收的參數是 pt_regs 結構和 tcp_v4_connect 的參數，pt_regs 包含了 CPU 佔存器的數值資訊，作為 eBPF 的上下文。後面 tcp_v4_connect 的第一個參數 sock 結構對應到當次連線的 socket 資訊，由於後面幾個參數不會使用到所以可以省略掉。

```shell
./tcpconnect --cgroupmap mappath  # only trace cgroups in this BPF map
./tcpconnect --mntnsmap mappath   # only trace mount namespaces in the map
```

首先呼叫的是  `container_should_be_filtered`。在 argparser 中定義了兩個參數 cgroupmap 和 mntnsmap 用來針對特定的 cgroups 或 mount namespace。`container_should_be_filtered`  則會負責這兩項的檢查。

一開始看可能會發現在 eBPF 程式裡面找不到這個函數定的定義，由於這兩個 filter 非常常用因此 bcc 定義了  `bcc.containers.filter_by_containers`[函數](https://github.com/iovisor/bcc/blob/master/src/python/bcc/containers.py)，在 python 程式碼裡面會看到，`bpf_text = filter_by_containers (args) + bpf_text`。以 cgroup 來說，如果使用者有提供  `cgroupmap`  這個參數，`filter_by_containers`  會在 mappath 透過  `BPF_TABLE_PINNED`  在 BPFFS 建立一個 hash type 的 map，根據這個 map 的 key 來 filter cgroup id，透過  `bpf_get_current_cgroup_id ()`  取得當前上下文的 cgroup_id 並只保留有在 map 內的上下文。

接著  `FILTER_PID`  和  `FILTER_UID`  分別是針對 pid 和 uid 去 filter，在後面的 python 程式碼中會根據是否有啟用這個選項來把字串替代成對應的程式碼或空字串

```python
if args.pid:
    bpf_text = bpf_text.replace ('FILTER_PID',
        'if (pid != % s) { return 0; }' % args.pid)
bpf_text = bpf_text.replace ('FILTER_PID', '')
```

如果一切都滿足，就會使用 tid 當 key，將 sock 結構更新到  `currsock` map 當中。

後半部分的 eBPG 程式碼定義了  `trace_connect_return`，這個函數會被 attach 到 tcp_v4_connect 和 tcp_v6_connect 的 kretprobe 上。kprobe 是在函數被呼叫時被觸發，kretprobe 則是在函數回傳時被觸發，因此可以取得函數的回傳值和執行結果。

```c
int trace_connect_v4_return(struct pt_regs *ctx)
{
    return trace_connect_return (ctx, 4);
}
```

真正的進入點分成 ip v4 和 v6 的版本來傳入 ipver 變數。

```c
static int trace_connect_return(struct pt_regs *ctx, short ipver)
{
    int ret = PT_REGS_RC (ctx);
    u64 pid_tgid = bpf_get_current_pid_tgid ();
    u32 pid = pid_tgid >> 32;
    u32 tid = pid_tgid;
    struct sock **skpp;
    skpp = currsock.lookup (&tid);
    if (skpp == 0) {
        return 0;   //missed entry
    }
    if (ret != 0) {
        //failed to send SYNC packet, may not have populated
        //socket __sk_common.{skc_rcv_saddr, ...}
        currsock.delete (&tid);
        return 0;
    }
    //pull in details
    struct sock *skp = *skpp;
    u16 lport = skp->__sk_common.skc_num;
    u16 dport = skp->__sk_common.skc_dport;
    FILTER_PORT
    FILTER_FAMILY
    if (ipver == 4) {
        IPV4_CODE
    } else /* 6 */ {
        IPV6_CODE
    }
    currsock.delete (&tid);
    return 0;
}
```

透過  `PT_REGS_RC`  可以取得函數的回傳值，根據函數的定義，如果執行成功應該要回傳 0 所以如果  `ret`  不為零，表示執行錯誤，直接忽略。透過  `currsock.lookup`  我們可以取回對應 tid 的 sock 指標，然後取得 dst port 和 src port (lport)，由於這時候 tcp_connect 已經執行完成，所以 src port 已經被 kernel 分配。

> 這邊可以看到 eBPF 程式設計上比較複雜的地方，sock 結構體要在 kprobe 取得，但是我們又需要 kretprobe 後的一些資訊，因此整個架構要被拆成兩個部分，然後透過 map 來進行傳輸。

接著  `FILTER_PORT`  和  `FILTER_FAMILY`  一樣會被替換，然後根據 dst port 和 family 來 filter。

由於 tcpconnect 有紀錄和統計連線次數兩種模式，因此最後一段的 code 一樣先被標記成  `IPV4_CODE`。然後根據模式的不同來取代成不同的 code。

```python
if args.count:
    bpf_text = bpf_text.replace ("IPV4_CODE", struct_init ['ipv4']['count'])
    bpf_text = bpf_text.replace ("IPV6_CODE", struct_init ['ipv6']['count'])
else:
    bpf_text = bpf_text.replace ("IPV4_CODE", struct_init ['ipv4']['trace'])
    bpf_text = bpf_text.replace ("IPV6_CODE", struct_init ['ipv6']['trace'])
```

我們這邊就只看 ipv4 trace 的版本。

```c
struct ipv4_data_t data4 = {.pid = pid, .ip = ipver};
data4.uid = bpf_get_current_uid_gid ();
data4.ts_us = bpf_ktime_get_ns () / 1000;
data4.saddr = skp->__sk_common.skc_rcv_saddr;
data4.daddr = skp->__sk_common.skc_daddr;
data4.lport = lport;
data4.dport = ntohs (dport);
bpf_get_current_comm (&data4.task, sizeof(data4.task));
ipv4_events.perf_submit (ctx, &data4, sizeof(data4));
```

這邊其實就是去填充 ipv4_data_t 結構、透過 bpf_get_current_comm 取得當前程式的名稱，最後透過前面透過 BPP_PERF_OUT 定義的 ipv4_events，呼叫  `perf_submit (ctx, &data4, sizeof (data4))`  將資料送到 user space。

到這邊就完成了整個的 eBPF 程式碼  `bpf_text`  的定義，後面就會先經過前面講的，將 IPV4_CODE 等字段，根據 tcpconnect 的參數進行取代。

```python
b = BPF (text=bpf_text)
b.attach_kprobe (event="tcp_v4_connect", fn_name="trace_connect_entry")
b.attach_kprobe (event="tcp_v6_connect", fn_name="trace_connect_entry")
b.attach_kretprobe (event="tcp_v4_connect", fn_name="trace_connect_v4_return")
b.attach_kretprobe (event="tcp_v6_connect", fn_name="trace_connect_v6_return")
```

接著透過 BCC 的 library 完成 eBPF 程式碼的編譯、載入和 attach。

最後是輸出的部分，前面會先輸出一些下列的欄位資訊，但是由於這不是很重要所以就省略掉。

```text
Tracing connect ... Hit Ctrl-C to end
PID     COMM         IP SADDR            DADDR            DPORT
```

```python
b = BPF (text=bpf_text)
...
# read events
b ["ipv4_events"].open_perf_buffer (print_ipv4_event)
b ["ipv6_events"].open_perf_buffer (print_ipv6_event)

while True:
	try:
		b.perf_buffer_poll ()
	except KeyboardInterrupt:
		exit ()
```

完成載入後，我們可以拿到一個對應的 BPF 物件，透過 b[MAP_NAME]，我們可以調用 map 對應的  `open_perf_buffer`API，透過  `open_perf_buffer`，我們可以定義一個 callback function 當有資料從 kernel 透過 perf_submit 被傳輸的時候被呼叫來處理 eBPF 程式送過來的資料。

最後會呼叫  `b.perf_buffer_poll`  來持續檢查 perf map 是不是有新的 perf event，以及呼叫對應的 callback function。

```python
def print_ipv4_event(cpu, data, size):
    event = b ["ipv4_events"].event (data)
    global start_ts
    if args.timestamp:
        if start_ts == 0:
            start_ts = event.ts_us
        printb (b"%-9.3f" % ((float(event.ts_us) - start_ts) / 1000000), nl="")
    if args.print_uid:
        printb (b"%-6d" % event.uid, nl="")
    dest_ip = inet_ntop (AF_INET, pack ("I", event.daddr)).encode ()
    if args.lport:
        printb (b"%-7d %-12.12s %-2d %-16s %-6d %-16s %-6d % s" % (event.pid,
            event.task, event.ip,
            inet_ntop (AF_INET, pack ("I", event.saddr)).encode (), event.lport,
            dest_ip, event.dport, print_dns (dest_ip)))
    else:
        printb (b"%-7d %-12.12s %-2d %-16s %-16s %-6d % s" % (event.pid,
            event.task, event.ip,
            inet_ntop (AF_INET, pack ("I", event.saddr)).encode (),
            dest_ip, event.dport, print_dns (dest_ip))) x
```

透過  `b ["ipv4_events"].event`  可以直接將 data 數據轉換成 BPF 程式內定義的資料結構，方便存取。取得的資料再經過一些清洗和轉譯就能夠直接輸出了。

雖然我們跳過了 count 功能還有一個紀錄 dst ip 的 DNS 查詢，但到此我們大致上看完了整個 tcpconnect 的主要的實作內容。
