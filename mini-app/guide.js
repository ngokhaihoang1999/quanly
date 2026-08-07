// ============ INTERACTIVE APP TOUR & WIKI MODULE ============
// guide.js - Provides game-like interactive onboarding tour and guide wiki

const APP_TOUR_STEPS = [
  {
    element: '#headerAvatar .header-avatar-wrapper',
    title: '⚙️ Cá nhân hóa & Cài đặt',
    text: 'Nhấp vào ảnh đại diện của bạn để thay đổi biệt danh, màu sắc chủ đề, ghim các tab làm việc nhanh và thiết lập mã PIN bảo mật.',
    tab: 'unit'
  },
  {
    element: '#notifBell',
    title: '🔔 Chuông thông báo',
    text: 'Nhận thông báo tức thời. Nhấn vào bánh răng ⚙️ bên trong chuông để bật/tắt nhận từng loại thông báo qua Telegram hoặc trong App.',
    tab: 'unit'
  },
  {
    element: '#guideBtn',
    title: '❓ Cẩm nang hướng dẫn',
    text: 'Đây chính là nút mở Cẩm nang hướng dẫn này bất cứ lúc nào để tra cứu Quy trình hồ sơ trái hoặc chạy lại tour giao diện.',
    tab: 'unit'
  },
  {
    element: '#semesterSelect',
    title: '📅 Kỳ Khai Giảng',
    text: 'Bộ chọn kỳ học. Khi bạn chuyển kỳ, toàn bộ số liệu thống kê và danh sách hồ sơ học viên sẽ tự động lọc theo kỳ tương ứng.',
    tab: 'unit'
  },
  {
    element: '#mainTabBar .tab[data-tab="unit"]',
    title: '🏢 Tab Đơn vị (Dashboard)',
    text: 'Hiển thị các chỉ số đo lường (Metrics) tổng quan của toàn bộ hệ thống và danh sách học viên cấp dưới phân theo từng nhóm.',
    tab: 'unit'
  },
  {
    element: '#mainTabBar .tab[data-tab="personal"]',
    title: '👤 Tab Cá nhân',
    text: 'Đây là không gian làm việc riêng của bạn. Hiển thị danh sách học viên (Trái) do chính bạn trực tiếp phụ trách chăm sóc.',
    tab: 'personal'
  },
  {
    element: '#mainTabBar .tab[data-tab="priority"]',
    title: '⚡ Tab Ưu tiên',
    text: 'Tổng hợp danh sách các đầu việc quan trọng cần xử lý gấp (nhắc nhở viết báo cáo, hoàn thành mốc tiến độ hồ sơ).',
    tab: 'priority'
  },
  {
    element: '#mainTabBar .tab[data-tab="calendar"]',
    title: '📅 Tab Lịch hẹn',
    text: 'Theo dõi lịch biểu, các cuộc hẹn phỏng vấn học viên hoặc các sự kiện quan trọng trong tháng cực kỳ trực quan.',
    tab: 'calendar'
  },
  {
    element: '#mainTabBar .tab[data-tab="notes"]',
    title: '📝 Tab Notes (Ghi chú)',
    text: 'Tạo nhanh các note cá nhân hoặc note chia sẻ với các nhân sự khác trong hệ thống để phối hợp làm việc mượt mà.',
    tab: 'notes'
  },
  {
    element: '#fabBtn',
    title: '➕ Tạo phiếu Check Hapja',
    text: 'Nút hành động nhanh để tạo Phiếu Sàng lọc Hapja cho học viên mới. Khi phiếu được duyệt, hồ sơ của học viên sẽ tự động được tạo lập.',
    tab: 'unit'
  }
];

