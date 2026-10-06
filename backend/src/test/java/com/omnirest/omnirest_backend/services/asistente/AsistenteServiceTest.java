package com.omnirest.omnirest_backend.services.asistente;

import com.omnirest.omnirest_backend.domain.entities.AsistenteConfig;
import com.omnirest.omnirest_backend.domain.entities.AsistenteMensaje;
import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.repositories.AsistenteConfigRepository;
import com.omnirest.omnirest_backend.repositories.AsistenteMensajeRepository;
import com.omnirest.omnirest_backend.repositories.AsistenteResumenRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AvisosSistemaService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Quién puede usar el asistente, cómo pregunta con herramientas y cómo se guarda la configuración. */
class AsistenteServiceTest {

    private final UUID restaurantId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(restaurantId).name("Fonda Lupita").build();
    private final Branch sucursal = Branch.builder().id(UUID.randomUUID()).name("Centro").restaurant(restaurante).active(true).build();

    private final AsistenteConfigRepository configRepository = mock(AsistenteConfigRepository.class);
    private final AsistenteMensajeRepository mensajeRepository = mock(AsistenteMensajeRepository.class);
    private final AsistenteResumenRepository resumenRepository = mock(AsistenteResumenRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final HerramientasAsistente herramientas = mock(HerramientasAsistente.class);
    private final SecurityValidationService seguridad = mock(SecurityValidationService.class);
    private final AvisosSistemaService avisos = mock(AvisosSistemaService.class);
    private final FabricaProveedores fabrica = mock(FabricaProveedores.class);
    private CifradoLlaves cifrado;
    private AsistenteService servicio;
    private AsistenteConfig config;

    /** Un proveedor de mentira: primero pide una herramienta, luego contesta con lo que recibió. */
    private final List<List<ProveedorLlm.Resultado>> recibidos = new ArrayList<>();
    private int pasosPidiendo = 1;

    @BeforeEach
    void setUp() {
        byte[] b = new byte[32];
        new SecureRandom().nextBytes(b);
        cifrado = new CifradoLlaves(Base64.getEncoder().encodeToString(b));
        servicio = new AsistenteService(configRepository, mensajeRepository, resumenRepository, userRepository,
                branchRepository, cifrado, herramientas, seguridad, avisos, fabrica);

        config = AsistenteConfig.builder().restaurantId(restaurantId).complementoActivo(true)
                .proveedor(AsistenteConfig.Proveedor.ANTHROPIC).modelo("claude-opus-5-5")
                .llaveCifrada(cifrado.cifrar("sk-ant-1234567890")).llaveFinal("7890").build();
        when(configRepository.findById(restaurantId)).thenAnswer(i -> Optional.ofNullable(config));
        when(configRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(branchRepository.findById(sucursal.getId())).thenReturn(Optional.of(sucursal));
        when(branchRepository.findByRestaurantIdAndActiveTrue(restaurantId)).thenReturn(List.of(sucursal));
        when(mensajeRepository.tokensDesde(any(), any())).thenReturn(List.<Object[]>of(new Object[]{0L, 0L}));
        when(herramientas.para(any())).thenReturn(List.of(new ProveedorLlm.Herramienta("resumen_ventas", "x", java.util.Map.of())));
        when(herramientas.ejecutar(any(), any())).thenAnswer(i -> new ProveedorLlm.Resultado(i.getArgument(0), "{\"total\":1500}", false));

        when(fabrica.crear(any())).thenReturn((instr, ctx, hist, pregunta, tools, max) -> new ProveedorLlm.Conversacion() {
            int pasos = 0;

            @Override
            public ProveedorLlm.Paso siguiente() {
                if (pasos++ < pasosPidiendo) {
                    return new ProveedorLlm.Paso("", List.of(new ProveedorLlm.Llamada("t" + pasos, "resumen_ventas", "{}")), 100, 20);
                }
                return new ProveedorLlm.Paso("Ayer vendiste $1,500.", List.of(), 150, 30);
            }

            @Override
            public void responder(List<ProveedorLlm.Resultado> resultados) {
                recibidos.add(resultados);
            }
        });
    }

    private CustomUserDetails usuario(String rol, String... permisos) {
        return new CustomUserDetails(UUID.randomUUID(), "lupita", "x", rol, "/", restaurantId, sucursal.getId(),
                java.util.Arrays.stream(permisos).map(SimpleGrantedAuthority::new).toList());
    }

    private static HttpStatus estado(Runnable r) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, r::run);
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    @Test
    @DisplayName("Dueño y gerente siempre; el resto del personal solo si el dueño lo habilitó")
    void quienPuede() {
        assertTrue(servicio.estado(usuario("SUPER_ADMIN")).puedeUsar());
        assertTrue(servicio.estado(usuario("SUPER_ADMIN")).puedeConfigurar());
        assertTrue(servicio.estado(usuario("BRANCH_MANAGER")).puedeUsar());
        assertFalse(servicio.estado(usuario("BRANCH_MANAGER")).puedeConfigurar());

        CustomUserDetails mesero = usuario("Mesero");
        when(userRepository.findById(mesero.id())).thenReturn(Optional.of(User.builder().id(mesero.id()).usaAsistente(false).build()));
        assertFalse(servicio.estado(mesero).puedeUsar());
        when(userRepository.findById(mesero.id())).thenReturn(Optional.of(User.builder().id(mesero.id()).usaAsistente(true).build()));
        assertTrue(servicio.estado(mesero).puedeUsar());
    }

    @Test
    @DisplayName("Sin complemento o sin configurar no se usa, y dice por qué")
    void sinComplemento() {
        config.setComplementoActivo(false);
        AsistenteService.Estado e = servicio.estado(usuario("SUPER_ADMIN"));
        assertFalse(e.puedeUsar());
        assertTrue(e.motivo().contains("complemento"));
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.preguntar(usuario("SUPER_ADMIN"),
                new AsistenteService.Pregunta("¿Cuánto vendí?", null, List.of()))));

