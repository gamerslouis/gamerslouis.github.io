---
categories:
  - eBPF
description: 2022 iThome鐵人賽 學習eBPF系列 介紹http-parser實例以及socket filter
tags:
  - 2022 iThome鐵人賽 - 學習 eBPF 系列
  - 技術分享
date: 2022-10-31
title: 學習 eBPF 系列 5 - BCC HTTP Filter & Socket Filter
---

這篇文章會介紹 eBPF socket filter 的概念，並使用 bcc 的  [http-parse-simple.py](https://github.com/iovisor/bcc/tree/master/examples/networking/http_filter)  作為範例，來說明如何使用 eBPF socket filter 來過濾 HTTP 請求，並且會深入底下 eBPF 的 socket filter 底層部分的實作。

<!-- more -->

## Socket filter 介紹

前一篇文章介紹的 tcpconnect 是使用  `BPF_PROG_TYPE_KPROBE`  這個 program type，透過 kprobe/kretprobe 機制在 kernel function 被呼叫和回傳的時候執行。

這次使用的是  `BPF_PROG_TYPE_SOCKET_FILTER`，socket filter 可以對進出 socket 的封包進行截斷或過濾。特別注意這邊如果會需要擷取封包 (長度不等於原始封包長度) 則會觸發對封包進行複製，然後修改封包大小。

socket filter program 會在 socket 層被呼叫 (在 net/core/sock.c 的 sock_queue_rcv_skb 被呼叫)，並傳入  [\_sk_buff 結構](https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/bpf.h#L5745)  取得 socket 上下文及封包的內容。

透過回傳的數值來決定如何處理該封包，如果回傳的數值大於等於封包長度，等價於保留完整封包，如果長度小於封包長度，則截斷只保留回傳數值長度的封包。其中兩個特例是回傳 0 和 - 1。回傳 0 等價解取一個長度為 0 的封包，也就是直接丟棄該封包。回傳 - 1 時，由於封包長度是無號整數，-1 等價於整數的最大數值，因此保證保留整個完整的封包。

另外一個關鍵技術是 raw socket，我們可以將 raw socket 監聽某個網路介面上所有進出封包。

因此整個程式的執行方式是這樣的，在目標網路卡上開啟一個 raw socket，透過 eBPF 程式過濾掉所有非 http 的封包，只保留 http 封包送出到 raw socket，userspace client 接收到封包時，可以直接解析封包欄位提取出 http 封包資訊。

## http-parse-simple 介紹

首先一樣先了解一下這支程式的功能，http-parse 能夠綁定到一張網路卡上面執行，然後提取經過 http 流量，將 http version, method, uri 和 status 輸出顯示。(當然如果經過 tls 加密的話是沒辦法的)

執行結果如下

```text
python http-parse-complete.py
GET /pipermail/iovisor-dev/ HTTP/1.1
HTTP/1.1 200 OK
GET /favicon.ico HTTP/1.1
HTTP/1.1 404 Not Found
GET /pipermail/iovisor-dev/2016-January/thread.html HTTP/1.1
HTTP/1.1 200 OK
GET /pipermail/iovisor-dev/2016-January/000046.html HTTP/1.1
HTTP/1.1 200 OK
```

## http-parse-simple 實作

### eBPF 實作

在這次的程式中 eBPF c code 直接寫在一個獨立的 http-parse-simple.c 檔案中。

這次的 ebpf 程式很簡單只有單一個函數  `http_filter`，作為 socket filter 的進度點。

```c
int http_filter(struct __sk_buff *skb) {

	u8 *cursor = 0;

	struct ethernet_t *ethernet = cursor_advance (cursor, sizeof(*ethernet));
	//filter IP packets (ethernet type = 0x0800)
	if (!(ethernet->type == 0x0800)) {
		goto DROP;
	}
	struct ip_t *ip = cursor_advance (cursor, sizeof(*ip));

	//drop the packet returning 0
	DROP:
	return 0;
...
```

相信很多人跟我一樣第一眼看到這個程式會覺得非常疑惑，首先看到的是  `cursor`  和  `cursor_advance`  這兩個東西，從 ip 那行大概可以猜的出來，cursor 是對封包內容存取位置的指標，cursor_advance 會輸出當前 cursor 的位置，然後將 cursor 向後移動第二個參數的長度。由於我們要分析的是 http 封包，所以他的 ether type 勢必得是 0x0800 (IP)，所以對於不滿足的封包，我們直接 goto 到 drop，return 0。表示我們要擷取一個長度為 0 的封包等價於丟棄該封包。

在 bcc 的  [helpers.h](https://github.com/iovisor/bcc/blob/master/src/cc/export/helpers.h)  輔助函數標頭檔裡面可以看到 cursor_advane 的定義。

```c
//packet parsing state machine helpers
#define cursor_advance (_cursor, _len) \
  ({ void *_tmp = _cursor; _cursor += _len; _tmp; })
```

果然符合我們的預期，先將原先 cursor 指標的數值保留起來，將 cursor 向後移動 len 後回傳原始數值。

後面的程式碼其實就很簡單，首先一路解析封包確保他是一個 ip/tcp/http 封包、封包長度夠長塞的下一個有效的 http 封包內容

```c
payload_offset = ETH_HLEN + ip_header_length + tcp_header_length;
...
unsigned long p [7];
int i = 0;
for (i = 0; i < 7; i++) {
	p [i] = load_byte (skb, payload_offset + i);
}
```

接著將 http packet 的前 7 個 byte 讀出來，load_byte 同樣是定義在  [helpers.h](https://github.com/iovisor/bcc/blob/master/src/cc/export/helpers.h)

```c
unsigned long long load_byte (void *skb,
	unsigned long long off) asm ("llvm.bpf.load.byte");
```

他會直接轉譯成 BPF_LD_ABS，從 payload_offset 位置開始讀一個 byte 出來，payload_offset，是前面算出來從 ethernet header 開始到 http payload 的位移。

```c
//HTTP
if ((p [0] == 'H') && (p [1] == 'T') && (p [2] == 'T') && (p [3] == 'P')) {
	goto KEEP;
}
//GET
if ((p [0] == 'G') && (p [1] == 'E') && (p [2] == 'T')) {
	goto KEEP;
}
...
//no HTTP match
goto DROP;

//keep the packet and send it to userspace returning -1
KEEP:
return -1;
```

接著檢查如果封包屬於 HTTP (以 HTTP, GET, POST, PUT, DELETE HEAD… 開頭)，就會跳到 keep，保留整個完整的封包送到 userspace client program。

```c
GET /favicon.ico HTTP/1.1
HTTP/1.1 200 OK
```

HTTP request 會以 method 開頭、response 會以 HTTP 開頭，所以需要查找這些字樣開頭的封包。

### python 實作

接著我們很快速的來看一下 python 程式碼的部分。

```python
bpf = BPF (src_file = "http-parse-simple.c",debug = 0)
function_http_filter = bpf.load_func ("http_filter", BPF.SOCKET_FILTER)
BPF.attach_raw_socket (function_http_filter, interface)
socket_fd = function_http_filter.sock
sock = socket.fromfd (socket_fd,socket.PF_PACKET,socket.SOCK_RAW,socket.IPPROTO_IP)
sock.setblocking (True)
```

首先我們一樣透過 BPF 物件完成 bpf 程式碼的編譯，不一樣的是是這邊直接指定 src_file 從檔案讀取。接著透過 load_func，指定 socket filter 這個 program type type 和 http_filter 這個入口函數，並載入 ebpf bytecode 到 kernel 接著透過 bcc 提供的 attach_raw_socket API 在 interface 上建立 row socket 並將 socket filter program attach 上去。接著從  `function_http_filter.sock`  取得 raw socket 的 file descripter 並封裝成 python 的 socket 物件。由於後面需要 socket 是阻塞的，但是 attach_raw_socket 建立出來的 socket 是非阻塞的，所以這邊透過  `sock.setblocking (True)`  阻塞 socket

```python
while 1:
  #retrieve raw packet from socket
  packet_str = os.read (socket_fd,2048)
  packet_bytearray = bytearray (packet_str)
  ...
  for i in range (payload_offset,len (packet_bytearray)-1):
    if (packet_bytearray [i]== 0x0A): # \n
      if (packet_bytearray [i-1] == 0x0D): \r
        break # 遇到 http 的換行 \r\n 則結束 < br>    print ("% c" % chr (packet_bytearray [i]), end = "")
```

後面的程式碼其實就和 ebpf 的部分大同小異，從 socket 讀取封包內容、解析到 http payload 後，將 http payload 的第一行輸出出來。

到此我們就完成了  `http-parse-simple`  的解析。

### 問題

1. cursor 指標數值為 0，但是可以存取到封包的內容。

   ```c
   u8 *cursor = 0;
   struct ethernet_t *ethernet = cursor_advance (cursor, sizeof(*ethernet));
   if (!(ethernet->type == 0x0800)) {
   		goto DROP;
   }
   ```

2. 特別的 load_bytes 函數呼叫，來取得封包內容

   ```c
   load_byte (skb, payload_offset + i);
   ```

首先雖然 ebpf 使用 c 來編寫，但是經由 LLVM 編譯後會轉換成 eBPF bytecode，在進入 kernel 後會再經過 verifier 的修改。(經過這次的探索，可以理解 verifier 雖然叫做 verifier，但是他的功能確包羅萬象，對 eBPF 架構來說非常重要)

## 深入了解 Socket filter

為了理解這段 eBPF code 後面發生了什麼事，我們先查看 LLVM 編譯出來的 eBPF bytecode。

### BCC Debug

在 BCC 編譯時，我們可以透過  `debug`  這個參數取得編譯過程中的資訊，當然也包含取得 LLVM 編譯出來的 eBPF bytecode，可以使用的 debug 選項如下

```python
# Debug flags

# Debug output compiled LLVM IR.
DEBUG_LLVM_IR = 0x1
# Debug output loaded BPF bytecode and register state on branches.
DEBUG_BPF = 0x2
# Debug output pre-processor result.
DEBUG_PREPROCESSOR = 0x4
# Debug output ASM instructions embedded with source.
DEBUG_SOURCE = 0x8
# Debug output register state on all instructions in addition to DEBUG_BPF.
DEBUG_BPF_REGISTER_STATE = 0x10
# Debug BTF.
DEBUG_BTF = 0x20
```

### 解析 simple-http-parse 編譯結果

透過  `BPF (src='simple-http-parse.c', debug=DEBUG_PREPROCESSOR)`，我們可以看到上面的 code 被 LLVM 重新解釋為

```c
void *cursor = 0;

struct ethernet_t *ethernet = cursor_advance (cursor, sizeof(*ethernet));

//filter IP packets (ethernet type = 0x0800)
if (!(bpf_dext_pkt (skb, (u64) ethernet+12, 0, 16) == 0x0800)) {
	goto DROP;
}
```

因此 cursor 在這邊的用途真的只是計算 offset。bpf_dext_pkt 在 bcc 的  [helper.h](https://github.com/iovisor/bcc/blob/master/src/cc/export/helpers.h)  有所定義

```c
u64 bpf_dext_pkt(void *pkt, u64 off, u64 bofs, u64 bsz) {
  if (bofs == 0 && bsz == 8) {
    return load_byte (pkt, off);
  } else if (bofs + bsz <= 8) {
    return load_byte (pkt, off) >> (8 - (bofs + bsz))  &  MASK (bsz);
  } else if (bofs == 0 && bsz == 16) {
     return load_half (pkt, off);
  ...
```

可以看到他是根據參數大小和類型去正確呼叫 load_byte, load_half, load_dword 系列函數，所以其實他做的事情與我們感興趣的第二段 code `load_byte (skb, payload_offset + i);`  是一致的。

接著我們使用  `BPF (src='simple-http-parse.c', debug=DEBUG_SOURCE)`  查看編譯出來的 eBPF binary code。

```c
; int http_filter(struct __sk_buff *skb) { // Line  27
   0:	bf 16 00 00 00 00 00 00	r6 = r1
   1:	28 00 00 00 0c 00 00 00	r0 = *(u16 *) skb [12]
; if (!(bpf_dext_pkt (skb, (u64) ethernet+12, 0, 16) == 0x0800)) { // Line  34
   2:	55 00 5c 00 00 08 00 00	if r0 != 2048 goto +92
```

其中 r0, r1, r6 是 eBPF 的 register，我們這邊只關注第 1 行  `r0 = *(u16 *) skb [12]`，這行是從 skb 的第 12 個 byte 拿取資料出來，剛好對應到 bpf_dext_pkt。

根據 ebpf instruction set 的定義，第一個 byte 28 (0010 1000) 是 op code。最後 3 個 bit 000 是 op code 的種類。這邊的 0x00 對應到  `BPF_LD` (non-standard load operations)

| 3 bits (MSB) | 2 bits | 3 bits (LSB)      |
| ------------ | ------ | ----------------- |
| mode         | size   | instruction class |

在  `BPF_LD`  這個分類內，size bits 01 剛好對應到  `BPF_H` (half word (2 bytes))最前面的 3 個 bit 000 代表  `BPF_ABS`(legacy BPF packet access)。

到這邊我們就理解它是怎麼運作了了，eBPF 定義了  `BPF_ABS`  來代表對封包的存取操作，LLVM 在編譯的時會將對 skb 的 load_byte 轉譯成對應的 instruction。

### 了解 eBPF BPF_ABS instruction

我們可以更深入的了解一下 eBPF 對  `BPF_ABS`  做了什麼事情，在 verifier 這個神奇的地方搜尋  `BPF_ABS`  這個 instruction，會找到下面這段內容 (簡化版)

```python
/* Implement LD_ABS and LD_IND with a rewrite, if supported by the program type. */
if (BPF_CLASS (insn->code) == BPF_LD &&
	(BPF_MODE (insn->code) == BPF_ABS ||
	 BPF_MODE (insn->code) == BPF_IND)) {

	cnt = env->ops->gen_ld_abs (insn, insn_buf);
	new_prog = bpf_patch_insn_data (env, i + delta, insn_buf, cnt);
```

首先執行條件是  `BPF_LD`  及  `BPF_ABS`，我們的 code 剛好符合這個條件，接著會呼叫  `env->ops->gen_ld_abs`，根據原本的 instrunction `insn`，生成新的 instruction 寫入  `insn_buf`，接著呼叫  `bpf_patch_insn_data`  將原本的指令取代為新的指令。

接著我們要找一下  `gen_ld_abs`，跟 day 11 介紹 map 的情況類似，verifier 定義了 bpf_verifier_ops 結構，讓不同的 program type 根據需要，實作 bpf_verifier_ops 定義的 function 來提供不同的功能和行為。

socket filter 的定義如下

```c
const struct bpf_verifier_ops sk_filter_verifier_ops = {
	.get_func_proto		= sk_filter_func_proto,
	.is_valid_access	= sk_filter_is_valid_access,
	.convert_ctx_access	= bpf_convert_ctx_access,
	.gen_ld_abs		= bpf_gen_ld_abs,
};
```

所以讓我們看到  `bpf_gen_ld_abs` (一樣經過簡化只看我們需要的部分)

```c
static int bpf_gen_ld_abs(const struct bpf_insn *insn,
			  struct bpf_insn *insn_buf)
{
	*insn++ = BPF_MOV64_REG (BPF_REG_2, orig->src_reg);

/* We're guaranteed here that CTX is in R6. */
	*insn++ = BPF_MOV64_REG (BPF_REG_1, BPF_REG_CTX);

	*insn++ = BPF_EMIT_CALL (bpf_skb_load_helper_16_no_cache);
}
```

看到最後一行就很清晰了，最後其實等於調用了內部使用的 helper function 來存取資料。eBPF 也提提供了類似的 helper function `bpf_skb_load_bytes`，來提供存取封包內容的功能。

```c
BPF_CALL_2 (bpf_skb_load_helper_16_no_cache, const struct sk_buff *, skb,
	   int, offset)
{
	return ____bpf_skb_load_helper_16 (skb, skb->data, skb->len - skb->data_len,
					  offset);
}
```

而 bpf_skb_load_helper_16_no_cache 其實就是直接從  `sk_buff->data`  的位置取得資料，data 是 sk_buff 用來指到封包開頭的指標。

### \_\_sk_buff 的限制

既然整個指令的本質是從  `sk_buff->data`  拿取資料，那我們是不是能夠直接從  `__sk_buff`  裡面拿到資料呢？

在 socket program type 下 program context 是  `__sk_buff`，他其實本質是對 sk_buff 的多一層封裝 (原因  [參見](https://lwn.net/Articles/636647))，在執行的時候，verifier 換將其取代回 sk_buff，因此\_\_sk_buff 等於是 sk_buff 暴露出來的介面。

```c
struct __sk_buff {
	...
	__u32 data;
	__u32 data_end;
	__u32 napi_id;
	...
```

參考**sk_buff 的定義，`**sk_buff` 是有定義將 `data` 和 `data_end`，那我們原始的 eBPF 程式是不是可以改成

```c
void *cursor = (void*)(long)(__sk_buff->data);
struct ethernet_t *ethernet = cursor_advance (cursor, sizeof (*ethernet));
if (!(ethernet->type == 0x0800)) {
		goto DROP;
}
```

如果完成這樣的修改，重新跑一遍  `http-parse-simple.py`，你會得到

```shell
python3 http-parse-simple.py -i eno0
binding socket to 'enp0s3'
bpf: Failed to load program: Permission denied
; int http_filter (struct __sk_buff *skb) {
0: (bf) r6 = r1
; void *cursor = (void*)(long) skb->data;
1: (61) r7 = *(u32 *)(r6 +76)
invalid bpf_context access off=76 size=4
processed 2 insns (limit 1000000) max_states_per_insn 0 total_states 0 peak_states 0 mark_read 0

Traceback (most recent call last):
  File "http-parse-simple.py", line 69, in <module>
    function_http_filter = bpf.load_func ("http_filter", BPF.SOCKET_FILTER)
  File "/usr/lib/python3/dist-packages/bcc/__init__.py", line 526, in load_func
    raise Exception ("Failed to load BPF program % s: % s" %
Exception: Failed to load BPF program b'http_filter': Permission denied
```

可以看到程式碼被 verifier 拒絕，並拿到了一個  `invalid bpf_context access off=76 size=4`  的錯誤，表示存取  `__sk_buff->data`  是非法的。

回去追蹤程式碼的話，會看到在 verifier 裡面會用  `env->ops->is_valid_access`  來檢查該存取是否有效，這同樣定義在  `bpf_verifier_ops`  結構內。

其中 socket filter program 的實作是

```c
static bool sk_filter_is_valid_access (int off, int size,
				      enum bpf_access_type type,
				      const struct bpf_prog *prog,
				      struct bpf_insn_access_aux *info)
{
	switch (off) {
	case bpf_ctx_range (struct __sk_buff, tc_classid):
	case bpf_ctx_range (struct __sk_buff, data):
	case bpf_ctx_range (struct __sk_buff, data_meta):
	case bpf_ctx_range (struct __sk_buff, data_end):
	case bpf_ctx_range_till (struct __sk_buff, family, local_port):
	case bpf_ctx_range (struct __sk_buff, tstamp):
	case bpf_ctx_range (struct __sk_buff, wire_len):
	case bpf_ctx_range (struct __sk_buff, hwtstamp):
		return false;
	}
	...
```

可以很直接看到拒絕了 data 的存取。

從 linux kernel 的  [變更紀錄](https://github.com/torvalds/linux/commit/db58ba45920255e967cc1d62a430cebd634b5046)  來推測，data 欄位好像本來就不是給 socket filter 使用的，只是單純因為 cls_bpf 和 socker filter 可能共用了這部分的程式碼，因此要額外阻擋這部分的 code 不讓使用。

## 結語

最後還有一個沒解決的問題，`u8 *cursor = 0;`，為甚麼空指標經過 LLVM 編譯後會編譯成對 skb 的存取還是未知的，看起來像是 BCC 特別的機制，但是找不太到相關資料，只好保留這個問題。

## 參考資料

- [eBPF Instruction Set](https://www.kernel.org/doc/html/v5.17/bpf/instruction-set.html)
- [Stackoverflow: invalid bpf_context access”](https://stackoverflow.com/questions/61702223/bpf-verifier-rejects-code-invalid-bpf-context-access)
- [bpf-helpers man page](https://man7.org/linux/man-pages/man7/bpf-helpers.7.html)