const JONDO_STEPS_DATA = [
  {
    step: 1,
    title: "1. Lập phiếu Check Hapja 📋",
    label: "Check Hapja",
    icon: "📋",
    keywords: ["hapja", "duyệt", "sàng lọc", "tạo học viên", "thêm học viên", "học viên mới", "khởi tạo"],
    content: `
      <p><b>Quy trình khởi tạo và sàng lọc học viên mới (Hapja):</b></p>
      <ul>
        <li><b>Cách tạo:</b> Bấm nút <b>➕ (Tạo Phiếu Check Hapja)</b> ở góc dưới bên phải màn hình chính.</li>
        <li><b>Nhập thông tin:</b> Điền đầy đủ các trường thông tin: Họ tên học viên, năm sinh, SĐT, khu vực, Tư vấn viên (TVV) phụ trách và các điều kiện sàng lọc ban đầu.</li>
        <li><b>Lưu bản nháp:</b> Hệ thống tự động lưu bản nháp nếu bạn đóng biểu mẫu dở dang, cho phép khôi phục khi mở lại.</li>
        <li><b>Chờ duyệt:</b> Sau khi gửi, phiếu lưu ở trạng thái <i>Chờ duyệt</i> trong tab <b>Check Hapja</b>.</li>
        <li><b>Duyệt phiếu:</b> Cấp quản lý (GGN Jondo) kiểm tra và bấm <b>Duyệt ✅</b>. Hồ sơ học viên sẽ chính thức được khởi tạo trên hệ thống.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Nút Tạo➕</span><small>Tạo phiếu & Lưu nháp</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Phiếu Hapja 📋</span><small>Chờ quản lý duyệt</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Duyệt ✅</span><small>GGN Jondo</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Khởi tạo 👤</span><small>Tự động lập hồ sơ</small></div>
      </div>
    `
  },
  {
    step: 2,
    title: "2. Thông tin & Trạng thái hồ sơ 👤",
    label: "Trạng thái",
    icon: "👤",
    keywords: ["profile", "hồ sơ", "trạng thái", "alive", "pause", "dropout", "nghỉ học", "tạm dừng", "hoạt động"],
    content: `
      <p><b>Quản lý Thông tin hành chính & Trạng thái hoạt động của học viên:</b></p>
      <ul>
        <li><b>Cập nhật thông tin:</b> Tại màn hình hồ sơ học viên, NDD hoặc Quản lý cập nhật lý lịch hành chính, thông tin liên hệ và phân công nhân sự phụ trách (TVV, GVBB, Lá).</li>
        <li><b>Quản lý 3 trạng thái cốt lõi:</b></li>
        <li>🟢 <b>Alive (Hoạt động):</b> Học viên đang tham gia học tập, gặp gỡ bình thường. Trạng thái mặc định của học viên mới.</li>
        <li>⏸️ <b>Pause (Tạm dừng):</b> Dùng khi học viên tạm nghỉ ngắn hạn (ốm đau, bận việc, đổi ca). Nhóm hỗ trợ cần duy trì tương tác để kích hoạt lại trạng thái 🟢 Alive.</li>
        <li>🔴 <b>Drop-out (Nghỉ học hẳn):</b> Dùng khi học viên dừng học. Yêu cầu chọn lý do cụ thể để phục vụ thống kê và cải tiến phương pháp chăm sóc.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span style="color:var(--green)">Alive 🟢</span><small>Đang hoạt động</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span style="color:var(--yellow)">Pause ⏸️</span><small>Hỗ trợ giữ ấm</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span style="color:var(--red)">Drop-out 🔴</span><small>Thống kê lý do</small></div>
      </div>
    `
  },
  {
    step: 3,
    title: "3. Chốt lịch & Báo cáo Tư vấn (TV) 💬",
    label: "Tư vấn",
    icon: "💬",
    keywords: ["tư vấn", "tv", "báo cáo", "nhật ký", "tình trạng", "tâm lý"],
    content: `
      <p><b>Quản lý cuộc hẹn và Báo cáo Tư vấn tâm lý:</b></p>
      <ul>
        <li><b>Đặt lịch chốt TV:</b> NDD hoặc Quản lý hẹn thời gian và phân công TVV chốt tư vấn. Sau 1 giờ từ giờ hẹn, hệ thống tự động tạo task <i>"Viết Báo cáo TV"</i> trong tab <b>Ưu tiên</b> để nhắc nhở.</li>
        <li><b>Quy trình Tư vấn:</b> TVV thực hiện các buổi trò chuyện sâu (tối thiểu 2 lần tư vấn), kết hợp các công cụ trắc nghiệm tính cách (Enneagram,...).</li>
        <li><b>Ghi nhận báo cáo:</b> Bấm <b>📝 Viết báo cáo Tư vấn</b> để lưu nhật ký buổi tư vấn: công cụ áp dụng, đánh giá tiếp thu, điểm tâm lý nhạy cảm và định hướng hỗ trợ tiếp theo.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Hẹn Lịch 📅</span><small>Tạo hẹn Chốt TV</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Tư vấn</span><small>Enneagram,...</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Báo Cáo 💬</span><small>Ghi nhận nhật ký TV</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Chốt tiếp 📅</span><small>Hoặc lập Group TV-BB</small></div>
      </div>
    `
  },
  {
    step: 4,
    title: "4. Nhóm hỗ trợ & Telegram (Group TV-BB) 🤝",
    label: "Group TV-BB",
    icon: "🤝",
    keywords: ["telegram", "nhóm", "group", "chat", "thảo luận", "liên kết", "kết nối", "tv-bb", "bot"],
    content: `
      <p><b>Liên kết và Đồng bộ thông tin qua Nhóm hỗ trợ (Group Telegram):</b></p>
      <ul>
        <li><b>Phân công Nhân sự phụ trách:</b> Mỗi học viên đồng hành bởi nhóm gồm: TVV, NDD, GVBB và Lá. Cần tìm GVBB phù hợp trước khi lập Group.</li>
        <li><b>Lập group Telegram:</b> Tạo nhóm chat riêng trên Telegram có đầy đủ thành viên phụ trách kèm <b>Bot Quản lý</b> hệ thống.</li>
        <li><b>Liên kết Group:</b> Vào hồ sơ học viên, bấm trạng thái <b>Chưa kết nối Group</b> để liên kết theo hướng dẫn (cần cấp quyền Admin cho Bot).</li>
        <li><b>Đồng bộ tự động:</b> Sau khi liên kết, mọi báo cáo bài học BB, BTVN và tiến độ hồ sơ sẽ được Bot cập nhật tức thời vào nhóm Telegram.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Tìm GVBB 👤</span><small>Phù hợp học viên</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Lập Nhóm 💬</span><small>Group Telegram riêng</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Liên Kết 🔗</span><small>Dán link vào hồ sơ</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Tương tác Bot 🤖</span><small>Quản lý & Hỗ trợ</small></div>
      </div>
    `
  },
  {
    step: 5,
    title: "5. Dạy và báo cáo BB + 4 Mốc Tiến độ ⭐",
    label: "Tiến độ BB",
    icon: "⭐",
    keywords: ["milestone", "mốc", "bài đặc biệt", "tiến độ", "phỏng vấn", "đăng ký center", "đk center", "bb", "báo cáo"],
    content: `
      <p><b>Dạy học và đánh giá chất lượng qua 4 mốc tiến độ:</b></p>
      <ul>
        <li><b>Dạy và báo cáo BB:</b> Sau mỗi buổi dạy, GVBB vào tab <b>BB</b> bấm <b>📝 Viết báo cáo BB</b> để ghi nhận mức độ tiếp thu và thông tin khai thác mới.</li>
        <li><b>4 mốc tiến độ quan trọng:</b></li>
        <li>1️⃣ <b>Bài đặc biệt:</b> Buổi học đặc biệt với Trợ giảng.</li>
        <li>2️⃣ <b>Phỏng vấn GVBB:</b> Phỏng vấn giữa GVBB và Center.</li>
        <li>3️⃣ <b>Đăng ký Center:</b> Đăng ký chính thức lớp học chuyên sâu.</li>
        <li>4️⃣ <b>Phỏng vấn Học viên:</b> Cuộc gặp giữa học viên và Trợ giảng kiểm định tấm lòng.</li>
        <li><b>Đồng bộ tiến độ:</b> Khi hoàn thành mốc nào, đánh dấu mốc đó trực tiếp tại tab Giai đoạn. Hoàn thành 100% cả 4 mốc mới mở chức năng Chốt Center.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Báo cáo BB 👨‍🏫</span><small>Dạy & cập nhật</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Mốc 1 & 2 ⭐</span><small>Bài ĐB & PV GVBB</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Mốc 3 & 4 ⭐</span><small>ĐK Center & PV HV</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Hoàn thành 💯</span><small>Mở nút chốt</small></div>
      </div>
    `
  },
  {
    step: 6,
    title: "6. Điền Sinka & Chốt Center 🏛️",
    label: "Chốt Center",
    icon: "🏛️",
    keywords: ["sinka", "chốt", "nhập học", "center", "xuất word", "in thẻ", "thẻ hv", "hoàn thành"],
    content: `
      <p><b>Hoàn tất hồ sơ hành chính Sinka và chốt danh sách lên lớp Center:</b></p>
      <ul>
        <li><b>Phiếu Sinka (Thẻ học viên):</b> Điền tích lũy thông tin lý lịch nhập học tại tab <b>Thẻ HV</b> ngay từ giai đoạn tư vấn.</li>
        <li><b>Xuất Thẻ HV Word:</b> Tại tab <b>Thẻ HV</b>, bấm <b>📄 Tải file Word</b> để xuất Thẻ học viên đã điền đầy đủ dữ liệu hành chính.</li>
        <li><b>Chốt Center:</b> Sau khi hoàn thành đủ 4 mốc tiến độ BB, bấm <b>🏛️ Chốt Center</b> trong tab Giai đoạn để chuyển học viên lên lớp Center.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Nhập Sinka 📜</span><small>Điền tích lũy Sinka</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Tải Word 📄</span><small>Xuất Thẻ HV Center</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Đủ 4 mốc BB ⭐</span><small>Mở nút chốt</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Chốt Center 🏛️</span><small>Lên lớp Center</small></div>
      </div>
    `
  }
];

