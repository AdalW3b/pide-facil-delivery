package com.omnirest.omnirest_backend.security;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.SesionSoporte;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.services.SoporteService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerMapping;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Toda petición del operador a datos de un restaurante pasa por el modo soporte. */
class CandadoSoporteTest {

    private final UUID restaurante = UUID.randomUUID();
    private final UUID sucursal = UUID.randomUUID();
    private final SoporteService soporte = mock(SoporteService.class);
    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final CandadoSoporte candado = new CandadoSoporte(soporte, branchRepository);
    private final SesionSoporte sesion = SesionSoporte.builder().id(UUID.randomUUID()).restaurantId(restaurante).build();

    @BeforeEach
    void setUp() {
        when(branchRepository.findById(sucursal)).thenReturn(Optional.of(
                Branch.builder().id(sucursal).restaurant(Restaurant.builder().id(restaurante).build()).build()));
        when(soporte.exigir(any(), any(), anyBoolean())).thenReturn(sesion);
    }

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
    }

    private void comoRol(String rol) {
        CustomUserDetails u = new CustomUserDetails(UUID.randomUUID(), "u", "x", rol, "/", null, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(u, null, List.of()));
    }

    private static MockHttpServletRequest peticion(String metodo, String ruta, Map<String, String> variables) {
        MockHttpServletRequest r = new MockHttpServletRequest(metodo, ruta);
        if (variables != null) r.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, variables);
        return r;
    }

    @Test
    @DisplayName("Leer un tablero pide sesión en el restaurante de esa sucursal")
    void lecturaConSucursal() {
        comoRol("SYSTEM_ADMIN");
        assertTrue(candado.preHandle(peticion("GET", "/api/v1/branches/" + sucursal + "/delivery/orders",
                Map.of("branchId", sucursal.toString())), new MockHttpServletResponse(), null));
        verify(soporte).exigir(any(), eq(restaurante), eq(false));
    }

    @Test
    @DisplayName("Un cambio pide la ventana de cambios y queda en la bitácora")
    void cambioSeRegistra() {
        comoRol("SYSTEM_ADMIN");
        MockHttpServletRequest r = peticion("PATCH", "/api/v1/branches/" + sucursal + "/delivery/orders/x/status",
                Map.of("branchId", sucursal.toString()));
        MockHttpServletResponse resp = new MockHttpServletResponse();
        candado.preHandle(r, resp, null);
        verify(soporte).exigir(any(), eq(restaurante), eq(true));

        candado.afterCompletion(r, resp, null, null);
        verify(soporte).registrarCambio(eq(sesion.getId()), eq("PATCH"), contains("/status"), eq(200));
    }

    @Test
    @DisplayName("Si el servicio lo niega, la petición no pasa y el 403 dice que es del modo soporte")
    void negado() throws Exception {
        comoRol("SYSTEM_ADMIN");
        when(soporte.exigir(any(), any(), anyBoolean()))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Abre una sesión \"de soporte\""));
        MockHttpServletResponse resp = new MockHttpServletResponse();
        assertFalse(candado.preHandle(peticion("GET", "/api/v1/tables", null), resp, null));
        assertEquals(403, resp.getStatus());
        assertTrue(resp.getContentAsString().contains("\"modoSoporte\":true"));
        // El mensaje va como JSON valido aunque traiga comillas.
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(resp.getContentAsString());
    }

    @Test
    @DisplayName("Sucursal por parámetro (?branchId=) también cuenta")
    void sucursalPorParametro() {
        comoRol("SYSTEM_ADMIN");
        MockHttpServletRequest r = peticion("GET", "/api/v1/tables", null);
        r.setParameter("branchId", sucursal.toString());
        candado.preHandle(r, new MockHttpServletResponse(), null);
        verify(soporte).exigir(any(), eq(restaurante), eq(false));
    }

    @Test
    @DisplayName("Lo de la plataforma y los reportes globales no piden sesión")
    void exentos() {
        comoRol("SYSTEM_ADMIN");
        candado.preHandle(peticion("GET", "/api/v1/system/renta/resumen", null), new MockHttpServletResponse(), null);
        candado.preHandle(peticion("POST", "/api/v1/admin/restaurants", null), new MockHttpServletResponse(), null);
        candado.preHandle(peticion("GET", "/api/v1/analytics/summary", null), new MockHttpServletResponse(), null);
        verify(soporte, never()).exigir(any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("Al dueño y a los empleados no les aplica")
    void otrosRoles() {
        comoRol("SUPER_ADMIN");
        candado.preHandle(peticion("POST", "/api/v1/branches/" + sucursal + "/caja/abrir",
                Map.of("branchId", sucursal.toString())), new MockHttpServletResponse(), null);
        verify(soporte, never()).exigir(any(), any(), anyBoolean());
    }
}
