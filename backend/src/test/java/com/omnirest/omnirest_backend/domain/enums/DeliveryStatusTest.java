package com.omnirest.omnirest_backend.domain.enums;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fija el camino del pedido a domicilio. Sin estas pruebas es facil que un
 * boton del tablero deje regresar un pedido ya entregado.
 */
class DeliveryStatusTest {

    @Test
    @DisplayName("El camino normal avanza paso a paso")
    void caminoNormal() {
        assertTrue(DeliveryStatus.NUEVO.puedeAvanzarA(DeliveryStatus.CONFIRMADO));
        assertTrue(DeliveryStatus.CONFIRMADO.puedeAvanzarA(DeliveryStatus.LISTO));
        assertTrue(DeliveryStatus.LISTO.puedeAvanzarA(DeliveryStatus.EN_CAMINO));
        assertTrue(DeliveryStatus.EN_CAMINO.puedeAvanzarA(DeliveryStatus.ENTREGADO));
    }

    @Test
    @DisplayName("Se pueden saltar pasos hacia adelante")
    void saltarPasos() {
        assertTrue(DeliveryStatus.CONFIRMADO.puedeAvanzarA(DeliveryStatus.EN_CAMINO),
                "un pedido puede salir sin pasar por el mostrador");
        assertTrue(DeliveryStatus.NUEVO.puedeAvanzarA(DeliveryStatus.ENTREGADO),
                "el mostrador puede cerrar de golpe un pedido que ya resolvio");
    }

    @Test
    @DisplayName("Nunca se retrocede")
    void noSeRetrocede() {
        assertFalse(DeliveryStatus.EN_CAMINO.puedeAvanzarA(DeliveryStatus.CONFIRMADO));
        assertFalse(DeliveryStatus.LISTO.puedeAvanzarA(DeliveryStatus.NUEVO));
        assertFalse(DeliveryStatus.CONFIRMADO.puedeAvanzarA(DeliveryStatus.NUEVO));
    }

    @Test
    @DisplayName("Quedarse en el mismo estado no es un avance")
    void mismoEstado() {
        for (DeliveryStatus estado : DeliveryStatus.values()) {
            assertFalse(estado.puedeAvanzarA(estado), estado + " no deberia avanzar a si mismo");
        }
    }

    @Test
    @DisplayName("Se puede cancelar en cualquier punto del camino")
    void cancelarEnCualquierMomento() {
        assertTrue(DeliveryStatus.NUEVO.puedeAvanzarA(DeliveryStatus.CANCELADO));
        assertTrue(DeliveryStatus.CONFIRMADO.puedeAvanzarA(DeliveryStatus.CANCELADO));
        assertTrue(DeliveryStatus.LISTO.puedeAvanzarA(DeliveryStatus.CANCELADO));
        assertTrue(DeliveryStatus.EN_CAMINO.puedeAvanzarA(DeliveryStatus.CANCELADO));
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"ENTREGADO", "CANCELADO"})
    @DisplayName("Un pedido terminado ya no se mueve, ni siquiera para cancelarlo")
    void estadosFinales(DeliveryStatus terminal) {
        assertTrue(terminal.esFinal());
        for (DeliveryStatus destino : DeliveryStatus.values()) {
            assertFalse(terminal.puedeAvanzarA(destino),
                    terminal + " no deberia poder pasar a " + destino);
        }
    }

    @Test
    @DisplayName("Cocina solo ve el pedido despues de que la sucursal lo acepta")
    void cuandoLlegaACocina() {
        assertFalse(DeliveryStatus.NUEVO.llegoACocina(), "sin aceptar, nadie debe cocinarlo");
        assertFalse(DeliveryStatus.CANCELADO.llegoACocina(), "cancelado se va del tablero");

        assertTrue(DeliveryStatus.CONFIRMADO.llegoACocina());
        assertTrue(DeliveryStatus.LISTO.llegoACocina());
        assertTrue(DeliveryStatus.EN_CAMINO.llegoACocina());
        assertTrue(DeliveryStatus.ENTREGADO.llegoACocina());
    }
}
