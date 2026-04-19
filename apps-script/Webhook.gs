function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Tạo 22 cột (Cột V bắt buộc giấu Profile_ID_Hidden để App biết ai là ai mà moi ra sửa)
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Group", "No.", "ID NDD", "Tên học sinh 대상자 이름", "Giai đoạn 단계", 
        "Công cụ tư vấn", "Trạng thái 탈락여부", "Mục tiêu Tháng 목표 개강월", "Ghi chú", 
        "Đăng kýBB", "Tham gia talkshow", "Tư vấn sau talkshow", "GVBB찾기", 
        "Ngày 2023-00-00찾기 날짜", "ONLINE/OFFLINE", "Phương thức đầu vào", 
        "Tỉnh", "Lí do nghỉ học", "Chủ đề", "Số điện thoại", "Tuần chuyển BB", "Profile_ID_Hidden"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");
      sheet.hideColumns(22); // Giấu cột ID đi cho đẹp
    }
    
    var pid = data.profile_id || "";
    var action = data.action || "upsert";
    
    var arrStr = function(val) { return Array.isArray(val) ? val.join(', ') : (val || ""); };
    var getPhaseCode = function(ph) {
      if (ph === 'chakki' || ph === 'new' || !ph) return 'CK';
      if (ph === 'tu_van_hinh') return 'TVH';
      if (ph === 'tu_van') return 'TV';
      if (ph === 'dk_sau_ts') return 'ĐK sau TS';
      if (ph === 'nghi_he') return 'NH';
      if (ph === 'bb') return 'BB';
      if (ph === 'dk_center') return 'ĐK CT';
      if (ph === 'center' || ph === 'completed') return 'CT';
      if (ph === 'hoan_lai') return 'HL';
      if (ph === 'tv_group') return 'TV group';
      if (ph === 'bb_group') return 'BB group';
      return 'CK';
    };
    // "HCM2 · Nhóm 1 · Tổ 3" → "HCM2 - N1T3"
    var fmtGroup = function(raw) {
      if (!raw) return '';
      var m = raw.match(/^(.+?)\s*[·•-]\s*Nhóm\s*(\d+)\s*[·•-]\s*Tổ\s*(\d+)$/i);
      return m ? (m[1].trim() + ' - N' + m[2] + 'T' + m[3]) : raw;
    };
    // "Tháng 5/2026" → "May/Tháng 5"
    var fmtMonth = function(raw) {
      if (!raw) return '';
      var m = raw.match(/Tháng\s*(\d+)/i);
      if (!m) return raw;
      var mn = parseInt(m[1]);
      var en = ['','Jan','Feb','Mar','April','May','June','July','Aug','Sep','Oct','Nov','Dec'];
      return en[mn] ? (en[mn] + '/Tháng ' + mn) : raw;
    };

    // Helper to generate a full row array from payload data
    var createRowData = function(itemData, rowNum) {
      var p = itemData.p || {};
      var d = itemData.d || {};   // form_hanh_chinh.data (t2_ prefix fields)
      var hj = itemData.hj || {}; // check_hapja.data (no prefix: hinh_thuc, ket_noi, concept, ngay_chakki)
      var trangThai = "Alive";
      if (p.fruit_status === 'dropout') trangThai = "Drop-out";
      else if (p.fruit_status === 'pause') trangThai = "Pause";
      var dangKyBB = false;
      if (p.phase === "bb" || p.phase === "center" || p.phase === "completed") dangKyBB = true;
      var giaiDoan = getPhaseCode(p.phase);
      var congCu = itemData.tools || d.t2_cong_cu || ""; 
      var ghiChu = itemData.recentNote || ""; 
      var gvbb = p.gvbb_staff_code || "";
      var lyDo = p.dropout_reason || "";
      var nhomNDD = itemData.nddGroup || ""; 
      var mucTieuThang = itemData.semesterName || ""; 
      var reqDataPhone = p.phone_number || d.t2_sdt || hj.sdt || "";
      if (reqDataPhone && !reqDataPhone.startsWith("'")) reqDataPhone = "'" + reqDataPhone;
      var ngayChakki = hj.ngay_chakki || d.ngay_chakki || "";
      var concept = hj.concept || d.concept || "";
      
      var hinhThuc = arrStr(hj.hinh_thuc || d.hinh_thuc || "").toUpperCase();
      var phuongThuc = arrStr(hj.ket_noi || d.ket_noi || "");
      var tinh = d.t2_tinh || hj.tinh || p.province || "";
      
      return [
        fmtGroup(nhomNDD), rowNum, p.ndd_staff_code || "", p.full_name || "", giaiDoan, congCu, trangThai, fmtMonth(mucTieuThang), ghiChu,
        dangKyBB, false, "", gvbb, ngayChakki, hinhThuc, phuongThuc, tinh, lyDo, concept, reqDataPhone, "", itemData.profile_id || ""
      ];
    };

    // ── DELETE: Remove profile row and re-number ──
    if (action === "delete") {
      if (pid !== "") {
        var values = sheet.getDataRange().getValues();
        for (var i = values.length - 1; i >= 1; i--) {
          if (values[i][21] == pid) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
        // Re-number "No." column (column B) sequentially
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          for (var r = 2; r <= lastRow; r++) {
            sheet.getRange(r, 2).setValue(r - 1);
          }
        }
      }
      syncToTargetSheet(sheet);
      return ContentService.createTextOutput(JSON.stringify({"status": "deleted"})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "bulk_sync") {
      var profiles = data.profiles || [];
      if (profiles.length > 0) {
        // Clear everything below header
        if (sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 22).clearContent();
        }
        var newValues = [];
        var redCells = [];
        for (var i = 0; i < profiles.length; i++) {
          var rowObj = createRowData(profiles[i], i + 1);
          newValues.push(rowObj);
          if (rowObj[9] === "O" || rowObj[9] === "X") redCells.push(i + 2); // Row index (1-based, +1 for header)
        }
        sheet.getRange(2, 1, newValues.length, 22).setValues(newValues);
        // Set checkboxes for columns J (10) and K (11)
        sheet.getRange(2, 10, newValues.length, 2).insertCheckboxes();
      }
      syncToTargetSheet(sheet);
      return ContentService.createTextOutput(JSON.stringify({"status": "bulk_success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Normal UPSERT 
    var p = data.p || {}; 
    var d = data.d || {};   // form_hanh_chinh.data (t2_ fields)
    var hj = data.hj || {}; // check_hapja.data (no prefix)
    var hinhThuc = arrStr(hj.hinh_thuc || d.hinh_thuc || "").toUpperCase(); 
    var phuongThuc = arrStr(hj.ket_noi || d.ket_noi || ""); 
    
    var trangThai = "Alive";
    if (p.fruit_status === 'dropout') trangThai = "Drop-out";
    else if (p.fruit_status === 'pause') trangThai = "Pause";

    var dangKyBB = false;
    if (p.phase === "bb" || p.phase === "center" || p.phase === "completed") dangKyBB = true;
    
    var getPhaseCode = function(ph) {
      if (ph === 'chakki' || ph === 'new' || !ph) return 'CK';
      if (ph === 'tu_van_hinh') return 'TVH';
      if (ph === 'tu_van') return 'TV';
      if (ph === 'dk_sau_ts') return 'ĐK sau TS';
      if (ph === 'nghi_he') return 'NH';
      if (ph === 'bb') return 'BB';
      if (ph === 'dk_center') return 'ĐK CT';
      if (ph === 'center' || ph === 'completed') return 'CT';
      if (ph === 'hoan_lai') return 'HL';
      if (ph === 'tv_group') return 'TV group';
      if (ph === 'bb_group') return 'BB group';
      return 'CK';
    };
    var giaiDoan = getPhaseCode(p.phase);
    
    var congCu = data.tools || d.t2_cong_cu || ""; 
    var ghiChu = data.recentNote || ""; 
    var gvbb = p.gvbb_staff_code || "";
    var lyDo = p.dropout_reason || "";
    var nhomNDD = fmtGroup(data.nddGroup || ""); // "HCM2 · Nhóm 1 · Tổ 3" → "HCM2 - N1T3"
    var mucTieuThang = fmtMonth(data.semesterName || ""); // Kì khai giảng → Jan/Tháng 1 format
    var no = Math.max(1, sheet.getLastRow()); 
    var ngayChakki = hj.ngay_chakki || d.ngay_chakki || "";
    var concept = hj.concept || d.concept || "";
    var reqDataPhone = p.phone_number || d.t2_sdt || hj.sdt || "";
    if (reqDataPhone && !reqDataPhone.startsWith("'")) {
        // chong form excel doi 0 dinh dang format number
        reqDataPhone = "'" + reqDataPhone;
    }

    // TÌM DÒNG CŨ ĐỂ CẬP NHẬT
    var rowIdx = -1;
    if (pid !== "") {
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (values[i][21] == pid) { // Dò đúng mã ID ẩn ở Cột số 22
          rowIdx = i + 1;
          break;
        }
      }
    }
    
    if (rowIdx === -1) {
      // 1. TRÁI MỚI TOANH (LÚC VỪA DUYỆT HAPJA) -> THÊM 1 DÒNG VÀO CUỐI
      var newRow = [
        nhomNDD,                        // 1. Group (đã format: HCM2 - N1T3)
        no,                             // 2. No.
        p.ndd_staff_code || "",         // 3. ID NDD
        p.full_name || "",              // 4. Tên học sinh
        giaiDoan,                       // 5. Giai đoạn
        congCu,                         // 6. Công cụ tư vấn
        trangThai,                      // 7. Trạng thái
        mucTieuThang,                   // 8. Mục tiêu Tháng
        ghiChu,                         // 9. Ghi chú
        dangKyBB,                       // 10. Đăng kýBB (checkbox)
        false,                          // 11. Tham gia talkshow (checkbox)
        "",                             // 12. Tư vấn sau talkshow
        gvbb,                           // 13. GVBB찾기
        ngayChakki,                     // 14. Ngay Chakki
        hinhThuc,                       // 15. ONLINE/OFFLINE
        phuongThuc,                     // 16. Phuong thuc dau vao
        d.t2_tinh || hj.tinh || p.province || "", // 17. Tinh
        lyDo,                           // 18. Li do nghi hoc
        concept,                        // 19. Chu de
        reqDataPhone,                   // 20. Số điện thoại (giữ số 0)
        "",                             // 21. Tuần chuyển BB
        pid                             // 22. ID Ẩn
      ];
      sheet.appendRow(newRow);
    } else {
      // 2. TRÁI ĐANG HỌC RỚT ĐÀI/CHỐT BB/THÊM GVBB -> NHÍP TRỰC TIẾP VÀO Ô GHI ĐÈ 
      if (nhomNDD) sheet.getRange(rowIdx, 1).setValue(nhomNDD); // Group (đã format)
      sheet.getRange(rowIdx, 5).setValue(giaiDoan);
      if (congCu) sheet.getRange(rowIdx, 6).setValue(congCu);
      sheet.getRange(rowIdx, 7).setValue(trangThai);
      if (mucTieuThang) sheet.getRange(rowIdx, 8).setValue(mucTieuThang);
      if (ghiChu) sheet.getRange(rowIdx, 9).setValue(ghiChu);
      
      var cell10 = sheet.getRange(rowIdx, 10);
      cell10.setValue(dangKyBB);
      
      if (gvbb) sheet.getRange(rowIdx, 13).setValue(gvbb);
      if (lyDo) sheet.getRange(rowIdx, 18).setValue(lyDo);
    }
    
    syncToTargetSheet(sheet);
    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── AUTO-SYNC: Copy C2:U from source → target "Data" tab using Sheets API ──
// Uses Advanced Sheets API to bypass data validation (no format/color/dropdown impact)
function syncToTargetSheet(sourceSheet) {
  try {
    var TARGET_ID = '1jmjxHPD4QtLyjgN8L41LgERl4tEGk2EkfHFo2BkaJ7g';
    var TARGET_TAB = 'Data';
    
    SpreadsheetApp.flush();
    
    var src = sourceSheet || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var allData = src.getDataRange().getValues();
    if (allData.length < 2) return;
    
    // Extract C2:U (columns index 2-20), sanitize values
    var srcData = [];
    for (var i = 1; i < allData.length; i++) {
      var row = [];
      for (var j = 2; j <= 20; j++) {
        var val = allData[i][j];
        // Convert Date objects to YYYY-MM-DD string (avoid timezone mess)
        if (val instanceof Date) {
          var y = val.getFullYear();
          var m = String(val.getMonth() + 1).padStart(2, '0');
          var d = String(val.getDate()).padStart(2, '0');
          val = y + '-' + m + '-' + d;
        }
        // Convert booleans to readable strings
        else if (val === true) val = 'TRUE';
        else if (val === false) val = 'FALSE';
        row.push(val);
      }
      srcData.push(row);
    }
    if (srcData.length === 0) return;
    
    // Clear old values in target via Sheets API (values only, no format/validation impact)
    var clearRange = TARGET_TAB + '!C2:U';
    Sheets.Spreadsheets.Values.clear({}, TARGET_ID, clearRange);
    
    // Write new values via Sheets API (bypasses data validation entirely)
    var writeRange = TARGET_TAB + '!C2:U' + (srcData.length + 1);
    Sheets.Spreadsheets.Values.update(
      { values: srcData },
      TARGET_ID,
      writeRange,
      { valueInputOption: 'RAW' }
    );
  } catch(e) {
    Logger.log('syncToTargetSheet error: ' + e.toString());
  }
}

// ── DEBUG: Run manually from Script Editor to test sync ──
function testSync() {
  var src = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  Logger.log('Source sheet name: ' + src.getName());
  Logger.log('Source last row: ' + src.getLastRow());
  var allData = src.getDataRange().getValues();
  Logger.log('Source total rows (incl header): ' + allData.length);
  Logger.log('Source row 2 sample: ' + JSON.stringify(allData[1]));
  
  var TARGET_ID = '1jmjxHPD4QtLyjgN8L41LgERl4tEGk2EkfHFo2BkaJ7g';
  var target = SpreadsheetApp.openById(TARGET_ID);
  var sheets = target.getSheets();
  Logger.log('Target sheet tabs: ' + sheets.map(function(s) { return s.getName() + ' (gid=' + s.getSheetId() + ')'; }).join(', '));
  
  var tSheet = target.getSheetByName('Data');
  Logger.log('Found "Data" tab: ' + (tSheet ? 'YES' : 'NO'));
  
  // Try the actual sync
  syncToTargetSheet(src);
  Logger.log('Sync completed. Check target sheet.');
}
