---
categories:
  - Networking
description: 憑證在驗證網站身份、確保 TLS 連線安全中扮演關鍵角色，然而，憑證背後的各種標準、編碼格式、驗證機制以及相關的技術細節，往往容易讓人感到模糊。這篇文章將會梳理數位憑證的技術脈絡，從其底層的編碼格式、核心的 X.509 標準、到如何層層驗證憑證鏈，以及各種安全機制。
tags:
  - 技術分享
  - 資安
  - 憑證
date: 2025-05-22
title: 搞懂數位憑證：檔案格式、簽署與驗證流程
draft: false
---
憑證在驗證網站身份、確保 TLS 連線安全中扮演關鍵角色，然而，憑證背後的各種標準、編碼格式、驗證機制以及相關的技術細節，往往容易讓人感到模糊。這篇文章將會梳理數位憑證的技術脈絡，從其底層的編碼格式、核心的 X.509 標準、到如何層層驗證憑證鏈，以及各種安全機制。

<!-- more -->

## PEM 與 DER：憑證的編碼格式

當我們談論數位憑證時，首先會遇到的是它們的儲存與傳輸格式。其中，**DER (Distinguished Encoding Rules)** 是基於 **ASN.1 (Abstract Syntax Notation One)** 的一種嚴格的二進位編碼格式。

- **ASN.1** 是一個獨立於特定語言和平台的標準，它定義了一套描述資料結構的規則（類似於 gRPC 使用的 Protobuf），並能將這些結構化的資料轉換為特定的二進位格式。這種標準化的方式確保了不同系統間資料交換的一致性。
    
- **DER** 編碼的憑證通常以 `.der` 作為副檔名，其內容是緊湊的二進位資料。
    

例如，以下是一個 ASN.1 定義的簡單資料結構：

```
EmployeeRecord ::= SEQUENCE {
    employeeID    INTEGER,
    isFullTime    BOOLEAN
}
```

這個定義表示 `EmployeeRecord` 是一個包含 `employeeID`（整數）和 `isFullTime`（Boolean）欄位的複合結構。

進一步地，ITU-T 制定的 X.690 技術規範詳細定義了多種將 ASN.1 資料結構轉換成二進位的方式，其中就包含了常見的 **BER (Basic Encoding Rules)** 和 **DER** 編碼。在實際應用中，憑證通常會使用 DER 編碼進行保存，而其具體內容結構則由 X.509 等標準定義的各種 ASN.1 結構來規範。

與 DER 相輔相成的是 **PEM (Privacy Enhanced Mail)** 格式。PEM 本質上是對 DER 編碼的二進位檔案進行 Base64 編碼，使其能夠以純文字形式表示，方便在電子郵件或文字環境中傳輸。PEM 格式的特徵是其內容會被 `-----BEGIN...-----` 開頭和 `-----END...-----` 結尾的區塊所包圍，例如我們常見的 `-----BEGIN CERTIFICATE-----`。

PEM 檔案通常使用 `.pem` 作為副檔名。值得注意的是，一個 `.pem` 檔案可以包含多個這類 `BEGIN/END` 區塊，這意味著它能夠在單一檔案中儲存多個憑證（例如憑證鏈中的多個憑證）或金鑰。

## X.509：憑證的標準

了解了憑證的編碼格式後，我們需要探究憑證本身的內容結構。在數位憑證領域，**X.509** 是最廣泛使用的標準。我們通常所說的 X.509，特指由 **RFC 5280** 描述的 **X.509 v3** 版本，它詳細定義了公開金鑰憑證的資料結構和語義。

RFC 5280 定義了憑證的核心結構如下：

```
Certificate ::= SEQUENCE {
  tbsCertificate TBSCertificate,
  signatureAlgorithm AlgorithmIdentifier,
  signatureValue BIT STRING 
}
```

