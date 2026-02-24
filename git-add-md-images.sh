#!/usr/bin/env bash
set -euo pipefail

MD_FILE="$1"

if [[ ! -f "$MD_FILE" ]]; then
  echo "Markdown file not found: $MD_FILE" >&2
  exit 1
fi

# 解析 Markdown 中的圖片路徑
# 支援 ![](path) 與 ![alt](path)
grep -oE '!\[[^]]*]\([^)]*\)' "$MD_FILE" \
  | sed -E 's/.*\(([^)]+)\).*/\1/' \
  | while read -r img_path; do
      # 只處理 /img/... 開頭的圖片
      if [[ "$img_path" == /img/* ]]; then
        real_path="static${img_path}"
        if [[ -f "$real_path" ]]; then
          echo "git add $real_path"
          git add "$real_path"
        else
          echo "WARNING: image not found: $real_path" >&2
        fi
      fi
    done
