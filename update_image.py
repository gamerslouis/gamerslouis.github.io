import os
import re
import hashlib
import shutil
import argparse

# 計算檔案的 MD5 值
def calculate_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

# 處理 Markdown 檔案
def process_markdown(file_path, img_dir, img_url_base):
    # 確保目標目錄存在
    os.makedirs(img_dir, exist_ok=True)
    
    # 讀取 Markdown 文件
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 正則表達式匹配圖片連結 ![alt text](image_path)
    pattern = r"!\[([^\]]*)\]\(([^)]+\.png)\)"
    updated_content = content

    for match in re.finditer(pattern, content):
        alt_text, image_path = match.groups()

        # 確認圖片是否在與 Markdown 檔案相同目錄下
        if not os.path.isabs(image_path):
            image_path = os.path.join(os.path.dirname(file_path), image_path)

        if os.path.isfile(image_path):
            # 計算 MD5 並生成新檔案名
            md5_hash = calculate_md5(image_path)
            new_file_name = f"{md5_hash}.png"
            new_file_path = os.path.join(img_dir, new_file_name)

            # 移動圖片到目標目錄
            shutil.move(image_path, new_file_path)

            # 更新 Markdown 內容中的圖片路徑
            new_image_url = f"{img_url_base}/{new_file_name}"
            updated_content = updated_content.replace(
                match.group(0), f"![]({new_image_url})" if alt_text == "alt text" else f"![{alt_text}]({new_image_url})"
            )

    # 將更新後的內容寫回檔案
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print("Markdown 文件已處理完成！")

if __name__ == "__main__":
    # 解析命令列參數
    parser = argparse.ArgumentParser(description="處理 Markdown 檔案中的圖片連結")
    parser.add_argument("markdown_file", help="Markdown 檔案路徑")
    args = parser.parse_args()

    markdown_file = os.path.join(os.getcwd(), args.markdown_file)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    process_markdown(markdown_file, img_dir="static/img/pages", img_url_base="/img/pages")
