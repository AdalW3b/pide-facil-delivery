package com.omnirest.omnirest_backend.services.asistente;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/** Las llaves de los restaurantes van cifradas, y el asistente no llega a la red interna. */
class SeguridadAsistenteTest {

    private static String maestraAlAzar() {
        byte[] b = new byte[32];
        new SecureRandom().nextBytes(b);
        return Base64.getEncoder().encodeToString(b);
    }

    @Test
    @DisplayName("Cifra y descifra; dos cifrados de la misma llave no se parecen")
    void cifrado() {
        CifradoLlaves c = new CifradoLlaves(maestraAlAzar());
        assertTrue(c.disponible());
        String a = c.cifrar("sk-ant-mi-llave-1234");
        String b = c.cifrar("sk-ant-mi-llave-1234");
        assertNotEquals(a, b, "cada cifrado lleva su propio IV");
        assertFalse(a.contains("sk-ant"));
        assertEquals("sk-ant-mi-llave-1234", c.descifrar(a));
    }

    @Test
    @DisplayName("Con otra llave maestra no se puede leer, ni alterado")
    void otraMaestra() {
        String cifrado = new CifradoLlaves(maestraAlAzar()).cifrar("sk-secreta");
        assertThrows(IllegalStateException.class, () -> new CifradoLlaves(maestraAlAzar()).descifrar(cifrado));

        CifradoLlaves c = new CifradoLlaves(maestraAlAzar());
        byte[] bytes = Base64.getDecoder().decode(c.cifrar("sk-secreta"));
        bytes[bytes.length - 1] ^= 1;
        assertThrows(IllegalStateException.class, () -> c.descifrar(Base64.getEncoder().encodeToString(bytes)));
    }

    @Test
    @DisplayName("Sin llave maestra (o una que no mide 32 bytes) el asistente queda apagado")
    void sinMaestra() {
        assertFalse(new CifradoLlaves("").disponible());
        assertFalse(new CifradoLlaves("no-es-base64!").disponible());
        assertFalse(new CifradoLlaves(Base64.getEncoder().encodeToString(new byte[16])).disponible());
        assertThrows(IllegalStateException.class, () -> new CifradoLlaves("").cifrar("x"));
    }

    @Test
    @DisplayName("URL de servicio compatible: solo https pública")
    void urlSegura() {
        assertEquals("https://8.8.8.8/v1", UrlSegura.exigir("https://8.8.8.8/v1/"));
        for (String mala : new String[]{
                "http://8.8.8.8/v1",            // sin cifrar
                "https://127.0.0.1/v1",         // el propio servidor
                "https://localhost:8080/v1",
                "https://10.0.0.5/v1",          // red privada
                "https://192.168.1.10/v1",
                "https://172.16.0.1/v1",
                "https://169.254.169.254/latest", // metadatos de la nube
                "https://[::1]/v1",
                "https://user:pass@8.8.8.8/v1",
                "ftp://8.8.8.8",
                ""}) {
            assertThrows(IllegalArgumentException.class, () -> UrlSegura.exigir(mala), mala);
        }
    }
}
