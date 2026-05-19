const MIN_PASSWORD_LENGTH = 10;

export function validarSenhaForte(senha: string) {
  if (senha.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `A senha precisa ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  if (!/[a-z]/.test(senha)) {
    return {
      valid: false,
      message: "A senha precisa ter pelo menos uma letra minuscula.",
    };
  }

  if (!/[A-Z]/.test(senha)) {
    return {
      valid: false,
      message: "A senha precisa ter pelo menos uma letra maiuscula.",
    };
  }

  if (!/[0-9]/.test(senha)) {
    return {
      valid: false,
      message: "A senha precisa ter pelo menos um numero.",
    };
  }

  if (!/[^A-Za-z0-9]/.test(senha)) {
    return {
      valid: false,
      message: "A senha precisa ter pelo menos um caractere especial.",
    };
  }

  return { valid: true, message: "" };
}

