#!/usr/bin/env python3
# Bắt lớp lỗi "dùng component/hàm mà quên import" — Vite build KHÔNG bắt (tham chiếu
# biến thiếu = hợp lệ cú pháp, nổ ở runtime). Chính là bug "Sơ đồ xử lý crash" 10/07.
# In ra danh sách component JSX viết hoa được DÙNG mà không có nguồn (import/định nghĩa).
import re
import sys

s = open("web/src/App.jsx", encoding="utf-8").read()
head = s[: s.index("function SectionTitle")]          # vùng import (đa dòng)

dung = set(re.findall(r"<([A-Z][A-Za-z0-9]+)[\s/>]", s))  # thành phần JSX viết hoa

def co_nguon(sym):
    # import trải nhiều dòng ⇒ tìm TỪ trong cả head; hoặc định nghĩa cục bộ
    if re.search(r"\b" + re.escape(sym) + r"\b", head):
        return True
    return bool(re.search(r"(function|const|class)\s+" + re.escape(sym) + r"\b", s))

BUILTIN = {"React", "Fragment"}
thieu = [c for c in sorted(dung) if c not in BUILTIN and not co_nguon(c)]
print(",".join(thieu))
