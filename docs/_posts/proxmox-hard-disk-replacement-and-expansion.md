---
categories:
  - 網管日常
description: 在這篇文章中，我們將探討如何在Proxmox上將舊的2TB SSD硬碟升級至4TB，並無需重新安裝系統或移動虛擬機的操作步驟和方法。
tags:
  - Proxmox
date: 2023-08-03
title: Proxmox硬碟更換及擴容
---

在手邊的 Proxmox 上使用了一年多的時間，最初是使用一顆 2TB 的 SSD 硬碟，但隨著時間推移，硬碟的容量已經不足以應付需求。為了解決這個問題，決定購買一顆 4TB 的 SSD 來替換。然而，為了節省時間和方便起見，希望能夠直接將舊硬碟的內容遷移到新硬碟上，而不必重新安裝 Proxmox 系統，也不需要搬遷虛擬機。因此，進行了一些研究和操作來實現這個目標，這裡記錄下相關的步驟和方法。

<!-- more -->

## **硬碟內容搬遷**

首先，我們需要將原始硬碟內的資料搬移到新的硬碟上。我們可以使用 **`dd`** 命令直接將硬碟內容完全複製過去。這可以在 Proxmox 的 Shell 中執行，無需使用額外的 USB 開機碟操作。儘管這樣做可能會複製 swap 等內容，但重開機後不會影響系統運作。

請先使用 **`lsblk`** 命令找到原始硬碟和目標硬碟：

```shell
# lsblk
NAME                          MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
nvme0n1                       259:0    0  1.7T  0 disk
├─nvme0n1p1                   259:1    0 1007K  0 part
├─nvme0n1p2                   259:2    0  512M  0 part /boot/efi
└─nvme0n1p3                   259:3    0  1.7T  0 part
  ├─pve-swap                  253:0    0    8G  0 lvm  [SWAP]
  ├─pve-root                  253:1    0   96G  0 lvm  /
  ├─pve-data_tmeta            253:2    0 15.8G  0 lvm
  │ └─pve-data-tpool          253:4    0  1.7T  0 lvm
  │   ├─pve-data              253:5    0  1.7T  1 lvm
  │   ├─pve-vm--100--disk--0  253:6    0    1T  0 lvm
  ....
nvme1n1                       259:4    0  3.6T  0 disk
```

從上述輸出中，我們可以很容易地辨識出 **`nvme0n1`** 為原始硬碟，**`nvme1n1`** 為新的硬碟。

接下來，使用 **`dd`** 命令進行硬碟內容的複製。為了在處理過程中顯示進度，我們加上 **`status=progress`** 選項。這樣在複製 2TB 資料時，我們可以知道進度，而不會等太久不知道是不是當掉了(搬了超過半小時)。**`bs`** 參數代表 **`dd`** 一次搬動的資料塊大小，預設值是 512bytes，但這可能會導致速度變慢，因此我們可以選擇較大的值，例如 **`bs=2G`**。

```shell
# dd if=/dev/nvme0n1 of=/dev/nvme1n1 status=progress bs=2G
```

完成後，關機並將舊的硬碟移除，用新的硬碟開機。

## 調整硬碟分割區大小

理論上，重開機後，應該可以正常進入系統，但從 Proxmox 的 Web GUI 可能會發現存儲空間的大小沒有變化。這是因為雖然資料已經完全複製到容量更大的硬碟，但系統設定仍然只認識原本的硬碟大小。因此，接下來我們需要調整分割區和 LVM 的配置，讓 Proxmox 能夠使用新的空間。

```shell
# lsblk
NAME                          MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
nvme0n1                       259:0    0  3.6T  0 disk
├─nvme0n1p1                   259:1    0 1007K  0 part
├─nvme0n1p2                   259:2    0  512M  0 part /boot/efi
└─nvme0n1p3                   259:3    0  1.7T  0 part
  ├─pve-swap                  253:0    0    8G  0 lvm  [SWAP]
  ├─pve-root                  253:1    0   96G  0 lvm  /
  ├─pve-data_tmeta            253:2    0 15.8G  0 lvm
  │ └─pve-data-tpool          253:4    0  1.7T  0 lvm
  │   ├─pve-data              253:5    0  1.7T  1 lvm
  │   ├─pve-vm--100--disk--0  253:6    0    1T  0 lvm
```

透過 `lsblk`，可以看到硬碟的大小為 3.6T。由於 pve 的資料都放在 nvem0n1p3 這個分割區下面，所以我們要先調整分割區的大小。

