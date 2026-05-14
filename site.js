function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.openById('10dUxBSU3JzqiRg_KPnjlh0eKpEAokgp73ePutWQU-NY').getActiveSheet();
    sheet.appendRow([
      new Date(),
      dados.nome,
      dados.email,
      dados.celular,
      dados.mensagem
    ]);
    
    MailApp.sendEmail({
      to: 'contato@cofebot.com.br',
      subject: 'Novo contato: ' + dados.nome,
      body:
        'Nome: '        + dados.nome       + '\n' +
        'E-mail: '      + dados.email      + '\n' +
        'Celular: '     + dados.celular    + '\n\n' +
        'Mensagem:\n'   + dados.mensagem
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}