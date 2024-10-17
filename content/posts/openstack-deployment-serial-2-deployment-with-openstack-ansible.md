---
categories:
  - OpenStack
description: 介紹如何設定 OpenStack Anisble (OSA)，使用 OSA 部屬 OpenStack
tags:
  - 系統建置教學
date: 2022-11-01
title: OpenStack 架設系列文章 (2) - 使用 OpenStack Ansible 部署 OpenStack
---

在前一篇文章中，我們介紹了 Openstack 的幾種  [網路架構](https://blog.louisif.me/posts/openstack-deployment-serial-1-network-architecure-and-config/)，今天我們要介紹如何使用 Openstack 官方提供的 Openstack-Ansible (OSA) 來完成 Opentack 的部署。

<!-- more -->

> 本篇文章以 Openstack Victoria 版本為例，安裝在作業系統為 ubuntu 的設備上，其他版本可能會有所不同。另外本篇文章主要專注在使用 nova 建立虛擬機服務，因此會部分省略掉 cinder 等 opentstack 儲存功能的部分。

## 介紹

Openstack 是由 keystone、glance 等多個組件組成，組件下又需要 dabase base 和 message queue 等服務，再加上需要在每個運算節點上部屬的 nova、neutron，如果要手動部署，會需要花費大量的時間、容易出錯，也不利於擴展。因此 Openstack 官方提供了 Openstack-Ansible (OSA)，使用 Ansible 來自動化部署及擴展 Openstack cluster。

![OSA 架構](/img/pages/a76dae1c9decdbef0330c98ffbb12bbd.png)

首先必須要知道透過 OSA 部屬的 openstack clauster 在架構上會與手動安裝文件教的方式有些差異。

- 所有 Controller node 上的 openstack 組件被部屬在獨立的 linux contaienr (LXC) 內，LXC 透過 linux bridge 直接暴露在外部網路中，與節點們處在同一個子網段內，可以直接互相訪問
- controller node 上的組建之間不直接互相訪問，而是透過一個  `haproxy`  做作為進入點，提供附載均衡和高可用。haproxy 會被直接部屬在控制節點上，而不會被部屬在 LXC 內。

另外在在 OSA 的文件內，用來執行 ansible playbook 的節點稱之為 deployment host，而被部屬 openstack 的 controller node 和 compute node 被統稱為 taget host。不過在實際操作的時候 deployment host 不一定需要是一台獨立的設備，可以直接挑一台 target host 來跑。

## 安裝流程

### 前置作業

首先我們要在 deployment host 上安裝 python 還有 OSA。

```shell
# system
apt update
apt dist-upgrade
apt install build-essential git chrony \
  openssh-server python3-dev sudo

# OSA
git clone -b victoria-em https://opendev.org/openstack/openstack-ansible/opt/openstack-ansible
cd /opt/openstack-ansible
scripts/bootstrap-ansible.sh
```

接著在 target hosts 上我們也需要先安裝一些必備的套件

```shell
apt update
apt dist-upgrade
apt install bridge-utils debootstrap openssh-server \
  tcpdump vlan python3
apt install linux-modules-extra-$(uname -r)
```

Ansible 是透過 ssh 連線到每一台主機上面完成安裝，且 OSA 要求在 deployment 和 target hosts 上都使用 root。OSA 要求的作法是在 deployment 的 root 上帳號下，使用  `ssh-keygen`  生成 ssh key 並將 public key 放到每個 target host 的 /root/.ssh/authorized_keys 中。另外 OSA 還會將 deployment host 上的  `/root/.ssh/id_rsa.pub`  檔案複製到每一個 LXC 的 authorized_keys，方便後續訪問。這個可以透過  `lxc_container_ssh_key`  選項修改，如何設定 OSA 會在後面提到。

最後是網路相關的設定，在前一篇文章中我們提到 openstack 的網路模式有  `flat`、`vlan`、`vxlan`  三種再加上 OSA 的 LXC 也需要特別的網路，因此這個部分會變得有點複雜，openstack 的虛擬機網路設定會在後面設定 OSA 的章節再來說明。

在網路的部分，OSA 要求網路基礎架構是預先提供好的，在所有節點上，我們需要有一個 br-mgmt 的 linux bridge，OSA 會為每一個 LXC 建立 veth，連結 br-mgmt 和 LXC 的 eth0 介面。前面有提到 LXC 和節點是在一個  `flat`  的網路架構，因此 br-mgmt 也需要連接到主機的實體網卡，並給予一個 IP。

```yaml
# /etc/netplan/99-openstack.yaml
network:
  version: 2
  renderer: networkd
  bridges:
    br-mgmt:
      addresses:
        - 192.168.56.1/24
      interfaces: [eth1]
```

在 ubuntu 上我們可以透過 netplan 來設置。

如果是需要在單節點下啟用 flat 網路做簡單的測試，可以使用下面 netplan 設定

```yaml
---
network:
  version: 2
  renderer: networkd
  ethernets:
    eth1: {}
  bridges:
    br-mgmt:
      addresses:
        - 192.168.56.101/24
        - 192.168.56.1/24
      interfaces: [eth1]
  vlans:
    eth1.10:
      id: 10
      link: eth1
```

- br-mgmt 多一個 IP 用於 external_lb_vip_address (後面會再提到)
- flat 網路設定時，綁定到 eth1.10 這張網卡

> 如果要使用 block storage 的服務的話還需要配置 LVM，這邊我們就省略掉

### OSA 設定檔設置

接著我們要調整 OSA 的設定檔。首先我們要把基礎設定複製到設定檔目錄

```shell
cp -r /opt/openstack-ansible/etc/openstack_deploy/etc/openstack_deploy
```

這邊我們主要要修改兩個檔案  `openstack_user_config.yml`  還有  `user_variables.yml`。

- `openstack_user_config`  是各 node 功能和 IP 等基本資訊的設置，OSA 會讀取 openstack_user_config 來生成 ansible 的 inventory file。
- `user_variables.yml`  則是 OSA 的主要設定檔。

> 在 /etc/openstack_deploy 內有各種後綴為 example 的範例文件可以參考

### openstack_user_config

```yaml
---
# openstack_user_config.yml
cidr_networks:
  container: 192.168.56.0/24
  tunnel: 172.29.240.0/22
  storage: 172.29.244.0/22

used_ips:
  - "192.168.56.1,192.168.56.50"
  - "172.29.236.1,172.29.236.50"
  - "172.29.240.1,172.29.240.50"
  - "172.29.244.1,172.29.244.50"
  - "172.29.248.1,172.29.248.50"

global_overrides:
  # The internal and external VIP should be different IPs, however they
  # do not need to be on separate networks.
  external_lb_vip_address: 172.29.236.10
  internal_lb_vip_address: 172.29.236.11
  management_bridge: "br-mgmt"
  provider_networks: ...
```

首先我們來設定  `/etc/openstack_deploy/openstack_user_config.yml`，可以複製  `/etc/openstack_deploy/openstack_user_config.yml.example`  來做修改。`cidr_networks`  定義了各種網路架構的 IP 區段，最主要的是 containers，是前面提到節點本身還有 controller service LXC 們要分配的 IP 段，這邊指定為  `192.168.56.0/24`。另外兩個 tunnel 和 storage 分別是給 vxlan 虛擬機網路架構和 block storage 用的，在 OSA 的架構內，control plane、storage 和虛擬機網路希望是分開的獨立網路，因此如果有使用 block storage 或 vxlan 的話這邊要設置對應的 IP 段。

接著  `used_ips`  是不允許被分配給 LXC 容器的 IP，`"172.29.236.1,172.29.236.50"`  表示.1 到.50 這 50 個 IP 都不允許被使用，當 OSA 生成 inventory file 時會在 container IP 段內隨機為每一個 LXC 分配 IP，因此需要透過此設定規避掉 gateway router 還有其他非 Openstack 使用的 IP。在單 controller node 的部屬環境下 LXC 會用掉 13 個 IP。

接著  `external_lb_vip_address`  和  `internal_lb_vip_address`  是 load balancer 的地址，這邊可以直接指定一個 controller node 的 IP，直接使用 controller node 上的 haproxy，或著在多 controller node 的情況下，使用一個獨立的 load balancer (不在 OSA 自動部屬的範圍)，提供控制平面的高可用 (HA)。

這邊 external 和 internal 的差別對應到 keystone 設定時需要為 endpoint 設置  `public`、`private`  和  `admin`  三種的 url，public 就會使用 external 的 address，後倆著則會使用 internal 的 address。

另外 address 也可以設置為 domain name，如  `openstack.example.com`，不過要特別注意的是 domain 要能夠被 dns 解析，而且要在 user_variables.yml 設置  `haproxy_keepalived_external_vip_cidr:"<external_vip_address>/<netmask>"`。根據文件，不建議將 external address 和 internal address 設置相同，特別是當兩者分別使用 http 和 https 時，一定要把兩個 address 分開。

接著要設置的是 provider_networks，這邊包含 LXC 網路和虛擬機網路，provider_networks 是一個 list，列出了所有主機上可用的網路。

```yaml
provider_networks:
- network:
	container_bridge: "br-mgmt"
	container_type: "veth"
	container_interface: "eth1"
	ip_from_q: "container"
	type: "raw"
	group_binds:
	  - all_containers
	  - hosts
	is_container_address: true
```

首先我們要提供前面提到給 LXC 和節點使用的控制網路，這邊主要要注意的是  `container_bridge`  要指定成節點上建立好的 bridge 名稱，可以直接沿用慣例的  `br-mgmt`。

另外  `type`  這邊要設置為  `raw`，type 總共有四種可能  `raw`, `flat`, `vlan`, `vxlan`，`raw`  是提供給 mgmt 網路和 storage 網路使用的，後三著則對應到虛擬機網路的三種可能架構。

接著就來到了 OSA 文件裡面最有問題的地方了，就是關於虛擬機網路架構的設定，在幾乎所有的 OSA 設定文件裡面都會要求在  `flat`  和  `vlan` type 的網路中，設置 container_bridge 為  `br-vlan`。然而在少數  [文件](https://docs.openstack.org/openstack-ansible/victoria/user/network-arch/example.html)  內，可以找到這樣一段話。

> The “br-vlan” bridge is no longer necessary for deployments unless Neutron agents are deployed in a container. Instead, a direct interface such as bond1 can be specified via the “host_bind_override” override when defining provider networks.

原來在現有的版本內，已經不需要設置  `br-vlan`  這個東西了。參考 OSA 容器網路的架構圖，我們可以得知需要 br-vlan 是因為 compute node 上的 neutron 是跑在一個 LXC 內，因此需要多一個 br-vlan 還有 vath pair 將網卡接到 LXC 內。

![Neutron in LXC](/img/pages/4bdeb3838bc36995943c85a2116c6f91.png)

而在現行的架構下 neutron agent 是直接跑在 compute node 的 host 上的。

![Neutron not in LXC](/img/pages/52951f37ab30503b4604637818540294.png)

然後回顧本系列文章前一篇就會知道，不論是 vlan 還是 flat 架構下，我們都只需要指定一張 interface 作為對外出口，bridge 的部分是歸屬於 neutron agent 管理的。

![Openstack vxlan network](/img/pages/b87770c8e1484d28949edf86a19b2b3b.png)

這邊是正確設置 flat 網路需要的設定檔。

```yaml
provider_networks:
  - network:
      host_bind_override: "eth1.10"
      type: "flat"
      net_name: "flat"
      group_binds:
        - neutron_linuxbridge_agent
```

- host_bind_override 指定 flat 網路連到節點外的網卡名稱。
- type: flat 網路模式下設置為  `flat`
- net_name: neutron physical_network mapping 的 name

同理於 vlan 網路設定，和 flat 的差別是要指定可用的 vlan id range (`range`)

```yaml
provider_networks:
  - network:
	  host_bind_override: "eth2"
      type: "vlan"
	  net_name: "vlan"
	  range: "101:200,301:400"
	  group_binds:
	    - neutron_linuxbridge_agent
```

最後是 vxlan 的部分，vxlan 的設定與  `vlan`  和  `flat`  有比較大的差異，在前一篇文章我們提到，vxlan 網路架構要指定一個 local ip 作為 vxlan 封包對外的 IP，並自動綁定到該 IP 對應的網路介面。

在 OSA 裡面 vxlan 則是需要設定  `container_bridge`，指定一個 bridge，OSA 會將該 bridge 的 IP 作為 local ip。

```yaml
provider_networks:
  - network:
      container_bridge: "br-vxlan"
      ip_from_q: "tunnel"
      type: "vxlan"
      range: "1:1000"
      net_name: "vxlan"
      group_binds:
        - neutron_linuxbridge_agent
```

- container_bridge: 指定為 vxlan 對外綁定的 bridge
- ip_from_q: 指定為 vxlan 封包傳輸的子網域，雖然 OSA 會從 bridge 提取 local IP，但是還是從該欄位取得 local address 的子網域遮罩
- range: 指定可用的 vxlan id (vni)

到這邊就完成  `global_overrides`  部分的設定。接下來是  `openstack_user_config`  對每個不同 service 還有節點的設定。

```yaml
###
### Infrastructure
###

shared-infra_hosts:
  infra1:
    ip: 192.168.56.101
---
### OpenStack
###

# keystone
identity_hosts:
  infra1:
    ip: 192.168.56.101
  infra2:
    ip: 192.168.56.102

# glance
image_hosts:
  infra1:
    ip: 192.168.56.101
---
# nova hypervisors
compute_hosts:
  compute1:
    ip: 192.168.56.103
    host_vars: ...
  compute2:
    ip: 192.168.56.104

storage_hosts:
  infra1:
    ip: 172.29.236.11
    container_vars: ...
```

這個部分的格式是

```yaml
SERVICE_NAME:
   HOST1_NAME:
     ip: HOST1_MGMT_IP
   HOST2_NAME:
     ip: HOST1_MGMT_IP
   ...
```

對於 openstack 的不同組件，我們可以自由控制要在那些節點上部屬，並在多個節點上部屬單個服務來達到高可用。如果希望 OSA 不要部屬，則可以直接省略對應的 service，OSA 在部屬的時候就會跳過該服務。

特別要注意的是  `compute_hosts`  這個 service，`compute_hosts`  定義了要在哪些節點上部屬 nova_compute 和 neutron agent，也就是作為 openstack 的運算節點。

另外還可以透過  `host_vars`  和  `container_vars`  覆蓋 OSA 的預設值，來對每個節點做單獨調整。

完整設定範例可以參考 OSA 的  [部屬範例](https://docs.openstack.org/openstack-ansible/victoria/user/prod/example.html)，及  `openstack_user_config`  的 reference [文件](https://docs.openstack.org/openstack-ansible/victoria/reference/inventory/openstack-user-config-reference.html)。

### user_variables

另外一個要設定的設定檔是  `/etc/openstack_deploy/user_variables.yml`。

> 透過 openstack-ansible 指令執行 ansible 時，會將 /etc/openstack*deploy 目錄下的 user*\*.yml 檔案會作為 ansible 的 varible file，在執行 playbook 的時候被自動加入。

在 user_variables.yml 中，可以對 OSA 所有組件的部屬和設定進行調整。參照 OSA 的  [官方文件](https://docs.openstack.org/project-deploy-guide/openstack-ansible/victoria/configure.html#advanced-service-configuration)，這邊每一個 role 對應到 OSA 部屬的每個 service，裡面有列出每個 service 每個設定的預設值。通常設定會使用 service name 當作 prefix，例如  `glance_etc_dir`  可以修改 glance 的設定檔位置，預設是“/etc/glance”，可能可以修改為“/usr/local/etc/glance”。另外一份是進階設定的  [reference](https://docs.openstack.org/openstack-ansible/victoria/reference/configuration/using-overrides.html#top)，有比較詳細對 user_varialbes 設定的說明。

這邊提幾個可能比較需要注意到的設定項目

- install_method: 選項有 source 和 distro，這個設定項會控制 openstack 組件的來源
  - 預設是 source，表示 OSA 會直接從 openstack git 拉取原始碼在本地進行安裝，根據官方文件優點是這樣的部屬比較有彈性還有可客製化的程度會比較高，甚至可以將 repo 切成自己的 repostory 來直接修改原始碼，不過缺點是安裝時間比較久
  - distro 則是比較像 openstack 手動安裝教學文件的方式，從 linux 發行版的 repository 直接安裝，優點是可能會有針對發行版的優化與修復還有安裝速度，但是缺點就是更新不會像官方這麼及時，而且會缺乏一些可設定的選項
- keystone_service_publicuri_proto 和 haproxy_ssl
  - 在 openstack 上每個 service 的 api endpoint 分為 public, private, admin 三種，通常來說 public 因為是要公開給外部使用的加上 ssl (可以參考這份  [文件](https://docs.openstack.org/openstack-ansible/latest/user/security/ssl-certificates.html))。
  - 在 OSA 中，external_lb_vip_address 會用於 public endpoint，並預設會加上自簽 ssl 憑證，然而在 user_variables.yml.example 中 keystone_service_publicuri_proto 設置為 http，因此透過 public endpoint 操作 openstack api 時，會被 keystone 導向到 http，導致 openstack client 沒辦法正確處理 haproxy ssl 加密的數據，因此要注意將 keystone_service_publicuri_proto 設置為 https

### user_secrets

最後需要生成 openstack 組件間溝通使用的密碼，可以簡單透過指令生成，路徑在 /etc/openstack/user_secrets.yml

```shell
cd /opt/openstack-ansible && ./scripts/pw-token-gen.py --file /etc/openstack_deploy/user_secrets.yml
```

### 執行 openstack ansible

完成前置作業和 openstack_user_config.yml、user_variables.yml 兩個檔案的設置後，就可以正式來進行部屬了。首先要移動到  `/opt/openstack-ansible/playbooks`，所有指令在這個目錄內執行。

接著為了讓 ansible 可以 ssh 連線到 target hosts，我們要使用 ssh agent，ssh agent 會再進行 ssh 連線時，自動嘗試預先列好的 ssh key file，進行登入。透過 ssh-add 將所有可能的 ssh key file 加入，由於前面我們將 id_rsa.pub 加入到 target host 的 authorized_keys 中，因此這邊只需要加這個 key。

```shell
eval $(ssh-agent)
ssh-add ~/.ssh/id_rsa
```

接著要 export 兩個環境變數，這個是要解決 ansible 本身的 bug，如果再執行 OSA 過程中出現  `failed to transfer file to...`  錯誤可以嘗試加這兩個環境變數，[詳情](https://github.com/ansible/ansible/issues/21562)  可以查看 ansible 的 issue。

```shell
export ANSIBLE_LOCAL_TEMP=$HOME/.ansible/tmp export ANSIBLE_REMOTE_TEMP=/home/vagrant/.ansible/tmp
```

接著執行第一步

```shell
openstack-ansible setup-infrastructure.yml --syntax-check
```

OSA 會根據  `openstack_user_config.yml`  生成 ansible 的 inventory 文件，放置在  `/etc/openstack_deploy/openstack_inventory.json`，並替每個 LXC 分配 IP。

接著就是執行正是安裝部屬的腳本。

```shell
openstack-ansible setup-hosts.yml
openstack-ansible setup-infrastructure.yml
openstack-ansible setup-openstack.yml
```

這邊分成三個步驟，分別是

- 在 target hosts 上安裝 LXC 等必要套件
- 安裝 database, msg queue, repo server 等 intra
- 安裝設置 openstack 組件理論上三個指令都完整執行成功的話，就代表 openstack 正確建立起來了

更簡單的指令是執行  `setup-everything`，他會依據執行上面三個指令。

```shell
openstack-ansible setup-everything.yml
```

> 另外當執行後，ansible 的 facts 會被保存在  /etc/openstack_deploy/ansible_facts/。

## 除錯

在我的安裝經驗中最容易出問題的是 haproxy 的部分。在 OSA 的部屬環境下，所有元件的 log 會被收到 systemd 的 log 內。因為 haproxy 是安裝在 host 上所以可直接在 target host 上，下  `journalctl -xe`  查看 haproxy 的 log。各個 openstack 組件的 log 則要到各個 LXC 內去查看 systemd log。

> 在 Rocky 版本後預設使用 systemd log 取代 rsyslog，因此如果在 openstack_user_config 中指定部屬 log_hosts 是沒有意義的，需要額外將 rsyslog_server_enabled 和 rsyslog_client_enabled 給 enable

如果是 LXC 有問題，可以在 target host 的 root 權限下

- 使用  `lxc-ls -f`  查看 LXC 的狀態、IP
- 使用  `lxc-attach -n <container_name>`  進入 LXC 內查看

## 結語

到這邊就完成整個 OSA 基本的安裝部屬流程了，下一篇我們會簡單看一下在部屬完成 openstack 後，如何測試和使用 openstack 的基本功能。
