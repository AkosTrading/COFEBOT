/**
 * Vercel Function: POST /api/contact
 * Requer quatro variaveis de ambiente no servidor (ver README).
 * Nenhum segredo pode ser copiado para o HTML ou enviado ao navegador.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function responder(status, codigo, extras = {}) {
  return new Response(JSON.stringify({ ok: status >= 200 && status < 300, codigo, ...extras }), {
    status,
    headers: JSON_HEADERS
  });
}

function normalizarString(valor, maximo, obrigatorio) {
  if (valor === undefined || valor === null) return obrigatorio ? null : '';
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if ((obrigatorio && !texto) || texto.length > maximo) return null;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(texto)) return null;
  return texto;
}

function validarLead(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return null;

  const nome = normalizarString(entrada.nome, 120, true);
  const email = normalizarString(entrada.email, 254, true)?.toLowerCase();
  const celular = normalizarString(entrada.celular, 30, false);
  const mensagem = normalizarString(entrada.mensagem, 3000, false);

  if (!nome || nome.length < 2 || /[\r\n]/.test(nome) || !email || celular === null || mensagem === null) {
    return null;
  }
  const formatoEmail = /^[^\s@]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
  if (!formatoEmail.test(email) || /\.(invalid|test|example)$/i.test(email)) return null;

  const digitos = celular.replace(/\D/g, '');
  if (celular && !/^(\d{10}|\d{11}|55\d{10}|55\d{11})$/.test(digitos)) return null;

  return { nome, email, celular, mensagem };
}

async function buscarComPrazo(url, opcoes, milissegundos) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milissegundos);
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function processarContato(request) {
  if (request.method !== 'POST') return responder(405, 'METODO_NAO_PERMITIDO');

  const secretTurnstile = process.env.TURNSTILE_SECRET_KEY;
  const scriptURL = process.env.COFEBOT_APPS_SCRIPT_URL;
  const segredoWebhook = process.env.COFEBOT_WEBHOOK_SECRET;
  const hostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
    .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!secretTurnstile || !scriptURL || !segredoWebhook || segredoWebhook.length < 32 || !hostnames.length) {
    console.error('COFEBOT: variaveis de ambiente obrigatorias ausentes.');
    return responder(503, 'CONFIGURACAO_INCOMPLETA');
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return responder(415, 'FORMATO_INVALIDO');
  const tamanho = Number(request.headers.get('content-length') || 0);
  if (tamanho > 10000) return responder(413, 'REQUISICAO_GRANDE');

  let entrada;
  try {
    const bruto = await request.text();
    if (new TextEncoder().encode(bruto).length > 10000) return responder(413, 'REQUISICAO_GRANDE');
    entrada = JSON.parse(bruto);
  } catch (_) {
    return responder(400, 'JSON_INVALIDO');
  }

  // Resposta neutra para bots que preencham o honeypot, sem gravar nada.
  if (entrada && typeof entrada.website === 'string' && entrada.website.trim()) {
    return responder(200, 'IGNORADO');
  }

  const lead = validarLead(entrada);
  if (!lead) return responder(400, 'DADOS_INVALIDOS');
  const token = entrada.turnstileToken;
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return responder(400, 'VERIFICACAO_NECESSARIA');
  }

  try {
    const corpo = new URLSearchParams({ secret: secretTurnstile, response: token });
    const verificacaoHTTP = await buscarComPrazo(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: corpo },
      8000
    );
    if (!verificacaoHTTP.ok) return responder(502, 'ERRO_VERIFICACAO');
    const verificacao = await verificacaoHTTP.json();
    if (!verificacao.success || !hostnames.includes(String(verificacao.hostname || '').toLowerCase())) {
      return responder(403, 'VERIFICACAO_REJEITADA');
    }

    const recebimentoHTTP = await buscarComPrazo(scriptURL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: JSON.stringify({ ...lead, segredo: segredoWebhook }),
      redirect: 'follow'
    }, 10000);
    if (!recebimentoHTTP.ok) return responder(502, 'FALHA_REGISTRO');

    let resultado;
    try {
      resultado = await recebimentoHTTP.json();
    } catch (_) {
      return responder(502, 'RESPOSTA_INESPERADA');
    }

    if (!resultado || resultado.ok !== true) {
      if (resultado?.codigo === 'LIMITE_ATINGIDO') return responder(429, 'LIMITE_ATINGIDO');
      return responder(502, 'FALHA_REGISTRO');
    }
    return responder(200, 'CONTATO_RECEBIDO');
  } catch (erro) {
    console.error('COFEBOT: falha de comunicacao no envio do contato.');
    return responder(502, 'SERVICO_INDISPONIVEL');
  }
}

export default { fetch: processarContato };
