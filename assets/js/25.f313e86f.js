(window.webpackJsonp=window.webpackJsonp||[]).push([[25],{350:function(e,a,t){"use strict";t.r(a);var s=t(4),o=Object(s.a)({},(function(){var e=this,a=e.$createElement,t=e._self._c||a;return t("ContentSlotsDistributor",{attrs:{"slot-key":e.$parent.slotKey}},[t("p",[e._v("這篇記錄一下，在使用 openstack 時，遇到的幾種建立失敗情況和解決方法")]),e._v(" "),t("h2",{attrs:{id:"quota-exceeded"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#quota-exceeded"}},[e._v("#")]),e._v(" Quota exceeded")]),e._v(" "),t("p",[e._v("openstack 透過 Quota 來限制每個 project 可以使用的資源量，當超過限制時，就會出現這個錯誤訊息。預設 admin project 也會有這個限制，而且預設值其實很小，如 instances、CPU 和 memory 的限制")]),e._v(" "),t("ul",[t("li",[e._v("10 instances")]),e._v(" "),t("li",[e._v("20 vCPU")]),e._v(" "),t("li",[e._v("51200 MB RAM 透過指令   "),t("code",[e._v("openstack quota show")]),e._v("   可以查看目前的限制並透過   "),t("code",[e._v("quota set --cores/ram/instance... 200 <project>")]),e._v("   來修改各種限制")])]),e._v(" "),t("h2",{attrs:{id:"資源不足"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#資源不足"}},[e._v("#")]),e._v(" 資源不足")]),e._v(" "),t("p",[e._v("也有可能是因為 openstack cluster 已經沒有足夠多的 cpu, memory 或硬碟可以分配給虛擬機了。")]),e._v(" "),t("p",[e._v("最簡單方法是增加新的機器來應付需求。")]),e._v(" "),t("p",[e._v("但是通通來說，分配 8GB 的 RAM 給虛擬機不代表虛擬機會吃滿 8GB 的 RAM，因此在一台有 100GB RAM 的機器上，開 50 台 8GB RAM 但是實際上只會用到 1GB RAM 的虛擬機，是不會有問題的。")]),e._v(" "),t("p",[e._v("因此我們就需要調整 allocation ratio，allocation ratio 表示 openstack 可以分配倍物理設備擁有的資源給虛擬機，例如前面的例子中，50 台 8GB RAM 的機器需要 400GB 的 ram。但是實際上 server 只有 100GB 的 RAM 還要扣掉 2GB 是預留給 host 本身運行使用，因此只剩下 98GB 的 RAM 可以分配給虛擬機，因此 allocation ratio 最少需要是 400/98=4.1。")]),e._v(" "),t("p",[e._v("在每個 compute node，可修改   "),t("code",[e._v("/etc/nova/nova.conf")]),e._v("   這個檔案中的三個參數，對應到 cpu, disk, ram 的 allocation ratio。")]),e._v(" "),t("ul",[t("li",[e._v("cpu_allocation_ratio")]),e._v(" "),t("li",[e._v("disk_allocation_ratio")]),e._v(" "),t("li",[e._v("ram_allocation_ratio 修改完後要重啟 nova。 "),t("code",[e._v("service nova-compute restart")])])]),e._v(" "),t("p",[e._v("可以透過指令查看各個設備上 resource 的使用情況")]),e._v(" "),t("div",{staticClass:"language-text line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-text"}},[t("code",[e._v("# openstack allocation candidate list --os-placement-api-version 1.12 --resource VCPU=1 --resource MEMORY_MB=1024 --resource DISK_GB=10\n+---+----------------------------------+--------------------------------------+------------------------------------------+\n| # | allocation                       | resource provider                    | inventory used/capacity                  |\n+---+----------------------------------+--------------------------------------+------------------------------------------+\n| 1 | VCPU=1,MEMORY_MB=1024,DISK_GB=10 | 000ab365-74ea-4c16-9aaa-3a2bdea6238c | VCPU=1/4,MEMORY_MB=512/3893,DISK_GB=1/30 |\n+---+----------------------------------+--------------------------------------+------------------------------------------+\n\n")])]),e._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[e._v("1")]),t("br"),t("span",{staticClass:"line-number"},[e._v("2")]),t("br"),t("span",{staticClass:"line-number"},[e._v("3")]),t("br"),t("span",{staticClass:"line-number"},[e._v("4")]),t("br"),t("span",{staticClass:"line-number"},[e._v("5")]),t("br"),t("span",{staticClass:"line-number"},[e._v("6")]),t("br"),t("span",{staticClass:"line-number"},[e._v("7")]),t("br")])]),t("p",[e._v("其中每一個 resource provider 都是一個 compute node，可以透過   "),t("code",[e._v("openstack resource provider list")]),e._v("   查看對應到哪來設備 8944。")])])}),[],!1,null,null,null);a.default=o.exports}}]);