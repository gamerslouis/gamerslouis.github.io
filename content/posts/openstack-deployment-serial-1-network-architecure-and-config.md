---
categories:
  - OpenStack
description: 釐清 OpenStack 的網路架構，介紹 flat, vlan, vxlan 三種不同網路模式的差別，以及 provider, self-service 的不同
tags:
  - 系統建置教學
date: 2022-10-05
title: OpenStack 架設系列 (1) - 網路架構解析及設置
---

## 前言

在嘗試布建 openstack 的過程中，卡關最久的應該是網路的部分，由於在設置 openstack 的過程中，需要先把網路介面和線路連接設定好，所以必須要對 openstack 的網路架構，有清晰的認知，不然在設置的過程中會遇到許多障礙…

<!-- more -->

特別是 openstack 有 `flat, vlan, vxlan` 以及 `provider, self-service` 兩種不同維度的概念分類，因此在釐清的過程中花費許多時間，因此這邊整理一下 openstack 的各種網路架構。

這篇文章不會介紹具體的 openstack 搭建，不過之後會有一篇介紹如何使用 openstack-ansible 來部屬 openstack。

首先為了後續討論方便我們這邊要先幫 openstack 裡面的幾個網路層級訂個名子。

- 物理網路：由 openstack 節點上面的實體網卡以及結點外的網路構成
- 覆蓋 (Overlay) 網路：以虛擬機的視角看到的 L2 網路後續會持續出現這三個名詞，在介紹的過程中來解釋和分析這三者的差別。

## Openstack 網路類型概念

首先我們先撇開 openstack，我們看一個最簡單在多台實體設備上面裝設虛擬機構建出來的一個網路結構。

![基礎網路架構](/img/pages/93ac534eca58dc84b691dbe9c3651980.png)

在這個架構裡，所有的 VM 和實體網卡都接在同一個 linux bridge 上，由於實體網卡也橋接在 bridge 上了，所以節點上的覆蓋網路是物理網路的延伸，可以看成所有實體共同構成了一個 L2 網路。
由於 bridge 本身可以給予 IP，當成是接在節點上的網路介面，因此 VM 和節點本身也都同在一個 L2 網路內彼此互相可見。
在這個網路架構中，物理網路和覆蓋網路是完全等價通透的。

### Flat network

![基礎 Openstack 網路架構](/img/pages/bc6c8e4d9cbc9cfbeeb5a25e1f257ecb.png)

接著我們加入 openstack 的組件。
首先是 controller 節點，我們在 controller 節點上部屬了 openstack 的 API 服務。
接著我們在 compute 節點上增加一張實體網卡 `eth1` 讓節點上的 nova agent 和 neutron agent 可以與 contrroller node 溝通。
在這個架構中，所有的 service 和 agent 是直接安裝在節點上的程式，因此可以透過 eth1 實體網卡的 ip 直接進行訪問。
在圖中的 linux bridge 換了顏色，因為這個 bridge 並不是由我們手動建立出來的而是由 neutron agent 自行建立出來的。同時當 nova 建立 VM 後，neutron 也會建立 veth pair 連接 bridge 和 VM。
到此我們就建立了最簡單的 openstack 網路，在這個網路架構下雖然節點本身的網路從 bridge 分離出來成為了獨立的網卡，但是節點本身和所有的 VM 還是同處在一個 L2 網路內，因此在這個網路架構中，物理網路和覆蓋網路是完全等價通透的。

到此我們就建構了 neutron 的第一個種網路模式 `flat`。Neutron 的不同模式差異在於說 neuitron 管理的 bridge 是如何接入物理網路的。在 `flat` 模式下對外網卡直接橋接到 bridge 上，不對封包做處理。

在 openstack 中有 tenant networks 租戶網路的概念，我們可以在 openstack 上切出若干個獨立的 L2 網路，分給不同的 project 和 vms 使用。在使用單一個 `flat` 網路的時候，這件事是做不到了，因為所有 VM 都在同一個 L2 網路內。

