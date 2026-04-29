function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.openById('1bao0ZleYUV6_GiBs3Es1AWC2X8oMUpzJrEQRBzCvhdw').getActiveSheet();
    sheet.appendRow([
      new Date(),
      dados.nome,
      dados.empresa,
      dados.email,
      dados.whatsapp,
      dados.tipoEspaco,
      dados.mensagem
    ]);
    
    MailApp.sendEmail({
      to: 'jvictor.ncn@gmail.com',
      subject: 'Novo contato: ' + dados.nome,
      body:
        'Nome: '        + dados.nome       + '\n' +
        'Empresa: '     + dados.empresa    + '\n' +
        'E-mail: '      + dados.email      + '\n' +
        'WhatsApp: '    + dados.whatsapp   + '\n' +
        'Tipo de espaço: ' + dados.tipoEspaco + '\n\n' +
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