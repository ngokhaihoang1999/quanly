# Mini App - Tai lieu ky thuat

## Tong quan

Loai: Single Page Application (Vanilla HTML/CSS/JS - khong framework)
Mo qua: Telegram WebApp button tu Bot /start
URL: https://ngokhaihoang1999.github.io/quanly/mini-app/index.html

---

## Cau truc module

```
mini-app/
  index.html       - HTML template
  styles.css       - CSS design system, dark/light theme
  core.js          - Init, sbFetch, helpers, globals, semester, viewAs
  dashboard.js     - Tab Don vi & Ca nhan: metrics, sub-unit tree
  profiles.js      - Chi tiet ho so, renderProfiles, saveInfoSheet
  hapja.js         - Phieu Check Hapja: tao, duyet, tu choi
  records.js       - Chot TV/BB/Center, Bao cao TV/BB, Undo/Revert
  calendar.js      - Lich events, phan phoi su kien
  notification.js  - Thong bao real-time qua Telegram
  priority.js      - Uu tien tasks (tu dong + scope)
  reports.js       - Bao cao so lieu truyen dao (4 module)
  reports.css      - CSS cho tab Bao cao
  staff.js         - Tab TD: danh sach, dang ky moi
  structure.js     - Tab Co cau: tree view, quan ly KV/Nhom/To
  transitions.js   - Motion system: card blink, tab ghost, swipe, countUp
  lacie.js         - AI persona "Lacie" - Enneagram chat
  mindmap.js       - AI Mindmap + AI Chat (OpenAI gpt-4.1-mini)
  webhook.js       - Live-Mirror dong bo qua Google Sheets
  avatar.js        - Avatar animated, personalization panel
  sinka.js         - The hoc vien (Sinka): form + export Word
  notes.js         - Ghi chu ca nhan (personal notes tab)
  pin.js           - PIN lock screen
  dkbb.js         - Dang ky BB / BB milestone logic
  strategy.js      - Tab Chien luoc: ke hoach TV/BB (cl_* fields)
  desktop.js       - Desktop 3-panel layout engine (Left/Center/Right)
  mm.html          - Mindmap embed (share view)
  mm-s.html        - Mindmap embed (compact)
```

---

## 6 Tab chinh (thu tu tuy chinh duoc)

| Tab | ID | Noi dung |
|-----|----|----------|
| Don vi | tab-unit | Metrics don vi, sub-unit tree (Nhom/To/Trai), Hapja |
| Ca nhan | tab-personal | Metrics ca nhan, danh sach trai cua toi |
| Uu tien | tab-priority | Tasks can xu ly ngay (tu dong + scope) |
| Lich | tab-calendar | Lich cac buoi TV/BB, su kien |
| Ghi chu | tab-notes | Ghi chu ca nhan, link ho so, alarm |
| Bao cao | tab-reports | Canh bao, pheu chuyen doi, xu huong, hieu suat NDD |
| TD | tab-staff | Danh sach nhan su, dang ky moi |
| Co cau | tab-structure | Tree view: Khu vuc > Nhom > To > Thanh vien |

---

## Giai doan (Phase) & Timeline

### Thu tu giai doan (QUAN TRONG)
chakki -> tu_van_hinh -> tu_van -> bb -> center

### Chi tiet:
1. chakki: Tiep can, Hapja, TV lan 1
2. tu_van_hinh: Chot TV lan 2+, TV tiep theo
3. tu_van: Lap group TV-BB, tim GVBB, bat dau day BB (truoc mo KT)
4. bb: Sau mo KT, tiep tuc BB
5. center: Chot Center, hoan thanh

### Chuyen phase:
- Duyet Hapja -> tao ho so (phase = chakki)
- Chot TV lan 2 -> tu_van_hinh
- Lap group TV-BB -> tu_van (tao group Telegram, tim GVBB)
- Mo KT -> bb (chon buoi BB da mo KT)
- Chot Center -> center

