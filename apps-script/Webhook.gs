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
    var getPhaseName = function(ph) {
      if (ph === 'chakki') return 'Chakki';
      if (ph === 'tu_van') return 'Tư vấn';
      if (ph === 'bb') return 'BB';
      if (ph === 'center') return 'Center';
      if (ph === 'completed') return 'Hoàn thành';
      return ph ? ph : 'Chakki';
    };

    // Helper to generate a full row array from payload data
    var createRowData = function(itemData, rowNum) {
      var p = itemData.p || {};
      var d = itemData.d || {};   // form_hanh_chinh.data (t2_ prefix fields)
      var hj = itemData.hj || {}; // check_hapja.data (no prefix: hinh_thuc, ket_noi, concept, ngay_chakki)
      var hinhThuc = arrStr(hj.hinh_thuc || d.hinh_thuc || "").toUpperCase(); 
      var phuongThuc = arrStr(hj.ket_noi || d.ket_noi || ""); 
      var trangThai = (p.fruit_status === 'dropout') ? "Drop-out" : "Alive";
      var dangKyBB = "";
      if (p.phase === "bb" || p.phase === "center" || p.phase === "completed") dangKyBB = "O";
      else if (p.fruit_status === 'dropout') dangKyBB = "X";
      var giaiDoan = getPhaseName(p.phase);
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
      
      return [
        nhomNDD, rowNum, p.ndd_staff_code || "", p.full_name || "", giaiDoan, congCu, trangThai, mucTieuThang, ghiChu,
        dangKyBB, "", "", gvbb, ngayChakki, hinhThuc, phuongThuc, "", lyDo, concept, reqDataPhone, "", itemData.profile_id || ""
      ];
    };

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
        // Clean all font colors then set RED for column J (10) manually
        sheet.getRange(2, 10, newValues.length, 1).setFontColor(null).setFontWeight("normal");
        for (var k = 0; k < redCells.length; k++) {
          sheet.getRange(redCells[k], 10).setFontColor("red").setFontWeight("bold");
        }
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

    var dangKyBB = "";
    if (p.phase === "bb" || p.phase === "center" || p.phase === "completed") dangKyBB = "O";
    else if (p.fruit_status === 'dropout') dangKyBB = "X";
    
    var getPhaseName = function(ph) {
      if (ph === 'chakki') return 'Chakki';
      if (ph === 'tu_van') return 'Tư vấn';
      if (ph === 'bb') return 'BB';
      if (ph === 'center') return 'Center';
      if (ph === 'completed') return 'Hoàn thành';
      return ph ? ph : 'Chakki';
    };
    var giaiDoan = getPhaseName(p.phase);
    
    var congCu = data.tools || d.t2_cong_cu || ""; 
    var ghiChu = data.recentNote || ""; 
    var gvbb = p.gvbb_staff_code || "";
    var lyDo = p.dropout_reason || "";
    var nhomNDD = data.nddGroup || ""; // Ví dụ HCM2-Nhóm 1-Tổ 3
    var mucTieuThang = data.semesterName || ""; // Cột 8: Khai giảng tháng
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
        nhomNDD,                        // 1. Group
        no,                             // 2. No.
        p.ndd_staff_code || "",         // 3. ID NDD
        p.full_name || "",              // 4. Tên học sinh
        giaiDoan,                       // 5. Giai đoạn
        congCu,                         // 6. Công cụ tư vấn
        trangThai,                      // 7. Trạng thái
        mucTieuThang,                   // 8. Mục tiêu Tháng
        ghiChu,                         // 9. Ghi chú
        dangKyBB,                       // 10. Đăng kýBB
        "",                             // 11. Tham gia talkshow
        "",                             // 12. Tư vấn sau talkshow
        gvbb,                           // 13. GVBB찾기
        ngayChakki,                     // 14. Ngay Chakki
        hinhThuc,                       // 15. ONLINE/OFFLINE
        phuongThuc,                     // 16. Phuong thuc dau vao
        "",                             // 17. Tinh
        lyDo,                           // 18. Li do nghi hoc
        concept,                        // 19. Chu de
        reqDataPhone,                   // 20. Số điện thoại (giữ số 0)
        "",                             // 21. Tuần chuyển BB
        pid                             // 22. ID Ẩn
      ];
      sheet.appendRow(newRow);
    } else {
      // 2. TRÁI ĐANG HỌC RỚT ĐÀI/CHỐT BB/THÊM GVBB -> NHÍP TRỰC TIẾP VÀO Ô GHI ĐÈ 
      if (nhomNDD) sheet.getRange(rowIdx, 1).setValue(nhomNDD);
      sheet.getRange(rowIdx, 5).setValue(giaiDoan);
      if (congCu) sheet.getRange(rowIdx, 6).setValue(congCu);
      sheet.getRange(rowIdx, 7).setValue(trangThai);
      if (mucTieuThang) sheet.getRange(rowIdx, 8).setValue(mucTieuThang);
      if (ghiChu) sheet.getRange(rowIdx, 9).setValue(ghiChu);
      
      var cell10 = sheet.getRange(rowIdx, 10);
      cell10.setValue(dangKyBB);
      if (dangKyBB === "O" || dangKyBB === "X") {
         cell10.setFontColor("red").setFontWeight("bold");
      }
      
      if (gvbb) sheet.getRange(rowIdx, 13).setValue(gvbb);
      if (lyDo) sheet.getRange(rowIdx, 18).setValue(lyDo);
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
