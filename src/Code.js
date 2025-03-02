function testDoPost() {
  var event = {
    postData: {
      contents: "{\n  \"update_id\": 822410803,\n  \"message\": {\n    \"message_id\": 41,\n    \"from\": {\n      \"id\": 691879361,\n      \"is_bot\": false,\n      \"first_name\": \"SS\",\n      \"username\": \"ss1997_blr\",\n      \"language_code\": \"en\"\n    },\n    \"chat\": {\n      \"id\": 691879361,\n      \"first_name\": \"SS\",\n      \"username\": \"ss1997_blr\",\n      \"type\": \"private\"\n    },\n    \"date\": 1740893791,\n    \"text\": \"Rs 270.00 debited via UPI on 02-03-2025 08:44:21 to VPA q385549627@ybl.Ref No 506161617793.Small txns?Use UPI Lite!-Federal Bank\",\n    \"entities\": [{ \"offset\": 56, \"length\": 18, \"type\": \"email\" }]\n  }\n}"
    }

  };
  doPost(event)
}

function doPost(e) {
  Logger.log(JSON.stringify(e));
  var data = JSON.parse(e.postData.contents);
  var chatId = data.message.chat.id;
  var userId = data.message.from.id;
  var text = data.message.text.trim();

  if (userId != getUserId()) {
    return ContentService.createTextOutput('OK');
  }

  var pendingExpense = getPendingExpense(userId);

  if (pendingExpense) {
    // ✅ User is entering a category
    validateExpenseCategory(text);
    saveExpenseWithCategory(pendingExpense, text);
    sendMessageToTelegram(chatId, '✅ Expense categorized as: ' + text);
    removePendingExpense(userId);
    return ContentService.createTextOutput('OK');
  }

  var expense = extractExpenseDetails(text);

  if (expense.amount !== 'Unknown') {
    savePendingExpense(userId, chatId, expense);
    sendMessageToTelegram(
      chatId,
      '📝 Please enter a category for this expense (e.g., Food, Travel, Shopping):',
    );
  } else {
    sendMessageToTelegram(chatId, '❌ Could not detect a valid expense.');
  }

  return ContentService.createTextOutput('OK');
}

function extractExpenseDetails(message) {
  var amountMatch = message.match(/Rs (\d+\.\d{2})/);
  var timeMatch = message.match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/);

  var amount = amountMatch ? parseFloat(amountMatch[1]) : 'Unknown';
  var transactionTime = timeMatch ? timeMatch[1] : 'Unknown';

  return {
    amount: amount,
    transactionTime: transactionTime,
    originalMessage: message,
  };
}

function savePendingExpense(userId, chatId, expense) {
  var sheet = SpreadsheetApp.openById(getSheetId()).getSheetByName(
    'PendingExpenses',
  );
  if (!sheet) {
    sheet = SpreadsheetApp.openById(getSheetId()).insertSheet(
      'PendingExpenses',
    );
    sheet.appendRow([
      'UserID',
      'ChatID',
      'Amount',
      'TransactionTime',
      'OriginalMessage',
    ]);
  }
  sheet.appendRow([
    userId,
    chatId,
    expense.amount,
    expense.transactionTime,
    expense.originalMessage,
  ]);
}

function getPendingExpense(userId) {
  var sheet = SpreadsheetApp.openById(getSheetId()).getSheetByName(
    'PendingExpenses',
  );
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      return {
        userId: data[i][0],
        chatId: data[i][1],
        amount: data[i][2],
        transactionTime: data[i][3],
        originalMessage: data[i][4],
      };
    }
  }
  return null;
}

function saveExpenseWithCategory(expense, category) {
  var sheet = SpreadsheetApp.openById(getSheetId()).getSheetByName('Expenses');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(getSheetId()).insertSheet('Expenses');
    sheet.appendRow([
      'Date',
      'Amount',
      'Transaction Time',
      'Original Message',
      'Category',
    ]);
  }
  sheet.appendRow([
    new Date(),
    expense.amount,
    expense.transactionTime,
    expense.originalMessage,
    category,
  ]);
}

function removePendingExpense(userId) {
  var sheet = SpreadsheetApp.openById(getSheetId()).getSheetByName(
    'PendingExpenses',
  );
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function validateExpenseCategory(text) {
  text = text.toLowerCase();
  if (text !== 'food' || text !== 'travel' || text !== 'shopping') {
    return ContentService.createTextOutput('OK');
  }
}

function sendMessageToTelegram(chatId, message) {
  var url = 'https://api.telegram.org/bot' + getBotToken() + '/sendMessage';
  var payload = {
    chat_id: chatId,
    text: message,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
  };

  UrlFetchApp.fetch(url, options);
}

function setProperties(botToken, sheetId) {
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('TELEGRAM_BOT_TOKEN', botToken);
  scriptProperties.setProperty('SHEET_ID', sheetId);
}

function getBotToken() {
  var scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('TELEGRAM_BOT_TOKEN');
}

function getSheetId() {
  var scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('SHEET_ID');
}

function getUserId() {
  var scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('TELEGRAM_USER_ID');
}