const WIKI_ITEMS = [
  {
    title: "Làm thế nào để đổi Màu sắc Chủ đề hoặc Biệt danh?",
    keywords: ["chủ đề", "theme", "màu", "biệt danh", "nickname", "cá nhân hóa"],
    content: "Bấm vào ảnh đại diện (avatar) của bạn ở góc trên cùng bên trái. Mục <b>Cá nhân hóa</b> sẽ mở ra, tại đây bạn có thể nhập biệt danh mới và chọn mã màu yêu thích làm màu chủ đề chính cho ứng dụng."
  },
  {
    title: "Làm thế nào để đổi Họ và tên thể hiện trên file Thẻ HV (Sinka)?",
    keywords: ["họ tên", "tên", "sinka", "thẻ học viên", "profile", "cài đặt"],
    content: "Bấm vào Avatar ➡️ Chọn <b>⚙️ Cài đặt</b> ➡️ Chuyển sang Tab <b>Hồ sơ</b> ➡️ Nhập <b>Họ và tên</b> của bạn ➡️ Bấm <b>Lưu hồ sơ</b>. Tên này sẽ xuất hiện trên file Word Thẻ học viên tại mục NDD phụ trách (mã JD giữ nguyên)."
  },
  {
    title: "Làm thế nào để bật/tắt nhận thông báo qua Telegram?",
    keywords: ["thông báo", "notif", "telegram", "chuông", "lọc", "nhận tin"],
    content: "Bấm vào biểu tượng <b>Chuông thông báo 🔔</b> ở góc trên bên phải ➡️ Chọn <b>Bánh răng ⚙️</b> ➡️ Tích chọn/bỏ chọn các loại thông báo muốn nhận qua Telegram hoặc trong App."
  },
  {
    title: "Chức năng 'Ghim tab' hoạt động như thế nào?",
    keywords: ["ghim", "pin", "tab", "làm việc", "nhanh", "desktop"],
    content: "Khi dùng máy tính, bạn có thể ghim các tab thường dùng (như Notes, Ưu tiên, Lịch) sang cột bên. Mở Cài đặt (nhấn avatar) ➡️ Chọn mục <b>Ghim Tab</b> ➡️ Tích chọn tab muốn ghim."
  },
  {
    title: "Làm thế nào để sửa lỗi hiển thị dữ liệu sai kỳ học?",
    keywords: ["kỳ học", "tháng", "sai dữ liệu", "reload", "tải lại", "cập nhật"],
    content: "Hãy kiểm tra bộ chọn <b>📅 Kỳ</b> ở trên cùng xem đã chọn đúng Kỳ hiện tại chưa. Nếu dữ liệu chưa cập nhật, bấm nút <b>🔄 (Tải lại)</b> ở thanh kỳ học."
  }
];

