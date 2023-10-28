---
categories:
  - Debug 日常
description: 分析ONOS上Openflow Packet Processor無法處理packet out以外的treatment的原因
tags:
  - ONOS
date: 2022-08-12
title: 分析 ONOS Packet Processor Treatment 無效之原因
---

> ONOS 踩坑日記

## 前言

最近嘗試使用 ONOS 目前最新的 2.7 版來開發 APP，用 OpenFlow 來讓交換機實現 router 的功能。結果踩到 ONOS Packet-in 封包處理實作未完全的坑。

<!-- more -->

當封包經過 router 時，會根據 routing table 和封包的目標決定要往哪個 interface 送出，同時將封包的 source mac address 改為交換機的 mac address、封包的 destination mac address 改為 nexthop 的 mac address。因此我們需要在交換機上安裝一條 flow rule，selector 是 destination mac address，treatment 有三個 instructions 分別是：修改 src mac、dst mac 和決定 output port。

為了減少交換機上的 flow entry 的數量，所以採用 reactive 的方式，也就是當交換機收到第一封包時，先將封包送 (packet-in) 給 SDN controller，controller 根據 routing table，直接修改該封包的 mac address，並從交換機特定的 port 送出 (packet-out)，同時生成對應的 flow rule 並安裝到交換機上，後續的封包就可以直接根據 flow rule 轉送而不用再經過 controller。

## 問題

然而問題就出現在第一個封包上，根據 tcpdump 看到的結果，封包的 source 和 destination mac address 都沒有被修改到。

由於我是使用 OVS 來模擬 Openflow 交換機，因此首先懷疑是不是 OVS 本身實作限制，不支援同時包含上述三個 instructions 導致。然而，後續經過 flow rule 直接送出的封包，都有成功修改到 mac address。由於只有第一個 packet-in 到 controller，再 packet-out 回 switch 的封包沒有被修改，因此開始懷疑是 ONOS 的問題。

## 追蹤

在 ONOS 裡面，一般使用 PacketProcessor 的方式來處理 packet-in 到 controller 的封包。首先實作 PacketProcessor 介面，然後向 PacketService 註冊，ONOS 就會調用 processor 處理 packet-in 的封包。

```java
private PacketProcessor processor = new PacketProcessor() {
    @Override
    public void process(PacketContext context) {
        //.... 處理封包的邏輯
        // 修改設定封包的 mac address 和決定 output port
        context.treatmentBuilder ()
               .setEthSrc (srcMac)
               .setEthDst (dstMac)
               .setOutput (outPort.port ());
        context.send (); // 將封包 packet-out 回交換機
    }
};
@Activate
protected void activate() {
    packetService.addProcessor (processor,
         PacketProcessor.director (1));
}
```

PacketContext 會包含 packet-in 進來的封包內容，並可透過 context.treatmentBuilder 修改封包和決定要往哪個 port 送出去，最後透過 send 指令，packet-out 回交換機。

搜查一下 ONOS 的原始碼，會在 core/api 下面找到 DefaultPacketContext ，這個 class 實作了 PacketContext 這個 Interface，但是這個 class 是一個 abstract class，因此一定有人繼承了它，繼續搜查 PacketContext 這個字會找到兩個跟 Openflow 相關的，DefaultOpenFlowPacketContext 和 OpenFlowCorePacketContext，但是後者才有繼承 DefaultPacketContext 和實作 PacketContext 介面，因此 PacketProcesser 在處理 openflow packet-in 進來的封包時，拿到的 PacketContext 具體應該是 OpenFlowCorePacketContext 這個 class。

打開 OpenFlowCorePacketContext.java 會看到它實現了 send 這個 function，經過簡單的檢查後呼叫 sendPacket 這個 function，然後你就會看到…

```java
private void sendPacket(Ethernet eth) {
        List<Instruction> ins = treatmentBuilder ().build ().allInstructions ();
        OFPort p = null;
        // TODO: support arbitrary list of treatments must be supported in ofPacketContext
        for (Instruction i : ins) {
            if (i.type () == Type.OUTPUT) {
                p = buildPort (((OutputInstruction) i).port ());
                break; //for now...
            }
        }
        .......
}
```

謎底揭曉，原來 ONOS 只有實作 output 這個 instruction (決定 output port)，因此它直接忽略的 set source mac 和 set destination mac 兩個指令，交換機送出來的封包當然就只有往對的 port 送，而沒有改到 mac address。

## 結論

結論就是在當前 ONOS 2.7 環境下，PacketProcesser 在處理 Openflow 交換機封包 packet-out 的時候，只能決定該封包的 output port，其餘對該封包的修改都是無效的。

## 參考資料

- [ONOS Source code](https://github.com/opennetworkinglab/onos/)
