package com.omnirest.omnirest_backend.services.asistente;

import com.omnirest.omnirest_backend.domain.entities.AsistenteConfig;
import com.omnirest.omnirest_backend.domain.entities.AsistenteMensaje;
import com.omnirest.omnirest_backend.domain.entities.AsistenteResumen;
import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.repositories.AsistenteConfigRepository;
import com.omnirest.omnirest_backend.repositories.AsistenteMensajeRepository;
import com.omnirest.omnirest_backend.repositories.AsistenteResumenRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * El asistente operativo de cada restaurante.
 *
 * Lo usan el dueño, los gerentes y el personal que el dueño habilite. Cada
 * restaurante pone el proveedor de IA y la llave que quiera; es un
 * complemento que activa el operador. El asistente consulta los datos con
 * {@link HerramientasAsistente} (solo lectura, con los permisos del usuario).
 */
@Slf4j
@Service
public class AsistenteService {

    /** Rondas de herramientas por pregunta: evita ciclos y cuentas largas. */
    static final int MAX_PASOS = 6;
    static final int MAX_TOKENS = 2000;
    static final int PREGUNTAS_POR_HORA = 30;
    static final int MAX_PREGUNTA = 2000;
    static final int MAX_TURNOS = 10;
    static final int MAX_TURNO = 4000;
    /** Lo que recibe el modelo si pide mas consultas de las permitidas. */
    static final String CIERRE = "Ya no hay más consultas para esta pregunta. Contesta ahora con lo que ya consultaste; "
            + "si falta algún dato, dilo y explica dónde verlo en el sistema.";

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("EEEE d 'de' MMMM 'de' yyyy", new Locale("es", "MX"));

    private final AsistenteConfigRepository configRepository;
    private final AsistenteMensajeRepository mensajeRepository;
    private final AsistenteResumenRepository resumenRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final CifradoLlaves cifrado;
    private final HerramientasAsistente herramientas;
    private final SecurityValidationService securityValidationService;
    private final com.omnirest.omnirest_backend.services.AvisosSistemaService avisos;
    private final FabricaProveedores fabrica;
    private final String instrucciones;

    public AsistenteService(AsistenteConfigRepository configRepository, AsistenteMensajeRepository mensajeRepository,
                            AsistenteResumenRepository resumenRepository, UserRepository userRepository,
                            BranchRepository branchRepository, CifradoLlaves cifrado, HerramientasAsistente herramientas,
                            SecurityValidationService securityValidationService,
                            com.omnirest.omnirest_backend.services.AvisosSistemaService avisos, FabricaProveedores fabrica) {
        this.configRepository = configRepository;
        this.mensajeRepository = mensajeRepository;
        this.resumenRepository = resumenRepository;
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.cifrado = cifrado;
        this.herramientas = herramientas;
        this.securityValidationService = securityValidationService;
        this.avisos = avisos;
        this.fabrica = fabrica;
        this.instrucciones = leer("asistente/instrucciones.md");
    }

    // ------------------------------------------------------------------
    // Tipos
    // ------------------------------------------------------------------

    public record Estado(boolean complemento, boolean configurado, boolean puedeUsar, boolean puedeConfigurar,
                         String motivo, String proveedor, String modelo) {
    }

    public record TurnoDTO(boolean delUsuario, String texto) {
    }

    public record Pregunta(String pregunta, UUID branchId, List<TurnoDTO> historial) {
    }

    public record Respuesta(String texto, List<String> consulto) {
    }

    public record ConfigDTO(boolean complemento, String proveedor, String modelo, String urlBase, String llaveFinal,
                            boolean resumenDiario, boolean servidorListo, long preguntasDelMes,
                            long tokensEntradaDelMes, long tokensSalidaDelMes) {
    }

    public record GuardarConfig(String proveedor, String modelo, String urlBase, String llave, Boolean resumenDiario) {
    }

    public record Persona(UUID id, String nombre, String usuario, String rol, boolean habilitado, boolean siempre) {
    }

    public record ResumenDTO(LocalDate dia, String contenido, LocalDateTime creadoEn) {
    }

