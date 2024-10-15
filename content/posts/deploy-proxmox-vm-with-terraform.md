---
categories:
  - Terraform
  - Proxmox
description: 使用Terraform來在Proxmox上自動部屬大量虛擬機
tags:
  - 自動化
  - 系統建置教學
date: 2022-10-29
title: 使用 Terraform 部屬 Proxmox 虛擬機
---

## 前言

Proxmox 提供了 web GUI 來方便的建立和管理 LXC 和虛擬機，但是如果有大量的虛擬機需要建立，那麼使用 GUI 就會變得非常繁瑣，而且不利於版本控制。因此我們可以使用 Terraform 來完成自動化建立的過程。然而在 Proxmox 上使用 Terraform，我覺得相對 openstack 來說概念會比較複雜一點，因此花了一點點時間來釐清。這邊記錄下使用 terrform 管理 Proxmox 的基本操作，希望對大家有幫助。

<!-- more -->

## Cloud-init 基本觀念

在使用 Terraform 建立 Proxmox VM 的過程中，我們會使用到 cloud-init 這個技術。
在使用 Promox GUI 設置虛擬機的過程中會有兩大麻煩的地方，第一個是需要在 web GUI 介面上一台一台的建立出來，第二個是需要在每台虛擬機上完成 OS 的安裝，設置硬碟、網路、SSH 等。
前者我們透過 terraform 來解決，後者我們則會搭配利用 cloud-init。cloud-init 是一個業界標準，在許多 Linux 發行版還有公 / 私有雲上都有相對應的支援。
各 Linux 發行版會發行特製的 cloud image 來支持 cloud-init。
支援 cloud-init 的作業系統會在開機執行的時候執行透過特定方式去讀取使用者設定檔，自動完成前面提到的網路、帳號等設置，來達到自動化的目的。

### Data Source