這邊我們使用 `growpart` 這個工具來調整分割區大小。

```shell
apt install cloud-guest-utils
growpart /dev/nvme0n1 3
```

**`growpart`** 的第一個參數是要調整的硬碟，第二個參數是第幾個分割區。**`growpart`** 預設會將硬碟的剩餘未分配空間都分配給分割區，因此不需要指定大小。如果你擔心出問題，可以先加上 **`-N`** 選項查看分配的結果是否符合預期。

分配完成後，再次使用 **`lsblk`** 命令來確認。現在，**`nvme0n1p3`** 分割區的大小應該已經變成 3.6T 了：

```shell
# lsblk
NAME                          MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
nvme0n1                       259:0    0  3.6T  0 disk
├─nvme0n1p1                   259:1    0 1007K  0 part
├─nvme0n1p2                   259:2    0  512M  0 part /boot/efi
└─nvme0n1p3                   259:3    0  3.6T  0 part
  ├─pve-swap                  253:0    0    8G  0 lvm  [SWAP]
  ├─pve-root                  253:1    0   96G  0 lvm  /
  ├─pve-data_tmeta            253:2    0 15.8G  0 lvm
  │ └─pve-data-tpool          253:4    0  1.7T  0 lvm
  │   ├─pve-data              253:5    0  1.7T  1 lvm
  │   ├─pve-vm--100--disk--0  253:6    0    1T  0 lvm
```

但是從 Proxmox 的 Web GUI，你可能會發現存儲空間大小還是沒有改變。這是因為 Proxmox 在 partition 上透過 LVM 做了一層分割，所以我們需要調整 LVM 的大小。

## 調整 LVM

首先，我們要調整硬碟分割區對應的 PV（物理卷）大小：

```shell
# pvs
PV             VG  Fmt  Attr PSize  PFree
/dev/nvme0n1p3 pve lvm2 a--  <1.74t <0.2t
```

使用 **`pvs`** 命令可以查看 PV 的資訊。

接下來，使用 **`pvresize`** 命令將分割區剩餘的所有空間都加入到 PV 內：

```shell
pvresize /dev/nvme0n1p3
```

這樣就能將分割區未使用的空間加入到 PV，無需進行其他配置。

再次執行 **`pvs`** 命令，現在你應該會看到 PV 的大小已經增加了：

```shell
# pvs
PV             VG  Fmt  Attr PSize  PFree
/dev/nvme0n1p3 pve lvm2 a--  <3.64t <1.84t
```

最後，我們需要調整 storage 對應的 LV（邏輯卷）的大小。首先，使用 **`lvs`** 命令來查看 LV 的資訊

```shell
# lvs
LV             VG  Attr       LSize   Pool Origin Data%  Meta%  Move Log Cpy%Sync Convert
data           pve twi-aotz--   1.67t             73.80  3.82
root           pve -wi-ao----  96.00g
swap           pve -wi-ao----   8.00g
vm-100-disk-0  pve Vwi-aotz--   1.00t data        57.73
vm-100-disk-1  pve Vwi-aotz--   4.00m data        14.06
vm-101-disk-0  pve Vwi-a-tz-- 100.00g data        71.78
vm-102-disk-0  pve Vwi-aotz--   4.00m data        14.06
...
```

從上述輸出中，可以看到所有 VM 的硬碟都掛載在 **`pve/data`** 這個 pool 下面。因此，我們需要調整的是 **`pve/data`** 的大小。

使用 **`lvresize`** 命令來調整 LV 分配的空間， **`-l`** 表示擴大， **`+100%FREE`** 表示將所有閒置空間分配給該 LV，最後指定 **`pve/data`**：

```shell
lvresize -l +100%FREE pve/data
```

執行完後再次使用 **`lvs`** 命令確認，現在 **`data`** 的大小應該已經變大了：

```shell
# lvs
lvs
LV             VG  Attr       LSize   Pool Origin Data%  Meta%  Move Log Cpy%Sync Convert
data           pve twi-aotz--  <3.51t             35.16  3.86
root           pve -wi-ao----  96.00g
swap           pve -wi-ao----   8.00g
vm-100-disk-0  pve Vwi-aotz--   1.00t data        57.73
vm-100-disk-1  pve Vwi-aotz--   4.00m data        14.06
```

現在，從 Proxmox Web GUI，你也應該可以看到存儲空間大小已成功調整。
