package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TurnosTest {

    @Test
    @DisplayName("Tres cifras y letra: A-001 ... A-999, luego B-001")
    void formato() {
        assertEquals("A-001", Turnos.formato(1));
        assertEquals("A-023", Turnos.formato(23));
        assertEquals("A-999", Turnos.formato(999));
        assertEquals("B-001", Turnos.formato(1000));
        assertEquals("A-001", Turnos.formato(0), "un contador raro no da A-000");
    }
}
