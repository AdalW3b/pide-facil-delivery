package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NumerosDeSucursalTest {

    private final Branch centro = Branch.builder().id(UUID.randomUUID()).name("Centro")
            .restaurant(Restaurant.builder().name("El Farolito").build())
            .whatsappNumber("+525512345678").build();
    private final Branch sur = Branch.builder().id(UUID.randomUUID()).name("Sur").whatsappNumber(null).build();
    private final BranchRepository repo = mock(BranchRepository.class);
    private final NumerosDeSucursal numeros = new NumerosDeSucursal(repo);

    {
        when(repo.findAll()).thenReturn(List.of(centro, sur));
    }

    @ParameterizedTest(name = "\"{0}\" ya es de Centro")
    @ValueSource(strings = {"+525512345678", "5215512345678", "55 1234 5678", "+52 (55) 1234-5678"})
    void elMismoNumeroEscritoDistintoSeRechaza(String numero) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> numeros.validarUnico(numero, sur.getId()));
        assertTrue(e.getReason().contains("Centro (El Farolito)"), e.getReason());
    }

    @Test
    @DisplayName("Guardar su propio número no es conflicto")
    void supropioNumeroNoChoca() {
        assertDoesNotThrow(() -> numeros.validarUnico("5215512345678", centro.getId()));
    }

    @Test
    @DisplayName("Un número nuevo o vacío se acepta")
    void numeroLibre() {
        assertDoesNotThrow(() -> numeros.validarUnico("5599998888", sur.getId()));
        assertDoesNotThrow(() -> numeros.validarUnico("", sur.getId()));
        assertDoesNotThrow(() -> numeros.validarUnico(null, null));
    }

    @Test
    @DisplayName("Se guarda siempre igual: +52 y diez dígitos")
    void formatoParaGuardar() {
        assertEquals("+525512345678", NumerosDeSucursal.paraGuardar("521 55 1234 5678"));
        assertNull(NumerosDeSucursal.paraGuardar("  "));
    }
}
