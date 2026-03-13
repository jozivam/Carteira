// 1. Crie uma pasta no Google Drive para salvar os comprovantes.
// 2. Abra a pasta e copie o ID dela na URL (a parte depois de "folders/").
// 3. Substitua 'COLE_O_ID_DA_PASTA_AQUI' abaixo por este ID.
// 4. Salve este script no Google Apps Script vinculado à sua planilha.
// 5. Publique como um aplicativo da web (Web App) e certifique-se de que o acesso esteja como "Qualquer pessoa".

const FOLDER_ID = 'COLE_O_ID_DA_PASTA_AQUI';

function doPost(e) {
  try {
    // Para aceitar CORS sem problemas
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    const data = JSON.parse(e.postData.contents);
    let imageUrl = null;

    // Transforma a base64 em arquivo e salva no Google Drive
    if (data.attachmentData && data.attachmentData.indexOf('base64,') !== -1) {
      const mimeType = data.attachmentData.split(';')[0].split(':')[1];
      const base64Str = data.attachmentData.split('base64,')[1];
      
      const fileName = data.attachmentName || ('comprovante_' + new Date().getTime());
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Str), mimeType, fileName);
      
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const file = folder.createFile(blob);
      
      // Permitir visualização do link
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imageUrl = file.getUrl();
    }
    
    // Adiciona a linha na Planilha Ativa (Adapte a ordem das colunas ao seu caso)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      data.id,
      data.date,
      data.description,
      data.amount,
      data.type,
      data.category,
      imageUrl ? imageUrl : (data.attachmentName || 'Sem anexo')
    ]);

    // Retorna a URL da imagem (se criada) para a aplicação atualizar localmente
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      imageUrl: imageUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Necessário para lidar com a requisição de preflight CORS (método OPTIONS) feita pelo navegador
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}
