---
categories:
  - Proxmox
description: 紀錄如何在Proxmox上開OpenVPN client的LXC，作為整個子網域的跳板
tags:
  - OpenVPN
  - LXC
  - 系統建置教學
date: 2022-11-01
title: Proxmox 安裝 OpenVPN client 紀錄
---

最近需要在 proxmox 上面裝 openvpn 的 client 當作本地所有裝置的跳板 (gateway) 來連到受管理網域，因此這邊紀錄一下怎麼在 proxmox 上面開 LXC 和設定 openvpn client。

<!-- more -->

## Promox LXC 設置

首先從 proxmox 的 WebGUI 建立一個 VM 後，要修改  `/etc/pve/lxc/${LXC_ID}.conf`，直接加入下面幾行。讓 LXC 可以存取 openvpn 需要使用的 tun driver。

```shell
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
lxc.mount.entry: /dev/net dev/net none bind,create=dir
lxc.cgroup.devices.allow: c 10:200 rwm
lxc.apparmor.profile: generated
lxc.apparmor.allow_nesting: 1
```

接著透過 web shell 進入到 LXC 內進行操作。

## Openvpn client 設置

- 安裝 Openvpn

  ```shell
  apk add oepnvpn
  ```

- 將從 server 端拿到的 ovpn client file (.ovpn) 修改為  `/etc/openvpn/openvpn.conf`
- 如果使用帳號密碼進行登入，為了要讓 ovpn 可以開機自動工作，我們要修改 openvpn.conf，加入或修改為  `auth-user-pass login.conf`。然後增加 /etc/openvpn/login.conf，第一行打帳號，第二行打密碼。
- 可以透過  `/etc/init.d/openvpn start`  指令啟動 openvpn，可能會出現  `WARNING: openvpn has started, but is inactive`  但是不影響。
  - 可以透過  `ip link`  檢查是不是有  `tun0`  這張介面出現
- 透過  `rc-update add openvpn`  讓 openvpn 開機自啟動

## 防火牆、gateway 設置

為了要讓 LXC 當作 VPN gateway，我們要修改防火牆設置。

- 開啟 ipv4 轉發

  ```shell
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
  sysctl -p /etc/sysctl.conf
  ```

- 添加防火牆規則

  ```shell
  apk add iptables
  rc-update add iptables

  iptables -t nat -A POSTROUTING -o tun0 -j MASQUERADE
  /etc/init.d/iptables save
  ```

  這邊是讓本地的封包經過 VPN 時，加上一層 NAT，不然 vpn server 那邊不會認得本地的 IP。

## 路由設定

這邊主要是要修改 openvpn.conf，讓 openvpn 只轉發特定的流量。

```shell
route-nopull
route 10.0.20.0 255.255.255.0 vpn_gateway
```

- 第一行  `route-nopull`  讓 openvpn 不會去跟 vpn server 要求路由表，而是只轉發我們希望他轉發的流量。
- 第二行設定將 10.0.20.0/24 這個網段往 vpn server 送。
- 重啟 openvpn `/etc/init.d/openvpn restart 這樣就能限制只有連線到 10.0.20.0/24 這個網段的時候，經過 VPN

不過這樣只完成 LXC 的路由設定，接著要在需要通過 VPN 的電腦或直接在路由器上將 10.0.20.0/24 這個網段送到 VPN gateway 的 IP

```shell
ip route add 10.0.20.0/24 via <VPN gateway LXC's ip>
```

如果是在路由器上設置好，本地所有的裝置都可以直接透過 VPN 訪問 10.0.20.0/24 這個網段而不用在每台機器上設置防火牆了。