    // ------------------------------------------------------------------
    // Quién puede
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Estado estado(CustomUserDetails u) {
        if (u == null || u.restaurantId() == null || esOperador(u)) {
            return new Estado(false, false, false, false, "El asistente es de cada restaurante.", null, null);
        }
        AsistenteConfig c = configRepository.findById(u.restaurantId()).orElse(null);
        boolean complemento = c != null && Boolean.TRUE.equals(c.getComplementoActivo());
        boolean configurado = c != null && c.configurado();
        boolean puedeConfigurar = esDueno(u);
        boolean permitido = puedeUsar(u);
        String motivo = !complemento ? "El asistente es un complemento: pídelo a Pide Fácil para activarlo."
                : !configurado ? (puedeConfigurar ? "Elige tu proveedor de IA y pon tu llave para empezar."
                : "El dueño todavía no configura el asistente.")
                : !permitido ? "El dueño no te ha habilitado el asistente." : null;
        return new Estado(complemento, configurado, complemento && configurado && permitido, puedeConfigurar && complemento,
                motivo, c != null && c.getProveedor() != null ? c.getProveedor().name() : null, c != null ? c.getModelo() : null);
    }

    /** El dueño y los gerentes siempre; el resto del personal si el dueño lo habilitó. */
    boolean puedeUsar(CustomUserDetails u) {
        if (esDueno(u) || "BRANCH_MANAGER".equalsIgnoreCase(u.roleName())) return true;
        return userRepository.findById(u.id()).map(x -> Boolean.TRUE.equals(x.getUsaAsistente())).orElse(false);
    }

    // ------------------------------------------------------------------
    // Preguntar
    // ------------------------------------------------------------------

