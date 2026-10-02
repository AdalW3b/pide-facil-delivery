package com.omnirest.omnirest_backend.services;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Comprueba que un webhook lo mando Rappi.
 *
 * Rappi firma cada aviso en el encabezado {@code Rappi-Signature} con la forma
 * {@code t=<timestamp>,sign=<firma>}: la firma es HMAC-SHA256, con el secreto
 * del webhook, de {@code <timestamp>.<cuerpo>}. Si no coincide el aviso no se
 * procesa: cualquiera puede llamar a la URL, pero solo Rappi conoce el secreto.
 */
final class RappiFirma {

    private RappiFirma() {
    }

    /** True si el encabezado firma exactamente este cuerpo con este secreto. */
    static boolean esValida(String encabezado, String cuerpo, String secreto) {
        if (encabezado == null || cuerpo == null || secreto == null || secreto.isBlank()) {
            return false;
        }
        String timestamp = null;
        String firma = null;
        for (String parte : encabezado.split(",")) {
            String[] llaveValor = parte.trim().split("=", 2);
            if (llaveValor.length != 2) continue;
            switch (llaveValor[0].trim()) {
                case "t" -> timestamp = llaveValor[1].trim();
                case "sign" -> firma = llaveValor[1].trim();
                default -> {
                    // Rappi puede agregar campos; se ignoran.
                }
            }
        }
        if (timestamp == null || timestamp.isEmpty() || firma == null || firma.isEmpty()) {
            return false;
        }
        byte[] esperada = firmar(timestamp + "." + cuerpo, secreto).getBytes(StandardCharsets.US_ASCII);
        byte[] recibida = firma.toLowerCase().getBytes(StandardCharsets.US_ASCII);
        // Comparacion en tiempo constante: no deja adivinar la firma byte a byte.
        return MessageDigest.isEqual(esperada, recibida);
    }

    /** HMAC-SHA256 en hexadecimal, en minusculas. */
    static String firmar(String mensaje, String secreto) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(mensaje.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo calcular la firma HMAC-SHA256", e);
        }
    }
}
