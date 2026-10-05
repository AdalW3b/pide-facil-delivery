package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.AccionSoporte;
import com.omnirest.omnirest_backend.domain.entities.CodigoSoporte;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.SesionSoporte;
import com.omnirest.omnirest_backend.repositories.AccionSoporteRepository;
import com.omnirest.omnirest_backend.repositories.CodigoSoporteRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.SesionSoporteRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * El modo soporte: el operador de la plataforma entra a ver un restaurante.
 *
 * Reglas: sin una sesión abierta (con motivo) no ve nada del restaurante; en
 * la sesión solo lee, y para hacer cambios necesita un código que genera el
 * dueño, que sirve una vez y abre una ventana corta. Todo queda en la
 * bitácora y el dueño recibe un aviso en su panel.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SoporteService {

    /** Una sesión se cierra sola pasado este tiempo. */
    static final Duration DURACION_SESION = Duration.ofHours(4);
    /** Lo que dura la ventana de cambios que abre un código. */
    static final Duration DURACION_CAMBIOS = Duration.ofMinutes(30);
    /** Lo que vale un código sin usarse. */
    static final Duration VIGENCIA_CODIGO = Duration.ofMinutes(15);
    /** Intentos de código fallidos antes de bloquear la sesión. */
    static final int INTENTOS_MAXIMOS = 5;

    private static final SecureRandom AZAR = new SecureRandom();
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    private final SesionSoporteRepository sesionRepository;
    private final AccionSoporteRepository accionRepository;
    private final CodigoSoporteRepository codigoRepository;
    private final RestaurantRepository restaurantRepository;
    private final AvisosSistemaService avisos;

    /** Códigos fallidos por sesión: seis cifras no aguantan prueba y error ilimitado. */
    private final Map<UUID, Integer> intentosFallidos = new ConcurrentHashMap<>();

    public record SesionDTO(UUID id, UUID restaurantId, String restaurante, String operador, String motivo,
                            LocalDateTime inicio, LocalDateTime fin, LocalDateTime cambiosHasta, boolean abierta) {
    }

    public record AccionDTO(String metodo, String ruta, Integer estadoHttp, LocalDateTime en) {
    }

    public record Bitacora(SesionDTO sesion, List<AccionDTO> acciones) {
    }

    public record CodigoGenerado(String codigo, LocalDateTime expiraEn) {
    }

    // ------------------------------------------------------------------
    // Operador
    // ------------------------------------------------------------------

    /** Abre una sesión en un restaurante y cierra cualquier otra que tuviera abierta. */
    @Transactional
    public SesionDTO abrir(CustomUserDetails operador, UUID restaurantId, String motivo) {
        String limpio = motivo == null ? "" : motivo.trim();
        if (limpio.length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe el motivo de la revisión.");
        }
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurante no encontrado."));

        LocalDateTime ahora = LocalDateTime.now();
        for (SesionSoporte otra : sesionRepository.findByOperadorIdAndFinIsNull(operador.id())) {
            otra.setFin(ahora);
            sesionRepository.save(otra);
        }
        SesionSoporte sesion = sesionRepository.save(SesionSoporte.builder()
                .restaurantId(restaurantId)
                .operadorId(operador.id())
                .operadorNombre(operador.username())
                .motivo(limpio.length() > 300 ? limpio.substring(0, 300) : limpio)
                .inicio(ahora)
                .build());

        avisos.avisar(restaurantId, "SOPORTE", "Soporte de Pide Fácil entró a revisar tu cuenta",
                "Motivo: " + sesion.getMotivo() + ". Solo puede ver; para hacer cambios necesita un código tuyo.");
        log.info("Soporte: {} abrió sesión en {} ({})", operador.username(), restaurant.getName(), sesion.getMotivo());
        return aDto(sesion, restaurant.getName());
    }

    /** La sesión abierta del operador, si tiene. Una a la vez. */
    @Transactional(readOnly = true)
    public Optional<SesionDTO> activa(CustomUserDetails operador) {
        return abierta(operador.id()).map(s -> aDto(s, nombre(s.getRestaurantId())));
    }

    @Transactional
    public void terminar(CustomUserDetails operador) {
        LocalDateTime ahora = LocalDateTime.now();
        for (SesionSoporte s : sesionRepository.findByOperadorIdAndFinIsNull(operador.id())) {
            s.setFin(ahora);
            s.setCambiosHasta(null);
            sesionRepository.save(s);
            intentosFallidos.remove(s.getId());
        }
    }

    /**
     * El operador da el código que le dictó el dueño: abre la ventana de
     * cambios. El código sirve una sola vez.
     */
    @Transactional
    public SesionDTO autorizarCambios(CustomUserDetails operador, String codigo) {
        SesionSoporte sesion = abierta(operador.id()).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.CONFLICT, "Abre una sesión de soporte primero."));
        int fallidos = intentosFallidos.getOrDefault(sesion.getId(), 0);
        if (fallidos >= INTENTOS_MAXIMOS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Demasiados códigos equivocados. Cierra la sesión y abre otra.");
        }

        LocalDateTime ahora = LocalDateTime.now();
        String huella = huella(sesion.getRestaurantId(), codigo == null ? "" : codigo.trim());
        CodigoSoporte valido = codigoRepository
                .findByRestaurantIdAndUsadoEnIsNullAndExpiraEnAfter(sesion.getRestaurantId(), ahora).stream()
                .filter(c -> MessageDigest.isEqual(c.getCodigoHash().getBytes(StandardCharsets.US_ASCII),
                        huella.getBytes(StandardCharsets.US_ASCII)))
                .findFirst()
                .orElse(null);
        if (valido == null) {
            intentosFallidos.merge(sesion.getId(), 1, Integer::sum);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El código no es válido o ya caducó. Pide al dueño uno nuevo.");
        }

        valido.setUsadoEn(ahora);
        valido.setSesionId(sesion.getId());
        codigoRepository.save(valido);
        intentosFallidos.remove(sesion.getId());
        sesion.setCambiosHasta(ahora.plus(DURACION_CAMBIOS));
        sesionRepository.save(sesion);

        avisos.avisar(sesion.getRestaurantId(), "SOPORTE", "Soporte usó tu código para hacer cambios",
                "Puede hacer cambios hasta las " + sesion.getCambiosHasta().format(HORA)
                        + ". Motivo de la revisión: " + sesion.getMotivo() + ".");
        log.info("Soporte: {} habilitó cambios en {} hasta {}", operador.username(), sesion.getRestaurantId(),
                sesion.getCambiosHasta());
        return aDto(sesion, nombre(sesion.getRestaurantId()));
    }

    /**
     * Lo que pide el candado en cada petición del operador a datos de un
     * restaurante. Devuelve la sesión para registrar el cambio.
     */
    @Transactional(readOnly = true)
    public SesionSoporte exigir(UUID operadorId, UUID restaurantId, boolean esCambio) {
        SesionSoporte sesion = abierta(operadorId).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.FORBIDDEN, "Abre una sesión de soporte para ver los datos de este restaurante."));
        if (restaurantId != null && !restaurantId.equals(sesion.getRestaurantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Tu sesión de soporte es de otro restaurante. Ciérrala y abre una en este.");
        }
        if (esCambio && !sesion.puedeCambiar(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Modo soporte de solo lectura. Pide al dueño un código para hacer cambios.");
        }
        return sesion;
    }

    @Transactional
    public void registrarCambio(UUID sesionId, String metodo, String ruta, int estadoHttp) {
        accionRepository.save(AccionSoporte.builder()
                .sesionId(sesionId)
                .metodo(metodo)
                .ruta(ruta.length() > 300 ? ruta.substring(0, 300) : ruta)
                .estadoHttp(estadoHttp)
                .build());
    }

    /** Las sesiones recientes: de un restaurante o de toda la plataforma. */
    @Transactional(readOnly = true)
    public List<Bitacora> bitacora(UUID restaurantId) {
        List<SesionSoporte> sesiones = restaurantId != null
                ? sesionRepository.findTop50ByRestaurantIdOrderByInicioDesc(restaurantId)
                : sesionRepository.findTop100ByOrderByInicioDesc();
        Map<UUID, List<AccionDTO>> acciones = new java.util.HashMap<>();
        accionRepository.findBySesionIdInOrderByEnAsc(sesiones.stream().map(SesionSoporte::getId).toList())
                .forEach(a -> acciones.computeIfAbsent(a.getSesionId(), k -> new java.util.ArrayList<>())
                        .add(new AccionDTO(a.getMetodo(), a.getRuta(), a.getEstadoHttp(), a.getEn())));
        Map<UUID, String> nombres = new java.util.HashMap<>();
        return sesiones.stream()
                .map(s -> new Bitacora(aDto(s, nombres.computeIfAbsent(s.getRestaurantId(), this::nombre)),
                        acciones.getOrDefault(s.getId(), List.of())))
                .toList();
    }

    // ------------------------------------------------------------------
    // Dueño
    // ------------------------------------------------------------------

    /** El dueño genera un código para dictárselo a soporte. Solo se guarda su huella. */
    @Transactional
    public CodigoGenerado generarCodigo(CustomUserDetails dueno) {
        if (dueno.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tu usuario no tiene restaurante.");
        }
        String codigo = String.format("%06d", AZAR.nextInt(1_000_000));
        LocalDateTime expira = LocalDateTime.now().plus(VIGENCIA_CODIGO);
        codigoRepository.save(CodigoSoporte.builder()
                .restaurantId(dueno.restaurantId())
                .codigoHash(huella(dueno.restaurantId(), codigo))
                .creadoPor(dueno.username())
                .expiraEn(expira)
                .build());
        log.info("Soporte: {} generó un código de autorización para su restaurante", dueno.username());
        return new CodigoGenerado(codigo, expira);
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private Optional<SesionSoporte> abierta(UUID operadorId) {
        LocalDateTime desde = LocalDateTime.now().minus(DURACION_SESION);
        return sesionRepository.findByOperadorIdAndFinIsNull(operadorId).stream()
                .filter(s -> s.getInicio().isAfter(desde))
                .max(java.util.Comparator.comparing(SesionSoporte::getInicio));
    }

    private String nombre(UUID restaurantId) {
        return restaurantRepository.findById(restaurantId).map(Restaurant::getName).orElse("");
    }

    private static SesionDTO aDto(SesionSoporte s, String restaurante) {
        LocalDateTime ahora = LocalDateTime.now();
        boolean abierta = s.getFin() == null && s.getInicio().isAfter(ahora.minus(DURACION_SESION));
        return new SesionDTO(s.getId(), s.getRestaurantId(), restaurante, s.getOperadorNombre(), s.getMotivo(),
                s.getInicio(), s.getFin(), s.puedeCambiar(ahora) ? s.getCambiosHasta() : null, abierta);
    }

    /** La huella del código, atada al restaurante: el mismo número en otro restaurante no sirve. */
    static String huella(UUID restaurantId, String codigo) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256")
                    .digest((restaurantId + ":" + codigo).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
