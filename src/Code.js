function testDoPost() {
  var event = {
    postData: {
      contents:
        '{\n  "update_id": 822410803,\n  "message": {\n    "message_id": 41,\n    "from": {\n      "id": 691879361,\n      "is_bot": false,\n      "first_name": "SS",\n      "username": "ss1997_blr",\n      "language_code": "en"\n    },\n    "chat": {\n      "id": 691879361,\n      "first_name": "SS",\n      "username": "ss1997_blr",\n      "type": "private"\n    },\n    "date": 1740893791,\n    "text": "Rs 270.00 debited via UPI on 02-03-2025 08:44:21 to VPA q385549627@ybl.Ref No 506161617793.Small txns?Use UPI Lite!-Federal Bank",\n    "entities": [{ "offset": 56, "length": 18, "type": "email" }]\n  }\n}',
    },
  };
  doPost(event);
}

function doPost(e) {
  Logger.log(JSON.stringify(e));
  var data = JSON.parse(e.postData.contents);
  var chatId = data.message.chat.id;
  var userId = data.message.from.id;
  var text = data.message.text.trim();

  setChatId(chatId);

  if (userId != getUserId()) {
    return;
  }

  processMessage(chatId, userId, text);
  return;
}

function processMessage(chatId, userId, text) {
  var pendingExpense = getPendingExpense(userId);

  // Category for pending expense. No other flows possible if there is a pending expense.
  if (pendingExpense) {
    var extractedCategory = extractCategory(text);
    if (extractedCategory.error) {
      sendMessageToTelegram(chatId, extractedCategory.error);
      return;
    }
    saveExpenseWithCategory(pendingExpense, extractedCategory);
    sendMessageToTelegram(chatId, '✅ Expense categorized as: ' + text);
    removePendingExpense(userId);
    return;
  }

  var expense = extractExpenseDetails(text);

  if (expense.amount !== 'Unknown') {
    savePendingExpense(userId, chatId, expense);
    sendMessageToTelegram(
      chatId,
      '📝 Please enter a category for this expense:\n\n' +
        '💰 *Expense Categories*\n' +
        '🛒 *Essentials:* Food, Rent, Utilities, Transport, Medical\n' +
        '🎉 *Lifestyle:* Shopping, Entertainment, Dining, Fitness\n' +
        '📚 *Growth:* Courses, Work\n' +
        '🎁 *Other:* Gifts, Travel, Miscellaneous',
    );
    return;
  } else {
    sendMessageToTelegram(chatId, '❌ Could not detect a valid expense.');
    return;
  }
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

function saveExpenseWithCategory(expense, categoryMetadata) {
  var sheet = SpreadsheetApp.openById(getSheetId()).getSheetByName('Expenses');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(getSheetId()).insertSheet('Expenses');
    sheet.appendRow([
      'Date',
      'Amount',
      'Transaction Time',
      'Original Message',
      'Category',
      'Sub-Category',
    ]);
  }
  sheet.appendRow([
    new Date(),
    expense.amount,
    expense.transactionTime,
    expense.originalMessage,
    categoryMetadata.group,
    categoryMetadata.category,
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

function extractCategory(category) {
  category = category.toLowerCase().trim();
  const categories = {
    essentials: ['food', 'rent', 'utilities', 'transport', 'medical'],
    lifestyle: ['shopping', 'entertainment', 'dining', 'fitness'],
    growth: ['courses', 'work'],
    other: ['gifts', 'travel', 'miscellaneous'],
  };

  let validCategory = null;
  let group = null;
  for (let data of Object.entries(categories)) {
    if (data[1].includes(category)) {
      validCategory = category;
      group = data[0];
      break;
    }
  }

  if (!validCategory) {
    return { error: '❌ Invalid category. Please use a valid one.' };
  }

  return {
    category: validCategory.charAt(0).toUpperCase() + validCategory.slice(1),
    group: group.charAt(0).toUpperCase() + group.slice(1),
    error: null,
  };
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

function remindUserToAddExpenses() {
  sendMessageToTelegram(getChatId(), '🤖 Please add your expenses for today.');
}

function findBestMatch(inputText) {
  var commands = [
    {
      keywords: ["daily expenses", "todays expenses"],
      action: getDailyExpenses,
    },
    {
      keywords: ['weekly expenses', "this week's expenses"],
      action: getWeeklyExpenses,
    },
    {
      keywords: ['monthly expenses', "this month's expenses"],
      action: getMonthlyExpenses,
    },
    {
      keywords: ['help', 'commands', 'what can I do', 'tasks'],
      action: sendHelpMessage,
    },
  ];

  var bestMatch = { score: 0, action: null };
  for (var i = 0; i < commands.length; i++) {
    for (var j = 0; j < commands[i].keywords.length; j++) {
      var similarity = getSimilarity(inputText, commands[i].keywords[j]);
      if (similarity > bestMatch.score) {
        bestMatch = { score: similarity, action: commands[i].action };
      }
    }
  }

  return bestMatch.score > 0.6
    ? bestMatch.action()
    : "🤖 Sorry, I didn't understand.";
}

// Levenshtein Distance (Basic Similarity Function) - basically vanir magic that I don't understand
function getSimilarity(str1, str2) {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  var longer = str1.length > str2.length ? str1 : str2;
  var shorter = str1.length > str2.length ? str2 : str1;
  return (
    (longer.length - levenshteinDistance(longer, shorter)) /
    parseFloat(longer.length)
  );
}

function levenshteinDistance(s1, s2) {
  var matrix = Array.from(Array(s2.length + 1), () => new Array(s1.length + 1));
  for (var i = 0; i <= s2.length; i++) {
    for (var j = 0; j <= s1.length; j++) {
      if (i === 0) matrix[i][j] = j;
      else if (j === 0) matrix[i][j] = i;
      else
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (s1[j - 1] === s2[i - 1] ? 0 : 1),
        );
    }
  }
  return matrix[s2.length][s1.length];
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

function getChatId() {
  var scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('CHAT_ID');
}

function setChatId(chatId) {
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('CHAT_ID', chatId);
}