### Events tren timeline (bang records)
| record_type | Hien thi | Mo ta |
|-------------|:--------:|-------|
| tu_van | Yes | Bao cao TV lan N |
| bien_ban | Yes | Bao cao BB buoi N |
| chot_bb | Yes | Event Lap group TV-BB |
| chot_center | Yes | Event Chot Center |
| mo_kt | Yes | Event Mo Kinh thanh |
| bai_dac_biet | Yes | BB Milestone: Bai dac biet (split-row linked BB session) |
| pv_gvbb | Yes | BB Milestone: Phong van GVBB |
| dky_center | Yes | BB Milestone: Dang ky Center |
| pv_hs | Yes | BB Milestone: PV HS — gate for Chot Center |
| note | No | Ghi chu nhanh |
| ai_mindmap | No | Cache AI Mindmap |
| ai_chat | No | Lich su AI Chat |

---

## Ho so Trai qua - Profile Detail

### Unified Card
Avatar (gradient tuy chinh) + Ten + Badges (phase, status, KT) + Roles
Drop-out hien ly do, Alive hien nam sinh

### Tab ben trong ho so
| Tab | Noi dung |
|-----|----------|
| Thong tin | Form 23 muc hanh chinh (form_hanh_chinh) |
| Giai doan | Dong thoi gian, Chot TV/BB/Center, BB Milestones, Bao cao, Undo |
| TV | Bao cao Tu van (record_type=tu_van) |
| BB | Bao cao BB (record_type=bien_ban) |
| Ghi chu | Ghi chu nhanh (record_type=note) |
| Tu Duy | 3 sub-tabs: Chien luoc / Thong tin co ban / Ho tro BB |
| The hoc vien | Form Sinka (phase bb/center, NDD/GVBB/fullEdit) |

---

## Bao cao - Template fields

### Bao cao Tu van (7 truong)
1. Lan thu
2. Ten cong cu tu van
3. Ket qua test cong cu
4. Van de / Nhu cau / Thong tin khai thac duoc
5. Phan hoi / Cam nhan cua trai sau tu van
6. Diem hai trai
7. De xuat cua TVV

### Bao cao BB (8 truong)
1. Buoi thu
2. Noi dung buoi hoc
3. Phan ung cua HS trong va sau buoi hoc
4. Khai thac moi ve HS
5. Tuong tac voi HS dang chu y
6. De xuat huong cham soc tiep theo
7. Buoi gap tiep theo (DD/MM/YYYY HH:mm)
8. Noi dung buoi tiep theo

---

## Undo / Revert logic
- Hoan tac giai doan: xoa cascade tat ca bao cao cua phase do + event chot
  - BB -> Tu van: Xoa Mo KT + Group BB + Record BB
  - Tu van -> TV Hinh: Xoa event Lap Group TV-BB
  - TV Hinh -> Chakki: Xoa tat ca consultation sessions (TV)
- Xoa bao cao: chi xoa record moi nhat cua phase hien tai
- Khong cho xoa: bao cao phase truoc khi da len phase sau

---

## Ky Khai Giang (Semester)
- Nhom cac trai qua vao tung dot Khai Giang (VD: T05.2026)
- Filter dashboard/profiles/hapja theo ky
- Chuyen ky cho tung ho so qua tag KG trong summary card

---

## Ca nhan hoa (Personalization)
- Mau chu dao: 10 preset + HEX/HSL/RGB tu chinh
- Thu tu tab: keo len/xuong, an/hien
- Avatar ho so: 12 gradient preset + tuy chon 2 mau + goc
- Luu vao: staff.preferences (JSONB) va profiles.avatar_color (TEXT)

---

## AI Features
- AI Mindmap: 6 nhanh phan tich (Tong quan, Van de, Diem hai, KT, Chien luoc, Hanh dong)
- AI Chat (Lacie): persona Enneagram 2w5/8, phan tich ho so
- API: OpenAI gpt-4.1-mini qua ai-proxy Edge Function

---

## Chia se Ho so (Share Profile)

Nut 📤 (SVG icon 3 node) tren Profile Detail card. Mo bottom-sheet modal:

### Phuong thuc 1: Gui toi TD trong he thong
- Tim kiem theo ma TD, ten, nickname (autocomplete)
- Chon nhieu TD (chip tags xoa duoc)
- Gui notification qua `createNotification()` (type: `chot_tv`)
- Nhan bao thong bao trong tab 🔔
- Nhan bam thong bao → mo ho so qua `openProfileById()`

### Phuong thuc 2: Sao chep link
- Deep link format: `https://t.me/quanlyhcm_bot/app?startapp=PROFILE_UUID`
- Copy rich text (HTML hyperlink) tren mobile
- Copy plain text (ten + link) tren desktop fallback
- Link mo thang Mini App trong Telegram → parse startapp → openProfileById()
- KHONG lo URL GitHub repo (bao mat)

### Luu y ky thuat
- `_shareSelectedStaff[]` luu danh sach TD da chon
- `window._shareProfileName` luu ten ho so dang chia se (tranh loi escape)
- Copy: ClipboardItem API (desktop) → execCommand contentEditable (mobile) → textarea fallback
- SVG share icon: `<circle>` + `<line>` giong icon share 3 cham

---

## Ca nhan hoa Chi tiet (Personalization v2)

### Emoji Picker
- 8 danh muc: 😀 Mat cuoi, 👋 Con nguoi, 🐶 Dong vat, 🍎 Do an, ⚽ The thao, 🚗 Phuong tien, ❤️ Bieu tuong, 🌍 Co & Quoc gia
- Tim kiem nhanh
- Grid layout 8 cot
- Luu vao `staff.preferences.emoji`

### Avatar Background
- 12 gradient preset (duong cheo 135deg)
- Custom 2-color picker (mau 1 + mau 2)
- Luu vao DB: `staff.staff_avatar_color` (text, vi du: `linear-gradient(135deg, #ff6b6b, #ee5a24)`)
- Hien thi tren: profile card, staff card, avatar nho

### So truong Jondo
- Truoc day goi la "Motto"
- Placeholder: "Tu van, Giao vien BB, Ket noi..."
- Luu vao `staff.preferences.motto`
- Hien thi tren staff card voi icon 💪

---

## Bao cao So lieu (Reports Tab)

Tab "📊 Bao cao" — chi hien cho GYJN tro len (scope >= team).
Tu dong scope theo don vi cua nguoi dung.
File: `reports.js` + `reports.css`

### 4 Module:

| Module | Noi dung |
|--------|----------|
| Canh bao som | Trai ngu dong (>14 ngay), ket phase (>30 ngay), Hapja pending lau, thieu TVV/GVBB |
| Pheu chuyen doi | Funnel: Hapja -> TV Hinh -> Group TV -> BB -> Center, ty le chuyen doi |
| Xu huong (3 thang) | Bar chart: Hapja duyet, BC BB, Mo KT theo thang |
| Hoat dong NDD | Bang: alive/dropout/ngu dong, phan bo phase (mini-bar) |

### Du lieu su dung:
- `fruit_roles` (scope NDD) -> `profiles` (phase, status)
- `check_hapja` (Hapja approved/pending)
- `records` (tu_van, bien_ban, mo_kt)
- `consultation_sessions` (phien chot TV)

### Phan quyen:
| Chuc vu | Scope |
|---------|-------|
| Admin/YJYN | Toan he thong |
| TJN | Nhom minh |
| GYJN/BGYJN | To minh |
| TD | Khong thay tab |

---

## Motion System (transitions.js)

He thong animation GPU-only. Chi dung `transform` + `opacity` (khong animate layout properties).
Tu dong tat khi `prefers-reduced-motion: reduce` hoac FPS < 30.

### 7 Module:

| Module | Mo ta |
|--------|-------|
| MotionPrefs | Detect reduced-motion, do FPS, expose `canAnimate()` |
| ProfileTransition | Card blink + scroll restoration khi open/close profile |
| TabIndicator | Ghost slide: accent rect truot tu tab cu -> tab moi, fade out |
| SwipeHandler | Vuot trai/phai chuyen tab (pointer events + rAF) |
| countUp | Dem so tu 0 len gia tri thuc (dashboard stats) |
| crossfadeContent | Skeleton -> content fade-in muot |
| navSlide | Directional slide trai/phai theo huong chuyen tab |