    @Transactional
    public Respuesta preguntar(CustomUserDetails u, Pregunta p) {
        Estado e = estado(u);
        if (!e.puedeUsar()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.motivo());
        }
        String pregunta = p.pregunta() == null ? "" : p.pregunta().trim();
        if (pregunta.isEmpty() || pregunta.length() > MAX_PREGUNTA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe una pregunta de hasta " + MAX_PREGUNTA + " letras.");
        }
        if (mensajeRepository.countByUserIdAndCreadoEnAfter(u.id(), LocalDateTime.now().minusHours(1)) >= PREGUNTAS_POR_HORA) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Llegaste al límite de " + PREGUNTAS_POR_HORA + " preguntas por hora. Intenta en un rato.");
        }
        Branch sucursal = sucursalDe(u, p.branchId());
        AsistenteConfig c = configRepository.findById(u.restaurantId()).orElseThrow();
        ProveedorLlm proveedor = fabrica.crear(c);
        HerramientasAsistente.Contexto ctx = new HerramientasAsistente.Contexto(u, u.restaurantId(), sucursal.getId());

        ProveedorLlm.Conversacion conv = proveedor.iniciar(instrucciones, contexto(u, sucursal), historial(p.historial()),
                pregunta, herramientas.para(u), MAX_TOKENS);

        Set<String> consulto = new LinkedHashSet<>();
        long entrada = 0;
        long salida = 0;
        String texto = null;
        boolean cerrada = false;
        for (int paso = 0; paso < MAX_PASOS; paso++) {
            ProveedorLlm.Paso r = conv.siguiente();
            entrada += r.tokensEntrada();
            salida += r.tokensSalida();
            if (!r.pideHerramientas()) {
                texto = r.texto();
                break;
            }
            List<ProveedorLlm.Resultado> resultados = new ArrayList<>();
            if (paso < MAX_PASOS - 1) {
                for (ProveedorLlm.Llamada l : r.llamadas()) {
                    consulto.add(l.nombre());
                    resultados.add(herramientas.ejecutar(l, ctx));
                }
            } else {
                // Se acabaron las rondas: que conteste con lo que ya consulto.
                for (ProveedorLlm.Llamada l : r.llamadas()) {
                    resultados.add(new ProveedorLlm.Resultado(l, CIERRE, true));
                }
                cerrada = true;
            }
            conv.responder(resultados);
        }
        if (cerrada) {
            ProveedorLlm.Paso r = conv.siguiente();
            entrada += r.tokensEntrada();
            salida += r.tokensSalida();
            if (!r.pideHerramientas()) texto = r.texto();
        }
        if (texto == null || texto.isBlank()) {
            texto = "No alcancé a terminar la respuesta. Intenta con una pregunta más concreta (por ejemplo, de un solo periodo).";
        }

        mensajeRepository.save(AsistenteMensaje.builder()
                .restaurantId(u.restaurantId())
                .branchId(sucursal.getId())
                .userId(u.id())
                .pregunta(pregunta)
                .respuesta(texto)
                .proveedor(c.getProveedor().name())
                .modelo(c.getModelo())
                .herramientas(String.join(",", consulto))
                .tokensEntrada(entrada)
                .tokensSalida(salida)
                .build());
        return new Respuesta(texto.trim(), List.copyOf(consulto));
    }

    /** Lo de este restaurante y este momento: va después de las instrucciones fijas. */
    private String contexto(CustomUserDetails u, Branch sucursal) {
        return "Contexto de esta plática:\n"
                + "- Restaurante: " + (sucursal.getRestaurant() != null ? sucursal.getRestaurant().getName() : "") + "\n"
                + "- Sucursal: " + sucursal.getName() + "\n"
                + "- Hoy es " + LocalDate.now().format(FECHA) + " (" + LocalDate.now() + ").\n"
                + "- Quien pregunta: " + u.username() + ", con el rol " + u.roleName() + ".";
    }

    private static List<ProveedorLlm.Turno> historial(List<TurnoDTO> turnos) {
        if (turnos == null) return List.of();
        List<TurnoDTO> ultimos = turnos.size() > MAX_TURNOS ? turnos.subList(turnos.size() - MAX_TURNOS, turnos.size()) : turnos;
        List<ProveedorLlm.Turno> salida = new ArrayList<>();
        for (TurnoDTO t : ultimos) {
            if (t == null || t.texto() == null || t.texto().isBlank()) continue;
            String texto = t.texto().length() > MAX_TURNO ? t.texto().substring(0, MAX_TURNO) : t.texto();
            salida.add(new ProveedorLlm.Turno(t.delUsuario(), texto));
        }
        // La plática tiene que empezar con el usuario y alternar.
        while (!salida.isEmpty() && !salida.get(0).delUsuario()) salida.remove(0);
        List<ProveedorLlm.Turno> alternado = new ArrayList<>();
        for (ProveedorLlm.Turno t : salida) {
            if (!alternado.isEmpty() && alternado.get(alternado.size() - 1).delUsuario() == t.delUsuario()) continue;
            alternado.add(t);
        }
        // Lo último antes de la pregunta nueva tiene que ser del asistente.
        if (!alternado.isEmpty() && alternado.get(alternado.size() - 1).delUsuario()) alternado.remove(alternado.size() - 1);
        return alternado;
    }

    /** La sucursal sobre la que se pregunta: la elegida (si tiene acceso), la suya o la primera del restaurante. */
    private Branch sucursalDe(CustomUserDetails u, UUID pedida) {
        UUID id = pedida != null ? pedida : u.branchId();
        if (id != null) {
            securityValidationService.validateUserAccessToBranch(id);
            return branchRepository.findById(id)
                    .filter(b -> b.getRestaurant() != null && u.restaurantId().equals(b.getRestaurant().getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sucursal no encontrada."));
        }
        return branchRepository.findByRestaurantIdAndActiveTrue(u.restaurantId()).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tu restaurante no tiene sucursales activas."));
    }

    // ------------------------------------------------------------------
    // Configuración (dueño)
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ConfigDTO config(CustomUserDetails u) {
        exigirDueno(u);
        AsistenteConfig c = configRepository.findById(u.restaurantId()).orElse(AsistenteConfig.builder().build());
        LocalDateTime inicioMes = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        Object[] tokens = mensajeRepository.tokensDesde(u.restaurantId(), inicioMes).get(0);
        return new ConfigDTO(Boolean.TRUE.equals(c.getComplementoActivo()),
                c.getProveedor() != null ? c.getProveedor().name() : null, c.getModelo(), c.getUrlBase(),
                c.getLlaveFinal(), Boolean.TRUE.equals(c.getResumenDiario()), cifrado.disponible(),
                mensajeRepository.countByRestaurantIdAndCreadoEnAfter(u.restaurantId(), inicioMes),
                ((Number) tokens[0]).longValue(), ((Number) tokens[1]).longValue());
    }

    /** Guarda el proveedor y el modelo. La llave solo se reemplaza si viene una nueva. */
    @Transactional
    public ConfigDTO guardar(CustomUserDetails u, GuardarConfig g) {
        exigirDueno(u);
        AsistenteConfig c = configRepository.findById(u.restaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "El asistente es un complemento: pídelo a Pide Fácil para activarlo."));
        if (!Boolean.TRUE.equals(c.getComplementoActivo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El asistente es un complemento: pídelo a Pide Fácil para activarlo.");
        }
        AsistenteConfig.Proveedor proveedor;
        try {
            proveedor = AsistenteConfig.Proveedor.valueOf(g.proveedor() == null ? "" : g.proveedor().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elige un proveedor de la lista.");
        }
        String modelo = g.modelo() == null ? "" : g.modelo().trim();
        if (modelo.isEmpty() || modelo.length() > 100 || !modelo.matches("[A-Za-z0-9._:/@-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe el nombre del modelo tal como lo da tu proveedor.");
        }
        c.setProveedor(proveedor);
        c.setModelo(modelo);
        c.setUrlBase(proveedor == AsistenteConfig.Proveedor.COMPATIBLE ? UrlSegura.exigir(g.urlBase()) : null);
        if (g.llave() != null && !g.llave().isBlank()) {
            String llave = g.llave().trim();
            if (llave.length() < 12 || llave.length() > 500) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La llave no parece completa.");
            }
            c.setLlaveCifrada(cifrado.cifrar(llave));
            c.setLlaveFinal(llave.substring(llave.length() - 4));
        }
        if (c.getLlaveCifrada() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pega la llave (API key) de tu proveedor.");
        }
        if (g.resumenDiario() != null) c.setResumenDiario(g.resumenDiario());
        c.setActualizadoEn(LocalDateTime.now());
        c.setActualizadoPor(u.username());
        configRepository.save(c);
        log.info("Asistente: {} configuró {} / {} en el restaurante {}", u.username(), proveedor, modelo, u.restaurantId());
        return config(u);
    }

    /** Una pregunta mínima al proveedor para confirmar que la llave y el modelo sirven. */
    @Transactional(readOnly = true)
    public String probar(CustomUserDetails u) {
        exigirDueno(u);
        AsistenteConfig c = configRepository.findById(u.restaurantId())
                .filter(AsistenteConfig::configurado)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Primero guarda el proveedor, el modelo y la llave."));
        ProveedorLlm.Paso r = fabrica.crear(c).iniciar("Responde en una sola línea.", "Prueba de conexión.", List.of(),
                "Contesta exactamente: Conexión lista.", List.of(), 50).siguiente();
        return r.texto() == null || r.texto().isBlank() ? "El proveedor respondió, pero sin texto." : r.texto().trim();
    }

    @Transactional(readOnly = true)
    public List<Persona> personal(CustomUserDetails u) {
        exigirDueno(u);
        return userRepository.findByRestaurantId(u.restaurantId()).stream()
                .filter(x -> Boolean.TRUE.equals(x.getActive()))
                .map(x -> {
                    String rol = x.getRole() != null ? x.getRole().getName() : "";
                    boolean siempre = "SUPER_ADMIN".equalsIgnoreCase(rol) || "BRANCH_MANAGER".equalsIgnoreCase(rol);
                    return new Persona(x.getId(), x.getName(), x.getUsername(), rol,
                            siempre || Boolean.TRUE.equals(x.getUsaAsistente()), siempre);
                })
                .toList();
    }

    @Transactional
    public void habilitar(CustomUserDetails u, UUID userId, boolean habilitado) {
        exigirDueno(u);
        User x = userRepository.findByIdAndRestaurantId(userId, u.restaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empleado no encontrado."));
        x.setUsaAsistente(habilitado);
        userRepository.save(x);
    }

    // ------------------------------------------------------------------
    // Resumen diario
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ResumenDTO> resumenes(CustomUserDetails u, UUID branchId) {
        if (!estado(u).puedeUsar()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, estado(u).motivo());
        }
        Branch b = sucursalDe(u, branchId);
        return resumenRepository.findTop14ByBranchIdOrderByDiaDesc(b.getId()).stream()
                .map(r -> new ResumenDTO(r.getDia(), r.getContenido(), r.getCreadoEn()))
                .toList();
    }

    /** El dueño lo pide a mano (por ejemplo, para probar) para la sucursal elegida. */
    @Transactional
    public ResumenDTO generarResumenAhora(CustomUserDetails u, UUID branchId) {
        exigirDueno(u);
        Branch b = sucursalDe(u, branchId);
        AsistenteConfig c = configRepository.findById(u.restaurantId()).filter(AsistenteConfig::configurado)
                .filter(x -> Boolean.TRUE.equals(x.getComplementoActivo()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Configura el asistente primero."));
        AsistenteResumen r = generarResumen(c, b, LocalDate.now().minusDays(1), u);
        return new ResumenDTO(r.getDia(), r.getContenido(), r.getCreadoEn());
    }

    /**
     * Escribe el resumen de un día de una sucursal y avisa al dueño. Los datos
     * se juntan aquí (sin que el modelo pida herramientas) y se le pasan de
     * una vez: es una sola llamada por sucursal.
     */
    @Transactional
    public AsistenteResumen generarResumen(AsistenteConfig c, Branch b, LocalDate dia, CustomUserDetails comoDueno) {
        HerramientasAsistente.Contexto ctx = new HerramientasAsistente.Contexto(comoDueno, c.getRestaurantId(), b.getId());
        String rango = "{\"desde\":\"" + dia + "\",\"hasta\":\"" + dia + "\"}";
        StringBuilder datos = new StringBuilder();
        for (String[] h : List.of(new String[]{"resumen_ventas", rango}, new String[]{"platillos_vendidos", rango},
                new String[]{"inventario", "{\"solo_bajo_minimo\":true}"}, new String[]{"cierres_de_caja", "{}"})) {
            ProveedorLlm.Resultado r = herramientas.ejecutar(new ProveedorLlm.Llamada(h[0], h[0], h[1]), ctx);
            datos.append("## ").append(h[0]).append('\n').append(r.contenido()).append("\n\n");
        }
        String pedido = "Escribe el resumen operativo del " + dia.format(FECHA) + " de la sucursal " + b.getName()
                + " para el dueño. Máximo 8 renglones: ventas y cómo van contra el periodo anterior, lo más y lo menos "
                + "rentable, lo que hay que comprar, si la caja cerró con diferencia, y una sola sugerencia concreta "
                + "para hoy. Si no hubo ventas, dilo en una línea. Usa solo estos datos:\n\n" + datos;
        String texto = fabrica.crear(c).iniciar(instrucciones, contexto(comoDueno, b), List.of(), pedido, List.of(), 1200)
                .siguiente().texto();
        if (texto == null || texto.isBlank()) {
            throw new IllegalStateException("El proveedor no regresó el resumen.");
        }
        AsistenteResumen guardado = resumenRepository.save(AsistenteResumen.builder()
                .restaurantId(c.getRestaurantId()).branchId(b.getId()).dia(dia).contenido(texto.trim()).build());
        avisos.avisar(c.getRestaurantId(), "ASISTENTE", "Resumen de ayer · " + b.getName(), texto.trim());
        return guardado;
    }

    /**
     * Para el resumen automático, que corre sin nadie conectado: ve lo mismo que
     * el dueño, solo de ese restaurante.
     */
    public static CustomUserDetails duenoDe(UUID restaurantId) {
        return new CustomUserDetails(null, "resumen-diario", "", "SUPER_ADMIN", "/", restaurantId, null,
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("SUPER_ADMIN")));
    }

    // ------------------------------------------------------------------
    // Complemento (operador)
    // ------------------------------------------------------------------

    @Transactional
    public boolean activarComplemento(UUID restaurantId, boolean activo) {
        AsistenteConfig c = configRepository.findById(restaurantId)
                .orElseGet(() -> AsistenteConfig.builder().restaurantId(restaurantId).build());
        c.setComplementoActivo(activo);
        c.setActualizadoEn(LocalDateTime.now());
        configRepository.save(c);
        avisos.avisar(restaurantId, "ASISTENTE", activo ? "Tu asistente operativo está activo"
                        : "Tu asistente operativo se desactivó",
                activo ? "Entra a Asistente › Configuración, elige tu proveedor de IA y pon tu llave para empezar."
                        : "Si es un error, comunícate con Pide Fácil.");
        return activo;
    }

    @Transactional(readOnly = true)
    public Set<UUID> conComplemento() {
        Set<UUID> ids = new java.util.HashSet<>();
        configRepository.findAll().forEach(c -> {
            if (Boolean.TRUE.equals(c.getComplementoActivo())) ids.add(c.getRestaurantId());
        });
        return ids;
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private static boolean esDueno(CustomUserDetails u) {
        return u != null && "SUPER_ADMIN".equalsIgnoreCase(u.roleName());
    }

    private static boolean esOperador(CustomUserDetails u) {
        return u != null && "SYSTEM_ADMIN".equalsIgnoreCase(u.roleName());
    }

    private static void exigirDueno(CustomUserDetails u) {
        if (!esDueno(u) || u.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el dueño configura el asistente.");
        }
    }

    private static String leer(String ruta) {
        try {
            return new String(new ClassPathResource(ruta).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Falta " + ruta, e);
        }
    }
}
