// Nama sheet database di Google Sheets Anda
const SHEET_APP_NAME = "Data App";
const SHEET_USER_NAME = "User";

function doGet(e) {
  return responseJSON({
    status: "aktif",
    message: "Master API Portal SMP berjalan normal. Silakan gunakan portal untuk login."
  });
}

function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    var action = request.action;

    if (action === "login") {
      return handleLogin(request.username, request.password);
    } 
    else if (action === "register") {
      return handleRegister(request.data);
    } 
    else if (action === "getApps") {
      return handleGetApps(request.username);
    } 
    else if (action === "addApp") {
      return handleAddApp(request.data);
    } 
    else if (action === "deleteApp") {
      return handleDeleteApp(request.id);
    } 
    //--- FITUR SIMPAN URUTAN DRAG & DROP ---
    else if (action === "reorderApps") {
      return handleReorderApps(request.ids);
    } 
    //--- FITUR KELOLA USER (SUPERADMIN) ---
    else if (action === "getUsers") {
      return handleGetUsers();
    } 
    else if (action === "saveUser") {
      return handleSaveUser(request.data);
    } 
    else if (action === "deleteUser") {
      return handleDeleteUser(request.username);
    } 
    else {
      return responseJSON({ success: false, message: "Aksi tidak dikenali." });
    }
  } catch (error) {
    return responseJSON({ success: false, message: "Error Server: " + error.message });
  }
}

/**
 * ====================================================================
 * A. OTENTIKASI & REGISTRASI
 * ====================================================================
 */
function handleLogin(username, password) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USER_NAME);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var dbUser = String(data[i][0]).trim();
    var dbPass = String(data[i][1]).trim();

    if (dbUser === username && dbPass === password) {
      var dbName = data[i][2] || dbUser;
      var dbRole = data[i][3] || "Viewer";
      var dbStatus = data[i][4] || "Aktif";
      var dbAllowed = data[i][5] || "";

      if (dbStatus === "Pending") {
        return responseJSON({
          success: false,
          message: "Akun Anda masih berstatus PENDING. Silakan hubungi SuperAdmin untuk persetujuan."
        });
      }
      if (dbStatus === "Nonaktif") {
        return responseJSON({
          success: false,
          message: "Akun Anda telah dinonaktifkan. Silakan hubungi SuperAdmin."
        });
      }

      return responseJSON({
        success: true,
        message: "Login berhasil",
        user: {
          username: dbUser,
          name: dbName,
          role: dbRole,
          status: dbStatus,
          allowedApps: dbRole === "SuperAdmin" ? "ALL" : dbAllowed
        }
      });
    }
  }
  return responseJSON({ success: false, message: "Username atau Password salah!" });
}

function handleRegister(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USER_NAME);
  var allData = sheet.getDataRange().getValues();

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][0]).trim().toLowerCase() === String(data.username).trim().toLowerCase()) {
      return responseJSON({ success: false, message: "Username sudah digunakan. Silakan pilih username lain." });
    }
  }

  sheet.appendRow([
    data.username.trim(),
    data.password.trim(),
    data.name.trim(),
    "Viewer",
    "Pending",
    ""
  ]);

  return responseJSON({
    success: true,
    message: "Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan SuperAdmin."
  });
}

/**
 * ====================================================================
 * B. MANAJEMEN APLIKASI & AKSES (RBAC + SHARE EXT LINK)
 * ====================================================================
 */
function handleGetApps(username) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName(SHEET_USER_NAME);
  var userData = userSheet.getDataRange().getValues();
  var userRole = "Viewer";
  var allowedAppsStr = "";

  for (var i = 1; i < userData.length; i++) {
    if (String(userData[i][0]).trim() === String(username).trim()) {
      userRole = userData[i][3] || "Viewer";
      allowedAppsStr = String(userData[i][5] || "").trim();
      break;
    }
  }

  var appSheet = ss.getSheetByName(SHEET_APP_NAME);
  var appData = appSheet.getDataRange().getValues();
  var appsList = [];
  var allowedArray = allowedAppsStr.split(",").map(function(item) {
    return item.trim();
  });

  for (var j = 1; j < appData.length; j++) {
    var appId = String(appData[j][0]).trim();
    if (appId === "") continue;

    var isAllowed = (userRole === "SuperAdmin" || allowedAppsStr === "ALL" || allowedArray.indexOf(appId) !== -1);

    if (isAllowed) {
      appsList.push({
        id: appId,
        name: appData[j][1],
        category: appData[j][2],
        url: appData[j][3],
        usernameApp: appData[j][4] || "",
        passwordApp: appData[j][5] || "",
        //--- 5 KOLOM BARU UNTUK FITUR BERBAGI EKSTERNAL ---
        extType: appData[j][6] || "",
        extUrl: appData[j][7] || "",
        extUser: appData[j][8] || "",
        extPass: appData[j][9] || "",
        extNote: appData[j][10] || ""
      });
    }
  }

  return responseJSON({ success: true, data: appsList });
}

