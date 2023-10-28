(window.webpackJsonp=window.webpackJsonp||[]).push([[10],{335:function(s,a,t){"use strict";t.r(a);var r=t(4),e=Object(r.a)({},(function(){var s=this,a=s.$createElement,t=s._self._c||a;return t("ContentSlotsDistributor",{attrs:{"slot-key":s.$parent.slotKey}},[t("h2",{attrs:{id:"前言"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#前言"}},[s._v("#")]),s._v(" 前言")]),s._v(" "),t("p",[s._v("Proxmox 提供了 web GUI 來方便的建立和管理 LXC 和虛擬機，但是如果有大量的虛擬機需要建立，那麼使用 GUI 就會變得非常繁瑣，而且不利於版本控制。因此我們可以使用 Terraform 來完成自動化建立的過程。然而在 Proxmox 上使用 Terraform，我覺得相對 openstack 來說概念會比較複雜一點，因此花了一點點時間來釐清。這邊記錄下使用 terrform 管理 Proxmox 的基本操作，希望對大家有幫助。")]),s._v(" "),t("h2",{attrs:{id:"cloud-init-基本觀念"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#cloud-init-基本觀念"}},[s._v("#")]),s._v(" Cloud-init 基本觀念")]),s._v(" "),t("p",[s._v("在使用 Terraform 建立 Proxmox VM 的過程中，我們會使用到 cloud-init 這個技術。\n在使用 Promox GUI 設置虛擬機的過程中會有兩大麻煩的地方，第一個是需要在 web GUI 介面上一台一台的建立出來，第二個是需要在每台虛擬機上完成 OS 的安裝，設置硬碟、網路、SSH 等。\n前者我們透過 terraform 來解決，後者我們則會搭配利用 cloud-init。cloud-init 是一個業界標準，在許多 Linux 發行版還有公 / 私有雲上都有相對應的支援。\n各 Linux 發行版會發行特製的 cloud image 來支持 cloud-init。\n支援 cloud-init 的作業系統會在開機執行的時候執行透過特定方式去讀取使用者設定檔，自動完成前面提到的網路、帳號等設置，來達到自動化的目的。")]),s._v(" "),t("h3",{attrs:{id:"data-source"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#data-source"}},[s._v("#")]),s._v(" Data Source")]),s._v(" "),t("p",[s._v("在 cloud image 中，cloud-init 會根據設定檔來完成設置，而設定檔的來源 (Data source) 有很多種，不同的 cloud (AWS, Azure, GCP, Openstack, Proxmox) 在 cloud-init 標準下制定了不同的設定檔來源。(可參考 "),t("a",{attrs:{href:"https://cloudinit.readthedocs.io/en/latest/topics/datasources.html",target:"_blank",rel:"noopener noreferrer"}},[s._v("文件"),t("OutboundLink")],1),s._v(")")]),s._v(" "),t("p",[s._v("在 Proxmox 上支援 NoCloud 和 ConfigDrive 兩種資料源，兩種的執行方式相似，將使用者設定檔轉成一個特製的印象檔掛載到虛擬機上，當 VM 開機時 cloud-init 可以自動搜索到該印象檔，並讀取裡面的設定檔來完成設置。")]),s._v(" "),t("h2",{attrs:{id:"前置作業"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#前置作業"}},[s._v("#")]),s._v(" 前置作業")]),s._v(" "),t("p",[s._v("首先我們要先安裝 Terraform 和在 proxmox 上安裝 cloud-init 的工具，這邊簡單直接把 Terraform 也裝在 promox host 上面。")]),s._v(" "),t("div",{staticClass:"language-shell line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-shell"}},[t("code",[t("span",{pre:!0,attrs:{class:"token comment"}},[s._v("# cloud-init")]),s._v("\n"),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("apt-get")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("install")]),s._v(" cloud-init\n\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[s._v("# Terraform")]),s._v("\n"),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("wget")]),s._v(" -O- https://apt.releases.hashicorp.com/gpg "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("|")]),s._v(" gpg "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--dearmor")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("|")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("sudo")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("tee")]),s._v(" /usr/share/keyrings/hashicorp-archive-keyring.gpg\n"),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("echo")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com '),t("span",{pre:!0,attrs:{class:"token variable"}},[t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$(")]),s._v("lsb_release "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("-cs")]),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v(")")])]),s._v(' main"')]),s._v(" "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("|")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("sudo")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("tee")]),s._v(" /etc/apt/sources.list.d/hashicorp.list\n"),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("sudo")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("apt")]),s._v(" update "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("&&")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("sudo")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("apt")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("install")]),s._v(" terraform\n")])]),s._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[s._v("1")]),t("br"),t("span",{staticClass:"line-number"},[s._v("2")]),t("br"),t("span",{staticClass:"line-number"},[s._v("3")]),t("br"),t("span",{staticClass:"line-number"},[s._v("4")]),t("br"),t("span",{staticClass:"line-number"},[s._v("5")]),t("br"),t("span",{staticClass:"line-number"},[s._v("6")]),t("br"),t("span",{staticClass:"line-number"},[s._v("7")]),t("br")])]),t("h2",{attrs:{id:"proxmox-cloud-init"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#proxmox-cloud-init"}},[s._v("#")]),s._v(" Proxmox & Cloud-init")]),s._v(" "),t("p",[s._v("再透過 Terraform 自動部屬之前，我們要先看看怎麼在 Proxmox 上搭配 cloud-init 手動部屬 VM。")]),s._v(" "),t("p",[s._v("這邊我們透過 promox 的 CLI 工具來完成設置，不過操作也都可以透過 GUI 完成。")]),s._v(" "),t("h3",{attrs:{id:"建立-vm"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#建立-vm"}},[s._v("#")]),s._v(" 建立 VM")]),s._v(" "),t("div",{staticClass:"language-shell line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-shell"}},[t("code",[t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("export")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token assign-left variable"}},[s._v("VM_ID")]),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"9001"')]),s._v("\n\n"),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("cd")]),s._v(" /var/lib/vz/template/iso/\n"),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("wget")]),s._v(" https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img\n\nqm create "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--name")]),s._v(" ubuntu-2004-focal-fossa "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--ostype")]),s._v(" l26 "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--memory")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("8192")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--balloon")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("2048")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--sockets")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("1")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--cores")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("1")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--vcpu")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("1")]),s._v("  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--net0")]),s._v(" virtio,bridge"),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v("vmbr11 "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("\\")]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--onboot")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("1")]),s._v("\n\nqm importdisk "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" focal-server-cloudimg-amd64.img local-lvm "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--format")]),s._v(" qcow2\n\nqm "),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("set")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--scsihw")]),s._v(" virtio-scsi-pci\nqm "),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("set")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--scsi0")]),s._v(" local-lvm:vm-"),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v("-disk-0\nqm "),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("set")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--boot")]),s._v(" c "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--bootdisk")]),s._v(" scsi0\n\nqm "),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("set")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--ide2")]),s._v(" local-lvm:cloudinit\nqm "),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("set")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token variable"}},[s._v("$VM_ID")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--serial0")]),s._v(" socket\n")])]),s._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[s._v("1")]),t("br"),t("span",{staticClass:"line-number"},[s._v("2")]),t("br"),t("span",{staticClass:"line-number"},[s._v("3")]),t("br"),t("span",{staticClass:"line-number"},[s._v("4")]),t("br"),t("span",{staticClass:"line-number"},[s._v("5")]),t("br"),t("span",{staticClass:"line-number"},[s._v("6")]),t("br"),t("span",{staticClass:"line-number"},[s._v("7")]),t("br"),t("span",{staticClass:"line-number"},[s._v("8")]),t("br"),t("span",{staticClass:"line-number"},[s._v("9")]),t("br"),t("span",{staticClass:"line-number"},[s._v("10")]),t("br"),t("span",{staticClass:"line-number"},[s._v("11")]),t("br"),t("span",{staticClass:"line-number"},[s._v("12")]),t("br"),t("span",{staticClass:"line-number"},[s._v("13")]),t("br"),t("span",{staticClass:"line-number"},[s._v("14")]),t("br"),t("span",{staticClass:"line-number"},[s._v("15")]),t("br"),t("span",{staticClass:"line-number"},[s._v("16")]),t("br"),t("span",{staticClass:"line-number"},[s._v("17")]),t("br"),t("span",{staticClass:"line-number"},[s._v("18")]),t("br"),t("span",{staticClass:"line-number"},[s._v("19")]),t("br"),t("span",{staticClass:"line-number"},[s._v("20")]),t("br"),t("span",{staticClass:"line-number"},[s._v("21")]),t("br"),t("span",{staticClass:"line-number"},[s._v("22")]),t("br"),t("span",{staticClass:"line-number"},[s._v("23")]),t("br"),t("span",{staticClass:"line-number"},[s._v("24")]),t("br")])]),t("p",[s._v("前面提到 cloud-init 要使用特製的印象檔，這邊我們透過 wget 抓取印象檔，放到  "),t("code",[s._v("/var/lib/vz/template/iso/")]),s._v("  路徑下，這是 proxmox 預設放置 ISO 檔的路徑，因此可以透過 GUI 到 storage/local/ISO image 的頁面看到我們剛剛下載的印象檔。")]),s._v(" "),t("p",[s._v("接著透過  "),t("code",[s._v("qm create")]),s._v("  指令建立 VM，這邊 balloon 參數對應到  "),t("code",[s._v("Minimum memory")]),s._v("  的設定。")]),s._v(" "),t("p",[s._v("這邊提供的 cloud image 提供的印象檔並不是通常我們用來安裝作業系統的 iso 安裝檔，而是 qcow2 文件，qcow2 是一種虛擬機硬碟快照格式，因此這邊我們透過 importdisk 指令，直接將 img 轉換成硬碟。")]),s._v(" "),t("p",[s._v("接著我們要將建立好的硬碟掛載到 VM 上，這邊我們指定 scsi0 介面，將硬碟掛載上去，同時由於我們要從 cloud image 開機，因此這邊直接將 bootdisk 設定為 scsi0。")]),s._v(" "),t("blockquote",[t("p",[s._v("Proxmox 官方文件有提到，ubuntu 的 cloud-init 映像，如果使用 scsi 接口掛載的話，需要將控制器設置為  "),t("code",[s._v("virtio-scsi-pci")]),s._v(" 。")])]),s._v(" "),t("p",[s._v("接著我們需要添加兩個特殊的設備，首先是 cloudinit (GUI 顯示為 cloud driver)，這個是前面提到用於傳輸 cloud-init 設定檔的設備，當在 proxmox 上完成 cloud-init 設定後，proxmox 會生成對應的印象檔掛到 cloud driver 上，")]),s._v(" "),t("p",[s._v("另外由於 cloud image 的特殊性，我們需要添加一個 srial 設備。")]),s._v(" "),t("p",[s._v("到這邊設址結果如下圖：")]),s._v(" "),t("p",[t("img",{attrs:{src:"/img/pages/301fd2a0b80ba832a11d915042b489ed.png",alt:"Proxmox hardware 結果"}})]),s._v(" "),t("h3",{attrs:{id:"設定-cloud-init"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#設定-cloud-init"}},[s._v("#")]),s._v(" 設定 cloud-init")]),s._v(" "),t("p",[s._v("接著我們要設定 cloud-init，這邊我們透過 GUI 的方式來完成設定。")]),s._v(" "),t("p",[t("img",{attrs:{src:"/img/pages/f019dbe59695bb3619cfdfe24ed2b598.png",alt:"Proxmox cloudinit 設定"}})]),s._v(" "),t("p",[s._v("在 proxmox 上我們可以簡單的在 GUI 完成 cloudinit 的設定 (包含帳號、密碼、SSH key 等)，接著按下  "),t("code",[s._v("Regenerage image")]),s._v("  按鈕，proxmox 會生成設定檔，並掛載到前面建立的 cloud driver 上。")]),s._v(" "),t("h3",{attrs:{id:"啟動-vm"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#啟動-vm"}},[s._v("#")]),s._v(" 啟動 VM")]),s._v(" "),t("p",[s._v("接著我們只要按下  "),t("code",[s._v("Start")]),s._v("  按鈕，VM 就會開機，並自動完成前面的 cloud-init 設定。")]),s._v(" "),t("blockquote"),s._v(" "),t("div",{staticClass:"language- extra-class"},[t("pre",[t("code",[s._v("Cloud image 不太建議使用密碼登入，因此預設 VM 通常都會把 SSH 密碼登入關閉，因此需要透過 SSH key 登入，或著使用最後後提到的 cicustom 來修改 SSH 設定。\n")])])]),t("h2",{attrs:{id:"使用-terraform"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#使用-terraform"}},[s._v("#")]),s._v(" 使用 Terraform")]),s._v(" "),t("p",[s._v("接著我們就要搭配 Terraform 來將完成自動化部屬了。("),t("a",{attrs:{href:"https://registry.terraform.io/providers/Telmate/proxmox/2.9.11",target:"_blank",rel:"noopener noreferrer"}},[s._v("Proxmox provider"),t("OutboundLink")],1),s._v(")")]),s._v(" "),t("p",[s._v("首先前面的指令不能丟，我們在最後加上一行  "),t("code",[s._v("qm template $VM_ID")]),s._v(" ，將 VM 轉成模板用於後續的 Terraform 部屬。\n這邊使用模板，目前研究起來有兩個原因，首先硬碟、cloud driver、serial 這些固定虛擬硬體和 cloud image 可以直接複製，而不用在 Terraform 上重新設定。\n另外 proxmox 的 terraform provider 好像不支援 importdisk 這樣導入 qcow2 印象檔的方式。")]),s._v(" "),t("p",[s._v("首先是 provider 的基礎設定")]),s._v(" "),t("div",{staticClass:"language-shell line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-shell"}},[t("code",[s._v("terraform "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("{")]),s._v("\n  required_providers "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("{")]),s._v("\n    proxmox "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("{")]),s._v("\n      "),t("span",{pre:!0,attrs:{class:"token builtin class-name"}},[s._v("source")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"Telmate/proxmox"')]),s._v("\n      version "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"2.9.11"')]),s._v("\n    "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("}")]),s._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("}")]),s._v("\n"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("}")]),s._v("\n\nprovider "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"proxmox"')]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("{")]),s._v("\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[s._v("# Configuration options")]),s._v("\n  pm_api_url "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"https://127.0.0.1:8006/api2/json"')]),s._v("\n  pm_user    "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"root@pam"')]),s._v("\n  pm_password "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"password"')]),s._v("\n  pm_tls_insecure "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token boolean"}},[s._v("true")]),s._v("\n"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("}")]),s._v("\n")])]),s._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[s._v("1")]),t("br"),t("span",{staticClass:"line-number"},[s._v("2")]),t("br"),t("span",{staticClass:"line-number"},[s._v("3")]),t("br"),t("span",{staticClass:"line-number"},[s._v("4")]),t("br"),t("span",{staticClass:"line-number"},[s._v("5")]),t("br"),t("span",{staticClass:"line-number"},[s._v("6")]),t("br"),t("span",{staticClass:"line-number"},[s._v("7")]),t("br"),t("span",{staticClass:"line-number"},[s._v("8")]),t("br"),t("span",{staticClass:"line-number"},[s._v("9")]),t("br"),t("span",{staticClass:"line-number"},[s._v("10")]),t("br"),t("span",{staticClass:"line-number"},[s._v("11")]),t("br"),t("span",{staticClass:"line-number"},[s._v("12")]),t("br"),t("span",{staticClass:"line-number"},[s._v("13")]),t("br"),t("span",{staticClass:"line-number"},[s._v("14")]),t("br"),t("span",{staticClass:"line-number"},[s._v("15")]),t("br"),t("span",{staticClass:"line-number"},[s._v("16")]),t("br")])]),t("p",[s._v("這邊我們直接使用 root 的帳號密碼登入 proxmox web，不過為了安全和控管的話，建議還是建立額外的使用者給 terraform 使用，以及使用 token 來取代密碼。")]),s._v(" "),t("div",{staticClass:"language-shell line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-shell"}},[t("code",[t("span",{pre:!0,attrs:{class:"token comment"}},[s._v("# 建立 terraform 使用者")]),s._v("\npveum role "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("add")]),s._v(" TerraformProv "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("-privs")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"VM.Allocate VM.Clone VM.Config.CDROM VM.Config.CPU VM.Config.Cloudinit VM.Config.Disk VM.Config.HWType VM.Config.Memory VM.Config.Network VM.Config.Options VM.Monitor VM.Audit VM.PowerMgmt Datastore.AllocateSpace Datastore.Audit"')]),s._v("\npveum user "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("add")]),s._v(" terraform-prov@pve "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("--password")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("<")]),s._v("password"),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v(">")]),s._v("\npveum aclmod /-user terraform-prov@pve "),t("span",{pre:!0,attrs:{class:"token parameter variable"}},[s._v("-role")]),s._v(" TerraformProv\n\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[s._v("# 建立 token")]),s._v("\npveum user token "),t("span",{pre:!0,attrs:{class:"token function"}},[s._v("add")]),s._v(" terraform-prov@pve terraform-token\n")])]),s._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[s._v("1")]),t("br"),t("span",{staticClass:"line-number"},[s._v("2")]),t("br"),t("span",{staticClass:"line-number"},[s._v("3")]),t("br"),t("span",{staticClass:"line-number"},[s._v("4")]),t("br"),t("span",{staticClass:"line-number"},[s._v("5")]),t("br"),t("span",{staticClass:"line-number"},[s._v("6")]),t("br"),t("span",{staticClass:"line-number"},[s._v("7")]),t("br")])]),t("p",[s._v("接著我們透過 proxmox_vm_qemu 資源來建立 VM")]),s._v(" "),t("div",{staticClass:"language-shell line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-shell"}},[t("code",[s._v("resource "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"proxmox_vm_qemu"')]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"resource-name"')]),s._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("{")]),s._v("\n  name        "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"VM-name"')]),s._v("\n  target_node "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"Node to create the VM on"')]),s._v("\n\n  clone "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"ubuntu-2004-focal-fossa"')]),s._v("\n  full_clone "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token boolean"}},[s._v("true")]),s._v("\n  os_type "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"cloud-init"')]),s._v("\n\n  onboot  "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token boolean"}},[s._v("true")]),s._v("\n  cores    "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("8")]),s._v("\n  sockets  "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("1")]),s._v("\n  cpu      "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"host"')]),s._v("\n  memory   "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("8192")]),s._v("\n  balloon  "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("2048")]),s._v("\n  scsihw   "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"virtio-scsi-pci"')]),s._v("\n  bootdisk "),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),s._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"virtio0\n\n  disk {\n    slot     = 0\n    size     = "')]),s._v("65536M"),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"\n    type     = "')]),s._v("scsi"),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"\n    storage  = "')]),s._v("local-lvm"),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"\n    iothread = 1\n  }\n\n  ipconfig0 = "')]),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("192.168")]),s._v(".0.1/24,gw"),t("span",{pre:!0,attrs:{class:"token operator"}},[s._v("=")]),t("span",{pre:!0,attrs:{class:"token number"}},[s._v("192.168")]),s._v(".0.254"),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"\n  ciuser="')]),s._v("username"),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"\n  cipassword="')]),s._v("password"),t("span",{pre:!0,attrs:{class:"token string"}},[s._v('"\n  sshkeys = file ("')]),s._v('/root/.ssh/id_rsa.pub"'),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v(")")]),s._v("\n"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[s._v("}")]),s._v("\n")])]),s._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[s._v("1")]),t("br"),t("span",{staticClass:"line-number"},[s._v("2")]),t("br"),t("span",{staticClass:"line-number"},[s._v("3")]),t("br"),t("span",{staticClass:"line-number"},[s._v("4")]),t("br"),t("span",{staticClass:"line-number"},[s._v("5")]),t("br"),t("span",{staticClass:"line-number"},[s._v("6")]),t("br"),t("span",{staticClass:"line-number"},[s._v("7")]),t("br"),t("span",{staticClass:"line-number"},[s._v("8")]),t("br"),t("span",{staticClass:"line-number"},[s._v("9")]),t("br"),t("span",{staticClass:"line-number"},[s._v("10")]),t("br"),t("span",{staticClass:"line-number"},[s._v("11")]),t("br"),t("span",{staticClass:"line-number"},[s._v("12")]),t("br"),t("span",{staticClass:"line-number"},[s._v("13")]),t("br"),t("span",{staticClass:"line-number"},[s._v("14")]),t("br"),t("span",{staticClass:"line-number"},[s._v("15")]),t("br"),t("span",{staticClass:"line-number"},[s._v("16")]),t("br"),t("span",{staticClass:"line-number"},[s._v("17")]),t("br"),t("span",{staticClass:"line-number"},[s._v("18")]),t("br"),t("span",{staticClass:"line-number"},[s._v("19")]),t("br"),t("span",{staticClass:"line-number"},[s._v("20")]),t("br"),t("span",{staticClass:"line-number"},[s._v("21")]),t("br"),t("span",{staticClass:"line-number"},[s._v("22")]),t("br"),t("span",{staticClass:"line-number"},[s._v("23")]),t("br"),t("span",{staticClass:"line-number"},[s._v("24")]),t("br"),t("span",{staticClass:"line-number"},[s._v("25")]),t("br"),t("span",{staticClass:"line-number"},[s._v("26")]),t("br"),t("span",{staticClass:"line-number"},[s._v("27")]),t("br"),t("span",{staticClass:"line-number"},[s._v("28")]),t("br"),t("span",{staticClass:"line-number"},[s._v("29")]),t("br"),t("span",{staticClass:"line-number"},[s._v("30")]),t("br")])]),t("p",[s._v("首先當然是指定我們 VM 的名子還有要長在 proxmox cluster 的哪台機器上 (name, target_node)。\n接著我們指定我們要 clone 的我們剛剛做的 VM 模板 (clone) 並指定為完整複製 (full_clone)，以及指定 OS type 為  "),t("code",[s._v("cloud-init")]),s._v(" 。")]),s._v(" "),t("p",[s._v("接著是設定 VM 的 CPU、memory 等硬體規格，這邊要特別注意的是這先參數的規格，如果不指定，並不會套用模板的規格，而是 provider 預設的規格，因此我們需要指定這些參數。")]),s._v(" "),t("p",[s._v("接著比較特別的是我們要重新定義我們的硬碟，前面雖然我們已經將 cloud image 轉成硬碟掛載到 VM 上了，但是這樣掛載上去硬碟大小是絕對不夠用的 (以 ubuntu 的 image 來說只有 2G 多的硬碟大小)，因此我們這邊複寫修改  "),t("code",[s._v("scsi0")]),s._v("  的硬碟大小，cloud-init 在第一次開機的時候能夠自我察覺並修改分割區的大小來匹配新的硬碟容量。")]),s._v(" "),t("p",[s._v("最後就是 cloud-init 的設定，這邊我們指定 VM 的 IP、帳號密碼、以及 ssh key。")]),s._v(" "),t("p",[s._v("最後就一樣透過指令完成自動部屬")]),s._v(" "),t("div",{staticClass:"language-shell line-numbers-mode"},[t("pre",{pre:!0,attrs:{class:"language-shell"}},[t("code",[s._v("terraform init\nterraform apply\n")])]),s._v(" "),t("div",{staticClass:"line-numbers-wrapper"},[t("span",{staticClass:"line-number"},[s._v("1")]),t("br"),t("span",{staticClass:"line-number"},[s._v("2")]),t("br")])]),t("p",[s._v("到這邊我們就完成 terraform 與 proxmox 搭配的自動部屬了。")]),s._v(" "),t("h2",{attrs:{id:"其他雜紀"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#其他雜紀"}},[s._v("#")]),s._v(" 其他雜紀")]),s._v(" "),t("h3",{attrs:{id:"cicustom"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#cicustom"}},[s._v("#")]),s._v(" cicustom")]),s._v(" "),t("p",[s._v("前面我們都是透過 proxmox 本身的功能來生成 cloud-init 的設定檔，但是 proxmox 提供的設置選項有限，因此有時候我們會需要直接修改 cloud-init 的設定檔，\n在 proxmox 上提供兩種方式來直接設定 cloud-init 設定檔的參數，一個是直接在指令上提供參數值，另外一個是直接提供 cloud-init 的 yaml 設定檔")]),s._v(" "),t("p",[s._v("在 terraform 上面，我們一樣可以透過  "),t("code",[s._v("cicustom")]),s._v("  設定來達到相同的事情。")]),s._v(" "),t("h3",{attrs:{id:"agent"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#agent"}},[s._v("#")]),s._v(" agent")]),s._v(" "),t("p",[s._v("在查找資料時，在許多範例會看到指定  "),t("code",[s._v("agent")]),s._v("  參數為 0 或 1，這邊的 agent 指的是  "),t("code",[s._v("Qemu-guest-agent")]),s._v(" ，簡單來說就是在虛擬機內部安裝一個 agent 來當作 proxmox 直接操作虛擬機內部的後門，不過具體的功能就不在本篇的範圍內了，且預設情況下這個功能是關閉的。")]),s._v(" "),t("h2",{attrs:{id:"結語"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#結語"}},[s._v("#")]),s._v(" 結語")]),s._v(" "),t("p",[s._v("這邊簡單紀錄了一下 terraform 和 proxmox 的搭配使用，在一開始研究的時候，cloud-init 還有使用 VM template 這兩件事，是之前在使用 terraform 或 proxmox 不會特別注意到的東西，因此會有點混亂和不知道功能，希望這篇文章能夠幫助到有需要的人。")]),s._v(" "),t("h2",{attrs:{id:"參考資料"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#參考資料"}},[s._v("#")]),s._v(" 參考資料")]),s._v(" "),t("ul",[t("li",[t("a",{attrs:{href:"https://registry.terraform.io/providers/Telmate/proxmox/latest/docs",target:"_blank",rel:"noopener noreferrer"}},[s._v("Terraform Provider for Proxmox"),t("OutboundLink")],1)]),s._v(" "),t("li",[t("a",{attrs:{href:"https://pve.proxmox.com/wiki/Cloud-Init_Support",target:"_blank",rel:"noopener noreferrer"}},[s._v("Proxmox Cloud-Init"),t("OutboundLink")],1)])])])}),[],!1,null,null,null);a.default=e.exports}}]);