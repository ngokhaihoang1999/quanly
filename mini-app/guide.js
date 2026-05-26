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
    text: 'Đây chính là nút mở Cẩm nang hướng dẫn này bất cứ lúc nào để tra cứu quy trình Quản lý Jondo hoặc chạy lại tour giao diện.',
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
      <p><b>Quy trình khởi tạo học viên mới:</b></p>
      <ul>
        <li>Bấm nút <b>➕ (FAB)</b> ở góc dưới bên phải màn hình chính.</li>
        <li>Điền đầy đủ thông tin ban đầu của học viên (Họ tên, năm sinh, TVV phụ trách, v.v.).</li>
        <li>Sau khi gửi, phiếu sẽ nằm ở trạng thái <i>Chờ duyệt</i> trong mục <b>Check Hapja</b>.</li>
        <li><b>Người đại diện (NDD)</b> sẽ vào xem xét thông tin và bấm duyệt. Khi được duyệt, hồ sơ (Profile) chính thức của học viên sẽ tự động được hệ thống tạo lập.</li>
      </ul>
      <div class="guide-illustration">
        <div class="guide-ill-row"><span class="guide-ill-badge">FAB ➕</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Phiếu Hapja 📋</span><div class="guide-ill-bar"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Duyệt ➔ Profile 👤</span><div class="guide-ill-bar fill"></div></div>
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
      <p><b>Quản lý thông tin & Vòng đời học viên:</b></p>
      <ul>
        <li>Trong Profile học viên, bạn có thể xem/sửa các trường thông tin hành chính, số điện thoại, người kết nối.</li>
        <li><b>Quản lý trạng thái học viên:</b></li>
        <li>🟢 <b>Alive:</b> Học viên đang hoạt động, học tập bình thường.</li>
        <li>⏸️ <b>Pause:</b> Học viên tạm dừng học (do bận, ốm, chuyển khóa). Cần theo dõi để kích hoạt lại.</li>
        <li>🔴 <b>Drop-out:</b> Học viên đã nghỉ học hẳn. Khi chuyển trạng thái này, cần chọn lý do cụ thể (tài chính, thời gian, mất liên lạc, v.v.) để hệ thống thống kê.</li>
      </ul>
      <div class="guide-illustration">
        <div class="guide-ill-row"><span style="color:var(--green)">🟢 Alive (Hoạt động)</span><div class="guide-ill-bar fill" style="background:var(--green)"></div></div>
        <div class="guide-ill-row"><span style="color:var(--yellow)">⏸️ Pause (Tạm dừng)</span><div class="guide-ill-bar fill" style="background:var(--yellow)"></div></div>
        <div class="guide-ill-row"><span style="color:var(--red)">🔴 Drop-out (Nghỉ học)</span><div class="guide-ill-bar fill" style="background:var(--red)"></div></div>
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
      <p><b>Theo dõi sát sao tình hình học viên:</b></p>
      <ul>
        <li>Trong hồ sơ học viên, chọn mục <b>Nhật ký tư vấn (TV)</b>.</li>
        <li>Nhấn <b>➕ Thêm ghi nhận</b> để nhập báo cáo sau mỗi buổi tư vấn hoặc gặp gỡ học viên.</li>
        <li>Báo cáo bao gồm: Ngày tư vấn, nội dung trao đổi, đánh giá mức độ tiếp thu, và các ghi chú tâm lý đặc biệt.</li>
        <li>NDD và Tổ trưởng sẽ đọc các báo cáo này để cùng thảo luận hướng hỗ trợ tốt nhất cho học viên.</li>
      </ul>
      <div class="guide-illustration">
        <div class="guide-ill-row"><span class="guide-ill-badge">Gặp gỡ 🤝</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Báo cáo TV 💬</span><div class="guide-ill-bar fill"></div></div>
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
      <p><b>Phối hợp hỗ trợ đồng bộ:</b></p>
      <ul>
        <li>Mỗi học viên có một <b>Nhóm hỗ trợ (Group TV-BB)</b> gồm Tư vấn viên (TVV), Người đại diện (NDD) và Giáo viên (GVBB).</li>
        <li>Trong Profile, bấm vào biểu tượng Telegram hoặc nút <b>Liên kết Group</b> để gắn link nhóm Telegram hỗ trợ.</li>
        <li>Khi liên kết thành công, mọi thông báo quan trọng của học viên (báo cáo BTVN mới, cập nhật mốc tiến độ) sẽ tự động gửi thẳng vào group Telegram này thông qua Telegram Bot của hệ thống, giúp các nhân sự không bị bỏ lỡ thông tin.</li>
      </ul>
      <div class="guide-illustration">
        <div class="guide-ill-row"><span class="guide-ill-badge">Nhân sự 👥</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Group Telegram 💬</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Bot thông báo 🤖</span><div class="guide-ill-bar fill"></div></div>
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
      <p><b>Kiểm soát tiến độ hoàn thành hồ sơ:</b></p>
      <ul>
        <li>Tiến độ của một Jondo được đánh giá qua 4 mốc quan trọng trong Profile:</li>
        <li>1. <b>Bài đặc biệt:</b> Bài viết hoặc thu hoạch đặc biệt của học viên.</li>
        <li>2. <b>Phỏng vấn GVBB:</b> Đánh giá chuyên môn từ Giáo viên hướng dẫn.</li>
        <li>3. <b>Đăng ký Center:</b> Đăng ký cơ sở học tập chính thức cho học viên.</li>
        <li>4. <b>Phỏng vấn Học viên:</b> Buổi phỏng vấn cuối cùng kiểm tra chất lượng.</li>
        <li>Khi hoàn thành mốc nào, tích chọn mốc đó trong Profile để hệ thống cập nhật tiến độ tổng quan.</li>
      </ul>
      <div class="guide-illustration">
        <div class="guide-ill-row"><span class="guide-ill-badge">Mốc 1</span><span>Bài đặc biệt 📝</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Mốc 2</span><span>Phỏng vấn GVBB 🗣️</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Mốc 3</span><span>Đăng ký Center 🏢</span><div class="guide-ill-bar"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Mốc 4</span><span>Phỏng vấn Học viên 🤝</span><div class="guide-ill-bar"></div></div>
      </div>
    `
  },
  {
    step: 6,
    title: "6. Chốt Center (Thẻ Sinka) 🏢",
    label: "Chốt Center",
    icon: "🏢",
    keywords: ["sinka", "chốt", "nhập học", "center", "xuất word", "in thẻ", "hoàn thành"],
    content: `
      <p><b>Hoàn tất quy trình Jondo chuyển lên Center:</b></p>
      <ul>
        <li>Khi học viên đạt đủ điều kiện và hoàn thành các mốc tiến độ, vào tab <b>Thẻ Sinka</b> trong Profile.</li>
        <li>Điền đầy đủ thông tin hành chính nhập học chi tiết của học viên.</li>
        <li>Bấm <b>Xuất file Word (Thẻ học viên)</b> để tải xuống mẫu thẻ nhập học chính thức được tự động điền toàn bộ dữ liệu.</li>
        <li>Sau khi chốt Sinka thành công, trạng thái Jondo sẽ được cập nhật hoàn thành chuyển sang Center.</li>
      </ul>
      <div class="guide-illustration">
        <div class="guide-ill-row"><span class="guide-ill-badge">Form Sinka 📝</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Xuất file Word 📄</span><div class="guide-ill-bar fill"></div></div>
        <div class="guide-ill-row"><span class="guide-ill-badge">Center 🏢</span><div class="guide-ill-bar fill"></div></div>
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
          <div class="guide-tab-btn active" id="gtab_jondo" onclick="switchGuideTab('jondo')">📋 Quản lý Jondo</div>
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

        <!-- Tab 2: FAQ & Tour launcher -->
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
            
            <div style="margin-top:10px; border-top:1px solid var(--border); padding-top:14px; text-align:center;">
              <div style="font-size:11px; color:var(--text2); margin-bottom:8px;">Bạn muốn làm quen nhanh các nút bấm chính trên màn hình?</div>
              <button class="form-btn" onclick="closeModal('guideCenterModal'); startAppTour();" style="background:linear-gradient(135deg,var(--accent),var(--accent2)); margin:0; display:flex; align-items:center; justify-content:center; gap:6px; width:100%;">
                🚀 Bắt đầu Tour hướng dẫn giao diện (10 bước)
              </button>
            </div>
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
  document.getElementById('guidePane_help').style.display = tab === 'help' ? 'block' : 'none';

  document.getElementById('gtab_jondo').classList.toggle('active', tab === 'jondo');
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
    // Restore current active step or jondo pane
    if (activeGuideTab === 'jondo') {
      document.getElementById('guidePane_jondo').style.display = 'block';
      document.getElementById('guidePane_help').style.display = 'none';
      selectGuideStep(activeGuideStep);
    } else {
      document.getElementById('guidePane_jondo').style.display = 'none';
      document.getElementById('guidePane_help').style.display = 'block';
    }
    return;
  }
  
  // Hide stepper and tabs layout during search to show clean results
  if (stepper) stepper.style.display = 'none';
  if (tabs) tabs.style.display = 'none';
  document.getElementById('guidePane_jondo').style.display = 'block';
  document.getElementById('guidePane_help').style.display = 'none';
  
  // Search Jondo steps
  const matchedSteps = JONDO_STEPS_DATA.filter(item => {
    return item.title.toLowerCase().includes(q) || 
           item.content.toLowerCase().includes(q) || 
           item.keywords.some(k => k.includes(q));
  });
  
  // Search FAQs Wiki
  const matchedWiki = WIKI_ITEMS.filter(item => {
    return item.title.toLowerCase().includes(q) || 
           item.content.toLowerCase().includes(q) || 
           item.keywords.some(k => k.includes(q));
  });
  
  if (matchedSteps.length === 0 && matchedWiki.length === 0) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Không tìm thấy kết quả</div>
        <div class="empty-sub">Hãy thử gõ từ khóa khác như "hapja", "dropout", "sinka", "telegram"...</div>
      </div>
    `;
    return;
  }
  
  let html = `<div style="display:flex;flex-direction:column;gap:12px;">`;
  
  if (matchedSteps.length > 0) {
    html += `<div style="font-weight:700;font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;">Tiến trình Quản lý Jondo (${matchedSteps.length})</div>`;
    matchedSteps.forEach(step => {
      html += `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:6px;">
          <div style="font-weight:700;font-size:13px;color:var(--accent2);margin-bottom:6px;">${step.title}</div>
          <div class="guide-content-body">${step.content}</div>
        </div>
      `;
    });
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
