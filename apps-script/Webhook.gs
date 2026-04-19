function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // ── Dirty flag: mark data changed so sync trigger picks it up ──
    PropertiesService.getScriptProperties().setProperty('lastChanged', String(new Date().getTime()));
    
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
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ═══════════════════════════════════════════════════════════
// ── MULTI-UNIT SYNC: Master → Unit Sheets (trigger-based) ──
// ID NDD matching + deletion handling + dirty flag
// ═══════════════════════════════════════════════════════════

// Sanitize cell values for Sheets API
function sanitizeVal(val) {
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, '0');
    var d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return val;
}

// ── Main sync — called by trigger every 5 minutes ──
function syncAllUnits() {
  try {
    // ── Dirty Flag check: skip if nothing changed ──
    var props = PropertiesService.getScriptProperties();
    var lastChanged = Number(props.getProperty('lastChanged') || 0);
    var lastSynced = Number(props.getProperty('lastSynced') || 0);
    
    if (lastChanged <= lastSynced) {
      return; // No changes since last sync
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterSheet = ss.getSheetByName('Trang tính1');
    var configSheet = ss.getSheetByName('Config');
    
    if (!masterSheet || !configSheet) {
      Logger.log('syncAllUnits: Missing master or Config tab');
      return;
    }
    
    // Read all master data
    var allData = masterSheet.getDataRange().getValues();
    if (allData.length < 2) return;
    
    // Read config: [Group, SheetID, TabName]
    var configData = configSheet.getDataRange().getValues();
    
    for (var c = 1; c < configData.length; c++) {
      var group = String(configData[c][0] || '').trim();
      var targetId = String(configData[c][1] || '').trim();
      var targetTab = String(configData[c][2] || 'Data').trim();
      
      if (!group || !targetId) continue;
      
      try {
        syncOneUnit(allData, group, targetId, targetTab);
      } catch(unitErr) {
        Logger.log('Error syncing ' + group + ': ' + unitErr.toString());
      }
    }
    
    // Mark as synced
    props.setProperty('lastSynced', String(lastChanged));
    Logger.log('syncAllUnits completed.');
    
  } catch(e) {
    Logger.log('syncAllUnits error: ' + e.toString());
  }
}

// ── Sync one unit sheet ──
// Profile ID (cột V) = chìa khoá duy nhất do app tạo cho mỗi hồ sơ
// Tên có thể đổi, NDD có thể đổi → Profile ID không đổi
// Match: Profile ID → Tên+NDD → Tên+Ngày → Append
// Mỗi lần match → ghi Profile ID vào cột V target → lần sau luôn chính xác
function syncOneUnit(allData, group, targetId, targetTab) {
  // 1. Filter master rows by Group, skip without student name
  var masterRows = [];
  for (var i = 1; i < allData.length; i++) {
    var rowGroup = String(allData[i][0] || '').trim();
    var rowName = String(allData[i][3] || '').trim();
    if (rowGroup === group && rowName) {
      masterRows.push(allData[i]);
    }
  }
  
  // 2. Read target C:V to get IDs, Names, Dates, Profile IDs
  //    C=0, D=1, ..., N=11, ..., V=19 (relative to C)
  var targetResult;
  try {
    targetResult = Sheets.Spreadsheets.Values.get(targetId, targetTab + '!C:V');
  } catch(e) {
    Logger.log('Cannot read target for ' + group + ': ' + e);
    return;
  }
  
  var targetData = targetResult.values || [];
  
  // Build matching indices:
  // profileIdMap:  profile_id → row (strongest, permanent)
  // comboMap:      "tên|idndd" → row
  // nameMap:       "tên" → [{row, date}]
  var profileIdMap = {};
  var comboMap = {};
  var nameMap = {};
  var lastDataRow = 1;
  
  for (var t = 1; t < targetData.length; t++) {
    var sheetRow = t + 1;
    var tr = targetData[t] || [];
    var colC = String(tr[0] || '').trim();    // ID NDD
    var colD = String(tr[1] || '').trim();    // Tên học sinh
    var colN = (tr.length > 11) ? String(tr[11] || '') : '';  // Ngày chakki
    var colV = (tr.length > 19) ? String(tr[19] || '').trim() : '';  // Profile ID
    
    if (colC || colD) lastDataRow = sheetRow;
    
    // Profile ID index (strongest match)
    if (colV) profileIdMap[colV] = sheetRow;
    
    if (colD) {
      var nameLower = colD.toLowerCase();
      
      // Combo key: tên + id ndd
      if (colC) {
        var ck = nameLower + '|' + colC.toLowerCase();
        if (!comboMap[ck]) comboMap[ck] = sheetRow;
      }
      
      // Name-only index
      if (!nameMap[nameLower]) nameMap[nameLower] = [];
      nameMap[nameLower].push({ row: sheetRow, date: colN });
    }
  }
  
  // 3. Process master rows
  var batchData = [];
  var nextAppendRow = lastDataRow + 1;
  var usedRows = {};
  var processedPids = {};  // for group-change detection
  var updated = 0, added = 0;
  
  for (var m = 0; m < masterRows.length; m++) {
    var row = masterRows[m];
    var nddId = String(row[2] || '').trim();
    var name = String(row[3] || '').trim();
    var masterDate = String(sanitizeVal(row[13]) || '');
    var profileId = String(row[21] || '').trim();  // cột V master = Profile ID
    var nameLower = name.toLowerCase();
    
    var targetRow = null;
    
    // ★ Priority 0: Profile ID (cột V) → match chính xác tuyệt đối
    if (profileId && profileIdMap[profileId] && !usedRows[profileIdMap[profileId]]) {
      targetRow = profileIdMap[profileId];
    }
    
    // Priority 1: Combo (Tên + ID NDD)
    if (!targetRow && nddId) {
      var ck = nameLower + '|' + nddId.toLowerCase();
      if (comboMap[ck] && !usedRows[comboMap[ck]]) {
        targetRow = comboMap[ck];
      }
    }
    
    // Priority 2: Name-only (khi target không có ID NDD)
    if (!targetRow) {
      var nameMatches = nameMap[nameLower];
      if (nameMatches) {
        var available = [];
        for (var n = 0; n < nameMatches.length; n++) {
          if (!usedRows[nameMatches[n].row]) available.push(nameMatches[n]);
        }
        
        if (available.length === 1) {
          targetRow = available[0].row;
        } else if (available.length > 1) {
          // Priority 3: Trùng tên → so ngày chakki
          if (masterDate) {
            for (var n = 0; n < available.length; n++) {
              if (available[n].date === masterDate) {
                targetRow = available[n].row;
                break;
              }
            }
          }
          if (!targetRow) targetRow = available[0].row;
        }
      }
    }
    
    if (targetRow) {
      usedRows[targetRow] = true;
      updated++;
    } else {
      targetRow = nextAppendRow++;
      added++;
    }
    
    if (profileId) processedPids[profileId] = true;
    
    // Build app columns
    var cj = [];
    for (var j = 2; j <= 9; j++) cj.push(sanitizeVal(row[j]));
    var mo = [sanitizeVal(row[12]), sanitizeVal(row[13]), sanitizeVal(row[14])];
    var rt = [sanitizeVal(row[17]), sanitizeVal(row[18]), sanitizeVal(row[19])];
    
    batchData.push({ range: targetTab + '!C' + targetRow + ':J' + targetRow, values: [cj] });
    batchData.push({ range: targetTab + '!M' + targetRow + ':O' + targetRow, values: [mo] });
    batchData.push({ range: targetTab + '!R' + targetRow + ':T' + targetRow, values: [rt] });
    
    // ★ Ghi Profile ID vào cột V → "khoá" dòng này vĩnh viễn
    if (profileId) {
      batchData.push({ range: targetTab + '!V' + targetRow, values: [[profileId]] });
    }
  }
  
  // 4. Group change: Alive profiles that moved to a different group → clear
  var moved = 0;
  for (var pid in profileIdMap) {
    if (processedPids[pid]) continue; // still in this group
    
    // Check master: does this Profile ID exist with DIFFERENT group + Alive?
    for (var i = 1; i < allData.length; i++) {
      var mPid = String(allData[i][21] || '').trim();
      var mGroup = String(allData[i][0] || '').trim();
      var mStatus = String(allData[i][6] || '').trim();
      
      if (mPid === pid && mGroup !== group && mStatus === 'Alive') {
        var clearRow = profileIdMap[pid];
        batchData.push({ range: targetTab + '!C' + clearRow + ':J' + clearRow, values: [['','','','','','','','']] });
        batchData.push({ range: targetTab + '!M' + clearRow + ':O' + clearRow, values: [['','','']] });
        batchData.push({ range: targetTab + '!R' + clearRow + ':T' + clearRow, values: [['','','']] });
        batchData.push({ range: targetTab + '!V' + clearRow, values: [['']] }); // xoá Profile ID
        moved++;
        break;
      }
    }
  }
  
  // 5. Batch write
  if (batchData.length > 0) {
    Sheets.Spreadsheets.Values.batchUpdate({
      data: batchData,
      valueInputOption: 'USER_ENTERED'
    }, targetId);
  }
  
  Logger.log(group + ': ' + updated + ' cập nhật, ' + added + ' thêm mới, ' + moved + ' chuyển đi');
}

// ── Setup: Create Config tab with headers (run once) ──
function setupConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName('Config');
  if (existing) {
    Logger.log('Config tab already exists!');
    return;
  }
  var config = ss.insertSheet('Config');
  config.getRange(1, 1, 1, 3).setValues([['Group', 'Sheet ID đích', 'Tab Name']])
    .setFontWeight('bold').setBackground('#d9ead3');
  config.getRange(2, 1, 1, 3).setValues([['HCM2 - N1T3', '1jmjxHPD4QtLyjgN8L41LgERl4tEGk2EkfHFo2BkaJ7g', 'Data']]);
  config.setColumnWidth(1, 150);
  config.setColumnWidth(2, 350);
  config.setColumnWidth(3, 100);
  Logger.log('Config tab created! Add your unit sheets here.');
}

// ── Setup: Install 5-minute trigger (run once) ──
function setupSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncAllUnits') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncAllUnits')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Trigger installed: syncAllUnits runs every 5 minutes.');
}

// ── DEBUG: Test sync manually (bypasses dirty flag) ──
function testSync() {
  Logger.log('=== Testing syncAllUnits ===');
  // Force dirty flag so sync runs
  PropertiesService.getScriptProperties().setProperty('lastChanged', String(new Date().getTime()));
  PropertiesService.getScriptProperties().deleteProperty('lastSynced');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName('Config');
  if (!config) {
    Logger.log('No Config tab! Run setupConfig() first.');
    return;
  }
  var configData = config.getDataRange().getValues();
  Logger.log('Config entries: ' + (configData.length - 1));
  for (var i = 1; i < configData.length; i++) {
    Logger.log('  ' + configData[i][0] + ' → ' + configData[i][1]);
  }
  syncAllUnits();
  Logger.log('=== Sync complete ===');
}
