---
categories:
  - 學習 eBPF 系列
  - 2022 iThome鐵人賽
description: 2022 iThome鐵人賽 學習eBPF系列 列舉eBPF helper function及其用途
tags:
  - eBPF
date: 2022-10-31
title: 學習 eBPF 系列 9 - eBPF helper functions
---

本篇是本系列文章的最後一篇，在 eBPF 程式裡面要與 kernel 交互很重要的是 helper function，因此在最後的兩天時間，我們要把所有的 helper function 速覽過一遍。這邊介紹以 bpf-helper 的  [man 文件](https://man7.org/linux/man-pages/man7/bpf-helpers.7.html)  的內容為主，部分的 helper function 可能因為文件更新而有遺漏。

<!-- more -->

接下來的介紹會稍微對 helper function 做一定程度的分類，但是具體不同的 eBPF program type 支援那些 helper function 可能還是要根據  [bcc 文件](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md)、每個 helper function 對應的 commit 資訊等查詢。

## eBPF map 操作類

- array, map 類型 map 的操作函數，對應到查詢、插入或更新、刪除 map 內的元素。其中 update 可以透過 flag (`BPF_NOEXIST`, `BPF_EXIST`, `BPF_ANY`) 決定 key 是不是不能先存在或一定要存在於 map 內。
  - bpf_map_lookup_elem
  - bpf_map_update_elem
  - bpf_map_delete_elem
- 用於 stack, queue 類型 map 的操作函數。
  - bpf_map_peek_elem
  - bpf_map_pop_elem
  - bpf_map_push_elem
- 用於 ringbuff 的操作函數 (改進原本 perf event map 的問題)
  - bpf_ringbuf_output
  - bpf_ringbuf_reserve
  - bpf_ringbuf_submit
  - bpf_ringbuf_discard
  - bpf_ringbuf_query

## 通用函數

- 生成隨機數
  - get_prandom_u32
- `atol`, `atoul`
  - bpf_strtol
  - bpf_strtoul
- 取得當前執行 eBPF 程式的 (SMP) processor ID。由於 eBPF 是 no preemption 的所以在整個執行過程中 processor id 不會變。
  - bpf_get_smp_processor_id
- 取得當前 NUMA (Non-uniform memory access) 的 node id。受於匯流排限制，CPU 核心可以比較快存取同節點上的 memory，透過 node id 區分。通常是當 attach 的 socket 有啟用  `SO_ATTACH_REUSEPORT_EBPF`  選項時會用到。
  - bpf_get_numa_node_id
- 搭配  `BPF_MAP_TYPE_PROG_ARRAY` map 去執行 tail call。
  - bpf_tail_call
- 取得開機到當下經過的時間，單位是 ns，差別在於後者會多包含 suspend (暫停) 的時間
  - bpf_ktime_get_ns
  - bpf_ktime_get_boot_ns
- 取得 jiffies64
  - bpf_jiffies64
- 將字串訊息發送到 /sys/kernel/debug/tracing/trace ，主要用於開發除錯
  - bpf_trace_printk
- 寫入 seq_file
  - bpf_seq_write
  - bpf_seq_printf
- 搭配  `struct bpf_spin_lock`  提供一個給  `BPF_MAP_TYPE_HASH`  和  `BPF_MAP_TYPE_ARRAY`(目前只支援這兩著) 裡面 value 使用的 lock，由於一個 map 裡面只能有一個 spin_lock，所以通常是使用把之前提過，整個 map 固定只有一個元素，把整個 map 當作一個 global variable 的用法
  - bpf_spin_lock
  - bpf_spin_unlock
- 搭配  `BPF_MAP_TYPE_PERF_EVENT_ARRAY`  使用，傳輸資料到 user space
  - bpf_perf_event_output

## Tracing 相關 (kprobe, tracepoint, perf event)

- 取得當前的 tgid, uid, gid, command name, task structure
  - bpf_get_current_pid_tgid
  - bpf_get_current_uid_gid
  - bpf_get_current_comm
  - bpf_get_current_task
- 發 signal 到當前 (process, thread)
  - bpf_send_signal
  - bpf_send_signal_thread
- 用於讀取記憶體資料、字串及寫入記憶體。帶 user 的版本用於 user space memory，其餘用於 kernel space memory。
  - bpf_probe_read (通常使用後倆著)
  - bpf_probe_read_user
  - bpf_probe_read_kernel
  - bpf_probe_read_str (通常使用後倆著)
  - bpf_probe_read_user_str
  - bpf_probe_read_kernel_str
  - bpf_probe_write_user
- 搭配  `BPF_MAP_TYPE_STACK_TRACE`  使用，取得一個 stack address hash 過的 stack id
  - bpf_get_stackid
- 取得 userspace 或 kernel space 的 stack 資料
  - bpf_get_stack
  - bpf_get_task_stack
- 搭配  `BPF_MAP_TYPE_PERF_EVENT_ARRAY`  取得 perf-event counter 的讀數
  - bpf_perf_event_read
  - bpf_perf_event_read_value (建議使用)
- 用於  `BPF_PROG_TYPE_PERF_EVENT`  取得 struct perf_branch_entry
  - bpf_read_branch_records
- 搭配  `BPF_MAP_TYPE_CGROUP_ARRAY`  使用，檢查是否在某個 cgroup v2 節點內
  - bpf_current_task_under_cgroup
- 查看當前上下文的 cgroup 節點的祖先節點 id
  - bpf_get_current_ancestor_cgroup_id
- 取得當前上下文對應的 cgroup id
  - bpf_get_current_cgroup_id
- 用於 kprobe，修改函數回傳值
  - bpf_override_return

### Cgroup 相關

- 取得一個當前 network namespace 對應的 cookie (identifer)
  - bpf_get_netns_cookie
- 取得 local storage 的指標 (cgroup 相關可使用的一個儲存區)
  - bpf_get_local_storage
- 用於  `BPF_PROG_TYPE_CGROUP_SYSCTL`
  - 取得、更新 sysctl 資訊
    - bpf_sysctl_get_name
    - bpf_sysctl_get_current_value
    - bpf_sysctl_get_new_value
    - bpf_sysctl_set_new_value

## 其他類別

- LIRC 紅外線收發相關 (BPF_PROG_TYPE_LIRC_MODE2)
  - bpf_rc_repeat
  - bpf_rc_keydown
  - bpf_rc_pointer_rel

## XDP 相關

- 於 XDP 修改封包大小 (可以增大或縮小)
  - bpf_xdp_adjust_head
  - bpf_xdp_adjust_tail
- XDP_TX redirect 使用
  - bpf_redirect_map
- XDP 輸出封包內容到 perf event
  - bpf_xdp_output
- 調整  `xdp_md->data_meta`
  - bpf_xdp_adjust_meta
- 查詢 fid (Forward Information Base, L2)
  - bpf_fib_lookup (也可用在 TC)

## LWT 相關

- attach 在 routing table
  - 替 L3 封包進行 tunnel header encap
    - bpf_lwt_push_encap
  - 外封包 (underlay) 內容修改
    - bpf_lwt_seg6_store_bytes
    - bpf_lwt_seg6_adjust_srh
  - 套用 IPv6 Segment Routing action 決策
    - bpf_lwt_seg6_action

## socket, socket buffer 相關

- 用於  `BPF_PROG_TYPE_CGROUP_SOCK_ADDR`，修改 bind address
  - bpf_bind
- 讀取封包內容
  - bpf_skb_load_bytes
  - bpf_skb_load_bytes_relative
- 修改封包內容，可自動更新 chekcsum
  - bpf_skb_store_bytes
- 改寫 l3, l4 的 checksum
  - bpf_l3_csum_replace
  - bpf_l4_csum_replace
- 用於計算 check sum，可搭配前兩個 replace 函數使用
  - bpf_csum_diff
- 取得 xfrm (IPsec 相關)
  - bpf_skb_get_xfrm_state
- 將封包發到其他的 device。後者會複製一分封包。
  - bpf_redirect
  - bpf_clone_redirect
- 取得 classid，參考 cgroup 的 net_cls，使用於 TC egress path。
  - bpf_get_cgroup_classid
- 增減 vlan header
  - bpf_skb_vlan_push
  - bpf_skb_vlan_pop
- 取得、修改封包的 tunnel (ex. GRE) 的 tunnel key 資訊
  - bpf_skb_get_tunnel_key
  - bpf_skb_set_tunnel_key
- 取得、修改封包的 tunnel 資訊
  - bpf_skb_get_tunnel_opt
  - bpf_skb_set_tunnel_opt
- 取得 skb 的 tclassid 欄位，用於 clsact TC egress
  - bpf_get_route_realm
- 修改封包 prtocol (ipv4, ipv6)
  - bpf_skb_change_proto
- 修改封包類型 (broadcast, multicast, unitcast..)
  - bpf_skb_change_type
- 搭配  `BPF_MAP_TYPE_CGROUP_ARRAY`  使用，檢查 skb 是不是在某個 cgroup v2 節點的子節點內。
  - bpf_skb_under_cgroup
- 取得 skb 對應的 cgroup id
  - bpf_skb_cgroup_id
- 向上查找 skb 對應 cgroup 節點的祖先節點 id
  - bpf_sk_ancestor_cgroup_id
- 取得、修改  `skb->hash`
  - bpf_get_hash_recalc
  - bpf_set_hash
- 修改封包大小
  - bpf_skb_change_tail
- 用於封包 payload 存取，具體內容有點難理解 (non-linear data)
  - bpf_skb_pull_data
- 修改  `skb->csum`
  - bpf_csum_update
- 修改  `skb->csum_level`
  - bpf_csum_level
- 標註  `skb->hash`  為無效，觸發重算
  - bpf_set_hash_invalid
- 將  `skb->sk`  轉成所有欄位都可以訪問的版本
  - bpf_sk_fullsock
- 從  `skb->sk`  取得  `struct bpf_tcp_sock`
  - bpf_tcp_sock
- 向 tcp-sock 對應的方向發一個 tcp-ack
  - bpf_tcp_send_ack
- 從  `skb->sk`  取得  `bpf_sock`
  - bpf_get_listener_sock
- 設置  `skb->sk`
  - bpf_sk_assign
- 取得 bpf_sock 對應的 cgroupv2 id
  - bpf_sk_cgroup_id
- 取得 bpf_sock 對應 cgroupv2 節點的祖先 id
  - bpf_sk_ancestor_cgroup_id
- 強制轉型 sk 成特定的 XXX_sock 結構
  - bpf_skc_to_tcp6_sock
  - bpf_skc_to_tcp_sock
  - bpf_skc_to_tcp_timewait_sock
  - bpf_skc_to_tcp_request_sock
  - bpf_skc_to_udp6_sock
- 增加 packet header 區 (headroom) 長度，用於為 L3 封包直接加上 L2 的 header
  - bpf_skb_change_head
- 幫 socket 建立一個 cookie，作為 socket 的 identifier，用於追蹤
  - bpf_get_socket_cookie (sk_buff)
  - bpf_get_socket_cookie (bpf_sock_addr)
  - bpf_get_socket_cookie (bpf_sock_ops)
- 取得 socket 的 owner UID
  - bpf_get_socket_uid
- 模擬呼叫 getsocketopt、setsockopt
  - bpf_getsockopt
  - bpf_setsockopt
- 存取 skb 的 ebpf local storage
  - bpf_sk_storage_get
  - bpf_sk_storage_delete
- 將封包內容輸出到 perf event
  - bpf_skb_output
- 修改封包 payload 大小，可以從 L2 或 L3 的角度來看
  - bpf_skb_adjust_room
- 產生、尋找封包對應的  `SYN cookie ACK`+ bpf_tcp_gen_syncookie+ bpf_tcp_check_syncookie
- `BPF_PROG_TYPE_SK_SKB` (ingress 方向)
  - 搭配  `BPF_MAP_TYPE_SOCKMAP`  做 socket redierct
    - bpf_sk_redirect_map
    - bpf_sk_redirect_hash
  - 搜尋滿足對應 5-tuple 的 socket
    - bpf_sk_lookup_tcp
    - bpf_skc_lookup_tcp
    - bpf_sk_lookup_udp
  - 釋放上面兩個找到的 socket 的 reference
    - bpf_sk_release
- `BPF_PROG_TYPE_SK_MSG` (egress 方向)
  - 搭配  `BPF_MAP_TYPE_SOCKMAP`  做 socket redierct
    - bpf_msg_redirect_map
    - bpf_msg_redirect_hash
  - 替特定長度的內容作 verdict (SK_PASS…)，可用於截短封包，優化處理速度 (tc 相關的東西不太熟…/)
    - bpf_msg_apply_bytes
  - 跳過接下來某長度的內容不做 veridct
    - bpf_msg_cork_bytes
  - 讀寫修改特定長度的資料
    - bpf_msg_pull_data
    - bpf_msg_pop_data
    - bpf_msg_push_data
- 更新  `BPF_MAP_TYPE_SOCKMAP`
  - bpf_sock_map_update
- 設置  `bpf_sock_ops->bpf_sock_ops_cb_flags`  欄位
  - bpf_sock_ops_cb_flags_set
- 更新 sockhash
  - bpf_sock_hash_update
- 用於  `BPF_PROG_TYPE_SK_REUSEPORT`(將多個程式綁定在同一個 port 上)
  - sk_select_reuseport
- 用於  `BPF_PROG_TYPE_CGROUP_SKB`，設置 ECN (Explicit Congestion Notification)
  - bpf_skb_ecn_set_ce
