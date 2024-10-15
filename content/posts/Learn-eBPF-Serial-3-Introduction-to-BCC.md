---
categories:
  - eBPF
description: 2022 iThome鐵人賽 學習eBPF系列 介紹BCC，一個python的eBPF框架
tags:
  - 2022 iThome鐵人賽 - 學習 eBPF 系列
  - 技術分享
date: 2022-10-31
title: 學習 eBPF 系列 3 - BCC 介紹
---

BPF Compiler Collection ([BCC](https://github.com/iovisor/bcc)) 是一套用於 eBPF，用來有效開發 kernel 追蹤修改程式的工具集。

<!-- more -->

### 介紹

BCC 我覺得可以看成兩個部分:

- eBPF 的 python 和 lua 的前端，透過 BCC 我們可以使用 python 和 lua 比較簡單的開發 eBPF 的應用程式，BCC 將 bpf system call 還有 eBPC 程式編譯封裝成了 API，並提供一系列預先定義好的巨集和語法來簡化 eBPF 程式。

```python
from bcc import BPF
b = BPF (text = """
#include <uapi/linux/bpf.h>
int xdp_prog1 (struct xdp_md *ctx)
{
    return XDP_DROP;
}
"""
fn = b.load_func ("xdp_prog1", BPF.XDP)
b.attach_xdp ("eth0", fn, 0)
```

以上面的範例來說，透過 BPF 物件實立化時會完成 eBPC bytecode 的編譯，然後透過 load_func 和 attach_xdp 就可以很簡單的將上面的 eBPF 程式碼編譯載入到 kernel 然後 attach 到 xdp 的 hook point 上。

- 一系列使用自身框架開發的工具

  - BCC 使用自己的 API 開發了一系列可以直接使用的現成 bcc eBPF 程式，本身就幾乎涵蓋了 eBPF 的所有 program type，可以開箱即用，直接跳過 eBPF 的開發。
  - 下圖包含了 BCC 對 linux kernel 各個模組實現的工具名稱
  - eBPC 本身和 bcc 相關的開發文件以及範例程式

    ![bcc tracing tools](/img/pages/1168a347874aad4495c7db7248cfcb54.png)

- 可以看到前面很多天有參考到 BCC 的文件，資料非常地豐富

### 安裝

首先 bcc 的安裝大概有幾種方式

- 透過各大發行板的套件管理工具安裝
- 直接使用原始碼編譯安裝
- 透過 docker image 執行對於前兩著，bcc 官方的文件列舉了需多發行版的  [安裝方式](https://github.com/iovisor/bcc/blob/master/INSTALL.md)，所以可以很容易地照著官方文件安裝。以 ubuntu 來說，可以透過 Universe 或 iovisor 的 repo 安裝。然而必須要注意的是，目前 iovisor 和 universe 上面的 bcc 套件本的都比較陳舊，甚至沒有 20.04 和 22.04 對應的安裝源，因此透過 apt 安裝可能會出現版本不支援或安裝後連範例都跑不起來的問題。

```shell
# use Universe
# add-apt-repository universe

# iovisor
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 4052245BD4284CDD
echo "deb [trusted=yes] https://repo.iovisor.org/apt/xenial xenial-nightly main" | sudo tee /etc/apt/sources.list.d/iovisor.list

sudo apt-get update
sudo apt-get install bcc-tools libbcc-examples linux-headers-$(uname -r)
```

因此特別建議透過原始碼來安裝會是比較穩妥的方式。一樣在 bcc 的的  [安裝文檔](https://github.com/iovisor/bcc/blob/master/INSTALL.md)  詳細列舉了在各個發行版本的各個版本下，要怎麼去安裝相依套件，然後編譯安裝 bcc。

```shell
sudo apt install -y bison build-essential cmake flex git libedit-dev \
  libllvm12 llvm-12-dev libclang-12-dev python zlib1g-dev libelf-dev libfl-dev python3-distutils

git clone https://github.com/iovisor/bcc.git
mkdir bcc/build; cd bcc/build
cmake ..
make
sudo make install
cmake -DPYTHON_CMD=python3 .. # build python3 binding
pushd src/python/
make
sudo make install
popd
```

這邊同樣以 ubuntu 舉例，首先因為 BCC 後端還是使用 LLVM，因此需要先安裝 llvm 以及 bcc 編譯需要的 cmake 等工具，然後後過 cmake 編譯安裝。

安裝完成後，昨天提到的 bcc 自己寫好的 kernel trace tools 會被安裝到  `/usr/share/bcc/tools`，因此可以直接 cd 到該目錄來玩，由於這些 tools 其實就是 python script，所以其實也可以直接透過 python3 執行 bcc repo 下 tools 目錄內的 python 檔，其結果其實是一樣的。

同樣的還有 examples 這個資料夾下的範例也會被安裝到  `/usr/share/bcc/examples`  目錄下。

最後是透過 docker 的方式執行 bcc。同樣參考 bcc 的  [quickstart](https://github.com/iovisor/bcc/blob/master/QUICKSTART.md)  文件，不過加上  `--pid=host`

```shell
docker run -it --rm \
  --pid=host \
  --privileged \
  -v /lib/modules:/lib/modules:ro \
  -v /usr/src:/usr/src:ro \
  -v /etc/localtime:/etc/localtime:ro \
  --workdir /usr/share/bcc/tools \
  zlim/bcc
```

但是不論是直接使用  `zlim/bcc`  還是透過 bcc repo 內的 dockerfile 自行編譯，目前測試起來還是有許多問題，使用 zlim/bcc 在執行部分的 eBPF 程式時會編譯失敗，直接透過 dockerfile 編譯初步測試也沒辦法 build 成功，因此目前自行編譯使用可能還是相對比較穩定簡單快速的方式。
