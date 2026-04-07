# ⚠️ Hướng dẫn Encoding — Tránh lỗi UTF-8

> **Bài học rút ra từ sự cố 2026-04-07**: Toàn bộ file `callbacks.ts` và `group.ts` bị corrupt encoding tiếng Việt, khiến bot hiển thị sai ("hềEsơ" thay vì "hồ sơ") và deploy thất bại liên tục.

---

## 1. Nguyên nhân gốc

Commit `c1ab443` đã ghi file `.ts` chứa tiếng Việt bằng **encoding sai** (không phải UTF-8 thuần). Kết quả:

| Đúng (UTF-8) | Bị corrupt |
|---|---|
| `hồ sơ` | `hềEsơ` |
| `❌ Huỷ bỏ` | `❁EHuỷ bềE` |
| `⚠️` | `â️EE` |
| `mở KT` | `mềEKT` |

Byte `0x81` (invalid UTF-8 continuation) xuất hiện khắp nơi, phá vỡ:
- **Deno parser** → deploy fail (`Expression expected`)
- **Telegram Bot API** → hiển thị ký tự rác trên Telegram

---

## 2. Quy tắc BẮT BUỘC khi sửa file `.ts` chứa tiếng Việt

### ❌ KHÔNG BAO GIỜ dùng

```powershell
# PowerShell Set-Content / Get-Content KHÔNG an toàn cho UTF-8 tiếng Việt!
Set-Content "file.ts" -Value $content          # ❌ Dùng encoding mặc định (cp932/cp1252)
$content | Out-File "file.ts"                  # ❌ Thêm BOM, có thể đổi encoding  
Get-Content "file.ts" -Raw | ... | Set-Content # ❌ Round-trip KHÔNG bảo toàn UTF-8
```

### ✅ Cách đúng

**Option A: Dùng Python (khuyến nghị)**
```python
# Đọc
with open('file.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Sửa
content = content.replace('old', 'new')

# Ghi (giữ LF, không BOM)
with open('file.ts', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
```

**Option B: Dùng .NET trong PowerShell**
```powershell
# Đọc bytes → decode UTF-8
$bytes = [System.IO.File]::ReadAllBytes("file.ts")
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Sửa
$text = $text.Replace("old", "new")

# Ghi lại UTF-8 KHÔNG BOM
[System.IO.File]::WriteAllBytes("file.ts", [System.Text.Encoding]::UTF8.GetBytes($text))
```

**Option C: Dùng `replace_file_content` tool (cho AI agent)**
- Tool này tự xử lý encoding đúng
- CHỈ dùng khi file KHÔNG có ký tự Unicode bị lỗi sẵn

---

## 3. Quy trình kiểm tra trước khi commit

### Bước 1: Verify UTF-8 hợp lệ
```python
# Chạy trước mỗi commit thay đổi file .ts
python -c "
import glob
for f in glob.glob('supabase/functions/**/*.ts', recursive=True):
    try:
        open(f, 'r', encoding='utf-8').read()
        print(f'{f}: ✅ OK')
    except UnicodeDecodeError as e:
        print(f'{f}: ❌ CORRUPT at pos {e.start}')
"
```

### Bước 2: Kiểm tra string syntax (cho Deno parser)
```python
# Đặc biệt quan trọng cho inline keyboard text
python -c "
for f in ['supabase/functions/telegram-bot/handlers/callbacks.ts',
          'supabase/functions/telegram-bot/handlers/group.ts']:
    lines = open(f, 'r', encoding='utf-8').readlines()
    for i, line in enumerate(lines, 1):
        s = line.strip()
        if 'text:' in s and \"'\" in s:
            sq = s.count(\"'\") - s.count(\"\\\\\\\\\'\")
            if sq % 2 != 0:
                print(f'{f}:{i} ❌ Odd quotes ({sq}): {s[:80]}')
    print(f'{f}: quote check done')
"
```

---

## 4. Cách khắc phục khi file ĐÃ BỊ corrupt

```bash
# 1. Tìm commit sạch cuối cùng
git log --oneline -- path/to/file.ts

# 2. Checkout bản sạch
git checkout <clean_sha> -- path/to/file.ts

# 3. Apply lại logic changes bằng Python (KHÔNG dùng PowerShell)
python fix_script.py

# 4. Verify
python -c "open('path/to/file.ts','r',encoding='utf-8').read(); print('OK')"

# 5. Commit
git add path/to/file.ts
git commit -m "fix: restore clean UTF-8 + apply changes"
```

---

## 5. Danh sách file nhạy cảm (chứa tiếng Việt)

| File | Nội dung tiếng Việt |
|---|---|
| `supabase/functions/telegram-bot/handlers/callbacks.ts` | Inline keyboard text, error messages |
| `supabase/functions/telegram-bot/handlers/group.ts` | Menu buttons, notification text |
| `supabase/functions/telegram-bot/handlers/private.ts` | Private chat responses |
| `supabase/functions/telegram-bot/config.ts` | Label constants |

---

## 6. Commit sạch để reference

| Commit | Ngày | Mô tả |
|---|---|---|
| `8fed8a1` | Pre-corruption | Tất cả handler files valid UTF-8 |
| `6117daf` | 2026-04-08 | Rebuild từ clean base + tu_van logic |

---

> **TL;DR**: Luôn dùng Python hoặc `[System.IO.File]` để sửa file `.ts` chứa tiếng Việt. KHÔNG BAO GIỜ dùng `Set-Content` / `Out-File` PowerShell.
