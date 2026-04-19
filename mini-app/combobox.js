// combobox.js — Custom combobox replacing native <datalist> on mobile
// Auto-initializes all <input list="..."> elements with inline dropdown

(function() {
  // Standard options lists (used as data source)
  const COMBO_DATA = {
    datalist_tools: [
      '4 hình', 'Rắn và hoa', 'Enneagram', '6 hình', 'Bể cá gia đình',
      'Cái bắt', 'Cái cây', 'Chiêm tinh/Bản đồ sao', 'Thần số học',
      'Cô gái dưới mưa', 'Life Graph', 'Tarot', 'Cảm Xúc Chủ Đạo',
      'Loại hình gắn bó', 'Test Beck', 'HTP', 'Ly cảm xúc',
      'JD Festival', 'Kokology', 'Echo Color'
    ],
    datalist_dropout_reasons: [
      'Mất liên lạc', 'Thời gian', 'Trầm cảm', 'Thái độ không tốt',
      'Bị ngăn cản/ảnh hưởng', 'Cấn KT', 'Ngăn cản công ty',
      'Tài chính (và lệ phí)', 'Chưa đủ tuổi',
      'Nghề nghiệp (Đa cấp/bitcoin/chính phủ)', 'LGBT',
      'Xin chuyển khoá sau', 'Khác'
    ]
  };

  // Expose globally so dynamic inputs can also use it
  window.COMBO_DATA = COMBO_DATA;

  function initCombobox(input) {
    const listId = input.getAttribute('list');
    if (!listId) return;
    const options = COMBO_DATA[listId];
    if (!options) return;

    // Remove native datalist binding
    input.removeAttribute('list');

    // Wrap input
    const wrap = document.createElement('div');
    wrap.className = 'combo-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'combo-dropdown';
    wrap.appendChild(dropdown);

    function renderOptions(filter) {
      const q = (filter || '').toLowerCase();
      const filtered = q
        ? options.filter(o => o.toLowerCase().includes(q))
        : options;
      if (filtered.length === 0 || (filtered.length === 1 && filtered[0].toLowerCase() === q)) {
        dropdown.classList.remove('open');
        return;
      }
      dropdown.innerHTML = filtered.map(o => {
        // Highlight matching text
        let display = o;
        if (q) {
          const idx = o.toLowerCase().indexOf(q);
          if (idx >= 0) {
            display = o.substring(0, idx) + '<mark>' + o.substring(idx, idx + q.length) + '</mark>' + o.substring(idx + q.length);
          }
        }
        return `<div class="combo-opt" data-val="${o.replace(/"/g, '&quot;')}">${display}</div>`;
      }).join('');
      dropdown.classList.add('open');
    }

    // Events
    input.addEventListener('focus', () => renderOptions(input.value));
    input.addEventListener('input', () => renderOptions(input.value));

    dropdown.addEventListener('click', (e) => {
      const opt = e.target.closest('.combo-opt');
      if (!opt) return;
      input.value = opt.dataset.val;
      dropdown.classList.remove('open');
      input.dispatchEvent(new Event('change'));
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Initialize all existing inputs with list attribute
  function initAll() {
    document.querySelectorAll('input[list]').forEach(initCombobox);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Expose for dynamically created inputs (e.g. in modals)
  window.initCombobox = initCombobox;

  // Also re-init when modals open (MutationObserver for new inputs)
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches('input[list]')) {
          initCombobox(node);
        }
        const nested = node.querySelectorAll ? node.querySelectorAll('input[list]') : [];
        nested.forEach(initCombobox);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
