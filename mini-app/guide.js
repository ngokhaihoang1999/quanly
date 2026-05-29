// ============ INTERACTIVE APP TOUR & WIKI MODULE ============
// guide.js - Provides game-like interactive onboarding tour and guide wiki

const APP_TOUR_STEPS = [
  {
    element: '#headerAvatar',
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
    element: '#dashUnitTitle',
    title: '🏢 Tab Đơn vị (Dashboard)',
    text: 'Hiển thị các chỉ số đo lường (Metrics) tổng quan của toàn bộ hệ thống và danh sách học viên cấp dưới phân theo từng nhóm.',
    tab: 'unit'
  },
  {
    element: '#dashMyListTitle',
    title: '👤 Tab Cá nhân',
    text: 'Đây là không gian làm việc riêng của bạn. Hiển thị danh sách học viên (Trái) do chính bạn trực tiếp phụ trách chăm sóc.',
    tab: 'personal'
  },
  {
    element: '#tab-priority .section-title',
    title: '⚡ Tab Ưu tiên',
    text: 'Tổng hợp danh sách các đầu việc quan trọng cần xử lý gấp (nhắc nhở viết báo cáo, hoàn thành mốc tiến độ hồ sơ).',
    tab: 'priority'
  },
  {
    element: '#calendarNav',
    title: '📅 Tab Lịch hẹn',
    text: 'Theo dõi lịch biểu, các cuộc hẹn phỏng vấn học viên hoặc các sự kiện quan trọng trong tháng cực kỳ trực quan.',
    tab: 'calendar'
  },
  {
    element: '#notesFilterChips',
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
        <li><b>Cách tạo:</b> Bấm vào nút <b>➕ (FAB - Floating Action Button)</b> màu nổi bật ở góc dưới bên phải màn hình chính của ứng dụng.</li>
        <li><b>Nhập thông tin:</b> Điền đầy đủ, chính xác các trường thông tin cơ bản: Họ tên học viên, năm sinh, số điện thoại liên hệ, khu vực sinh sống, Tư vấn viên (TVV) trực tiếp chăm sóc, và đặc biệt là các thông tin đánh giá ban đầu về điều kiện tham gia (Hapja).</li>
        <li><b>Lưu Bản nháp (Draft):</b> Nếu đang điền dở mà vô tình đóng modal, hệ thống sẽ tự động lưu bản nháp vào thiết bị. Khi mở lại biểu mẫu, bạn sẽ nhận được thông báo để khôi phục hoặc xóa bản nháp tùy chọn.</li>
        <li><b>Chờ duyệt:</b> Sau khi nhấn gửi, thông tin học viên sẽ được lưu dưới dạng phiếu <i>Chờ duyệt</i> trong tab <b>Check Hapja</b>.</li>
        <li><b>Duyệt phiếu:</b> Cấp quản lý được phân quyền (Tổ trưởng <b>GYJN</b>, Tổ phó <b>BGYJN</b>, Nhóm trưởng <b>TJN</b>, Khu vực trưởng <b>YJYN</b>) sẽ vào danh sách kiểm tra thông tin. Nếu đủ tiêu chuẩn, quản lý bấm <b>Duyệt ✅</b>. Hệ thống sẽ tự động tạo hồ sơ học viên chính thức trong cơ sở dữ liệu và chuyển sang giai đoạn tiếp theo.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>FAB ➕</span><small>Tạo phiếu & Lưu nháp</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Phiếu Hapja 📋</span><small>Chờ quản lý duyệt</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Duyệt ✅</span><small>GYJN / TJN / YJYN</small></div>
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
      <p><b>Quản lý Thông tin hành chính & Vòng đời học tập của học viên:</b></p>
      <ul>
        <li><b>Xem & Chỉnh sửa hồ sơ:</b> Tại màn hình chi tiết của học viên, người dẫn dắt (NDD) hoặc quản lý có thể cập nhật các thông tin cơ bản: SĐT, người kết nối, phân công nhân sự phụ trách (TVV, GVBB, Lá), điều chỉnh tổ nhóm học tập.</li>
        <li><b>Quản lý 3 trạng thái cốt lõi:</b></li>
        <li>🟢 <b>Alive (Hoạt động):</b> Học viên đang tham gia đầy đủ các buổi gặp mặt, học tập BB hoặc lớp Center bình thường. Đây là trạng thái mặc định của mọi học viên mới được duyệt.</li>
        <li>⏸️ <b>Pause (Tạm dừng):</b> Dùng khi học viên tạm thời nghỉ học ngắn hạn (do ốm đau, bận việc gia đình đột xuất, đi du lịch, đổi ca học). Khi ở trạng thái này, nhóm hỗ trợ cần liên tục tương tác giữ ấm mối quan hệ để kích hoạt trở lại trạng thái hoạt động (🟢 Alive).</li>
        <li>🔴 <b>Drop-out (Nghỉ học hẳn):</b> Dùng khi học viên chính thức nghỉ học hoặc không thể tiếp tục hỗ trợ. <b>Yêu cầu bắt buộc:</b> Khi chuyển sang trạng thái này, hệ thống sẽ yêu cầu bạn chọn một lý do cụ thể (áp lực gia đình, bận công việc/thời gian, rào cản tài chính, mất liên lạc hoàn toàn, thái độ không phù hợp, v.v.). Đây là cơ sở dữ liệu cực kỳ quan trọng để hệ thống phân tích và cải tiến phương pháp chăm sóc.</li>
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
    title: "3. Nhật ký & Báo cáo Tư vấn (TV) 💬",
    label: "Nhật ký TV",
    icon: "💬",
    keywords: ["tư vấn", "tv", "báo cáo", "nhật ký", "tình trạng", "tâm lý", "ghi chú"],
    content: `
      <p><b>Quản lý cuộc hẹn và Ghi nhận báo cáo Tư vấn tâm lý:</b></p>
      <ul>
        <li><b>Đặt lịch chốt TV:</b> NDD hoặc quản lý đặt lịch hẹn tư vấn trực tiếp trên hệ thống. <b>Lưu ý tự động hóa:</b> Sau 1 tiếng kể từ thời điểm giờ hẹn chốt TV, hệ thống sẽ tự động tạo một công việc <i>"Viết Báo cáo Tư vấn"</i> trong tab <b>Ưu tiên</b> của TVV/NDD để nhắc nhở họ làm báo cáo kịp thời.</li>
        <li><b>Quy trình Tư vấn:</b> TVV thực hiện các buổi trò chuyện sâu (thường có ít nhất 2 lần tư vấn). Sử dụng các công cụ trắc nghiệm tính cách chính xác như <b>Enneagram</b>, <b>MBTI</b> hoặc bảng phân tích điểm hại (nỗi sợ, khó khăn) để thấu hiểu sâu sắc thế giới nội tâm của học viên.</li>
        <li><b>Ghi nhận báo cáo:</b> TVV hoặc người được phân quyền truy cập hồ sơ nhấn nút <b>➕ Thêm ghi nhận</b> để lưu lại diễn biến buổi tư vấn. Nội dung báo cáo bao gồm: Ngày giờ, công cụ áp dụng, đánh giá mức độ tin cậy/tiếp thu, các điểm tâm lý nhạy cảm cần lưu ý và đề xuất định hướng hỗ trợ tiếp theo.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Hẹn Lịch 📅</span><small>Tự động tạo task sau 1h</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Trắc Nghiệm 🧠</span><small>Enneagram, MBTI</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Phân Tích 📝</span><small>Tìm điểm chạm tâm lý</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Báo Cáo 💬</span><small>Ghi nhận hồ sơ hệ thống</small></div>
      </div>
    `
  },
  {
    step: 4,
    title: "4. Nhóm hỗ trợ & Telegram (Group TV-BB) 🤝",
    label: "Group TV-BB",
    icon: "🤝",
    keywords: ["telegram", "nhóm", "group", "chat", "thảo luận", "liên kết", "kết nối", "tv-bb"],
    content: `
      <p><b>Liên kết và Đồng bộ thông tin qua Nhóm hỗ trợ (Group Telegram):</b></p>
      <ul>
        <li><b>Phân công Nhân sự phụ trách:</b> Mỗi học viên sẽ được đồng hành bởi một nhóm nhân sự chuyên biệt bao gồm: Tư vấn viên (TVV), Người dẫn dắt (NDD), Giáo viên BB (GVBB) và các nhân sự hỗ trợ (Lá).</li>
        <li><b>Lập group Telegram:</b> NDD tạo một nhóm chat riêng trên Telegram với tất cả thành viên phụ trách trên kèm theo **Bot Quản lý** của hệ thống.</li>
        <li><b>Liên kết Group:</b> Bấm vào biểu tượng Telegram hoặc nút <b>Liên kết Group</b> trong hồ sơ học viên để gắn đường link chat vào hệ thống.</li>
        <li><b>Bot báo cáo tự động:</b> Khi liên kết thành công, hệ thống sẽ kích hoạt webhook. Mọi thao tác quan trọng trên app (giao bài tập về nhà mới, học viên nộp bài tập, giáo viên chấm bài xong, cập nhật báo cáo buổi học BB mới, hoặc hoàn thành các mốc tiến độ hồ sơ) sẽ tự động được Bot gửi tin nhắn tức thời vào nhóm Telegram để toàn bộ nhân sự phụ trách cùng nắm bắt và hỗ trợ kịp thời.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Phân Sự 👥</span><small>TVV, NDD, GVBB, Lá</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Lập Nhóm 💬</span><small>Group Telegram riêng</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Liên Kết 🔗</span><small>Dán link vào hồ sơ</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Webhook 🤖</span><small>Bot đẩy tin nhắn auto</small></div>
      </div>
    `
  },
  {
    step: 5,
    title: "5. Theo dõi 4 Mốc Tiến độ ⭐",
    label: "Tiến độ",
    icon: "⭐",
    keywords: ["milestone", "mốc", "bài đặc biệt", "tiến độ", "phỏng vấn", "đăng ký center", "đk center"],
    content: `
      <p><b>Đánh giá chất lượng hồ sơ qua 4 Mốc Tiến độ quan trọng:</b></p>
      <ul>
        <li>Để đảm bảo học viên tiếp thu tốt kiến thức và sẵn sàng chuyển sang giai đoạn học tập chuyên sâu cao hơn, hệ thống giám sát chặt chẽ 4 mốc tiến độ chính (tương ứng với các nút tích hoàn thành trong hồ sơ):</li>
        <li>1️⃣ <b>Bài đặc biệt:</b> Bài viết hoặc bài thu hoạch tâm đắc của học viên để đánh giá mức độ thấu hiểu và khao khát thay đổi bản thân.</li>
        <li>2️⃣ <b>Phỏng vấn GVBB:</b> Buổi phỏng vấn và đánh giá chuyên môn trực tiếp từ Giáo viên BB hướng dẫn, xác nhận học viên đã nắm vững các kiến thức nền tảng.</li>
        <li>3️⃣ <b>Đăng ký Center:</b> Đăng ký chính thức lớp học chuyên sâu, xác nhận lịch trình sinh hoạt và cam kết thời gian của học viên.</li>
        <li>4️⃣ <b>Phỏng vấn Học viên:</b> Cuộc gặp gỡ, phỏng vấn chất lượng cuối cùng từ đại diện quản lý cấp trên để kiểm định tấm lòng và sự an toàn của học viên.</li>
        <li><b>Quy trình cập nhật:</b> Khi hoàn thành mốc nào, GVBB hoặc quản lý phụ trách sẽ bấm hoàn thành mốc đó trực tiếp trong tab Giai đoạn. Cả 4 mốc này phải được hoàn thành 100% thì hệ thống mới cho phép mở chức năng chốt chuyển sang lớp Center.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Bài Đặc Biệt 📝</span><small>Mốc 1</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>PV GVBB 🎤</span><small>Mốc 2</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>ĐK Center 🏛️</span><small>Mốc 3</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>PV Học Viên 🤝</span><small>Mốc 4 (Hoàn thành)</small></div>
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
      <p><b>Hoàn tất biểu mẫu Sinka và Chốt hồ sơ nhập học lớp Center:</b></p>
      <ul>
        <li><b>Phiếu Sinka (Thẻ học viên):</b> Đây là phiếu lý lịch nhập học chi tiết của học viên. Phiếu Sinka cần được điền tích lũy và cập nhật <i>liên tục và xuyên suốt</i> ngay sau khi học viên bước vào giai đoạn Tư vấn (phase <code>tu_van</code>). Tuyệt đối tránh dồn việc điền Sinka vào phút chót.</li>
        <li><b>Điền thông tin Sinka:</b> Vào tab <b>Thẻ HV</b> trong hồ sơ học viên. Điền chi tiết các trường thông tin hành chính, học vấn, công việc, đặc điểm tính cách, và nhận xét chung của nhóm hỗ trợ. Bấm <b>Lưu thông tin Sinka</b> để cập nhật dữ liệu.</li>
        <li><b>Nút Chốt Center:</b> Khi học viên đã hoàn thành đầy đủ cả 4 mốc tiến độ quan trọng ở giai đoạn học BB, nút <b>🏛️ Chốt Center</b> sẽ tự động hiển thị trong tab Giai đoạn.</li>
        <li><b>Chốt Center & Xuất File Word:</b> Người được phân quyền bấm <b>Chốt Center</b> để chính thức đóng hồ sơ giai đoạn BB và chuyển học viên lên danh sách lớp Center. Luôn sẵn sàng tải thẻ học viên Center dưới dạng file Word đẹp mắt.</li>
      </ul>
      <div class="guide-flowchart">
        <div class="guide-flow-step"><span>Nhập Sinka 📜</span><small>Điền tích lũy</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Đủ 4 mốc BB ⭐</span><small>Mở nút chốt</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Bấm Chốt Center 🏛️</span><small>Chuyển phase Center</small></div>
        <div class="guide-flow-arrow">➔</div>
        <div class="guide-flow-step"><span>Tải Word 📄</span><small>Xuất Thẻ HV Center</small></div>
      </div>
    `
  }
];