在 cloud image 中，cloud-init 會根據設定檔來完成設置，而設定檔的來源 (Data source) 有很多種，不同的 cloud (AWS, Azure, GCP, Openstack, Proxmox) 在 cloud-init 標準下制定了不同的設定檔來源。(可參考 [文件](https://cloudinit.readthedocs.io/en/latest/topics/datasources.html))

在 Proxmox 上支援 NoCloud 和 ConfigDrive 兩種資料源，兩種的執行方式相似，將使用者設定檔轉成一個特製的印象檔掛載到虛擬機上，當 VM 開機時 cloud-init 可以自動搜索到該印象檔，並讀取裡面的設定檔來完成設置。

## 前置作業

首先我們要先安裝 Terraform 和在 proxmox 上安裝 cloud-init 的工具，這邊簡單直接把 Terraform 也裝在 promox host 上面。

```shell
# cloud-init
apt-get install cloud-init

# Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

## Proxmox & Cloud-init

再透過 Terraform 自動部屬之前，我們要先看看怎麼在 Proxmox 上搭配 cloud-init 手動部屬 VM。

這邊我們透過 promox 的 CLI 工具來完成設置，不過操作也都可以透過 GUI 完成。

### 建立 VM

```shell
export VM_ID="9001"

cd /var/lib/vz/template/iso/
wget https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img

qm create $VM_ID \
    --name ubuntu-2004-focal-fossa \
    --ostype l26 \
    --memory 8192 \
    --balloon 2048 \
    --sockets 1 \
    --cores 1 \
    --vcpu 1  \
    --net0 virtio,bridge=vmbr11 \
    --onboot 1

qm importdisk $VM_ID focal-server-cloudimg-amd64.img local-lvm --format qcow2

qm set $VM_ID --scsihw virtio-scsi-pci
qm set $VM_ID --scsi0 local-lvm:vm-$VM_ID-disk-0
qm set $VM_ID --boot c --bootdisk scsi0

qm set $VM_ID --ide2 local-lvm:cloudinit
qm set $VM_ID --serial0 socket
```

前面提到 cloud-init 要使用特製的印象檔，這邊我們透過 wget 抓取印象檔，放到 `/var/lib/vz/template/iso/` 路徑下，這是 proxmox 預設放置 ISO 檔的路徑，因此可以透過 GUI 到 storage/local/ISO image 的頁面看到我們剛剛下載的印象檔。

接著透過 `qm create` 指令建立 VM，這邊 balloon 參數對應到 `Minimum memory` 的設定。

這邊提供的 cloud image 提供的印象檔並不是通常我們用來安裝作業系統的 iso 安裝檔，而是 qcow2 文件，qcow2 是一種虛擬機硬碟快照格式，因此這邊我們透過 importdisk 指令，直接將 img 轉換成硬碟。

接著我們要將建立好的硬碟掛載到 VM 上，這邊我們指定 scsi0 介面，將硬碟掛載上去，同時由於我們要從 cloud image 開機，因此這邊直接將 bootdisk 設定為 scsi0。

> Proxmox 官方文件有提到，ubuntu 的 cloud-init 映像，如果使用 scsi 接口掛載的話，需要將控制器設置為 `virtio-scsi-pci`。

接著我們需要添加兩個特殊的設備，首先是 cloudinit (GUI 顯示為 cloud driver)，這個是前面提到用於傳輸 cloud-init 設定檔的設備，當在 proxmox 上完成 cloud-init 設定後，proxmox 會生成對應的印象檔掛到 cloud driver 上，

另外由於 cloud image 的特殊性，我們需要添加一個 srial 設備。

到這邊設址結果如下圖：

![Proxmox hardware 結果](/img/pages/301fd2a0b80ba832a11d915042b489ed.png)

### 設定 cloud-init

接著我們要設定 cloud-init，這邊我們透過 GUI 的方式來完成設定。

![Proxmox cloudinit 設定](/img/pages/f019dbe59695bb3619cfdfe24ed2b598.png)

在 proxmox 上我們可以簡單的在 GUI 完成 cloudinit 的設定 (包含帳號、密碼、SSH key 等)，接著按下 `Regenerage image` 按鈕，proxmox 會生成設定檔，並掛載到前面建立的 cloud driver 上。

### 啟動 VM

接著我們只要按下 `Start` 按鈕，VM 就會開機，並自動完成前面的 cloud-init 設定。

>

    Cloud image 不太建議使用密碼登入，因此預設 VM 通常都會把 SSH 密碼登入關閉，因此需要透過 SSH key 登入，或著使用最後後提到的 cicustom 來修改 SSH 設定。

## 使用 Terraform

接著我們就要搭配 Terraform 來將完成自動化部屬了。([Proxmox provider](https://registry.terraform.io/providers/Telmate/proxmox/2.9.11))

首先前面的指令不能丟，我們在最後加上一行 `qm template $VM_ID`，將 VM 轉成模板用於後續的 Terraform 部屬。
這邊使用模板，目前研究起來有兩個原因，首先硬碟、cloud driver、serial 這些固定虛擬硬體和 cloud image 可以直接複製，而不用在 Terraform 上重新設定。
另外 proxmox 的 terraform provider 好像不支援 importdisk 這樣導入 qcow2 印象檔的方式。

首先是 provider 的基礎設定

```shell
terraform {
  required_providers {
    proxmox = {
      source = "Telmate/proxmox"
      version = "2.9.11"
    }
  }
}

provider "proxmox" {
  # Configuration options
  pm_api_url = "https://127.0.0.1:8006/api2/json"
  pm_user    = "root@pam"
  pm_password = "password"
  pm_tls_insecure = true
}
```

這邊我們直接使用 root 的帳號密碼登入 proxmox web，不過為了安全和控管的話，建議還是建立額外的使用者給 terraform 使用，以及使用 token 來取代密碼。

```shell
# 建立 terraform 使用者
pveum role add TerraformProv -privs "VM.Allocate VM.Clone VM.Config.CDROM VM.Config.CPU VM.Config.Cloudinit VM.Config.Disk VM.Config.HWType VM.Config.Memory VM.Config.Network VM.Config.Options VM.Monitor VM.Audit VM.PowerMgmt Datastore.AllocateSpace Datastore.Audit"
pveum user add terraform-prov@pve --password <password>
pveum aclmod /-user terraform-prov@pve -role TerraformProv

# 建立 token
pveum user token add terraform-prov@pve terraform-token
```

接著我們透過 proxmox_vm_qemu 資源來建立 VM

```shell
resource "proxmox_vm_qemu" "resource-name" {
  name        = "VM-name"
  target_node = "Node to create the VM on"

  clone = "ubuntu-2004-focal-fossa"
  full_clone = true
  os_type = "cloud-init"

  onboot  = true
  cores    = 8
  sockets  = 1
  cpu      = "host"
  memory   = 8192
  balloon  = 2048
  scsihw   = "virtio-scsi-pci"
  bootdisk = "virtio0

  disk {
    slot     = 0
    size     = "65536M"
    type     = "scsi"
    storage  = "local-lvm"
    iothread = 1
  }

  ipconfig0 = "192.168.0.1/24,gw=192.168.0.254"
  ciuser="username"
  cipassword="password"
  sshkeys = file ("/root/.ssh/id_rsa.pub")
}
```

首先當然是指定我們 VM 的名子還有要長在 proxmox cluster 的哪台機器上 (name, target_node)。
接著我們指定我們要 clone 的我們剛剛做的 VM 模板 (clone) 並指定為完整複製 (full_clone)，以及指定 OS type 為 `cloud-init`。

接著是設定 VM 的 CPU、memory 等硬體規格，這邊要特別注意的是這先參數的規格，如果不指定，並不會套用模板的規格，而是 provider 預設的規格，因此我們需要指定這些參數。

接著比較特別的是我們要重新定義我們的硬碟，前面雖然我們已經將 cloud image 轉成硬碟掛載到 VM 上了，但是這樣掛載上去硬碟大小是絕對不夠用的 (以 ubuntu 的 image 來說只有 2G 多的硬碟大小)，因此我們這邊複寫修改 `scsi0` 的硬碟大小，cloud-init 在第一次開機的時候能夠自我察覺並修改分割區的大小來匹配新的硬碟容量。

最後就是 cloud-init 的設定，這邊我們指定 VM 的 IP、帳號密碼、以及 ssh key。

最後就一樣透過指令完成自動部屬

```shell
terraform init
terraform apply
```

到這邊我們就完成 terraform 與 proxmox 搭配的自動部屬了。

## 其他雜紀

### cicustom

前面我們都是透過 proxmox 本身的功能來生成 cloud-init 的設定檔，但是 proxmox 提供的設置選項有限，因此有時候我們會需要直接修改 cloud-init 的設定檔，
在 proxmox 上提供兩種方式來直接設定 cloud-init 設定檔的參數，一個是直接在指令上提供參數值，另外一個是直接提供 cloud-init 的 yaml 設定檔

在 terraform 上面，我們一樣可以透過 `cicustom` 設定來達到相同的事情。

### agent

在查找資料時，在許多範例會看到指定 `agent` 參數為 0 或 1，這邊的 agent 指的是 `Qemu-guest-agent`，簡單來說就是在虛擬機內部安裝一個 agent 來當作 proxmox 直接操作虛擬機內部的後門，不過具體的功能就不在本篇的範圍內了，且預設情況下這個功能是關閉的。

## 結語

這邊簡單紀錄了一下 terraform 和 proxmox 的搭配使用，在一開始研究的時候，cloud-init 還有使用 VM template 這兩件事，是之前在使用 terraform 或 proxmox 不會特別注意到的東西，因此會有點混亂和不知道功能，希望這篇文章能夠幫助到有需要的人。

## 參考資料

- [Terraform Provider for Proxmox](https://registry.terraform.io/providers/Telmate/proxmox/latest/docs)
- [Proxmox Cloud-Init](https://pve.proxmox.com/wiki/Cloud-Init_Support)

eBPF
