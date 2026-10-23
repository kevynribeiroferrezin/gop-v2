export class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function bearerToken(request: Request) {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(
    request.headers.get("authorization") ?? ""
  );
  if (!match || match[1].length > 8192) {
    throw new RequestError("Autenticacao invalida.", 401);
  }
  return match[1];
}

// Nao confiar apenas em Content-Length: o corpo pode usar streaming.
export async function readJsonObject(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new RequestError("Use application/json.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Corpo JSON obrigatorio.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new RequestError("Solicitacao muito grande.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestError("JSON invalido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError("Objeto JSON obrigatorio.");
  }
  return body as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, trim = true) {
  if (typeof value !== "string") throw new RequestError(`${label} invalido.`);
  const result = trim ? value.trim() : value;
  if (!result || result.length > max || [...result].some((char) =>
    char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new RequestError(`${label} invalido.`);
  }
  return result;
}

export function newUserInput(body: Record<string, unknown>) {
  const nome = text(body.nome, "Nome", 200);
  const email = text(body.email, "E-mail", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError("E-mail invalido.");
  }
  const senha = text(body.senha, "Senha", 128, false);
  const role = body.role;
  if (role !== "admin" && role !== "supervisor" && role !== "rh" && role !== "coordenador") {
    throw new RequestError("Perfil invalido.");
  }
  const codigoSupervisor = role === "supervisor"
    ? text(body.codigoSupervisor, "Codigo do supervisor", 100) : undefined;
  const regionalId = body.regionalId ?? null;
  if (regionalId !== null && (typeof regionalId !== "number" ||
    !Number.isSafeInteger(regionalId) || regionalId < 1)) {
    throw new RequestError("Regional invalida.");
  }
  return { nome, email, senha, role, codigoSupervisor, regionalId };
}

export function passwordInput(body: Record<string, unknown>) {
  const userId = text(body.userId, "Usuario", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new RequestError("Usuario invalido.");
  }
  return { userId, novaSenha: text(body.novaSenha, "Senha", 128, false) };
}