const PROFILE_TABS_DATA = [
  {
    id: "info",
    title: "1. Thông tin",
    icon: "ℹ️",
    desc: `<b>Quản lý Hồ sơ Hành chính & Liên hệ:</b><br/>
      • <b>Nội dung:</b> Tập trung toàn bộ lý lịch hành chính cốt lõi gồm Họ tên, năm sinh, SĐT liên lạc cá nhân, liên kết NDD, TVV phụ trách và tổ nhóm sinh hoạt.<br/>
      • <b>Phân quyền & Bảo mật:</b> Chỉ NDD trực tiếp và cấp quản lý mới có quyền chỉnh sửa. Tự động lưu nháp chống mất dữ liệu.`
  },
  {
    id: "stage",
    title: "2. Giai đoạn",
    icon: "🗓️",
    desc: `<b>Kiểm soát Vòng đời Học tập & Bảng Dòng thời gian:</b><br/>
      • <b>Nội dung:</b> Theo dõi tiến trình qua 5 Giai đoạn: <b>Chakki</b> ➔ <b>TV Hình</b> ➔ <b>Tư vấn</b> ➔ <b>BB</b> ➔ <b>Center</b>.<br/>
      • <b>Bảng Dòng thời gian (Timeline):</b> Hiển thị song song Sự kiện, Báo cáo và Bài tập về nhà theo trình tự thời gian.<br/>
      • <b>Thao tác nghiệp vụ:</b> Lập group TV-BB, Mở KT (Kinh Thánh), Chốt Center.`
  },
  {
    id: "tv",
    title: "3. TV (Tư vấn)",
    icon: "💬",
    desc: `<b>Quản lý Lịch hẹn & Nhật ký Tư vấn tâm lý:</b><br/>
      • <b>Nội dung:</b> Ghi nhận lịch hẹn tư vấn và toàn bộ báo cáo chi tiết sau mỗi lần trò chuyện tâm lý.<br/>
      • <b>Nhắc nhở tự động:</b> Sau 1 giờ từ lịch hẹn, hệ thống tự động gửi công việc nhắc nhở viết báo cáo vào tab <b>Ưu tiên</b>.`
  },
  {
    id: "bb",
    title: "4. BB (Học tập)",
    icon: "📖",
    desc: `<b>Giám sát Bài giảng 12 buổi BB & 4 Mốc hồ sơ:</b><br/>
      • <b>Nội dung:</b> GVBB ghi nhận báo cáo sau mỗi buổi dạy và kiểm soát 4 mốc tiến độ (Bài đặc biệt, PV GVBB, ĐK Center, PV Học viên).`
  },
  {
    id: "btvn",
    title: "5. BTVN (Bài tập)",
    icon: "📝",
    desc: `<b>Quản lý Giao bài & Chấm bài tập về nhà:</b><br/>
      • <b>Nội dung:</b> GVBB cập nhật đề bài và bài làm của học viên để đánh giá chất lượng học tập.`
  },
  {
    id: "notes",
    title: "6. Ghi chú",
    icon: "🗒️",
    desc: `<b>Ghi chép Nội bộ & Kế hoạch Bảo an:</b><br/>
      • <b>Nội dung:</b> Lưu trữ các ghi chép nhanh, phát hiện tâm lý nhạy cảm hoặc kế hoạch bảo an dành riêng cho học viên.`
  },
  {
    id: "discuss",
    title: "7. Thảo luận",
    icon: "💬",
    desc: `<b>Kênh Chat Nội bộ Bảo mật:</b><br/>
      • <b>Nội dung:</b> Phòng chat thời gian thực trong hồ sơ cho phép TVV, NDD, GVBB và Lá trao đổi phương án hỗ trợ học viên.`
  },
  {
    id: "sinkacard",
    title: "8. Thẻ HV (Sinka)",
    icon: "📜",
    desc: `<b>Điền Sinka Lý lịch & Xuất file Word:</b><br/>
      • <b>Nội dung:</b> Thu thập lý lịch chi tiết và tự động điền file Word (.docx) Thẻ Học viên Center chính thức để xuất lưu trữ.`
  },
  {
    id: "mindmap",
    title: "9. Tư Duy",
    icon: "🗺️",
    desc: `<b>Sơ đồ Tư duy Tâm lý (Mindmap):</b><br/>
      • <b>Nội dung:</b> Tổng hợp dữ liệu tâm lý, hoàn cảnh và chiến lược dẫn dắt học viên thành sơ đồ tư duy dạng cây trực quan.`
  }
];

let currentTourIndex = 0;
let tourOverlayEl = null;
let tourTooltipEl = null;
let currentHighlightedEl = null;

let activeGuideTab = 'jondo';
let activeGuideStep = 1;