function handleAddApp(appData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_APP_NAME);
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  if (appData.id && String(appData.id).trim() !== "") {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(appData.id).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
  }

  var appId = (rowIndex > 0) ? appData.id : ("APP-" + Date.now());

  //--- MENYIMPAN LENGKAP 11 KOLOM (A - K) ---
  var rowData = [
    appId,
    appData.name.trim(),
    appData.category.trim(),
    appData.url.trim(),
    appData.usernameApp || "",
    appData.passwordApp || "",
    appData.extType || "",
    appData.extUrl || "",
    appData.extUser || "",
    appData.extPass || "",
    appData.extNote || ""
  ];

  if (rowIndex > 0) {
    // Diubah menjadi lebar 11 kolom
    sheet.getRange(rowIndex, 1, 1, 11).setValues([rowData]);
    return responseJSON({ success: true, message: "Aplikasi berhasil diperbarui!", id: appId });
  } else {
    sheet.appendRow(rowData);
    return responseJSON({ success: true, message: "Aplikasi berhasil ditambahkan!", id: appId });
  }
}

function handleDeleteApp(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_APP_NAME);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      return responseJSON({ success: true, message: "Aplikasi berhasil dihapus." });
    }
  }
  return responseJSON({ success: false, message: "ID Aplikasi tidak ditemukan." });
}

//--- FUNGSI SIMPAN URUTAN DRAG & DROP ---
function handleReorderApps(newOrderedIds) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_APP_NAME);
  var range = sheet.getDataRange();
  var data = range.getValues();

  if (data.length <= 1 || !newOrderedIds || newOrderedIds.length === 0) {
    return responseJSON({ success: false, message: "Data aplikasi kosong atau ID tidak valid." });
  }

  var header = data[0];
  var rows = data.slice(1);
  var rowMap = {};

  for (var i = 0; i < rows.length; i++) {
    var appId = String(rows[i][0]).trim();
    if (appId !== "") {
      rowMap[appId] = rows[i];
    }
  }

  var reorderedRows = [];

  for (var j = 0; j < newOrderedIds.length; j++) {
    var targetId = String(newOrderedIds[j]).trim();
    if (rowMap[targetId]) {
      reorderedRows.push(rowMap[targetId]);
      delete rowMap[targetId];
    }
  }

  for (var remainingId in rowMap) {
    if (rowMap.hasOwnProperty(remainingId)) {
      reorderedRows.push(rowMap[remainingId]);
    }
  }

  var fullData = [header].concat(reorderedRows);
  sheet.clearContents();
  sheet.getRange(1, 1, fullData.length, header.length).setValues(fullData);

  return responseJSON({ success: true, message: "Urutan aplikasi berhasil diperbarui di Spreadsheet!" });
}

/**
 * ====================================================================
 * C. MANAJEMEN PENGGUNA (KHUSUS SUPERADMIN)
 * ====================================================================
 */
function handleGetUsers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USER_NAME);
  var data = sheet.getDataRange().getValues();
  var usersList = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== "") {
      usersList.push({
        username: String(data[i][0]).trim(),
        password: String(data[i][1]).trim(),
        name: data[i][2] || String(data[i][0]),
        role: data[i][3] || "Viewer",
        status: data[i][4] || "Aktif",
        allowedApps: data[i][5] || ""
      });
    }
  }
  return responseJSON({ success: true, data: usersList });
}

function handleSaveUser(userData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USER_NAME);
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var targetUsername = userData.oldUsername || userData.username;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(targetUsername).trim().toLowerCase()) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowData = [
    userData.username.trim(),
    userData.password.trim(),
    userData.name.trim(),
    userData.role || "Viewer",
    userData.status || "Aktif",
    userData.allowedApps || ""
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 6).setValues([rowData]);
    return responseJSON({ success: true, message: "Data pengguna berhasil diperbarui!" });
  } else {
    sheet.appendRow(rowData);
    return responseJSON({ success: true, message: "Pengguna baru berhasil ditambahkan!" });
  }
}

function handleDeleteUser(username) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_USER_NAME);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(username).trim()) {
      sheet.deleteRow(i + 1);
      return responseJSON({ success: true, message: "Pengguna berhasil dihapus." });
    }
  }
  return responseJSON({ success: false, message: "Username tidak ditemukan." });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