        config.setComplementoActivo(true);
        config.setLlaveCifrada(null);
        assertFalse(servicio.estado(usuario("SUPER_ADMIN")).puedeUsar());
    }

    @Test
    @DisplayName("Pregunta, usa la herramienta, contesta y lo guarda con sus tokens")
    void preguntaConHerramienta() {
        AsistenteService.Respuesta r = servicio.preguntar(usuario("SUPER_ADMIN", "SUPER_ADMIN"),
                new AsistenteService.Pregunta("¿Cuánto vendí ayer?", sucursal.getId(), List.of()));

        assertEquals("Ayer vendiste $1,500.", r.texto());
        assertEquals(List.of("resumen_ventas"), r.consulto());
        assertEquals("{\"total\":1500}", recibidos.get(0).get(0).contenido());
        verify(seguridad).validateUserAccessToBranch(sucursal.getId());

        ArgumentCaptor<AsistenteMensaje> m = ArgumentCaptor.forClass(AsistenteMensaje.class);
        verify(mensajeRepository).save(m.capture());
        assertEquals(250L, m.getValue().getTokensEntrada());
        assertEquals(50L, m.getValue().getTokensSalida());
        assertEquals("resumen_ventas", m.getValue().getHerramientas());
    }

    @Test
    @DisplayName("Si el modelo no deja de pedir herramientas, se corta y se avisa")
    void cicloInfinito() {
        pasosPidiendo = 100;
        AsistenteService.Respuesta r = servicio.preguntar(usuario("SUPER_ADMIN", "SUPER_ADMIN"),
                new AsistenteService.Pregunta("Todo", null, List.of()));
        assertEquals(AsistenteService.MAX_PASOS, recibidos.size());
        assertTrue(r.texto().contains("No alcancé"));
    }

    @Test
    @DisplayName("Límite de preguntas por hora y largo de la pregunta")
    void limites() {
        CustomUserDetails dueno = usuario("SUPER_ADMIN");
        assertEquals(HttpStatus.BAD_REQUEST, estado(() -> servicio.preguntar(dueno,
                new AsistenteService.Pregunta("x".repeat(AsistenteService.MAX_PREGUNTA + 1), null, List.of()))));

        when(mensajeRepository.countByUserIdAndCreadoEnAfter(eq(dueno.id()), any())).thenReturn((long) AsistenteService.PREGUNTAS_POR_HORA);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, estado(() -> servicio.preguntar(dueno,
                new AsistenteService.Pregunta("¿Cuánto vendí?", null, List.of()))));
    }

    @Test
    @DisplayName("Configurar: solo el dueño; la llave se guarda cifrada y solo se ven sus últimos 4")
    void configurar() {
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> servicio.guardar(usuario("BRANCH_MANAGER"),
                new AsistenteService.GuardarConfig("OPENAI", "gpt-5", null, "sk-nueva-llave-abcd", true))));

        AsistenteService.ConfigDTO c = servicio.guardar(usuario("SUPER_ADMIN"),
                new AsistenteService.GuardarConfig("openai", "gpt-5", null, "sk-nueva-llave-abcd", false));
        assertEquals("OPENAI", c.proveedor());
        assertEquals("abcd", c.llaveFinal());
        assertNotEquals("sk-nueva-llave-abcd", config.getLlaveCifrada());
        assertEquals("sk-nueva-llave-abcd", cifrado.descifrar(config.getLlaveCifrada()));
        assertFalse(c.resumenDiario());

        // Sin llave nueva se conserva la anterior.
        String antes = config.getLlaveCifrada();
        servicio.guardar(usuario("SUPER_ADMIN"), new AsistenteService.GuardarConfig("GEMINI", "gemini-2.5-pro", null, " ", null));
        assertEquals(antes, config.getLlaveCifrada());
    }

    @Test
    @DisplayName("Configurar: proveedor, modelo y URL inválidos se rechazan")
    void configuracionInvalida() {
        CustomUserDetails dueno = usuario("SUPER_ADMIN");
        assertThrows(ResponseStatusException.class, () -> servicio.guardar(dueno,
                new AsistenteService.GuardarConfig("CHATBOT", "x", null, null, null)));
        assertThrows(ResponseStatusException.class, () -> servicio.guardar(dueno,
                new AsistenteService.GuardarConfig("OPENAI", "gpt 5; drop table", null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> servicio.guardar(dueno,
                new AsistenteService.GuardarConfig("COMPATIBLE", "deepseek-chat", "http://10.0.0.2/v1", null, null)));
    }

    @Test
    @DisplayName("El historial que manda el panel se recorta y se ordena para el proveedor")
    void historial() {
        List<AsistenteService.TurnoDTO> turnos = new ArrayList<>();
        turnos.add(new AsistenteService.TurnoDTO(false, "Hola, ¿en qué te ayudo?"));   // no puede empezar el asistente
        turnos.add(new AsistenteService.TurnoDTO(true, "¿Cuánto vendí?"));
        turnos.add(new AsistenteService.TurnoDTO(true, "repetido"));                    // dos del usuario seguidos
        turnos.add(new AsistenteService.TurnoDTO(false, "Vendiste $100."));
        turnos.add(new AsistenteService.TurnoDTO(true, "¿Y ayer?"));                    // la pregunta nueva va aparte

        ArgumentCaptor<List<ProveedorLlm.Turno>> captor = ArgumentCaptor.captor();
        ProveedorLlm proveedor = mock(ProveedorLlm.class);
        ProveedorLlm.Conversacion conv = mock(ProveedorLlm.Conversacion.class);
        when(conv.siguiente()).thenReturn(new ProveedorLlm.Paso("Listo.", List.of(), 1, 1));
        when(proveedor.iniciar(any(), any(), captor.capture(), any(), any(), anyInt())).thenReturn(conv);
        when(fabrica.crear(any())).thenReturn(proveedor);

        servicio.preguntar(usuario("SUPER_ADMIN"), new AsistenteService.Pregunta("Nueva", null, turnos));
        List<ProveedorLlm.Turno> h = captor.getValue();
        assertEquals(2, h.size());
        assertTrue(h.get(0).delUsuario());
        assertFalse(h.get(1).delUsuario());
    }

    @Test
    @DisplayName("Activar el complemento avisa al dueño")
    void complemento() {
        config = null;
        assertTrue(servicio.activarComplemento(restaurantId, true));
        verify(avisos).avisar(eq(restaurantId), eq("ASISTENTE"), contains("activo"), anyString());
    }
}