這個結構清晰地表明，一個憑證由三大部分組成：待簽署的憑證資訊（`tbsCertificate`）、簽章演算法（`signatureAlgorithm`）和數位簽章值（`signatureValue`）。您可以透過 [ASN.1 JavaScript decoder](https://lapo.it/asn1js/ "null") 等工具，實際查看憑證的 ASN.1 結構，以加深理解。

## Distinguished Name (DN)：憑證中的實體識別

在憑證的內容中，一個重要的概念是 **DN (Distinguished Name)**。DN 是一種標準化的階層式名稱格式，用於唯一識別憑證的主體或簽發者。它常見於憑證和 LDAP (Lightweight Directory Access Protocol) 中，例如在 LDAP 中，`CN=Jeff Smith,OU=Sales,DC=Fabrikam,DC=COM` 用於描述一個使用者。

- DN 是一個由 **Relative Distinguished Name (RDN)** 序列組成的。每個 RDN 都是一個鍵（正式名稱為 AttributeType）- 值對。
    
- DN 的讀取順序通常是從右到左，表示從上層往下索引。例如，對於 `cn=Alice Smith,ou=Sales,o=Example Corp,c=US` 這個 DN，它可以被理解為以下的階層結構：
    

```
       c=US (國家：美國)
        |
    o=Example Corp (組織：範例公司)
        |
     ou=Sales (組織單位：銷售部)
        |
   cn=Alice Smith (通用名稱：Alice Smith)
```

RFC 4519 (LDAP Schema) 規範了一些常見的屬性類型 (Attribute Type)，這些屬性類型在 X.500 和 X.509 中也廣泛使用：

|String|X.500 AttributeType|
|---|---|
|CN|commonName (2.5.4.3)|
|L|localityName (2.5.4.7)|
|ST|stateOrProvinceName (2.5.4.8)|
|O|organizationName (2.5.4.10)|
|OU|organizationalUnitName (2.5.4.11)|
|C|countryName (2.5.4.6)|
|STREET|streetAddress (2.5.4.9)|
|DC|domainComponent (0.9.2342.19200300.100.1.25)|
|UID|userId (0.9.2342.19200300.100.1.1)|

追溯歷史，最早出現的是 ITU-T X.500 標準，旨在定義一套全面的目錄服務系統，並利用 Distinguished Name 來描述和定位唯一的實體。X.500 的 DN 定義了諸如 `commonName`、`organizationName` 等屬性，每個屬性都有對應的物件識別碼 (OID)。由於 X.500 過於複雜，簡化版的 LDAP 應運而生。LDAP 在 RFC 4514 中規範了應以 `CN=Jeff Smith,OU=Sales,DC=Fabrikam,DC=COM` 形式的字串來描述 DN，並在 RFC 4519 中定義了 RDN 中可能出現的屬性類型（基本沿用了 X.500 的定義）。同樣地，X.509 憑證標準也採用了 DN 作為描述憑證資訊的格式，並定義了一些必須支援的屬性，這些屬性大多來自 X.500 的定義。

## Certificate：憑證的核心內容解析

憑證的核心在於其所包含的資訊，這些資訊共同定義了憑證的身份、有效期和用途。以下我們以 Let's Encrypt 的一個中繼憑證為例，解析憑證中的重要欄位：

- **`tbsCertificate` (To Be Signed Certificate)**：這是憑證中所有待簽署的資訊，它包含了憑證的實質內容。
    - `version`: 憑證的版本號，現今基本都使用 X.509 v3 (0x2) 。

	- `Serial Number`: 由憑證簽發機構 (CA) 給定的一個唯一識別該憑證的序列號，這在憑證撤銷列表 (CRL) 中也扮演重要角色。
    
	- `Issuer`: 表示這張憑證是由哪個 CA 簽署的，例如 `CN=DST Root CA X3, O=Digital Signature Trust Co.`。
    
	- `subject`: 憑證所屬的主體，即憑證所驗證的實體，例如 `CN=Let's Encrypt Authority X3, O=Let's Encrypt, C=US`。
    
	- `validity`: 憑證的有效期限，包含起始日期 (`Not Before`) 和結束日期 (`Not After`)。例如：
        - `Not Before`: Mar 17 16:40:46 2016 GMT
        - `Not After`: Mar 17 16:40:46 2021 GMT
    
	- `subjectPublicKeyInfo`: 憑證持有者提供的公開金鑰資訊，包含金鑰的演算法（例如 `rsaEncryption (PKCS #1)`）和金鑰的實際數值。
	
    - `extensions`: 這是 X.509 v3 憑證的重要功能，透過不同的擴展提供額外的資訊和功能，例如憑證的用途、憑證鏈的相關資訊等。
- **`signatureAlgorithm` 和 `signatureValue`**：這兩部分共同構成了憑證的數位簽章。CA 機構會使用其上層憑證的私有金鑰對 `tbsCertificate` 的雜湊值進行加密，生成數位簽章。並可用上層憑證的 Public Key 驗證。
    
	- `signatureAlgorithm`: 指明用於生成數位簽章的演算法，例如 `sha256WithRSAEncryption`。
	
    - `signatureValue`: 實際的數位簽章值。

## 雜湊演算法在數位簽章中的角色

在數位簽章的生成過程中，簽署者會先對原始資料（在憑證中即為 `tbsCertificate` 的內容）計算其雜湊值，然後使用自己的私有金鑰對這個雜湊值進行加密，得到數位簽章。接收者在驗證時，則會使用簽署者的公開金鑰解密數位簽章，得到原始的雜湊值，同時也對接收到的原始資料重新計算雜湊值，如果兩個雜湊值一致，則證明資料未被篡改且確實由簽署者發出。

![Digital Signature diagram](/img/pages/understanding-digital-certificates-formats-signatures-and-verification-1747936194663.png) [Source: Digital Signature diagram.svg - Wikipedia](https://en.wikipedia.org/wiki/File:Digital_Signature_diagram.svg)


## 憑證鏈的驗證流程：

數位憑證的信任模型是建立在「信任鏈」的概念之上。當我們收到一個憑證時，必須驗證它是否由一個受信任的機構簽發。這個驗證過程涉及從目標憑證向上追溯，直到找到一個我們預先信任的根憑證。

其核心驗證步驟如下：

1. **身份匹配**：目標憑證的 `Issuer` 欄位必須與其上層憑證的 `Subject` 欄位完全匹配。這確保了憑證是由聲稱的簽發者所簽發。
    
2. **數位簽章驗證**：使用上層憑證的 `subjectPublicKeyInfo` 中包含的公開金鑰，來解密目標憑證的 `signatureValue`。解密後會得到一個雜湊值。同時，對目標憑證的 `tbsCertificate` 內容重新計算雜湊值。如果這兩個雜湊值一致，則證明目標憑證的內容未被篡改，且確實由上層憑證的私有金鑰所簽署。
![](/img/pages/understanding-digital-certificates-formats-signatures-and-verification-1747977532620.png)


這個過程會層層遞進，直到達到一個「信任錨點」(Trust Anchor)，通常是一個預先安裝在作業系統或瀏覽器中的**根憑證 (Root Certificate)**。這些根憑證是自我簽署的，它們的信任是內建的，無需進一步驗證。

## 憑證鏈中間的憑證哪裡來？

在 TLS 握手過程中，伺服器通常會提供其自身的憑證以及任何必要的中繼憑證 (Intermediate Certificates)，以便用戶端能夠建立完整的憑證鏈。然而，有時用戶端可能需要額外獲取這些中繼憑證。

X.509 憑證提供了一個名為 **Authority Information Access (AIA)** 的擴展，其中可以包含一個 URL，讓用戶端能夠下載所需的中繼憑證。

例如，當我們透過 [Qualys SSL Labs](https://www.ssllabs.com/ssltest/) 網站查看 `c2.synology.com` 的憑證資訊時：
![](/img/pages/understanding-digital-certificates-formats-signatures-and-verification-1747938104170.png)
+ 您可以看到 `c2.synology.com` 的憑證鏈中，前三個憑證是由伺服器在 TLS 握手過程中發送過來的，而最後一個則是本地信任的根 CA。第四個憑證標註為 `Extra download`。如果我們進一步解析第三個憑證的資訊，就會發現其中包含了 AIA 的資訊，指明了獲取第四個憑證的 URL：

```
Authority Information Access: 
	OCSP - URI:http://ocsp.rootg2.amazontrust.com
	CA Issuers - URI:http://crt.rootg2.amazontrust.com/rootg2.cer
```

透過這個機制，用戶端可以動態地獲取憑證鏈中缺失的部分，從而完成憑證的完整驗證。

## 交互簽名 (Cross-Signing)

在憑證信任鏈中，**交互簽名**是一種常見的機制，用於讓新興的憑證簽發機構 (CA) 所簽發的憑證能夠被廣泛信任，尤其是在其自身的根憑證尚未被所有瀏覽器和作業系統信任的情況下。

以 Let's Encrypt 為例，其[官方說明](https://letsencrypt.org/zh-tw/certificates/#%E4%BA%A4%E4%BA%92%E7%B0%BD%E5%90%8D)中提到：Let's Encrypt Authority X3 中間憑證擁有一對公開金鑰和私有金鑰。Let's Encrypt 使用這個私有金鑰來簽署所有終端憑證，也就是我們最終從 Let's Encrypt 獲得的憑證。Let's Encrypt Authority X3 中間憑證本身則是由 ISRG Root X1 根憑證所簽發。然而，ISRG Root X1 在早期尚未受到大多數瀏覽器的信任。為了解決這個問題，並使 Let's Encrypt 頒發的憑證能夠被廣泛信任，Let's Encrypt 向一個已受主流瀏覽器信任的根憑證 DST Root CA X3 請求了交互簽名。經過 DST Root CA X3 的簽名後，產生了另一個版本的 Let's Encrypt Authority X3 中間憑證。

{{< mermaid >}}
graph TD
    A[ISRG Root X1] --> C[Let's Encrypt Authority X3]
    B[DST Root CA X3] --> C
    C --> D[Server Cert]
    C --> E[Server Cert]
    C --> F[Server Cert]
{{< /mermaid >}}

### 多路徑信任鏈：彈性與兼容性

透過交互簽名機制，一個終端憑證可能不只一條有效的憑證鏈可以被驗證。這表示瀏覽器不論信任 ISRG 根憑證還是 DST Root CA X3 根憑證，都可以建立一條完整的信任鏈。接下來，我們將說明這是如何做到的。

![](/img/pages/understanding-digital-certificates-formats-signatures-and-verification-1748004705306.png)

前面提到，對於一個終端憑證而言，其上層憑證需要滿足兩個要求：

1. `Subject Name` 等於終端憑證的 `Issuer`。
    
2. 上層憑證的公開金鑰要能驗證附加在終端憑證上的數位簽章。
    

然而，這兩個要求並沒有強制規定上層憑證必須是完全相同的一張憑證，只要上層憑證的 `Subject Name` 和 `Public Key` 能夠滿足匹配和驗證條件即可。因此，實際上，像 Let's Encrypt 這樣的憑證簽發機構會準備兩張（或更多）內容相同但由不同根 CA 簽署的中繼憑證。

例如，Let's Encrypt 會將一份 CSR 分別提交給 ISRG（其自身的根 CA）和 DST Root CA X3（一個較早且廣泛信任的根 CA）進行簽署。由於簽署過程是使用這兩個根 CA 各自的私有金鑰進行的，所以最終生成的中繼憑證（例如，中繼憑證 A 和中繼憑證 B）雖然其 `Subject Name` 相同，但其內部包含的 `Signature Value` 數值會不同。

這樣一來，就會存在兩條可驗證的憑證鏈：

- **鏈一**：從 ISRG 根憑證 -> 中繼憑證 A -> 終端憑證。
    
- **鏈二**：從 DST Root CA X3 根憑證 -> 中繼憑證 B -> 終端憑證。
    

瀏覽器或作業系統只需要信任其中一張根 CA 憑證（無論是 ISRG 或 DST Root CA X3），就可以成功完成終端憑證的驗證。這種設計提供了極大的彈性與兼容性，尤其對於確保舊有系統也能信任新簽發的憑證至關重要。

## 憑證吊銷機制：

基於憑證鏈的信任機制，我們發現上層 CA 機構並沒有直接撤回已簽發憑證的能力，只能等待憑證自然過期。然而，在憑證私有金鑰洩漏、CA 機構受損或憑證資訊錯誤等緊急情況下，我們需要一種機制能夠立即撤銷憑證的有效性。為了解決這個問題，X.509 提供了兩種主要的憑證吊銷機制：**憑證撤銷列表 (Certificate Revocation List, CRL)** 和 **線上憑證狀態協定 (Online Certificate Status Protocol, OCSP)**。

- **憑證撤銷列表 (Certificate Revocation List, CRL)**：
    
    - CA 會定期發布一個列表，其中包含所有已被其撤銷的憑證 Serial Number。用戶端可以下載這個列表，並在驗證憑證時檢查目標憑證的 Serial Number 是否在列表中。
        
    - X.509 憑證中通常包含一個 **CRL Distribution Points** 擴展，它會告訴用戶端該去哪裡找到可能包含目標憑證的 CRL 列表。
        
- **線上憑證狀態協定 (Online Certificate Status Protocol, OCSP)**：
    
    - 相較於 CRL，OCSP 提供了一種更即時的憑證狀態查詢方式。用戶端會向 OCSP 伺服器發送查詢，詢問特定憑證的撤銷狀態（有效、已撤銷或未知）。
        
    - 由於 CRL 可能存在滯後性且大型 CRL 列表會消耗較多頻寬，瀏覽器通常會優先使用 OCSP 進行憑證狀態檢查。OCSP 伺服器的位址同樣可以透過憑證的 AIA 擴展獲得。
        

## 憑證的簽發：從請求到生成

了解了憑證的結構和驗證機制後，我們來看看憑證是如何被簽發的。整個流程通常始於申請人生成一個 **憑證簽署請求 (Certificate Signing Request, CSR)**。

- CSR 通常基於 **PKCS#10 (RFC 2986)** 格式，這同樣是一個透過 ASN.1 定義的資料結構，並常使用 `.csr`作為副檔名。CSR 中包含了憑證所需的各種資訊，例如憑證的主體 (Subject)、申請者的公開金鑰資訊 (`subjectPublicKeyInfo`) 等。
    
- 透過 `openssl req -newkey rsa:2048 -nodes -keyout domain.key -out domain.csr` 這樣的命令，可以同時完成私有金鑰 (`domain.key`) 和 CSR (`domain.csr`) 的生成。
    
- 由 OpenSSL 產生的 `.csr` 檔案通常也是 PEM 格式的（即 DER 編碼後再進行 Base64 編碼），其內容會被 `-----BEGIN CERTIFICATE REQUEST-----` 和 `-----END CERTIFICATE REQUEST-----` 區塊包圍。
    

```
-----BEGIN CERTIFICATE REQUEST-----
MIICijCCAXICAQAwRTELMAkGA1UEBhMCQVUxE
...
-----END CERTIFICATE REQUEST-----
```

此外，私有金鑰檔案通常遵循 **PKCS#8 (RFC 5208)** 標準。

```
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

當 CSR 被提交給 CA 後，CA 會驗證申請者的身份，然後使用其私有金鑰對 CSR 中的資訊（特別是申請者的公開金鑰和憑證主體資訊）進行數位簽章，最終形成一個完整的憑證。這個簽發完成的憑證通常會以 `.crt` 或 `.cer` 作為副檔名，儘管它們的內容通常是 PEM 格式的 X.509 憑證，也可能是未經 Base64 編碼的 DER 格式。有時，`.ca` 副檔名會用於代表中繼或根憑證，但其內容通常也是 PEM 格式的 X.509 憑證。

值得一提的是，上述提到的 **PKCS#1、PKCS#8、PKCS#10** 都是 **Public Key Cryptography Standards (PKCS)**標準的一部分，這些標準由 RSA Security LLC 制定，旨在規範公開金鑰密碼學的各種實踐。其他重要的 PKCS 標準還包括：

- **PKCS#12**：用於將憑證（`.crt`）和其對應的私有金鑰（`.key`）封裝到一個單一檔案中，通常使用 `*.pfx`或 `*.p12` 副檔名，方便攜帶和部署。
    
- **PKCS#7**：用於加密、簽章和傳輸資料。CA 有時會使用 PKCS#7 將中繼憑證和簽署後的目標憑證打包成 `.p7b` 或 `.p7c` 檔案交付給申請者。
    

## 憑證，TLS 連線與 Domain Name：

當我們透過瀏覽器訪問一個網域並建立 TLS 連線時，確保憑證的合法性至關重要。那麼，網域名稱是如何與憑證關聯起來的呢？

早期，憑證主要透過 `subject` 欄位中的 **Common Name (CN)** 來對應網域。例如，如果 `github.com` 的憑證 `subject` 是 `CN=github.com`，那麼這個憑證就可以用來驗證該網域的有效性。

然而，使用 CN 的問題在於它只能標記一個網域名稱，並且在格式上存在一定的限制。為了解決這個問題，X.509 v3 引入了 **Subject Alternative Name (SAN) 擴展**。透過 `subjectAltName` 欄位，憑證可以標記多個網域名稱，也支援電子郵件地址、IP 位址、URI 等多種格式。例如，`github.com` 的憑證在 `subjectAltName` 中可能同時標註了 `github.com` 和 `www.github.com`，這使得該憑證能夠同時驗證這兩個網域的有效性。SAN 擴展極大地提升了憑證的靈活性和實用性。

此外，雖然 RFC 5280 並未明確定義萬用字元（wildcard）的使用，但在實際應用中，我們通常可以使用 `*.xxxx.xxx` 這樣的格式來代表所有子網域，這就是所謂的萬用字元憑證 (Wildcard Certificate)。

## 其他重要的憑證擴展

除了上述提到的擴展外，X.509 憑證還包含許多其他重要的擴展，它們定義了憑證的行為和約束：

- **Basic Constraints Extension**：這個擴展透過 `cA` (boolean) 欄位來控制憑證是否能夠作為 CA 憑證，即是否能夠簽發下一層憑證。如果 `cA` 為 `TRUE`，則該憑證是一個 CA 憑證；如果為 `FALSE`，則它是一個實體憑證，不能用於簽發其他憑證。
    
- **Name Constraints Extension**：這個擴展通常出現在 CA 憑證中，它可以限制該 CA 憑證能夠簽發的下一層憑證必須屬於特定的網域或 IP 範圍。這對於建立更精細的信任策略和防止 CA 誤發憑證非常有用。
    
- **Key Usage Extension**：這個擴展定義了憑證中公開金鑰的特定用途，例如用於數位簽章、金鑰加密、憑證簽章等。
    
- **Extended Key Usage Extension**：這個擴展進一步定義了憑證的特定應用程式用途，例如用於伺服器認證 (TLS/SSL 伺服器)、客戶端認證 (TLS/SSL 客戶端)、程式碼簽章等。
    

## 自簽憑證 (Self-Signed Certificates)

根憑證本質上是一種**自簽憑證**。自簽憑證是由其自身私有金鑰簽署的憑證，這意味著它的 `Issuer` 和 `Subject`欄位是相同的。
![](/img/pages/understanding-digital-certificates-formats-signatures-and-verification-1747978725828.png)

## 憑證安全機制：憑證固定與憑證透明度

為了進一步增強憑證的安全性，業界還發展出了一些更高級的機制：

- **憑證固定 ( Certificate Pinning )**：這是一種安全機制，應用程式（例如行動應用程式）會預先「記住」或「固定」其預期伺服器憑證的公開金鑰或其雜湊值。當應用程式連接到伺服器時，它不僅會驗證憑證鏈，還會檢查伺服器提供的憑證是否與其預先固定的金鑰匹配。如果憑證鏈有效但金鑰不匹配，連線將被拒絕。這有助於防範惡意的中繼憑證攻擊。
    
- **憑證透明度 (Certificate Transparency, CT)**：CT 是一種公開日誌系統，要求所有新簽發的憑證都必須被記錄在公開可審計的日誌中。瀏覽器和其他用戶端可以檢查這些日誌，以確保其所信任的 CA 沒有錯誤地或惡意地簽發憑證。這增加了憑證簽發過程的透明度，有助於及早發現和糾正問題憑證。
    

## 結語

從底層的 ASN.1 編碼與 PEM/DER 格式，到 X.509 標準定義的憑證結構，以及關鍵的憑證鏈驗證、吊銷機制，乃至於憑證簽發的流程與各種擴展，這些知識對於任何涉及網路安全、系統管理或軟體開發的工程師都至關重要。掌握這些技術細節，不僅能更好地排查問題、設計更安全的系統，也能在面對複雜的憑證議題時，具備更強的分析與解決能力。