### Profile Transition (Card Blink)
- Click profile card -> card pulse (scale 0.96 + accent glow) -> detail fade-in
- Quay lai -> detail fade-out -> scroll restore -> card blink accent glow
- Save/restore: window.scrollY + panelCenter.scrollTop + mainContent.scrollTop
- Card off-screen: tu dong scrollIntoView({ block: 'center' })
- Tab styling KHONG bi suppress -> text/icon luon visible

### Ghost Tab Indicator
- div.tab-ghost (z-index: 0) nam SAU tab (z-index: 1)
- Khi chuyen tab: ghost hien o vi tri tab cu -> slide sang tab moi -> fade out
- Tab's .active styling KHONG BAO GIO bi thay doi
- Ap dung: #mainTabBar, .form-tabs, .dash-mode-toggle

### Swipe Gesture
- Pointer events (tuong thich ca touch + mouse)
- Threshold: |deltaX| > 50px AND |deltaX| > |deltaY| * 2
- rAF throttle: 1 DOM update / frame
- touch-action: pan-y (cho phep scroll doc binh thuong)
- Trong detail view: swipe chuyen form tabs
- Ngoai detail view: swipe chuyen main tabs
- Khong activate tren: input, textarea, select, modal, tab-bar

### Tich hop:
- core.js: switchMainTab() + switchFormTab() goi TabIndicator.moveTo() + navSlide()
- core.js: backToList() goi ProfileTransition.close()
- profiles.js: openProfile(p, cardEl) goi ProfileTransition.open()
- profiles.js: renderProfileCard -> data-pid attribute cho card blink
- dashboard.js: countUp() cho .dash-stat .num sau khi render

---

## BB Milestones (Phase BB Gate)

4 milestone trung gian trong Phase BB, phai hoan thanh truoc khi Chot Center:

| # | record_type | Hien thi | Link BB session? |
|---|-------------|----------|:---:|
| 1 | bai_dac_biet | Bai dac biet | Yes (chon buoi BB) |
| 2 | pv_gvbb | PV GVBB | No |
| 3 | dky_center | DKy Center | No |
| 4 | pv_hs | PV HS | No |

- Nut "Chot Center" CHI hien khi co record `pv_hs`
- 4 milestone la independent (order khong bat buoc)
- Data model: dung bang `records` hien co (khong tao bang moi)
- Toggle: bam milestone button -> tao/xoa record
- Timeline: hien o cot trai (major event), bai_dac_biet dung split-row

---

## Tab Chien Luoc (strategy.js)

Tab "Tu Duy" trong Profile Detail co 3 sub-tabs:

| Sub-tab | Hien khi | File |
|---------|----------|------|
| Chien luoc | Moi phase (default) | strategy.js |
| Thong tin co ban | Moi phase | mindmap.js |
| Ho tro BB | Tu tu_van tro len | mindmap.js |

Data model: du lieu cl_* keys luu trong form_hanh_chinh.data (JSONB)

5 Sections chien luoc:
1. Boi canh & Concept (cl_concept, cl_cach_quen, cl_kho_khan, cl_diem_hai_du_kien, cl_rao_can)
2. Ke hoach TV lan 1 (cl_tv1_cong_cu, cl_tv1_muc_tieu, cl_tv1_tam_long, cl_tv1_khai_thac, cl_tv1_dan_dat)
3. Ke hoach TV lan 2+ (cl_tv2_cong_cu, cl_tv2_muc_tieu, cl_tv2_dao_sau, cl_tv2_chot_group)
4. Ky vong & Du kien (cl_timeline, cl_lich_gap, cl_gvbb_du_kien, cl_ghi_chu)
5. Rui ro & Phuong an B (cl_rui_ro, cl_phuong_an, cl_nguoi_ho_tro)

Tinh nang: Copy chien luoc -> format text gui Telegram

---

## Desktop 3-Panel Workspace (desktop.js)