// Open the unified Guide Center Modal
function openGuideCenter() {
  let modal = document.getElementById('guideCenterModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'guideCenterModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal" style="max-height:85vh; overflow-y:auto;">
      <div class="modal-handle"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <button onclick="closeModal('guideCenterModal')" style="background:var(--surface2); border:1px solid var(--border); color:var(--accent); font-size:12px; cursor:pointer; font-weight:700; padding:6px 12px; border-radius:20px; display:flex; align-items:center; gap:4px;">← Quay lại</button>
        <div class="modal-title" style="margin:0; font-size:16px;">❓ Cẩm nang hướng dẫn</div>
        <div style="width:70px;"></div>
      </div>
      
      <div class="guide-center-container">
        <!-- Search bar -->
        <div class="guide-search-wrap">
          <span class="icon">🔍</span>
          <input type="text" placeholder="Tìm hướng dẫn (vd: sinka, btvn, dropout...)" id="guideSearchInput" oninput="onGuideSearch(this.value)" autocomplete="off" />
        </div>

        <!-- Navigation Tabs -->
        <div class="guide-tabs" id="guideTabs">
          <div class="guide-tab-btn active" id="gtab_jondo" onclick="switchGuideTab('jondo')">📋 Quy trình</div>
          <div class="guide-tab-btn" id="gtab_tabs" onclick="switchGuideTab('tabs')">🗂️ 9 Tab hồ sơ</div>
          <div class="guide-tab-btn" id="gtab_tour" onclick="switchGuideTab('tour')">🚀 Tour nhanh</div>
          <div class="guide-tab-btn" id="gtab_help" onclick="switchGuideTab('help')">💡 Hỏi & Đáp</div>
        </div>

        <!-- Tab 1: Stepper quy trình -->
        <div id="guidePane_jondo">
          <!-- Role Filter Chips -->
          <div style="display:flex; gap:6px; margin-bottom:12px; overflow-x:auto; padding-bottom:4px;" id="guideRoleChips">
            <button class="guide-role-chip active" onclick="filterGuideRole('all', this)">Tất cả</button>
            <button class="guide-role-chip" onclick="filterGuideRole('ndd', this)">👤 NDD</button>
            <button class="guide-role-chip" onclick="filterGuideRole('tvv', this)">💬 TVV</button>
            <button class="guide-role-chip" onclick="filterGuideRole('gvbb', this)">📖 GVBB</button>
            <button class="guide-role-chip" onclick="filterGuideRole('ggn', this)">🛡️ Quản lý (GGN)</button>
          </div>

          <!-- Stepper horizontal -->
          <div class="guide-stepper" id="guideStepper">
            ${JONDO_STEPS_DATA.map(step => `
              <div class="guide-step-node ${step.step === 1 ? 'active' : ''}" id="gstep_${step.step}" onclick="selectGuideStep(${step.step})">
                <div class="guide-step-circle">${step.icon}</div>
                <div class="guide-step-label">${step.label}</div>
              </div>
            `).join('')}
          </div>

          <!-- Content display area -->
          <div class="guide-content-panel" id="guideContentPanel">
            <!-- Dynamically filled -->
          </div>
        </div>

        <!-- Tab 2: 9 Tab Hồ sơ -->
        <div id="guidePane_tabs" style="display:none;">
          <div class="guide-grid">
            ${PROFILE_TABS_DATA.map(item => `
              <div class="guide-profile-tab-card">
                <div class="guide-profile-tab-header">
                  <span class="icon">${item.icon}</span>
                  <span class="title">${item.title}</span>
                </div>
                <div class="desc">${item.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Tab 3: Tour giao diện -->
        <div id="guidePane_tour" style="display:none;">
          <div style="background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:18px; margin-bottom:12px; text-align:center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position:relative; overflow:hidden;">
            <div style="font-size:18px; font-weight:800; color:var(--accent); margin-bottom:6px;">🚀 Khám Phá Giao Diện Hệ Thống</div>
            <div style="font-size:12px; color:var(--text2); max-width:480px; margin:0 auto 14px; line-height:1.5;">
              Nhấp vào nút dưới đây để kích hoạt Tour hướng dẫn trực tiếp. Hệ thống sẽ làm nổi bật từng vị trí nút bấm và giải thích trực quan cách vận hành ứng dụng.
            </div>
            <button class="form-btn" onclick="closeModal('guideCenterModal'); startAppTour();" style="background:linear-gradient(135deg,var(--accent),var(--accent2)); margin:0 auto; display:flex; align-items:center; justify-content:center; gap:8px; max-width:320px; font-weight:700; box-shadow:0 4px 12px var(--fab-shadow);">
              ✨ Bắt đầu Tour hướng dẫn tương tác
            </button>
          </div>
          
          <div style="font-weight:700; font-size:12px; color:var(--text1); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; padding-left:4px;">Danh sách 10 bước hướng dẫn giao diện</div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${APP_TOUR_STEPS.map((step, index) => `
              <div style="display:flex; gap:12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; transition:border-color 0.2s;">
                <div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:white; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; flex-shrink:0; box-shadow:0 2px 5px var(--fab-shadow);">
                  ${index + 1}
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div style="font-weight:700; font-size:13px; color:var(--accent);">${step.title}</div>
                  <div style="font-size:11.5px; color:var(--text2); line-height:1.45;">${step.text}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Tab 4: FAQ -->
        <div id="guidePane_help" style="display:none;">
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${WIKI_ITEMS.map((item, index) => `
              <div class="guide-wiki-item" onclick="toggleWikiItem(this)">
                <div class="guide-wiki-header">
                  <span>❓ ${item.title}</span>
                  <span style="font-size:10px;color:var(--text3);transition:transform 0.2s;" class="wiki-arrow">▼</span>
                </div>
                <div class="guide-wiki-body">
                  ${item.content}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Ask Lacie AI Banner -->
        <div style="margin-top:16px; background:linear-gradient(135deg,rgba(124,106,247,0.12),rgba(167,139,250,0.06)); border:1px solid var(--accent); border-radius:var(--radius); padding:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:24px;">👼</span>
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--accent);">Thắc mắc khác về Quy trình hoặc App?</div>
              <div style="font-size:11px; color:var(--text2);">Hỏi Trợ lý AI Lacie để được giải đáp tức thì!</div>
            </div>
          </div>
          <button onclick="closeModal('guideCenterModal'); openGlobalLacieModal();" style="background:linear-gradient(135deg,var(--accent),var(--accent2)); color:white; border:none; border-radius:20px; padding:8px 14px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 3px 10px var(--fab-shadow); flex-shrink:0;">
            🤖 Hỏi Lacie
          </button>
        </div>
      </div>
    </div>
  `;

  // Apply default selection
  activeGuideTab = 'jondo';
  activeGuideStep = 1;
  selectGuideStep(1);

  // Open modal
  if (typeof haptic === 'function') haptic('selection');
  modal.classList.add('open');

  // Add click-to-close on overlay background
  modal.onclick = (e) => {
    if (e.target === modal) closeModal('guideCenterModal');
  };
}

// Switch between Tabs in Guide Center
function switchGuideTab(tab) {
  activeGuideTab = tab;
  document.getElementById('guidePane_jondo').style.display = tab === 'jondo' ? 'block' : 'none';
  document.getElementById('guidePane_tabs').style.display = tab === 'tabs' ? 'block' : 'none';
  document.getElementById('guidePane_tour').style.display = tab === 'tour' ? 'block' : 'none';
  document.getElementById('guidePane_help').style.display = tab === 'help' ? 'block' : 'none';

  document.getElementById('gtab_jondo').classList.toggle('active', tab === 'jondo');
  document.getElementById('gtab_tabs').classList.toggle('active', tab === 'tabs');
  document.getElementById('gtab_tour').classList.toggle('active', tab === 'tour');
  document.getElementById('gtab_help').classList.toggle('active', tab === 'help');
  
  // Clear search query
  const searchInput = document.getElementById('guideSearchInput');
  if (searchInput) {
    searchInput.value = '';
    onGuideSearch('');
  }
}

// Select a specific business process step in the Stepper
function selectGuideStep(stepNum) {
  activeGuideStep = stepNum;
  
  // Update stepper UI
  for (let i = 1; i <= 6; i++) {
    const node = document.getElementById('gstep_' + i);
    if (node) {
      node.classList.toggle('active', i === stepNum);
    }
  }

  // Update content
  const stepData = JONDO_STEPS_DATA.find(s => s.step === stepNum);
  const panel = document.getElementById('guideContentPanel');
  if (stepData && panel) {
    panel.innerHTML = `
      <div class="guide-content-title">
        <span>${stepData.title}</span>
      </div>
      <div class="guide-content-body">
        ${stepData.content}
      </div>
    `;
  }
}

// Toggle wiki accordion item open/close
function toggleWikiItem(itemEl) {
  const body = itemEl.querySelector('.guide-wiki-body');
  const arrow = itemEl.querySelector('.wiki-arrow');
  if (!body) return;
  const isOpen = body.classList.contains('open');
  
  // Close all other wikis
  document.querySelectorAll('.guide-wiki-body').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('.wiki-arrow').forEach(a => {
    a.classList.remove('open');
    a.style.transform = '';
  });

  if (!isOpen) {
    body.classList.add('open');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  }
}

// Smart Search with Synonyms support
function onGuideSearch(query) {
  const q = query.trim().toLowerCase();
  const panel = document.getElementById('guideContentPanel');
  const stepper = document.getElementById('guideStepper');
  const tabs = document.getElementById('guideTabs');
  
  if (!q) {
    if (stepper) stepper.style.display = 'flex';
    if (tabs) tabs.style.display = 'flex';
    // Restore active pane
    document.getElementById('guidePane_jondo').style.display = activeGuideTab === 'jondo' ? 'block' : 'none';
    document.getElementById('guidePane_tabs').style.display = activeGuideTab === 'tabs' ? 'block' : 'none';
    document.getElementById('guidePane_tour').style.display = activeGuideTab === 'tour' ? 'block' : 'none';
    document.getElementById('guidePane_help').style.display = activeGuideTab === 'help' ? 'block' : 'none';
    if (activeGuideTab === 'jondo') {
      selectGuideStep(activeGuideStep);
    }
    return;
  }
  
  // Hide stepper and tabs layout during search to show clean results
  if (stepper) stepper.style.display = 'none';
  if (tabs) tabs.style.display = 'none';
  document.getElementById('guidePane_jondo').style.display = 'block';
  document.getElementById('guidePane_tabs').style.display = 'none';
  document.getElementById('guidePane_tour').style.display = 'none';
  document.getElementById('guidePane_help').style.display = 'none';
  
  // Search Jondo steps
  const matchedSteps = JONDO_STEPS_DATA.filter(item => {
    return item.title.toLowerCase().includes(q) || 
           item.content.toLowerCase().includes(q) || 
           item.keywords.some(k => k.includes(q));
  });
  
  // Search Profile tabs
  const matchedTabs = PROFILE_TABS_DATA.filter(item => {
    return item.title.toLowerCase().includes(q) || 
           item.desc.toLowerCase().includes(q) ||
           (item.id && item.id.toLowerCase().includes(q));
  });
  
  // Search FAQs Wiki
  const matchedWiki = WIKI_ITEMS.filter(item => {
    return item.title.toLowerCase().includes(q) || 
           item.content.toLowerCase().includes(q) || 
           item.keywords.some(k => k.includes(q));
  });
  
  if (matchedSteps.length === 0 && matchedWiki.length === 0 && matchedTabs.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Không tìm thấy kết quả</div>
        <div class="empty-sub">Hãy thử gõ từ khóa khác như "hapja", "dropout", "sinka", "telegram", "sơ đồ"...</div>
      </div>
    `;
    return;
  }
  
  let html = `<div style="display:flex;flex-direction:column;gap:12px;">`;
  
  if (matchedSteps.length > 0) {
    html += `<div style="font-weight:700;font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;">Quy trình hồ sơ trái (${matchedSteps.length})</div>`;
    matchedSteps.forEach(step => {
      html += `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:6px;">
          <div style="font-weight:700;font-size:13px;color:var(--accent2);margin-bottom:6px;">${step.title}</div>
          <div class="guide-content-body">${step.content}</div>
        </div>
      `;
    });
  }

  if (matchedTabs.length > 0) {
    html += `<div style="font-weight:700;font-size:11px;color:var(--yellow);text-transform:uppercase;letter-spacing:0.5px;margin-top:10px;">9 Tab Hồ sơ Trái quả (${matchedTabs.length})</div>`;
    html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px; margin-top:6px;">`;
    matchedTabs.forEach(item => {
      html += `
        <div class="guide-profile-tab-card" style="margin-bottom:0;">
          <div class="guide-profile-tab-header">
            <span class="icon">${item.icon}</span>
            <span class="title">${item.title}</span>
          </div>
          <div class="desc">${item.desc}</div>
        </div>
      `;
    });
    html += `</div>`;
  }
  
  if (matchedWiki.length > 0) {
    html += `<div style="font-weight:700;font-size:11px;color:var(--green);text-transform:uppercase;letter-spacing:0.5px;margin-top:10px;">Hỏi đáp & Trợ giúp (${matchedWiki.length})</div>`;
    matchedWiki.forEach(item => {
      html += `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:6px;">
          <div style="font-weight:700;font-size:12px;color:var(--text1);margin-bottom:4px;">❓ ${item.title}</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;">${item.content}</div>
        </div>
      `;
    });
  }
  
  html += `</div>`;
  panel.innerHTML = html;
}

// Start the interactive 10-step tour
function startAppTour() {
  // Close any open modals
  const activeModals = document.querySelectorAll('.modal-overlay.open');
  activeModals.forEach(m => m.classList.remove('open'));
  
  // Close settings personalization panel if open
  const settingsPanel = document.getElementById('personalizationPanel');
  if (settingsPanel) settingsPanel.classList.remove('open');

  document.body.classList.add('tour-active');
  currentTourIndex = 0;
  createTourElements();
  executeTourStep();
}

// Create overlay and tooltip DOM elements if they don't exist
function createTourElements() {
  if (document.getElementById('tourOverlay')) return;

  // Create overlay
  tourOverlayEl = document.createElement('div');
  tourOverlayEl.id = 'tourOverlay';
  tourOverlayEl.className = 'tour-overlay';
  tourOverlayEl.onclick = (e) => {
    endAppTour();
  };
  document.body.appendChild(tourOverlayEl);

  // Create tooltip container
  tourTooltipEl = document.createElement('div');
  tourTooltipEl.id = 'tourTooltip';
  tourTooltipEl.className = 'tour-tooltip';
  document.body.appendChild(tourTooltipEl);
}

// Execute the current step of the tour
async function executeTourStep() {
  const step = APP_TOUR_STEPS[currentTourIndex];
  if (!step) {
    endAppTour();
    return;
  }

  // Ensure we are on the correct tab for the step
  if (step.tab && typeof switchMainTab === 'function') {
    const tabEl = document.querySelector(`#mainTabBar .tab[data-tab="${step.tab}"]`);
    if (tabEl && !tabEl.classList.contains('active')) {
      switchMainTab(tabEl, step.tab);
      // Wait a moment for tab switch and rendering
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  // Clear previous highlights
  if (currentHighlightedEl) {
    currentHighlightedEl.classList.remove('tour-highlight');
    currentHighlightedEl.classList.remove('tour-highlight-static');
  }

  // Clear previous ancestor highlights
  document.querySelectorAll('.tour-ancestor-highlight').forEach(el => {
    el.classList.remove('tour-ancestor-highlight');
  });

  const targetEl = document.querySelector(step.element);
  if (!targetEl || targetEl.style.display === 'none' || getComputedStyle(targetEl).display === 'none') {
    // If target element is not visible or doesn't exist, skip to next step
    currentTourIndex++;
    if (currentTourIndex < APP_TOUR_STEPS.length) {
      executeTourStep();
    } else {
      endAppTour();
    }
    return;
  }

  // Highlight target element
  currentHighlightedEl = targetEl;
  targetEl.classList.add('tour-highlight');
  
  // Only apply relative position if static, to preserve fixed/absolute layouts
  const computedPos = window.getComputedStyle(targetEl).position;
  if (computedPos === 'static') {
    targetEl.classList.add('tour-highlight-static');
  }

  // Apply ancestor highlights to overcome stacking contexts (like .header with z-index)
  let parent = targetEl.parentElement;
  while (parent && parent !== document.body) {
    parent.classList.add('tour-ancestor-highlight');
    parent = parent.parentElement;
  }

  // Render tooltip content
  const isFirst = currentTourIndex === 0;
  const isLast = currentTourIndex === APP_TOUR_STEPS.length - 1;

  tourTooltipEl.innerHTML = `
    <div class="tour-tooltip-title">${step.title}</div>
    <div class="tour-tooltip-body">${step.text}</div>
    <div class="tour-tooltip-footer">
      <span class="tour-step-indicator">Bước ${currentTourIndex + 1}/${APP_TOUR_STEPS.length}</span>
      <div style="display:flex;gap:6px;">
        <button class="tour-btn tour-btn-prev" onclick="exitAppTour()" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:4px 8px;font-weight:normal;">Bỏ qua</button>
        ${!isFirst ? `<button class="tour-btn tour-btn-prev" onclick="prevTourStep()">Trước</button>` : ''}
        <button class="tour-btn tour-btn-next" onclick="nextTourStep()">${isLast ? 'Hoàn thành' : 'Tiếp tục'}</button>
      </div>
    </div>
  `;

  // Position tooltip
  positionTourTooltip(targetEl);
  
  // Position pointing arrow pointing at the target element!
  positionTourArrow(targetEl);
  
  // Fade in elements
  tourOverlayEl.style.opacity = '1';
  tourTooltipEl.style.opacity = '1';
}

// Position the tooltip dynamically next to the highlighted element
function positionTourTooltip(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  
  // Measure actual rendered tooltip dimensions
  const tooltipW = tourTooltipEl.offsetWidth || 280;
  const tooltipH = tourTooltipEl.offsetHeight || 150;

  let top = 0;
  let left = 0;

  // Decide vertical position
  if (rect.top + rect.height / 2 < winH / 2) {
    // Target is in the top half of viewport -> position below target
    top = rect.bottom + 12;
  } else {
    // Target is in the bottom half of viewport -> position above target
    top = rect.top - tooltipH - 12;
  }

  // Decide horizontal position
  left = rect.left + rect.width / 2 - tooltipW / 2;

  // Constrain inside viewport limits
  if (left < 12) left = 12;
  if (left + tooltipW > winW - 12) left = winW - tooltipW - 12;

  if (top < 12) top = 12;
  if (top + tooltipH > winH - 12) top = winH - tooltipH - 12;

  tourTooltipEl.style.top = `${top}px`;
  tourTooltipEl.style.left = `${left}px`;
}

// Position a bouncing pointing finger directly at the highlighted element
function positionTourArrow(targetEl) {
  let arrow = document.getElementById('tourArrow');
  if (!arrow) {
    arrow = document.createElement('div');
    arrow.id = 'tourArrow';
    document.body.appendChild(arrow);
  }
  
  const rect = targetEl.getBoundingClientRect();
  
  // Reset classes
  arrow.className = 'tour-arrow';
  
  let top = rect.top - 48; // Floating 48px above the top edge
  let left = rect.left + rect.width / 2 - 18; // Centered horizontally
  arrow.className = 'tour-arrow tour-arrow-down';
  arrow.innerHTML = '👇';
  
  // If there's not enough room above (e.g. top of screen), point up from below:
  if (top < 10) {
    top = rect.bottom + 12;
    arrow.className = 'tour-arrow tour-arrow-up';
    arrow.innerHTML = '👆';
  }
  
  arrow.style.top = `${top}px`;
  arrow.style.left = `${left}px`;
  arrow.style.display = 'block';
}

// Proceed to the next step
function nextTourStep() {
  currentTourIndex++;
  if (currentTourIndex < APP_TOUR_STEPS.length) {
    executeTourStep();
  } else {
    endAppTour(true);
  }
}

// Go back to the previous step
function prevTourStep() {
  if (currentTourIndex > 0) {
    currentTourIndex--;
    executeTourStep();
  }
}

// Exit the tour (Skip action)
function exitAppTour() {
  endAppTour();
  if (typeof showToast === 'function') showToast('✕ Đã bỏ qua hướng dẫn');
}

// Clean up and end the tour
function endAppTour(completed = false) {
  document.body.classList.remove('tour-active');
  
  // Remove pointing arrow
  const arrow = document.getElementById('tourArrow');
  if (arrow) arrow.remove();

  if (currentHighlightedEl) {
    currentHighlightedEl.classList.remove('tour-highlight');
    currentHighlightedEl.classList.remove('tour-highlight-static');
    currentHighlightedEl = null;
  }

  // Clear all ancestor highlights
  document.querySelectorAll('.tour-ancestor-highlight').forEach(el => {
    el.classList.remove('tour-ancestor-highlight');
  });
  
  if (tourOverlayEl) {
    tourOverlayEl.remove();
    tourOverlayEl = null;
  }

  if (tourTooltipEl) {
    tourTooltipEl.remove();
    tourTooltipEl = null;
  }
}

// Filter Guide Steps based on Staff Role
function filterGuideRole(role, btnEl) {
  document.querySelectorAll('#guideRoleChips .guide-role-chip').forEach(c => c.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const roleStepMap = {
    'all': [1, 2, 3, 4, 5, 6],
    'ndd': [2, 3, 4, 6],
    'tvv': [2, 3, 4],
    'gvbb': [4, 5],
    'ggn': [1, 2, 5, 6]
  };

  const allowedSteps = roleStepMap[role] || [1, 2, 3, 4, 5, 6];
  JONDO_STEPS_DATA.forEach(step => {
    const nodeEl = document.getElementById(`gstep_${step.step}`);
    if (nodeEl) {
      if (allowedSteps.includes(step.step)) {
        nodeEl.style.opacity = '1';
        nodeEl.style.filter = 'none';
      } else {
        nodeEl.style.opacity = '0.35';
        nodeEl.style.filter = 'grayscale(1)';
      }
    }
  });

  // Select first allowed step
  if (allowedSteps.length > 0) {
    selectGuideStep(allowedSteps[0]);
  }
}

  if (completed && typeof showToast === 'function') {
    showToast('🎉 Đã hoàn thành hướng dẫn!');
  }
}

// Autostart tour once for first time users (after ensuring main page loaded)
function checkAutoStartTour() {
  const hasSeen = localStorage.getItem('cj_has_seen_tour');
  if (!hasSeen) {
    localStorage.setItem('cj_has_seen_tour', 'true');
    // Start tour after a delay to ensure app is fully loaded
    setTimeout(() => {
      startAppTour();
    }, 2500);
  }
}

// Add event listener to check auto start when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkAutoStartTour, 1000);
});