const WIKI_ITEMS = [
  {
    title: "Làm thế nào để đổi Màu sắc Chủ đề hoặc Biệt danh?",
    keywords: ["chủ đề", "theme", "màu", "biệt danh", "nickname", "cá nhân hóa"],
    content: "Bấm vào ảnh đại diện (avatar) của bạn ở góc trên cùng bên trái. Mục <b>Cá nhân hóa</b> sẽ mở ra, tại đây bạn có thể nhập biệt danh mới và chọn mã màu yêu thích làm màu chủ đề chính cho toàn bộ ứng dụng."
  },
  {
    title: "Làm thế nào để bật/tắt nhận thông báo qua Telegram?",
    keywords: ["thông báo", "notif", "telegram", "chuông", "lọc", "nhận tin"],
    content: "Bấm vào biểu tượng <b>Chuông thông báo 🔔</b> ở góc trên bên phải. Tiếp tục bấm vào biểu tượng <b>Bánh răng ⚙️</b> ở góc phải của panel thông báo. Tại đây, bạn có thể tích chọn/bỏ chọn từng loại thông báo muốn nhận (Nhận trong App hoặc nhận qua Telegram)."
  },
  {
    title: "Chức năng 'Ghim tab' hoạt động như thế nào?",
    keywords: ["ghim", "pin", "tab", "làm việc", "nhanh", "desktop"],
    content: "Khi làm việc trên máy tính (màn hình lớn), bạn có thể ghim các tab thường dùng (như Notes, Ưu tiên, Lịch) sang cột trái hoặc cột phải. Để ghim, hãy mở phần Cài đặt (nhấn avatar) ➡️ Chọn mục <b>Ghim Tab</b> ➡️ Tích chọn tab muốn ghim. Giao diện sẽ tự động chia làm 2 hoặc 3 cột cực kỳ trực quan."
  },
  {
    title: "Làm thế nào để sửa lỗi hiển thị dữ liệu sai kỳ học?",
    keywords: ["kỳ học", "tháng", "sai dữ liệu", "reload", "tải lại", "cập nhật"],
    content: "Hãy kiểm tra xem bộ chọn <b>📅 Kỳ</b> ở trên cùng có đang chọn đúng Kỳ hiện tại của bạn không. Dữ liệu sẽ tự động lọc theo kỳ. Nếu dữ liệu chưa được cập nhật mới nhất, hãy bấm nút <b>🔄 (Tải lại)</b> ở góc phải thanh kỳ học để tải lại dữ liệu tab hiện tại."
  }
];

