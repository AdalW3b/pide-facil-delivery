package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.CodigoSoporte;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.SesionSoporte;
import com.omnirest.omnirest_backend.repositories.AccionSoporteRepository;
import com.omnirest.omnirest_backend.repositories.CodigoSoporteRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.SesionSoporteRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Soporte ve con sesión y motivo; cambia solo con el código del dueño, una vez y por poco tiempo. */
class SoporteServiceTest {

    private final UUID restaurante = UUID.randomUUID();
    private final CustomUserDetails operador = new CustomUserDetails(UUID.randomUUID(), "sysadmin", "x", "SYSTEM_ADMIN",
            "/system", null, null, List.of());
    private final CustomUserDetails dueno = new CustomUserDetails(UUID.randomUUID(), "dueno", "x", "SUPER_ADMIN",
            "/dashboard", restaurante, null, List.of());

    private final SesionSoporteRepository sesionRepository = mock(SesionSoporteRepository.class);
    private final AccionSoporteRepository accionRepository = mock(AccionSoporteRepository.class);
    private final CodigoSoporteRepository codigoRepository = mock(CodigoSoporteRepository.class);
    private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
    private final AvisosSistemaService avisos = mock(AvisosSistemaService.class);
    private final SoporteService servicio = new SoporteService(sesionRepository, accionRepository, codigoRepository,
            restaurantRepository, avisos);

    private final List<SesionSoporte> abiertas = new ArrayList<>();
    private final List<CodigoSoporte> codigos = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(restaurantRepository.findById(restaurante)).thenReturn(Optional.of(
                Restaurant.builder().id(restaurante).name("Pizzería").build()));
        when(sesionRepository.findByOperadorIdAndFinIsNull(operador.id())).thenAnswer(i ->
                abiertas.stream().filter(s -> s.getFin() == null).toList());
        when(sesionRepository.save(any(SesionSoporte.class))).thenAnswer(i -> {
            SesionSoporte s = i.getArgument(0);
            if (s.getId() == null) {
                s.setId(UUID.randomUUID());
                abiertas.add(s);
            }
            return s;
        });
        when(codigoRepository.save(any(CodigoSoporte.class))).thenAnswer(i -> {
            CodigoSoporte c = i.getArgument(0);
            if (!codigos.contains(c)) codigos.add(c);
            return c;
        });
        when(codigoRepository.findByRestaurantIdAndUsadoEnIsNullAndExpiraEnAfter(any(), any())).thenAnswer(i ->
                codigos.stream().filter(c -> c.getRestaurantId().equals(i.getArgument(0)) && c.getUsadoEn() == null
                        && c.getExpiraEn().isAfter(i.getArgument(1))).toList());
    }

    private static HttpStatus estado(Runnable r) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, r::run);
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    @Test
    @DisplayName("Sin sesión no se ve nada; con sesión se lee, pero no se cambia")
    void soloLecturaPorOmision() {
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.exigir(operador.id(), restaurante, false)));

        servicio.abrir(operador, restaurante, "No le llegan pedidos de WhatsApp");
        assertNotNull(servicio.exigir(operador.id(), restaurante, false));
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> servicio.exigir(operador.id(), restaurante, true));
        assertTrue(e.getReason().contains("solo lectura"));

        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.exigir(operador.id(), UUID.randomUUID(), false)),
                "la sesión es de un solo restaurante");
    }

    @Test
    @DisplayName("Abrir una sesión pide motivo, cierra la anterior y avisa al dueño")
    void abrirAvisa() {
        assertEquals(HttpStatus.BAD_REQUEST, estado(() -> servicio.abrir(operador, restaurante, " ")));

        servicio.abrir(operador, restaurante, "Revisión de inventario");
        servicio.abrir(operador, restaurante, "Otra revisión");
        assertEquals(1, abiertas.stream().filter(s -> s.getFin() == null).count());
        verify(avisos, times(2)).avisar(eq(restaurante), eq("SOPORTE"), contains("Soporte"), contains("Motivo"));
    }

    @Test
    @DisplayName("El código del dueño abre los cambios, sirve una sola vez y avisa")
    void codigoDelDueno() {
        servicio.abrir(operador, restaurante, "Corregir un platillo");
        SoporteService.CodigoGenerado generado = servicio.generarCodigo(dueno);
        assertTrue(generado.codigo().matches("\\d{6}"));
        assertNotEquals(generado.codigo(), codigos.get(0).getCodigoHash(), "solo se guarda la huella");

        SoporteService.SesionDTO s = servicio.autorizarCambios(operador, generado.codigo());
        assertNotNull(s.cambiosHasta());
        assertNotNull(servicio.exigir(operador.id(), restaurante, true));
        verify(avisos).avisar(eq(restaurante), eq("SOPORTE"), contains("código"), anyString());

        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.autorizarCambios(operador, generado.codigo())),
                "el mismo código no sirve dos veces");
    }

    @Test
    @DisplayName("Un código de otro restaurante o caducado no sirve; muchos intentos bloquean la sesión")
    void codigosInvalidos() {
        servicio.abrir(operador, restaurante, "Revisión");
        UUID otro = UUID.randomUUID();
        String codigoAjeno = servicio.generarCodigo(new CustomUserDetails(UUID.randomUUID(), "otro", "x", "SUPER_ADMIN",
                "/", otro, null, List.of())).codigo();
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.autorizarCambios(operador, codigoAjeno)));

        String caducado = servicio.generarCodigo(dueno).codigo();
        codigos.get(codigos.size() - 1).setExpiraEn(LocalDateTime.now().minusMinutes(1));
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.autorizarCambios(operador, caducado)));

        for (int i = 0; i < SoporteService.INTENTOS_MAXIMOS; i++) {
            try {
                servicio.autorizarCambios(operador, "000000");
            } catch (ResponseStatusException ignorado) {
                // se cuentan los fallidos
            }
        }
        String bueno = servicio.generarCodigo(dueno).codigo();
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, estado(() -> servicio.autorizarCambios(operador, bueno)));
    }

    @Test
    @DisplayName("Una sesión vieja ya no vale aunque nadie la haya cerrado")
    void sesionCaduca() {
        servicio.abrir(operador, restaurante, "Revisión de caja");
        abiertas.get(0).setInicio(LocalDateTime.now().minus(SoporteService.DURACION_SESION).minusMinutes(1));
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.exigir(operador.id(), restaurante, false)));
    }

    @Test
    @DisplayName("Terminar cierra la sesión y quita los cambios")
    void terminar() {
        servicio.abrir(operador, restaurante, "Revisión");
        servicio.terminar(operador);
        ArgumentCaptor<SesionSoporte> captor = ArgumentCaptor.forClass(SesionSoporte.class);
        verify(sesionRepository, atLeast(2)).save(captor.capture());
        assertNotNull(captor.getValue().getFin());
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.exigir(operador.id(), restaurante, false)));
    }
}