Layout 3 cot (Left/Center/Right) cho desktop full-screen:
- Drag-resize dividers giua cac panel
- Tab bar 3 mode: wide (ten + icon), icon-only, dropdown
- Tab "Don vi" chi o Center panel
- Active/inactive tab visual distinction
- Single-tab panel: fill full vertical height
- Panel engine nam trong desktop.js (19KB) + core.js (phan desktop)

---

## Rebranding Sinka -> The Hoc Vien

- Tat ca UI hien thi: "The hoc vien" (KHONG con "Sinka")
- Code/DB van dung: sinka, sk_*, sinka-exports, sinka.js
- Chi doi: labels, button text, card titles, message templates
- KHONG doi: variable names, function names, field names, file names

---

## BB Reminder (Edge Function + Cron)

- Edge Function: supabase/functions/bb-reminder/
- Cron: moi 15 phut via pg_cron (20260420_bb_reminder_cron.sql)
- Logic: kiem tra lich BB sap toi -> gui notification cho NDD/GVBB

---

## Bong bong chat (Floating Chat Heads)

He thong bong bong chat (Messenger Style) cho phep tuong tac nhanh ma khong can roi khoi tab hien tai:
- **Bong bong noi (`#cjFloatingChatHead`)**: 
  - Hien thi avatar cua hoc vien duoc ghim (hoac bieu tuong 💬).
  - Ho tro keo tha di chuyen (drag) bang Pointer Events.
  - Khi click vao se bat/tat cua so chat.
- **Cua so chat noi (`#cjFloatingChatWindow`)**:
  - Hien thi danh sach cac cuoc hoi thoai duoc ghim o dang hang ngang (Avatars Row).
  - Ho tro keo di chuyen bang cach nam giu thanh tieu de (Drag header).
  - Ho tro co gian kích thuoc 8 huong (Resize w/e/n/s/nw/ne/sw/se) thong qua cac tay cam duoc chen dong.
  - Luu tru toan bo toado va kich thuoc nguoi dung tu dinh nghia vao `localStorage`.
- **Tu dong bam bien & Chong troi**:
  - Trinh lang nghe `resize` cua window se tu dong gioi han (clamp) toa do cua bong bong va cua so chat luon nam trong vung nhin thay duoc (viewport limits).
  - Khi ghim, vi tri cung duoc constrain tu dong de tranh hien tuong bong bong bi chet hoac bi bay ra ngoai man hinh tren thiet bi nho.
- **Tim kiem tin nhan**:
  - O nhap lieu tim kiem `#cjFloatingChatSearchInput` cho phep loc tin nhan chua tu khoa realtime.

---

## Tai anh lam Avatar (Custom Avatar Upload)

Nang cap he thong tuy bien anh dai dien cho nguoi dung (Nhan su) va ho so (Trai qua):
- **Co che tai len**:
  - Su dung form input file an, goi Endpoint Edge Function `/functions/v1/telegram-bot?document=true`.
  - Truyen tham so `document=true` de bot Telegram gui file duoi dang tai lieu (Document) giup **bo qua co che nen anh lossy cua Telegram**, giu nguyen 100% chat luong va do phan giai cua anh goc.
- **Luu tru & Hien thi**:
  - Tra ve URL proxy tu Edge Function va luu thong tin nay vao cot `avatar_color` (Profiles) hoac `staff_avatar_color` (Staff).
  - Ham `renderAnimatedAvatar` se tu dong phat hien neu chuoi cau hinh/gradient co chua link URL anh (Telegram/Supabase) de dung the `<img>` bo tron tinh te thay vi render anh hoat hoa CSS.
  - Co che handle error: Tu dong phuc hoi ve dang chu cai mac dinh neu anh bi loi.

---

## He thong Thong bao & Cai dat (Notification & Settings System)

He thong thong bao da kenh giup nhan su theo doi ho so va hanh trinh hoc vien nhanh chong:
- **Kenh nhan thong bao**:
  - **Trong App (`app`)**: Cac thong bao duoc luu vao bang `notifications` trong database, hien thi o goc tren qua tab Bell 🔔. Khi nguoi dung click vao thong bao, ung dung tu dong chuyen tab va deep link den ho so tuong ung, hoac tu dong mo tab **Thao luan** (`chatTab`) neu la thong bao nhac ten.
  - **Qua Telegram (`chat`)**: Bot Telegram se tu dong gui tin nhan truc tiep cho nhan su qua chat bot hoac vao cac group hoc tap tuong ung tuy vao tung event type.