const PROFILE_TABS_DATA = [
  {
    id: "info",
    title: "1. Thông tin",
    icon: "ℹ️",
    desc: `<b>Quản lý Hồ sơ Hành chính & Liên hệ:</b><br/>
      • <b>Nội dung:</b> Nơi tập trung toàn bộ lý lịch hành chính cốt lõi gồm Họ tên, năm sinh, SĐT liên lạc cá nhân, liên kết người giới thiệu/người dẫn dắt (NDD), Tư vấn viên (TVV) phụ trách, và phân khu đơn vị sinh hoạt (Tổ/Nhóm/Khu vực).<br/>
      • <b>Phân quyền:</b> Chỉ Admin, Người dẫn dắt trực tiếp (NDD) và các cấp quản lý từ Đơn vị trở lên (Tổ trưởng GYJN+) mới có quyền chỉnh sửa các thông tin này để bảo mật dữ liệu tuyệt đối.<br/>
      • <b>Tính năng nổi bật:</b> Hỗ trợ tính năng <i>Lưu nháp tự động (Auto-Save Draft)</i> khi chỉnh sửa. Nếu xảy ra sự cố sập app, mất mạng hoặc vô tình đóng modal, hệ thống sẽ lưu tạm để bạn khôi phục lại ngay lần mở sau mà không bị mất dữ liệu đã nhập.`
  },
  {
    id: "stage",
    title: "2. Giai đoạn",
    icon: "🗓️",
    desc: `<b>Kiểm soát Vòng đời Học tập & Lịch trình (5 Phase):</b><br/>
      • <b>Nội dung:</b> Quản lý quá trình chuyển giao từng bước một cách chặt chẽ qua 5 Phase: <code>Chakki</code> ➔ <code>TV Hình</code> ➔ <code>Tư vấn</code> ➔ <code>BB (Học tập)</code> ➔ <code>Center</code>.<br/>
      • <b>Các nút hành động nghiệp vụ quan trọng:</b><br/>
      &nbsp;&nbsp; - <i>Lập group TV-BB:</i> Tự động kiểm tra điều kiện nhân sự trước khi cho phép liên kết nhóm Telegram hỗ trợ.<br/>
      &nbsp;&nbsp; - <i>Mở KT (Kinh Thánh):</i> Đánh dấu bước tiến quan trọng khi bắt đầu tiết lộ nội dung Kinh thánh cho học viên.<br/>
      &nbsp;&nbsp; - <i>Chốt Center:</i> Nút bấm quan trọng nhất để hoàn thành giai đoạn học BB và chuyển lên lớp Center 100 buổi.<br/>
      • <b>Mẹo thao tác:</b> Hãy chắc chắn cập nhật các thông tin nhân sự và hoàn thành đầy đủ 4 mốc tiến độ BB trước khi thực hiện chuyển phase.`
  },
  {
    id: "tv",
    title: "3. TV (Tư vấn)",
    icon: "💬",
    desc: `<b>Quản lý Lịch hẹn & Nhật ký Tư vấn tâm lý:</b><br/>
      • <b>Nội dung:</b> Ghi nhận thời gian các buổi hẹn tư vấn và toàn bộ báo cáo chi tiết sau mỗi lần gặp gỡ. Thường quy trình có tối thiểu 2 lần tư vấn chính thức trước khi học viên bước vào khóa học.<br/>
      • <b>Tích hợp trắc nghiệm tính cách:</b> Cho phép lưu trữ và hiển thị kết quả phân tích các bài test tâm lý (Enneagram, MBTI), phân tích rõ "điểm hại" (nỗi sợ, trở ngại lớn nhất) và đề xuất phương án dẫn dắt cụ thể.<br/>
      • <b>Tự động hóa thông minh:</b> 1 giờ sau mốc thời gian hẹn chốt TV, hệ thống sẽ tự động tạo một task nhắc nhở <i>"Viết Báo cáo TV"</i> gửi thẳng vào tab <b>Ưu tiên</b> của TVV/NDD, giúp hạn chế tối đa việc quên ghi nhận báo cáo.`
  },
  {
    id: "bb",
    title: "4. BB (Học tập)",
    icon: "📖",
    desc: `<b>Giám sát Mạch bài giảng 12 buổi BB & 4 Mốc hồ sơ:</b><br/>
      • <b>Nội dung:</b> Nhật ký chi tiết của Giáo viên BB (GVBB) ghi lại sau mỗi buổi dạy về mức độ phản hồi, thái độ tiếp thu, và các thông tin khai thác mới của học viên.<br/>
      • <b>Nhắc lịch dạy tiếp theo:</b> Khi lưu báo cáo buổi học, GVBB nhập thời gian dự kiến cho buổi tiếp theo. Đúng 1 giờ sau giờ học đó, hệ thống sẽ tự động tạo task <i>"Viết BC BB buổi N"</i> trong tab <b>Ưu tiên</b>.<br/>
      • <b>Bảng kiểm soát 4 mốc tiến độ BB:</b> Nơi GVBB hoặc quản lý tích chọn xác nhận hoàn thành: <i>Bài đặc biệt</i>, <i>Phỏng vấn GVBB</i>, <i>Đăng ký Center</i>, và <i>Phỏng vấn Học viên</i>. Đây là điều kiện tiên quyết để được Chốt Center.`
  },
  {
    id: "btvn",
    title: "5. BTVN (Bài tập)",
    icon: "📝",
    desc: `<b>Quản lý Giao bài & Chấm bài tập về nhà:</b><br/>
      • <b>Nội dung:</b> Giáo viên BB giao các bài tập rèn luyện tư duy kèm theo thời hạn nộp cụ thể trực tiếp trên hệ thống.<br/>
      • <b>Trạng thái làm bài:</b> Theo dõi trạng thái nộp bài qua các nhãn màu trực quan: 🔴 <i>Chưa làm</i>, 🟡 <i>Đã nộp</i> (chờ chấm), 🟢 <i>Đã chấm</i>. Giáo viên có thể chấm điểm và viết nhận xét chi tiết bài làm.<br/>
      • <b>Đong bộ Telegram:</b> Mỗi khi có bài tập mới được giao, học viên nộp bài hoặc giáo viên hoàn thành chấm bài, Bot Telegram của hệ thống sẽ tự động gửi thông báo chi tiết vào nhóm hỗ trợ TV-BB giúp việc phối hợp đôn đốc học viên cực kỳ nhịp nhàng.`
  },
  {
    id: "notes",
    title: "6. Ghi chú",
    icon: "🗒️",
    desc: `<b>Không gian Ghi chép nội bộ & Bảo an nhạy cảm:</b><br/>
      • <b>Nội dung:</b> Lưu trữ các ghi chép nhanh, thông báo khẩn cấp, các phát hiện tâm lý nhạy cảm hoặc kế hoạch bảo an đặc biệt dành riêng cho học viên.<br/>
      • <b>Lưu trữ an toàn:</b> Mọi thông tin tại đây được bảo mật tuyệt đối, chỉ hiển thị với các thành viên trong nhóm hỗ trợ trực tiếp và các cấp quản lý đơn vị phụ trách.<br/>
      • <b>Mẹo cộng tác:</b> Các thành viên có thể đọc và cập nhật liên tục để hiểu rõ hiện trạng mới nhất của học viên trước khi tiến hành dạy học hoặc tư vấn, tránh tình trạng thông tin bị lệch pha giữa TVV, NDD và GVBB.`
  },
  {
    id: "discuss",
    title: "7. Thảo luận",
    icon: "💬",
    desc: `<b>Kênh Chat nội bộ Bảo mật & Tức thời:</b><br/>
      • <b>Nội dung:</b> Phòng chat nội bộ thời gian thực tích hợp sẵn ngay trong hồ sơ học viên, cho phép TVV, NDD, GVBB và các Lá trao đổi, bàn bạc phương án hỗ trợ học viên mọi lúc mọi nơi.<br/>
      • <b>Chức năng nâng cao:</b> Hỗ trợ gửi tin nhắn văn bản, emoji, tag tên đồng nghiệp (@mention), ghi âm giọng nói trực tiếp (Voice message), gửi tệp tin đa phương tiện (ảnh, video) kèm trình phát đa phương tiện độc lập ngay trong app.<br/>
      • <b>Lợi ích:</b> Giúp tập trung toàn bộ lịch sử thảo luận về học viên tại một nơi duy nhất trên hệ thống, không bị trôi tin nhắn hoặc lộ lọt thông tin nhạy cảm ra các nền tảng chat công cộng bên ngoài.`
  },
  {
    id: "sinkacard",
    title: "8. Thẻ HV (Sinka)",
    icon: "📜",
    desc: `<b>Điền Sinka Lý lịch & Xuất file Word nhập học:</b><br/>
      • <b>Nội dung:</b> Biểu mẫu Sinka thu thập thông tin lý lịch nhập học chi tiết của học viên (tiểu sử gia đình, hoàn cảnh học tập, xu hướng tâm lý, công việc hiện tại, nhận xét của nhóm hỗ trợ).<br/>
      • <b>Điền thông tin tích lũy:</b> Nên điền tích lũy dần thông tin ngay từ giai đoạn tư vấn học viên để dữ liệu đầy đủ và chính xác nhất.<br/>
      • <b>Tự động điền & Xuất Word (.docx):</b> Hệ thống tự động lấy các thông tin hành chính có sẵn trong hồ sơ để điền sẵn vào biểu mẫu Sinka. Khi học viên sẵn sàng nhập học, người dùng chỉ cần bấm nút xuất thẻ để tải ngay file Word (.docx) mẫu Thẻ Học viên Center chính thức được thiết kế chuẩn chỉ để lưu trữ vật lý.`
  },
  {
    id: "mindmap",
    title: "9. Tư Duy",
    icon: "🗺️",
    desc: `<b>Sơ đồ Tư duy Tâm lý (Mindmap) Trực quan:</b><br/>
      • <b>Nội dung:</b> Biến toàn bộ các dữ liệu phân tích tâm lý, hoàn cảnh, khó khăn và chiến lược dẫn dắt học viên thành một sơ đồ tư duy dạng cây tương tác cực kỳ trực quan và sinh động.<br/>
      • <b>Công nghệ tích hợp:</b> Sử dụng thư viện <b>Markmap CDN</b> cao cấp để biên dịch mã Markdown thành sơ đồ SVG tương tác. Bạn có thể thu phóng (zoom in/out), kéo di chuyển (drag) và đóng/mở các nút nhánh sơ đồ một cách mượt mà.<br/>
      • <b>Lợi ích:</b> Giúp người xem (đặc biệt là quản lý cấp trên hoặc GVBB mới nhận lớp) chỉ cần nhìn lướt qua trong 30 giây là nắm bắt được toàn bộ chiến lược chăm sóc và "chìa khóa tâm lý" của học viên.`
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
        <div class="modal-title" style="margin:0; font-size:16px;">❓ Cẩm nang hướng dẫn</div>
        <button onclick="closeModal('guideCenterModal')" style="background:none; border:none; color:var(--text2); font-size:16px; cursor:pointer; font-weight:bold; padding:4px;">✕</button>
      </div>
      
      <div class="guide-center-container">
        <!-- Search bar -->
        <div class="guide-search-wrap">
          <span class="icon">🔍</span>
          <input type="text" placeholder="Tìm hướng dẫn (vd: sinka, btvn, dropout...)" id="guideSearchInput" oninput="onGuideSearch(this.value)" autocomplete="off" />
        </div>

        <!-- Navigation Tabs -->
        <div class="guide-tabs" id="guideTabs">
          <div class="guide-tab-btn active" id="gtab_jondo" onclick="switchGuideTab('jondo')">📋 Quy trình hồ sơ trái</div>
          <div class="guide-tab-btn" id="gtab_tabs" onclick="switchGuideTab('tabs')">🗂️ 9 Tab Hồ Sơ</div>
          <div class="guide-tab-btn" id="gtab_tour" onclick="switchGuideTab('tour')">🚀 Tour Giao Diện</div>
          <div class="guide-tab-btn" id="gtab_help" onclick="switchGuideTab('help')">💡 Hỏi đáp & Trợ giúp</div>
        </div>

        <!-- Tab 1: Stepper quy trình -->
        <div id="guidePane_jondo">
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
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px; padding:4px 0;">
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
  if (currentHighlightedEl) {
    currentHighlightedEl.classList.remove('tour-highlight');
    currentHighlightedEl.classList.remove('tour-highlight-static');
    currentHighlightedEl = null;
  }
  
  if (tourOverlayEl) {
    tourOverlayEl.remove();
    tourOverlayEl = null;
  }

  if (tourTooltipEl) {
    tourTooltipEl.remove();
    tourTooltipEl = null;
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
