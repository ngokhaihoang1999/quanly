# ⚠️ Hướng dẫn Encoding — Tránh lỗi UTF-8

> **Bài học rút ra từ sự cố 2026-04-07 và 2026-04-28**: 
> - **2026-04-07**: File `callbacks.ts` và `group.ts` bị corrupt encoding tiếng Việt do PowerShell `Set-Content`.
> - **2026-04-28**: File `index.html` bị corrupt (213 bytes `0x81`) do round-trip qua Windows cp932/Shift-JIS. **CẢNH BÁO**: Việc viết script sửa lỗi `0x81` chung chung đã vô tình làm hỏng `records.js` vì file này vốn đang là UTF-8 hợp lệ và `0x81` là một byte hợp lệ trong mã hóa UTF-8 của tiếng Việt (vd: `ề` là `\xe1\xbb\x81`).

---

## 1. Nguyên nhân gốc

### Lỗi từ PowerShell (2026-04-07)
Dùng lệnh PowerShell xử lý file chứa tiếng Việt bằng **encoding sai** (không phải UTF-8 thuần). Kết quả:
| Đúng (UTF-8) | Bị corrupt |
|---|---|
| `hồ sơ` | `hềEsơ` |
| `❌ Huỷ bỏ` | `❁EHuỷ bềE` |

### Lỗi Round-trip qua cp932/Shift-JIS (2026-04-28)
Quá trình đọc/ghi qua công cụ không hỗ trợ tốt UTF-8 trên Windows đã biến các sequence UTF-8 nhiều byte thành ký tự rác chứa byte `0x81`. 

### Lỗi "Chữa Lợn Lành Thành Lợn Què" (2026-04-28)
Byte `0x81` (thường xuất hiện trong lỗi) **CŨNG LÀ MỘT BYTE HỢP LỆ** trong mã hóa UTF-8. 
Ví dụ: 
- `ề` = `\xe1\xbb\x81`
- `ổ` = `\xe1\xbb\x95` (có thể không chứa 0x81, nhưng các ký tự tương tự có thể chứa).
Khi thấy `index.html` bị lỗi `0x81`, một script tự động thay thế `0x81` đã được chạy trên **cả** `records.js` (file vốn đang bình thường). Điều này làm hỏng toàn bộ chuỗi string tiếng Việt trong file JS (vd: `"Lập Group"` biến thành chứa emoji `\xef\xb8\x8f`).

Hơn nữa, một số tag HTML cơ bản trong `index.html` đã bị mã hóa sai khi có ký tự `E`, làm vỡ cấu trúc DOM (white screen):
- `⚙︁E/button>` → `⚙️</button>`
- `Đơn vềE/span>` → `Đơn vị</span>`
- `TāE/span>` → `Nhân sự</span>` (Tổ)
- `Tất cả TāE/div>` → `Tất cả Nhân sự</div>`
- `✁E/div>` → `⚡</div>`
- `Chưa mềEKT` → `Chưa mở KT`

---

## 2. Quy tắc BẮT BUỘC khi sửa file chứa tiếng Việt

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
with open('file.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Sửa
content = content.replace('old', 'new')

# Ghi (giữ LF, không BOM)
with open('file.js', 'w', encoding='utf-8', newline='') as f:
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
- Tool này tự xử lý encoding đúng.
- CHỈ dùng khi file KHÔNG có ký tự Unicode bị lỗi sẵn.

---

## 3. Quy trình kiểm tra trước khi can thiệp hàng loạt

### Bước 1: Verify UTF-8 có hợp lệ không TRƯỚC KHI sửa
Đừng bao giờ chạy regex sửa byte rác lên một file nếu chưa xác nhận nó bị corrupt.

```python
# Kiểm tra file có phải là UTF-8 hợp lệ không
try:
    with open('mini-app/records.js', 'rb') as f:
        f.read().decode('utf-8')
    print("VALID UTF-8 - KHÔNG ĐƯỢC CHẠY SCRIPT FIX ENCODING LÊN ĐÂY")
except UnicodeDecodeError as e:
    print(f"CORRUPT tại vị trí {e.start}")
```

### Bước 2: Kiểm tra string syntax (cho JS/TS parser)
```python
# Kiểm tra nhanh syntax lỗi do string literals bị phá vỡ (đặc biệt trong file JS)
import subprocess
subprocess.run(['node', '--check', 'mini-app/records.js'])
```

---

## 4. Cách khắc phục khi file ĐÃ BỊ corrupt

```bash
# 1. Tìm commit sạch cuối cùng
git log --oneline -- path/to/file.ext

# 2. Xem file sạch (không ghi đè vội nếu muốn copy logic mới)
git show <clean_sha>:path/to/file.ext > file_clean.ext

# 3. NẾU file chỉ lỗi encoding mà logic KHÔNG ĐỔI, hãy phục hồi từ git!
git checkout <clean_sha> -- path/to/file.ext

# 4. Nếu bắt buộc phải sửa byte rác bằng Python:
# -> Chỉ target vào CÁC BYTE KHÔNG HỢP LỆ, không replace bừa bãi `\x81`.
```

---

## 5. Danh sách file nhạy cảm (chứa nhiều tiếng Việt)

| File | Nội dung tiếng Việt |
|---|---|
| `mini-app/index.html` | UI Text, Labels |
| `mini-app/records.js` | Messages, Notifications, Constants |
| `supabase/functions/telegram-bot/handlers/*.ts` | Inline keyboard text, error messages |
| `supabase/functions/telegram-bot/config.ts` | Label constants |

---

---

## 6. Phòng ngừa tự động (Prevention)

Để đảm bảo không bao giờ xảy ra lỗi này một lần nữa, dự án đã có script validation:

### Chạy script kiểm tra encoding
Mỗi khi sửa file hoặc trước khi commit, hãy chạy:
```bash
python scripts/check_encoding.py
```

### Script này làm gì?
1. Kiểm tra xem tất cả các file `.html`, `.js`, `.ts`, `.md` có phải là UTF-8 hợp lệ không.
2. Tìm kiếm các pattern "Shift-JIS corruption" đặc trưng như `ềE`, `āE`, hoặc các tag HTML bị vỡ (`E/span>`, `E/div>`).
3. Nếu phát hiện lỗi, script sẽ báo lỗi và dừng quá trình (exit code 1), giúp ngăn chặn việc push code hỏng lên server.

---

> **TL;DR**: 
> 1. Luôn dùng Python hoặc `[System.IO.File]` để sửa file chứa tiếng Việt. KHÔNG BAO GIỜ dùng `Set-Content` / `Out-File` PowerShell.
> 2. Byte `0x81` CÓ THỂ là rác, CÓ THỂ là một phần của UTF-8 hợp lệ. Đừng replace bừa bãi! Hãy check `decode('utf-8')` trước.
> 3. Chạy `python scripts/check_encoding.py` thường xuyên.

