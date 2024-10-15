---
categories:
  - OpenStack
description: 介紹OpenStack的基本操作，如建立虛擬機的流程
tags:
  - 系統建置教學
date: 2022-11-03
title: OpenStack 架設系列文章 (3) - 基本指令操作
---

在前面的文章中，我們介紹了 Openstack 的幾種[網路架構](https://blog.louisif.me/posts/Openstack-Deployment-Serial-1-Network-Architecure-and-Config/)，並使用 Openstack-Ansible (OSA) 完成了 Openstack 的[部屬](https://blog.louisif.me/posts/Openstack-Deployment-Serial-2-Deployment-with-Openstack-Ansible/)，今天則會簡單紀錄一下在完成 OSA 部屬之後怎麼操作 openstack。

<!-- more -->

## 使用 openstack CLI

完成 OSA 部屬之後，在控制節點上可以使用  `lxc-ls -f`  指令查看 LXC 資訊。

```shell
# lxc-ls -f
NAME                                     STATE   AUTOSTART GROUPS            IPV4                       IPV6 UNPRIVILEGED
infra1_galera_container-763c1458         RUNNING 1         onboot, openstack 10.0.3.44, 192.168.56.132  -    false
infra1_glance_container-ecb3abc2         RUNNING 1         onboot, openstack 10.0.3.174, 192.168.56.4   -    false
infra1_horizon_container-3c77d785        RUNNING 1         onboot, openstack 10.0.3.30, 192.168.56.238  -    false
infra1_keystone_container-40e90a3e       RUNNING 1         onboot, openstack 10.0.3.19, 192.168.56.108  -    false
infra1_memcached_container-7a783869      RUNNING 1         onboot, openstack 10.0.3.242, 192.168.56.196 -    false
infra1_neutron_server_container-35c98df6 RUNNING 1         onboot, openstack 10.0.3.36, 192.168.56.74   -    false
infra1_nova_api_container-775a3593       RUNNING 1         onboot, openstack 10.0.3.225, 192.168.56.244 -    false
infra1_placement_container-dac38473      RUNNING 1         onboot, openstack 10.0.3.226, 192.168.56.33  -    false
infra1_rabbit_mq_container-c2bb7a2e      RUNNING 1         onboot, openstack 10.0.3.20, 192.168.56.115  -    false
infra1_repo_container-23639b71           RUNNING 1         onboot, openstack 10.0.3.129, 192.168.56.94  -    false
infra1_rsyslog_container-509d2d2f        RUNNING 1         onboot, openstack 10.0.3.164, 192.168.56.141 -    false
infra1_utility_container-4b62f537        RUNNING 1         onboot, openstack 10.0.3.198, 192.168.56.75  -    false
```

其中可以看到一個  `utility_container`，是 OSA 用來提供 openstack cli 的 LXC。

透過  `lxc-attach infra1_utility_container-4b62f537`  進入 LXC。

在使用 openstack cli 之前要將 admin 登入資訊載入環境變數，可以透過指令  `. ~/openrc`。

接著就可以透過  `openstack`  這個指令跟 cluster 互動。

```shell
# openstack user list --os-cloud=default
+----------------------------------+-----------+
| ID                               | Name      |
+----------------------------------+-----------+
| 8291fddd2a80414d8f1b3cb40ff720c0 | admin     |
| 3761aw47e9204a8090843b00705b0ea8 | placement |
| 4526a5q64f9a48dc9752b577e26559b9 | glance    |
| 2dbf52994f7f49a1b6eb5afdc6590781 | nova      |
| b7866083ve63469f93bd26e72a141a13 | neutron   |
+----------------------------------+-----------+
```

## 訪問 horizon web GUI

透過之前在  `/etc/openstack_deploy/openstack_user_config.yml`  設置的  `external_lb_vip_address`，透過瀏覽器 https 訪問該網址。

帳號是  `admin`，密碼可以直接在前面提到的 openrc 檔案裡面找到  `OS_PASSWORD`，或著到 deployment host 的  `/etc/openstack_deploy/user_secrets.yml`  中找到  `keystone_auth_admin_password`。

## 虛擬機建立流程

假設前面使用 OSA 部署完成，並使用  `flat`  網路模式，預留 192.168.56.100-200/24 作為虛擬機 IP，gateway 為 195.168.56.1。

首先我們要下載一個 VM 的映象檔，這邊使用 openstack 示範使用的 cirros，這是一個只有 13Mb 大小的 img，適合拿來測試。並將其上傳到 glance 上。

```shell
wget http://download.cirros-cloud.net/0.4.0/cirros-0.4.0-x86_64-disk.img
glance image-create --name "cirros" \
  --file cirros-0.4.0-x86_64-disk.img \
  --disk-format qcow2 --container-format bare \
  --visibility=public
```

接著我們要將  `flat`  網路加入 openstack，假設前面部屬的時候將  `net_name`  設置為  `flat_net`

```shell
openstack network create --external --share \
  --provider-physical-network flat_net --provider-network-type flat \
  flat_network
```

neutron 會為 VM 分配 IP，因此要設置 ip pool

```shell
openstack subnet create --network flat_network \ --allocation-pool start=192.168.56.100,end=192.168.56.200 \ --dns-nameserver 8.8.4.4 --gateway 192.168.56.1 \ --subnet-range 192.168.56.0/24 flat_ip_pool
```

接著我們要建立一個 flavor，作為虛擬機的模板，定義 VM 的規格，包含 CPU, memory, disk 的大小

```shell
openstack flavor create --vcpus 1 --ram 512 --disk 1 m1.tiny
```

接著我們就可以真的將這個 VM 建立出來了

```shell
openstack server create --flavor m1.tiny --image cirros --security-group default test
```

> 因為我們現在只建立了一個 network，因此可以直接省略，如果存在多個 network，就需要下 –network 參數

為了要測試，虛擬機是否正常，我們可以透過 ssh 連進去虛擬機裡面進行操作

首先我們要修改 vm 的 security group rule，security group 是 openstack 提供防火牆管理的機制，將 VM 劃分成多個 security group，統一套用特定的防火牆規則，預設的 defualt group 是不允許任何 ingress 流量的，因此我們要讓他放行 ssh 和 icmp 方便測試。

```shell
openstack security group rule create --protocol tcp --ingress --dst-port 22 --remote-ip 0.0.0.0/0 <group id>
openstack security group rule create --protocol icmp --remote-ip 0.0.0.0/0 <group id>
```

這邊要填入 security group id，可以透過剛剛建立 VM 的結果資訊裡面找到，或著透過  `openstack security group list`  查看。

接著我們就可以透過 ssh 連入 VM 內部

```shell
openstack server ssh -4 --private --login cirros test
```

> cirros 的帳號密碼是 cirros/gocubsgo
