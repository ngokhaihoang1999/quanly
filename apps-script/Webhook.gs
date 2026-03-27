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
    var p = data.p || {}; 
    var d = data.d || {}; 
    var arrStr = function(val) { return Array.isArray(val) ? val.join(', ') : (val || ""); };
    
    var hinhThuc = arrStr(d.hinh_thuc).toUpperCase(); 
    var phuongThuc = arrStr(d.ket_noi); 
    
    var trangThai = "Alive";
    if (p.fruit_status === 'dropout') trangThai = "Drop-out";

    var dangKyBB = "";
    if (p.phase === "bb" || p.phase === "center" || p.phase === "completed") dangKyBB = "O";
    else if (p.fruit_status === 'dropout') dangKyBB = "X";
    
    var congCu = data.tools || d.t2_cong_cu || ""; 
    var ghiChu = data.recentNote || ""; 
    var gvbb = p.gvbb_staff_code || "";
    var lyDo = p.dropout_reason || "";
    var nhomNDD = data.nddGroup || ""; // Ví dụ HCM2-Nhóm 1-Tổ 3
    var mucTieuThang = data.semesterName || ""; // Cột 8: Khai giảng tháng
    var no = Math.max(1, sheet.getLastRow()); 
    var reqDataPhone = p.phone_number || d.sdt || "";
    if (reqDataPhone && !reqDataPhone.startsWith("'")) {
        // chống form excel đổi 0 định dạng format number
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
        "Chakki",                       // 5. Giai đoạn
        congCu,                         // 6. Công cụ tư vấn
        trangThai,                      // 7. Trạng thái
        mucTieuThang,                   // 8. Mục tiêu Tháng
        ghiChu,                         // 9. Ghi chú
        dangKyBB,                       // 10. Đăng kýBB
        "",                             // 11. Tham gia talkshow
        "",                             // 12. Tư vấn sau talkshow
        gvbb,                           // 13. GVBB찾기
        d.ngay_chakki || "",            // 14. Ngày Chakki
        hinhThuc,                       // 15. ONLINE/OFFLINE
        phuongThuc,                     // 16. Phương thức đầu vào
        "",                             // 17. Tỉnh
        lyDo,                           // 18. Lí do nghỉ học
        d.concept || "",                // 19. Chủ đề
        reqDataPhone,                   // 20. Số điện thoại (giữ số 0)
        "",                             // 21. Tuần chuyển BB
        pid                             // 22. ID Ẩn
      ];
      sheet.appendRow(newRow);
    } else {
      // 2. TRÁI ĐANG HỌC RỚT ĐÀI/CHỐT BB/THÊM GVBB -> NHÍP TRỰC TIẾP VÀO Ô GHI ĐÈ 
      if (nhomNDD) sheet.getRange(rowIdx, 1).setValue(nhomNDD);
      if (p.phase) sheet.getRange(rowIdx, 5).setValue(p.phase);
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
