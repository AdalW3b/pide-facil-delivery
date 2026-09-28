/**
 * Achica una foto en el navegador antes de subirla.
 *
 * Una foto recién tomada con el teléfono pesa 3 a 6 MB: subirla así tarda y
 * gasta los datos de quien está en el restaurante. Se reduce a 1600 px por
 * lado y se pasa a JPEG, lo que la deja en unos 200 a 400 KB. El servidor la
 * vuelve a procesar de todos modos; esto solo aligera el viaje.
 *
 * `imageOrientation: 'from-image'` respeta la rotación que guarda el teléfono:
 * sin eso, las fotos verticales llegan acostadas.
 */
export async function comprimirImagen(archivo: File, ladoMaximo = 1600, calidad = 0.85): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pudimos abrir esa foto. Prueba con otra en JPG o PNG.');
  }

  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no pudo procesar la foto.');
  // Fondo blanco: un PNG transparente pasado a JPEG quedaría negro.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  return new Promise((resolver, rechazar) =>
    canvas.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No pudimos comprimir la foto.'))),
      'image/jpeg',
      calidad
    )
  );
}
