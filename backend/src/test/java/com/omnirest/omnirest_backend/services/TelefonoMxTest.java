package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Este caso ya se coló una vez: el mismo repartidor quedó registrado dos veces,
 * una como 529531403282 y otra como 5219531403282, y su reporte salió partido.
 */
class TelefonoMxTest {

    @ParameterizedTest(name = "{0} es el mismo número")
    @ValueSource(strings = {
            "5219531403282",      // como lo entrega WhatsApp
            "529531403282",       // con pais, sin el 1
            "+52 953 140 3282",   // como lo teclea la gente
            "9531403282",         // solo los diez dígitos
            "(953) 140-3282",
            "+521-953-140-3282"
    })
    @DisplayName("Todas las formas de escribirlo dan el mismo número")
    void formasEquivalentes(String escrito) {
        assertEquals("529531403282", TelefonoMx.canonico(escrito));
    }

    @Test
    @DisplayName("Dos escrituras distintas del mismo celular se reconocen")
    void mismoNumero() {
        assertTrue(TelefonoMx.mismoNumero("5219531403282", "+52 953 140 3282"));
        assertTrue(TelefonoMx.mismoNumero("9531403282", "529531403282"));
    }

    @Test
    @DisplayName("Números distintos no se confunden")
    void numerosDistintos() {
        assertFalse(TelefonoMx.mismoNumero("5219531403282", "5219531403283"));
        assertFalse(TelefonoMx.mismoNumero("9531403282", "9511115555"));
    }

    @Test
    @DisplayName("Sin número no hay coincidencia, ni siquiera entre dos vacíos")
    void vacios() {
        assertEquals("", TelefonoMx.canonico(null));
        assertEquals("", TelefonoMx.canonico("   "));
        assertEquals("", TelefonoMx.canonico("sin dígitos"));

        // Dos vacíos no son "la misma persona": si lo fueran, cualquiera podría
        // cerrar la entrega de otro mandando el teléfono en blanco.
        assertFalse(TelefonoMx.mismoNumero(null, null));
        assertFalse(TelefonoMx.mismoNumero("", ""));
    }

    @Test
    @DisplayName("Un número extranjero se conserva como viene")
    void numeroExtranjero() {
        // Estados Unidos: 1 + 10 dígitos. No se le toca el 1, que ahí es el país.
        assertEquals("13055550123", TelefonoMx.canonico("+1 305 555 0123"));
    }
}
