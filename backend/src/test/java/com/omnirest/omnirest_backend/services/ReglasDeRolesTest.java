package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Permission;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Nadie da mas de lo que tiene, y lo de la plataforma solo lo da el operador. */
class ReglasDeRolesTest {

    private final UUID miRestaurante = UUID.randomUUID();
    private final UUID otroRestaurante = UUID.randomUUID();

    private CustomUserDetails usuario(String rol, UUID restaurante, String... permisos) {
        return new CustomUserDetails(UUID.randomUUID(), "u", "x", rol, "/", restaurante, UUID.randomUUID(),
                Arrays.stream(permisos).map(SimpleGrantedAuthority::new).toList());
    }

    private static Role rolDelSistema(String nombre, String... permisos) {
        return Role.builder().id(UUID.randomUUID()).name(nombre).isCustom(false).restaurant(null)
                .permissions(permisos(permisos)).build();
    }

    private static Role rolDe(UUID restaurante, String nombre, String... permisos) {
        return Role.builder().id(UUID.randomUUID()).name(nombre).isCustom(true)
                .restaurant(Restaurant.builder().id(restaurante).build()).permissions(permisos(permisos)).build();
    }

    private static List<Permission> permisos(String... nombres) {
        return Arrays.stream(nombres).map(n -> Permission.builder().id(UUID.randomUUID()).name(n).build()).toList();
    }

    private static HttpStatus estado(Runnable r) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, r::run);
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    // ------------------------------------------------------------------ asignar

    @Test
    @DisplayName("Ni el dueño ni el gerente pueden crear a un operador de la plataforma")
    void nadieAsignaSystemAdmin() {
        Role operador = rolDelSistema("SYSTEM_ADMIN", "MANAGE_RESTAURANTS");
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeAsignar(usuario("SUPER_ADMIN", miRestaurante), operador, miRestaurante)));
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeAsignar(usuario("BRANCH_MANAGER", miRestaurante, "USERS_CREATE"), operador, miRestaurante)));
        assertDoesNotThrow(() ->
                ReglasDeRoles.exigirPuedeAsignar(usuario("SYSTEM_ADMIN", null), operador, miRestaurante));
    }

    @Test
    @DisplayName("Un rol de otro restaurante no se asigna, ni siquiera el dueño")
    void rolAjeno() {
        Role ajeno = rolDe(otroRestaurante, "Cajero", "ORDERS_READ");
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeAsignar(usuario("SUPER_ADMIN", miRestaurante), ajeno, miRestaurante)));
        assertDoesNotThrow(() -> ReglasDeRoles.exigirPuedeAsignar(usuario("SUPER_ADMIN", miRestaurante),
                rolDe(miRestaurante, "Cajero", "ORDERS_READ"), miRestaurante));
    }

    @Test
    @DisplayName("El gerente no asigna el rol de dueño ni roles con más permisos que los suyos")
    void gerenteNoEscala() {
        CustomUserDetails gerente = usuario("BRANCH_MANAGER", miRestaurante, "BRANCH_MANAGER", "ORDERS_READ", "TABLES_READ");
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeAsignar(gerente, rolDelSistema("SUPER_ADMIN"), miRestaurante)));
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> ReglasDeRoles.exigirPuedeAsignar(gerente,
                rolDe(miRestaurante, "Inventarista", "INVENTORY_UPDATE"), miRestaurante)));
        assertDoesNotThrow(() -> ReglasDeRoles.exigirPuedeAsignar(gerente,
                rolDe(miRestaurante, "Host", "TABLES_READ"), miRestaurante));
        assertDoesNotThrow(() -> ReglasDeRoles.exigirPuedeAsignar(gerente,
                rolDelSistema("Mesero", "ORDERS_READ"), miRestaurante));
    }

    // ------------------------------------------------------------------ otorgar

    @Test
    @DisplayName("Los permisos de plataforma no van en un rol de restaurante, ni del dueño")
    void permisosDePlataforma() {
        CustomUserDetails dueno = usuario("SUPER_ADMIN", miRestaurante);
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeOtorgar(dueno, List.of("ORDERS_READ", "MANAGE_RESTAURANTS"))));
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeOtorgar(dueno, List.of("super_admin"))));
        assertDoesNotThrow(() -> ReglasDeRoles.exigirPuedeOtorgar(dueno, List.of("ORDERS_READ", "INVENTORY_UPDATE")));
        assertDoesNotThrow(() -> ReglasDeRoles.exigirPuedeOtorgar(usuario("SYSTEM_ADMIN", null), List.of("MANAGE_RESTAURANTS")));
    }

    @Test
    @DisplayName("Quien no es dueño solo da permisos que ya tiene")
    void soloLoQueTiene() {
        CustomUserDetails gerente = usuario("BRANCH_MANAGER", miRestaurante, "ORDERS_READ", "USERS_CREATE");
        assertDoesNotThrow(() -> ReglasDeRoles.exigirPuedeOtorgar(gerente, List.of("ORDERS_READ")));
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                ReglasDeRoles.exigirPuedeOtorgar(gerente, List.of("ORDERS_READ", "CAJA_OPERAR"))));
    }

    // ------------------------------------------------------------------ nombres y rutas

    @Test
    @DisplayName("Un rol no puede llamarse como uno del sistema ni como un permiso, con cualquier mayúscula")
    void nombresReservados() {
        List<String> permisos = List.of("CAJA_OPERAR", "ORDERS_READ");
        for (String nombre : List.of("super_admin", "System_Admin", "admin", "Mesero", "caja_operar")) {
            assertEquals(HttpStatus.BAD_REQUEST, estado(() -> ReglasDeRoles.exigirNombreValido(nombre, permisos)), nombre);
        }
        assertEquals("Cajero de turno", ReglasDeRoles.exigirNombreValido("  Cajero   de turno ", permisos));
        assertEquals(HttpStatus.BAD_REQUEST, estado(() -> ReglasDeRoles.exigirNombreValido("   ", permisos)));
    }

    @Test
    @DisplayName("La pantalla de inicio tiene que existir; vacía es Mesas")
    void rutas() {
        assertEquals("/dashboard", ReglasDeRoles.exigirRuta(null));
        assertEquals("/caja", ReglasDeRoles.exigirRuta(" /caja "));
        assertEquals(HttpStatus.BAD_REQUEST, estado(() -> ReglasDeRoles.exigirRuta("https://otro-sitio.com")));
        assertEquals(HttpStatus.BAD_REQUEST, estado(() -> ReglasDeRoles.exigirRuta("/admin")));
    }
}
