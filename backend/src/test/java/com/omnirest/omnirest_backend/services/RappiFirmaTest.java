package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Solo entra el aviso que firmo Rappi con nuestro secreto. */
class RappiFirmaTest {

    private static final String SECRETO = "secreto-de-prueba";
    private static final String CUERPO = "{\"order_id\":\"392625\",\"store_id\":\"900109448\"}";

    private static String encabezado(String timestamp, String cuerpo, String secreto) {
        return "t=" + timestamp + ",sign=" + RappiFirma.firmar(timestamp + "." + cuerpo, secreto);
    }

    @Test
    @DisplayName("Calcula HMAC-SHA256 en hexadecimal (vector conocido)")
    void hmacConocido() {
        // RFC 4231, caso 2.
        assertEquals("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
                RappiFirma.firmar("what do ya want for nothing?", "Jefe"));
    }

    @Test
    @DisplayName("Acepta la firma de timestamp.cuerpo con el secreto")
    void aceptaFirmaCorrecta() {
        assertTrue(RappiFirma.esValida(encabezado("1696204800", CUERPO, SECRETO), CUERPO, SECRETO));
    }

    @Test
    @DisplayName("Tolera espacios y la firma en mayusculas")
    void toleraFormato() {
        String firma = RappiFirma.firmar("123." + CUERPO, SECRETO).toUpperCase();
        assertTrue(RappiFirma.esValida(" t=123 , sign=" + firma + " ", CUERPO, SECRETO));
    }

    @Test
    @DisplayName("Rechaza si cambia el cuerpo, el timestamp o el secreto")
    void rechazaAlteraciones() {
        String bueno = encabezado("123", CUERPO, SECRETO);
        assertFalse(RappiFirma.esValida(bueno, CUERPO.replace("392625", "392626"), SECRETO));
        assertFalse(RappiFirma.esValida(bueno.replace("t=123", "t=124"), CUERPO, SECRETO));
        assertFalse(RappiFirma.esValida(bueno, CUERPO, "otro-secreto"));
    }

    @Test
    @DisplayName("Rechaza encabezados incompletos y la integracion sin secreto")
    void rechazaIncompletos() {
        String firma = RappiFirma.firmar("123." + CUERPO, SECRETO);
        assertFalse(RappiFirma.esValida(null, CUERPO, SECRETO));
        assertFalse(RappiFirma.esValida("sign=" + firma, CUERPO, SECRETO));
        assertFalse(RappiFirma.esValida("t=123", CUERPO, SECRETO));
        assertFalse(RappiFirma.esValida("basura", CUERPO, SECRETO));
        // Sin secreto configurado no pasa ni una firma bien formada.
        assertFalse(RappiFirma.esValida("t=123,sign=" + firma, CUERPO, ""));
        assertFalse(RappiFirma.esValida("t=123,sign=" + firma, CUERPO, null));
    }
}
