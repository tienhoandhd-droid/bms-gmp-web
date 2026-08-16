#!/usr/bin/env python3
# Bắt lớp lỗi "dùng component/hàm mà quên import" — Vite build KHÔNG bắt (tham chiếu
# biến thiếu = hợp lệ cú pháp, nổ ở runtime). Chính là bug "Sơ đồ xử lý crash" 10/07.
#
# 17/08/2026: App.jsx đã tách thành app/ + features/ + components/ (đại tu UI P0+P1)
# → quét TOÀN BỘ web/src/**/*.jsx thay vì mỗi App.jsx. Mỗi file: component JSX viết
# hoa được DÙNG phải có nguồn ngay trong file (import hoặc định nghĩa cục bộ).
# Thiếu → in danh sách và exit 1 (chặn deploy).
import re
import glob
import sys

BUILTIN = {"React", "Fragment"}

def kiem_file(path):
    s = open(path, encoding="utf-8").read()
    # Bỏ comment trước khi dò cách DÙNG (kẻo <Chart …> trong chú thích thành dương giả);
    # phần định nghĩa/import dò trên bản gốc.
    khong_cmt = re.sub(r"/\*[\s\S]*?\*/|(?<![:\\w])//[^\n]*", "", s)
    dung = set(re.findall(r"<([A-Z][A-Za-z0-9]+)[\s/>]", khong_cmt))
    if not dung:
        return []
    # Câu import có thể trải nhiều dòng → gom non-greedy tới chuỗi nguồn.
    imports = "\n".join(re.findall(r"import[\s\S]*?from\s*['\"][^'\"]+['\"]", s))

    def co_nguon(sym):
        if re.search(r"\b" + re.escape(sym) + r"\b", imports):
            return True
        # định nghĩa cục bộ HOẶC destructuring đổi tên ({ icon: Icon }) HOẶC tham số
        if re.search(r"(function|const|class)\s+" + re.escape(sym) + r"\b", s):
            return True
        return bool(re.search(r":\s*" + re.escape(sym) + r"\b", s))

    return [c for c in sorted(dung) if c not in BUILTIN and not co_nguon(c)]

loi = 0
for path in sorted(glob.glob("web/src/**/*.jsx", recursive=True)):
    thieu = kiem_file(path)
    if thieu:
        print(f"{path}: THIẾU NGUỒN → {', '.join(thieu)}")
        loi += len(thieu)
print("OK — mọi component JSX đều có nguồn" if loi == 0 else f"✗ {loi} component thiếu nguồn import/định nghĩa")
sys.exit(1 if loi else 0)
