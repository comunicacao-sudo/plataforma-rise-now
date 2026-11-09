export function r2ConnectionError(path: string, online: boolean) {
  if (!online)
    return new Error(
      "Você está sem conexão com a internet. Reconecte e tente enviar a aula novamente.",
    );
  const operation = path.startsWith("/upload/start")
    ? "iniciar o envio da aula"
    : path.startsWith("/upload/part")
      ? "enviar uma parte da aula"
      : path.startsWith("/upload/complete")
        ? "concluir o envio da aula"
        : "acessar o serviço de vídeos";
  return new Error(
    "Não foi possível conectar para " +
      operation +
      ". Confira sua conexão e tente novamente. Se estiver no aplicativo instalado, atualize-o e reabra a RISE.",
  );
}