- **Quan ly Cau hinh**:
  - Modal **Cai dat thong bao** (⚙️) cho phep nguoi dung bat/tat tung loai su kien cho ca 2 kenh App va Chat doc lap.
  - Du lieu preferences duoc dong bo xuong bang `notification_preferences` (cot `app_events` va `chat_events` dang `TEXT[]`).
- **Su kien Nhac ten (`chat_mention`)**:
  - Khi mot nhan su duoc tag trong o chat **Thao luan** cua hoc vien bang ma `@000142-NKH`, he thong se ghi nhan mot notification loai `chat_mention`.
  - Tren Telegram, bot se push tin nhan kem link deep link truc tiep den tab Thao luan cua ho so: `https://t.me/quanlyhcm_bot/app?startapp=PROFILE_UUID_chatTab`.
  - Khi nguoi dung click thong bao trong App hoac qua link Telegram, he thong tu dong load noi dung cuoc hop, danh dau da doc (`markChatAsRead`) va dua thang nguoi dung vao tab Thao luan.

---

## He thong Luu Ban Nhap Bieu Mau (Draft Auto-Save System)

He thong luu tru ban thao cuc bo thong minh, an toan giup ngan ngua mat mat du lieu soan thao cho cac bieu mau dai (Bao cao Tu van, Bao cao Bien ban, Bao cao Bai tap, Hop team, hoac phieu Check Hapja):
- **Co che Luu ngam tu dong (Real-time Auto-Save)**:
  - Khi nguoi dung dang nhap du lieu trong `#createHapjaModal` hoac `#addRecordModal`, moi thay doi ban phim (`input` tre 500ms) hoac thay doi lua chon danh sach (`change` tuc thoi) se duoc tu dong dong bo hoa xuong `localStorage`.
  - Bo ma khoa nhap PIN khoa mat khau (`pin` / `Pin`) hoan toan bi loai tru de bao ve an toan danh tinh tuyet doi.
  - Ban nhap trong hoan toan se tu dong bi huy de tiet kiem bo nho cuc bo.
- **Bieu ngu khoi phuc truc quan (Draft Recovery Banner)**:
  - Khi mo lai bieu mau trong, neu phat hien ban thao do dang tuong ung, mot bieu ngu mau vang cam HSL hien dai se duoc ket xuan dong o dau bieu mau:
    - **Nut [Khoi phuc]**: Dien lai toan bo gia tri da luu vao cac truong tuong ung trong form va kich hoat cac su kien cap nhat giao dien lien quan (`input`/`change` event dispatching).
    - **Nut [Xoa]**: Huy ban thao khoi bo nho `localStorage` va an bieu ngu di.
- **Tu dong don dep (Clean-on-Success)**:
  - Khi bieu mau duoc gui len co so du lieu Supabase thanh cong (`submitCreateHapja` hoac `saveRecord`), ban nhap tuong ung cua no se bi xoa sach khoi `localStorage` de khong hien lai bieu ngu o cac phien lam viec tiep theo.

---

## Bo tro Cua so & Thanh cong cu (Window Controls & Tab Visibility)

Cac toi uu hoa giao dien nang cao cho che do man hinh lon (Desktop layout):
- **Ghi nho kich thuoc cua so**:
  - Trang thai Phong to (Maximized/Fullscreen) duoc ghi nho trong bo nho `localStorage` qua khoa `cj_last_fullscreen` moi khi nguoi dung nhap vao nut `winBtnMax`.
  - Khi ung dung khoi dong lai, che do Phong to se duoc kich hoat ngay lap tuc tu `DOMContentLoaded` trong `init.js` truoc khi hien thi man hinh khoa nhap PIN, dam bao tinh lien tuc cua giao dien.
