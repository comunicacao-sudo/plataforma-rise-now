/** Comprime novas capas no navegador antes do upload; não altera o arquivo original. */
export async function prepareJourneyCover(file: File): Promise<File> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return file;
  if (typeof createImageBitmap !== "function") return file;
  const image = await createImageBitmap(file);
  try {
    if (image.width <= 1280 && image.height <= 1280 && file.size <= 200_000) return file;
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.88),
    );
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    image.close();
  }
}
