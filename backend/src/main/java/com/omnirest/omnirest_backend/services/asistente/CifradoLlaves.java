package com.omnirest.omnirest_backend.services.asistente;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifra las llaves de IA de los restaurantes con AES-GCM y la llave maestra
 * del servidor. En la base solo queda el texto cifrado: quien lea la base no
 * obtiene las llaves de los clientes.
 */
@Component
public class CifradoLlaves {

    private static final int BYTES_IV = 12;
    private static final int BITS_ETIQUETA = 128;
    private static final SecureRandom AZAR = new SecureRandom();

    private final byte[] maestra;

    public CifradoLlaves(@Value("${asistente.llave-maestra:}") String llaveMaestra) {
        this.maestra = decodificar(llaveMaestra);
    }

    /** Sin llave maestra no se pueden guardar llaves: el asistente queda apagado. */
    public boolean disponible() {
        return maestra != null;
    }

    public String cifrar(String texto) {
        exigirDisponible();
        try {
            byte[] iv = new byte[BYTES_IV];
            AZAR.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(maestra, "AES"), new GCMParameterSpec(BITS_ETIQUETA, iv));
            byte[] cifrado = c.doFinal(texto.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + cifrado.length).put(iv).put(cifrado).array());
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo cifrar la llave.", e);
        }
    }

    public String descifrar(String guardado) {
        exigirDisponible();
        try {
            byte[] todo = Base64.getDecoder().decode(guardado);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(maestra, "AES"), new GCMParameterSpec(BITS_ETIQUETA, todo, 0, BYTES_IV));
            return new String(c.doFinal(todo, BYTES_IV, todo.length - BYTES_IV), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo leer la llave guardada: vuelve a capturarla en la configuración del asistente.");
        }
    }

    private void exigirDisponible() {
        if (maestra == null) {
            throw new IllegalStateException("El asistente no está configurado en el servidor (falta ASISTENTE_LLAVE_MAESTRA).");
        }
    }

    private static byte[] decodificar(String llave) {
        if (llave == null || llave.isBlank()) return null;
        try {
            byte[] bytes = Base64.getDecoder().decode(llave.trim());
            return bytes.length == 32 ? bytes : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