![flat 網路運算節點架構](/img/pages/0e50dff9a3c9098c92713afe3d961264.png)

直觀的第一個方法當然是切出多個 `flat` network 給不同的 tenat 使用，然而這樣使用的限制非常大，首先我們需要替每個 flat 預先切出獨立的 L2 網路，在這個範例中我們使用獨立的網卡和交換機來分割，非常麻煩。

因此比較可行的方法是使用 vlan 或 vxlan 來切割租戶網路，並將 vlan、vxlan 的建立管理交給 neutron agent 來處理。

### Vlan networ

![vlan 網路運算節點架構](/img/pages/d73bbe6de54d701f57db6b2a5c235f41.png)

首先是 `vlan` 模式，在 vlan 模式下我們一樣提供一個網路介面 `eth0` 給 neutron 使用，並一樣假設所有節點上的 `eth0` 介面都在 L2 互通。

接著當我們透過 openstack 建立網路並指定為 `vlan` type 時，neutron 會替該網路分配一個 vlan id，並建立對應的 vlan 網路卡，vlan 網路卡是 linux 本身的功能，經過 vlan 網路卡的封包會從該網路卡榜定的原始網卡送出去 (eth0)，但是封包會加上 vlan 網卡綁定的 vlan id。

如上圖所示，我們切割出了 vlan 356 和 vlan 357 兩個租戶網路，並統一透過 eth0 物理網路與其他節點溝通。

### Vxlan network

首先我們先介紹一下 vxlan。和 vlan 的功能類似，vxlan 的功能也是在一個網路內切割出多個覆蓋網路，不過教於 vlan，vxlan 有以下特點：

- vlan id 只能夠切出 4096 個網路，但是 vxlan id 可以切出 2 的 24 次方個網路。
- vlan 只是在 ethernet header 和 IP header 中間插了一個 vlan header，因此 vlan 只能在 L2 的物理網路內傳輸。但是 vxlan 的封裝方式是將整個 L2 封包加上一個 vxlan header 後，封裝在一個 UDP 封包內，因此透過外面的 UDP 封包，vxlan 能夠跨越 L3 網路建立 L2 的通道，連結兩個不相連的 L2 網路。

在 Linux 上建立 vxlan 介面時要指定兩個東西，一個是 vni (vxlan id), 另一個是 local ip，當封包通共 vxlan 介面時，會被加上包含 vni 的 vxlan id，外部的 UDP 封包則會利用 local ip 當作 src ip，同時利用該 local ip 對應的 interface 來收發 vxlan 封包。

在 vlan 網路裡面，由於 vlan 一樣是 L2 封包，因此封包是透過 L2 的廣播學習機制來傳遞的。然而如前面所示，vxlan 封包會封裝成 UDP 封包，因此 vxlan 靠的是 L3 的路由機制來傳遞。

在 Linux 上這個路由機制有幾種作法

- 在建立 vxlan interface 時直接指定 remote ip，建立成點對點的 vxlan tunnel
- 透過 linux bridge forwarding database，下達 forwarding rule，指定當 L2 封包的 mac address 是多少的時候要送到哪個 remote ip
- 最後也是 openstack 使用的方式，將封包發送到一個 L3 廣播地址 (例如 239.1.1.1)，linux 會自動在 L2 加上 multicast mac address，所有在同一個 L2 物理網路上的設備就能夠同時收到 vxlan 的封包。回到 openstack 上，在設置 `vxlan` 時和 `vlan`、`flat` 不太一樣，我們不用指定綁定的網路介面 (eth0)，而是要指定 `local_ip` 跟 `vxlan_group`，前者對應到綁定解面 (eth0) 的 IP，後者則是 vxlan 廣播域的 IP (239.1.1.1)。後面就和 vlan 一樣，在 openstack 上建立的網路時，netruon 為該網路建立對應的 vxlan 介面和 linux bridge，來提供給該網路的虛擬機使用。

  ![vxlan 網路運算節點架構](/img/pages/6255b50e4d5379c12f4a8b9044464387.png)