- **Tu dong an tab dinh kem**:
  - Khi cac tab phu (Lich, Note, Uu tien) duoc dinh sang 2 ben sidebar trong layout desktop, he thong se loc va an chung hoan toan khoi thanh cong cu chinh giua `#mainTabBar` (ngay ca khi nguoi dung thay doi thu tu tab ca nhan hoa trong `_applyTabOrder`), giu giao dien luon gon gang va chuan muc.

---

## Quy trình phòng ngừa lỗi cú pháp & Đảm bảo ổn định (Syntax Check & Deployed Stability)

### 1. Phân tích sự cố tải ứng dụng (Syntax Regression Post-mortem)
* **Nguyên nhân chính**: Trong quá trình cập nhật giao diện (search-and-replace, cập nhật template literals lớn), xuất hiện lỗi đóng sớm chuỗi template hoặc ký tự thừa (ví dụ ``;`;` thay vì ``;` tại `mini-app/profiles.js`). Điều này làm cho trình duyệt không thể biên dịch file JS và ném ra lỗi `SyntaxError`, khiến ứng dụng trắng trang hoàn toàn khi tải.
* **Đặc điểm**: Lỗi này vô cùng nguy hiểm vì chỉ một ký tự thừa hoặc thiếu ngoặc nhọn `{}`/`}` cũng có thể làm sập toàn bộ hệ thống client-side.

### 2. Quy trình kiểm tra bắt buộc trước khi Commit & Push (Mandatory Pre-commit Protocol)
Để đảm bảo lỗi tải ứng dụng **không bao giờ lặp lại**, các nhà phát triển (hoặc AI agent) bắt buộc phải thực hiện các bước sau trước khi thực hiện `git push`:

1. **Kiểm tra cú pháp tĩnh bằng Node.js (Static Syntax Check)**:
   Mọi thay đổi trên file JavaScript (`.js`) đều PHẢI được biên dịch thử bằng trình biên dịch của Node.js để phát hiện ngay lập tức bất kỳ lỗi cú pháp nào:
   ```powershell
   # Kiểm tra toàn bộ các file JS trong thư mục mini-app
   Get-ChildItem mini-app/*.js | ForEach-Object { node -c $_.FullName }
   
   # Hoặc kiểm tra các file cụ thể được chỉnh sửa:
   node -c mini-app/profiles.js mini-app/chat.js mini-app/records.js
   ```
   *Lưu ý*: Lệnh `node -c` chỉ biên dịch (compile check) mà không chạy code thực tế, đảm bảo an toàn tuyệt đối và cực kỳ nhanh. Nếu lệnh trả về trống (không lỗi), cú pháp hoàn toàn hợp lệ.

2. **Kiểm tra Git Diff chi tiết (Line-by-line Diff Inspection)**:
   Chạy `git diff` để rà soát từng dòng thay đổi. Đặc biệt chú ý:
   - Các dấu backtick (``` ` ```) đóng mở chuỗi template HTML.
   - Các cặp ngoặc nhọn `{}` trong biểu thức nội suy `${}`.
   - Các dấu chấm phẩy thừa đứng sau dấu đóng template literal.

3. **Gia tăng phiên bản Cache-Busting trong `index.html`**:
   Khi deploy bản vá mới cho CSS hoặc JS, luôn cập nhật tham số phiên bản `?v=YYYYMMDDHH` tương ứng trong thẻ `<link>` hoặc `<script>` tại [index.html](file:///c:/Users/ADMIN/OneDrive/Desktop/quan_ly/mini-app/index.html) để trình duyệt của người dùng lập tức tải bản mới nhất thay vì dùng cache cũ.

### 3. Nguyên tắc vận hành & Bảo trì
* **Không deploy code chưa qua kiểm tra tĩnh**: Bất kỳ pull request hay commit nào đẩy lên nhánh `main` mà làm gãy cú pháp đều bị coi là không đạt tiêu chuẩn vận hành.
* **Lưu vết và cập nhật**: Khi phát hiện thêm lỗi hệ thống tương tự, bổ sung ngay vào tài liệu này để cập nhật bộ quy tắc chung.