雖然在一台節點上面不太可能開到 4096 個 tenant，但是在整個 openstack 叢集內可以將不同 tenant 分配在不同的節點上，因此 vxlan 是有意義的。

## Openstack 網路設置

在 openstack neutron 中，我們要設定每個節點上的 ml2 設定檔來提供 neutron 網路的基本資訊。路徑在 `/etc/neutron/plugins/ml2/`。

```text
# /etc/neutron/plugins/ml2/ml2_conf.ini
[ml2]
type_drivers = flat,vlan,vxlan,local
tenant_network_types = vxlan,vlan,flat
mechanism_drivers = linuxbridge
extension_drivers = port_security
```

- 首先對於上述三種不同的網路類型，如果要在 openstack 內使用需要指定啟用對應的 `type_drivers`。(除了前面介紹的三種網路類型，還有 local 跟 gre 這兩種，前者用於單機情況 neutron 的 linux bridge 不連接到任何對外網路，後者使用 gre tunnel 來取代 vxlan tunnel，這邊不多作介紹)
- 接著 `tenant_network_types` 表示在 openstack 設可以用於建立 project 租戶網路的網路類型，同時順序也代表了在建立網路時預設使用的網路類型優先順序。
- `mechanism_drivers` 這邊指定是 linuxbridge，前面提到 neutron 會建立 bridge 來連接 VM 跟外部網路介面，其實這邊還有很多其他選項，例如 open vSwitch，來提供更多網路管理功能，但是這邊就只以 linux bridge 為主要介紹對象。
- `extension_drivers` 則可以載入其他 plugin 來提供 QoS、安全管理的功能。

接著我們要設定物理網路和網路介面的對應，在 flat 和 vlan 網路模式下，我們都需要將網路與一張可以連接到物理網路的網路介面做綁定 (前面的 eth0 或 eth1)，但是在實際情況中，每個節點上網路介面卡的名稱可能不相通，因此需要在每個節點上指定物理網路和網路介面的對應。

```text
# /etc/neutron/plugins/ml2/linuxbridge_agent.ini
[linux_bridge]
physical_interface_mappings = vlan1:eth0,flat1:eth1,flat2:eth2
```

接著對不同的網路類型有各自的網路設置，首先是 flat，要指定的東西很簡單，就是可以用於建立 flat network 的物理網路，如果所有網路都可以，則指定為 \*

```text
# /etc/neutron/plugins/ml2/ml2_conf.ini
[ml2_type_flat]
flat_networks = flat1, flat2
# Example:flat_networks = *
```

在 vlan 部分則要指定在每個物理網路上允許的租戶網路 vlan id，格式是`<physical_network>[:<vlan_min>:<vlan_max>]`

```text
# /etc/neutron/plugins/ml2/ml2_conf.ini
[ml2_type_vlan]
network_vlan_ranges = vlan1:101:200,vlan1:301:400
```

最後 vxlan 分成兩個部分，首先和 vlan 類似，我們要指定可使用的 vxlan vni 和廣播域 ip

```text
# /etc/neutron/plugins/ml2/ml2_conf.ini
[ml2_type_vxlan]
vxlan_group = 239.1.1.1
vni_ranges = 1:1000
```

接著我們要設置綁定的網卡 ip

```text
# /etc/neutron/plugins/ml2/linuxbridge_agent.ini
[vxlan]
enable_vxlan = True
vxlan_group = 239.1.1.1
# VXLAN local tunnel endpoint
local_ip = 192.168.56.101
l2_population = False
ttl = 32
```

這邊有一個特別的東西是 l2 population，l2 population 是一種降低廣播封包造成網路負載的方式，在傳統網路內 ARP 封包需要廣播到所有的節點上，大大增加的網路的負擔，透過 l2 population 提供的 proxy ARP 機制，ARP 會在節點上直接由 neutron 回應，而不用透過物理網路廣播到所有節點上，大大降低網路負擔，由於 openstack 內所有的 VM IP、網卡 mac address 都會受到 openstack 的管理，因此 openstack 可以做到 proxy ARP。如果需要啟用 l2 population 則需要額外的 driver，這邊一樣不做詳細介紹。

最後是網路安全的部分，在 openstack 我們可以使用 iptables 來建立 VM 的網路管理，iptables 會阻擋所有進出虛擬機網路的流量，並透過 security group 來下達 iptables 的規則允許特定流量進出。

```text
# /etc/neutron/plugins/ml2/linuxbridge_agent.ini
[securitygroup]
firewall_driver = iptables
enable_security_group = True

# /etc/neutron/plugins/ml2/ml2_conf.ini
[securitygroup]
enable_security_group = True
enable_ipset = True
```

## Provider vs Self-service networks

接著我們要介紹 openstack 裡面另外一個重要的網路概念，provider network 跟 self-service network 的差別。

首先要特別注意的是，這邊提到的分類方式和前面的網路類型是兩種不同的角度和分類方式。

雖然 flat network 通常會搭配 provider networks，vlan 和 vxlan 通常會搭配 self service network 但是這並不是一定而且必要的。

前面的網路類型我們探討的是要如何在跨節點的網路架構下提供一個或多個 L2 網路讓 VMs 之間可以彼此連接。

這邊 provider 和 self-service 的差別則是要探討，如何提供前面切割出來的網路 L3 的網路功能 (gateway, routing…)

在 provider 網路模式下，我們假設 L3 的網路功能可以直接由物理網路提供，因此 openstack 只負責提供 DHCP，以及將虛擬機接到物理網路上，其餘的 gateway, routing 功能，openstack 只假設存在，不多做處理。在最簡單的 `flat` 網路模式下這麼做當然是非常簡單可行的，最簡單的方法就是將 `flat` 網路直接接入節點間 openstack 管理用的網段，並與節點共用 ip subnet，直接由物理網路提供功能。

然而在 `vlan` 和 `vxlan` 模式下使用 proider 網路就不是這麼好用了，前面提到相較於 `flat`，`vlan` 和 `vxlan` 的特點就是能夠動態建立獨立的租戶網路，如果要使用 provider 機制，變成說我們要導入額外的自動化方式，替每個 vlan 或 vxlan 提供 gateway 的功能，因此通常會使用 self-service network。

self-service network 指的是 openstack self service，也就是由 openstack 本身來提供 L3 網路的 gateway, router 的功能。

為了要提供 router 的功能，openstack 的作法是使用 network namespace。

首先我們需要在一個節點上部署 neutron 的 L3 agent。
當我們透過 openstack 的 API 建立一個 virtual router 的時候，netron L3 agent 會在節點上建立一個獨立的 network namespace 當作這台 virtual router 的主體。

![](/img/pages/afdd1a1876f49cd8274dfe38fba5ac17.png)

接著我們就可以將不同的租戶網路接入 router，透過 linux 本身的 iptables, routing 的功能來提供租戶網路間 routing 的功能。

![](/img/pages/53d5638f933d3bc5fb6e059ab155d846.png)

我們也可以透過把其中一個租戶網路或 `flat` 網路接入物理網路，使用 provider network 的方式，其他的租戶網路可以透過 virtual router routing 到 provider network 的租戶網路來上網。

### Openstack self-service 指令

這邊補充一下如何透過 cli 在 openstack 上建立 router 還有把租戶網路加入 router

```shell
openstack router create router1
```

首先建立 router1

```shell
openstack port create --network net1 net1-router-port
```

接著為了讓租戶網路能夠“接線”到 router，我們需要幫網路建立一個 port

```shell
openstack router add port router1 net1-router-port
```

最後把 port 接到 router 上
