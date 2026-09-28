package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.CodigoVerificacion;
import com.omnirest.omnirest_backend.domain.entities.Customer;
import com.omnirest.omnirest_backend.domain.entities.Driver;
import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import com.omnirest.omnirest_backend.dtos.CuentaResponseDTO;
import com.omnirest.omnirest_backend.dtos.IniciarSesionCuentaDTO;
import com.omnirest.omnirest_backend.dtos.RegistrarCuentaDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CodigoVerificacionRepository;
import com.omnirest.omnirest_backend.repositories.CustomerRepository;
import com.omnirest.omnirest_backend.repositories.DriverRepository;
import com.omnirest.omnirest_backend.security.FrenoDeIntentos;
import com.omnirest.omnirest_backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Cuentas de clientes y repartidores.
 *
 * Las credenciales se cuelgan de la ficha que la persona ya tenia, no de una
 * nueva: quien lleva meses pidiendo por WhatsApp abre su cuenta y encuentra ahi
 * su historial, sus direcciones y sus entregas.
 *
 * Por eso mismo hay que comprobar el telefono antes de dejar poner contrasena.
 * Si no, cualquiera podria registrarse con el numero de otro y quedarse con su
 * historial y con el pin de su casa. El codigo llega por WhatsApp al numero que
 * se esta reclamando: es la unica prueba de que es suyo.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CuentaPublicaService {

    /** Cuanto vive un codigo. Suficiente para leerlo, poco para reutilizarlo. */
    private static final int MINUTOS_DE_VIDA = 10;
    private static final int LARGO_CODIGO = 6;
    private static final int MINIMO_CONTRASENA = 8;
    private static final SecureRandom AZAR = new SecureRandom();

    /*
     * Limites para pedir codigos. Cada codigo es un mensaje que sale del
     * WhatsApp del restaurante: sin freno, alguien podria pedir cientos, gastar
     * mensajes y hacer que WhatsApp marque el numero como spam y lo bloquee.
     */
    /** Espera minima entre un codigo y el siguiente para el mismo numero. */
    private static final int SEGUNDOS_ENTRE_CODIGOS = 60;
    /** Codigos por numero en una hora: sobra para quien se equivoca, no para quien abusa. */
    private static final int CODIGOS_POR_NUMERO_POR_HORA = 5;
    /**
     * Codigos por restaurante en una hora, sumando todos los numeros. Frena a
     * quien va probando numeros distintos para mandar mensajes a desconocidos.
     */
    private static final int CODIGOS_POR_RESTAURANTE_POR_HORA = 60;
    private static final int UNA_HORA = 3600;

    private final BranchRepository branchRepository;
    private final CustomerRepository customerRepository;
    private final DriverRepository driverRepository;
    private final CodigoVerificacionRepository codigoRepository;
    private final WhatsappIntegrationService whatsappIntegrationService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final FrenoDeIntentos frenoDeIntentos;
    private final ColaWhatsapp colaWhatsapp;

    // ------------------------------------------------------------------
    // Alta
    // ------------------------------------------------------------------

    /**
     * Manda por WhatsApp el codigo con el que se comprueba el telefono.
     *
     * La respuesta es siempre la misma, exista o no la ficha: decir "ese numero
     * no esta registrado" le confirmaria a un extrano quien es cliente del
     * negocio.
     */
    @Transactional
    public void solicitarCodigo(UUID branchId, TipoCuenta tipo, String telefonoCrudo) {
        Branch branch = buscarSucursal(branchId);
        String telefono = TelefonoMx.canonico(telefonoCrudo);

        if (telefono.isEmpty()) {
            throw new IllegalArgumentException("Escribe un número de WhatsApp válido.");
        }

        UUID restaurantId = branch.getRestaurant().getId();
        frenarAbuso(restaurantId, telefono);

        String codigo = nuevoCodigo();
        LocalDateTime ahora = LocalDateTime.now();

        // Un codigo viejo que siga vivo es un codigo que alguien podria usar.
        codigoRepository.invalidarAnteriores(restaurantId, tipo, telefono, ahora);
        codigoRepository.save(CodigoVerificacion.builder()
                .restaurantId(restaurantId)
                .tipo(tipo)
                .phoneNumber(telefono)
                .codigoHash(passwordEncoder.encode(codigo))
                .expiraEn(ahora.plusMinutes(MINUTOS_DE_VIDA))
                .build());

        enviarCodigo(branch, telefono, codigo);
    }

    /**
     * Crea la cuenta sobre la ficha existente, o abre una nueva si la persona
     * todavia no habia pedido nada.
     */
    @Transactional
    public CuentaResponseDTO registrar(UUID branchId, RegistrarCuentaDTO peticion) {
        Branch branch = buscarSucursal(branchId);
        UUID restaurantId = branch.getRestaurant().getId();
        String telefono = TelefonoMx.canonico(peticion.phoneNumber());

        validarContrasena(peticion.password());
        consumirCodigo(restaurantId, peticion.tipo(), telefono, peticion.codigo());

        String hash = passwordEncoder.encode(peticion.password());
        LocalDateTime ahora = LocalDateTime.now();

        if (peticion.tipo() == TipoCuenta.CLIENTE) {
            Customer cliente = customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                    .orElseGet(() -> Customer.builder()
                            .restaurant(branch.getRestaurant())
                            .phoneNumber(telefono)
                            .name("Cliente")
                            .totalVisits(0)
                            .build());

            if (cliente.tieneCuenta()) {
                throw new IllegalStateException("Ya tienes una cuenta con este número. Inicia sesión.");
            }
            if (peticion.nombre() != null && !peticion.nombre().isBlank()) {
                cliente.setName(peticion.nombre().trim());
            }
            cliente.setEmail(limpiar(peticion.email()));
            cliente.setPasswordHash(hash);
            cliente.setCuentaCreadaEn(ahora);
            cliente.setUltimoAcceso(ahora);
            customerRepository.save(cliente);

            log.info("Cuenta de cliente creada para {} en el restaurante {}", telefono, restaurantId);
            return comoRespuesta(cliente, restaurantId);
        }

        Driver repartidor = driverRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                .orElseGet(() -> Driver.builder()
                        .restaurant(branch.getRestaurant())
                        .phoneNumber(telefono)
                        .nombre("Repartidor")
                        .build());

        if (repartidor.tieneCuenta()) {
            throw new IllegalStateException("Ya tienes una cuenta con este número. Inicia sesión.");
        }
        if (peticion.nombre() != null && !peticion.nombre().isBlank()) {
            repartidor.setNombre(peticion.nombre().trim());
        }
        repartidor.setEmail(limpiar(peticion.email()));
        repartidor.setPasswordHash(hash);
        repartidor.setCuentaCreadaEn(ahora);
        repartidor.setUltimoAcceso(ahora);
        driverRepository.save(repartidor);

        log.info("Cuenta de repartidor creada para {} en el restaurante {}", telefono, restaurantId);
        return comoRespuesta(repartidor, restaurantId);
    }

    // ------------------------------------------------------------------
    // Entrada
    // ------------------------------------------------------------------

    /**
     * Los intentos se cuentan por restaurante y no por sucursal: la cuenta es
     * del restaurante, y contar por sucursal le daria a quien ataca tantos
     * intentos como sucursales haya.
     */
    @Transactional
    public CuentaResponseDTO iniciarSesion(UUID branchId, IniciarSesionCuentaDTO peticion, String ipCliente) {
        Branch branch = buscarSucursal(branchId);
        UUID restaurantId = branch.getRestaurant().getId();
        String telefono = TelefonoMx.canonico(peticion.phoneNumber());
        LocalDateTime ahora = LocalDateTime.now();

        String cuenta = FrenoDeIntentos.claveCuenta(restaurantId, peticion.tipo(), telefono);
        String ip = FrenoDeIntentos.claveIp(ipCliente);
        frenoDeIntentos.comprobar(cuenta, ip);

        if (peticion.tipo() == TipoCuenta.CLIENTE) {
            Customer cliente = customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                    .filter(Customer::tieneCuenta)
                    .filter(c -> passwordEncoder.matches(peticion.password(), c.getPasswordHash()))
                    .orElse(null);
            if (cliente == null) {
                frenoDeIntentos.fallo(cuenta, ip);
                throw credencialesInvalidas();
            }
            frenoDeIntentos.exito(cuenta);

            cliente.setUltimoAcceso(ahora);
            customerRepository.save(cliente);
            return comoRespuesta(cliente, restaurantId);
        }

        Driver repartidor = driverRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                .filter(Driver::tieneCuenta)
                .filter(d -> passwordEncoder.matches(peticion.password(), d.getPasswordHash()))
                .orElse(null);
        if (repartidor == null) {
            frenoDeIntentos.fallo(cuenta, ip);
            throw credencialesInvalidas();
        }
        frenoDeIntentos.exito(cuenta);

        if (Boolean.FALSE.equals(repartidor.getActivo())) {
            throw new IllegalStateException("Tu acceso como repartidor está desactivado. Habla con el restaurante.");
        }

        repartidor.setUltimoAcceso(ahora);
        driverRepository.save(repartidor);
        return comoRespuesta(repartidor, restaurantId);
    }

    /**
     * Cambia la contrasena de quien olvido la suya. Pide codigo otra vez: es el
     * mismo problema que en el alta, comprobar que el telefono es suyo.
     */
    @Transactional
    public void restablecerContrasena(UUID branchId, RegistrarCuentaDTO peticion) {
        Branch branch = buscarSucursal(branchId);
        UUID restaurantId = branch.getRestaurant().getId();
        String telefono = TelefonoMx.canonico(peticion.phoneNumber());

        validarContrasena(peticion.password());
        consumirCodigo(restaurantId, peticion.tipo(), telefono, peticion.codigo());

        String hash = passwordEncoder.encode(peticion.password());

        if (peticion.tipo() == TipoCuenta.CLIENTE) {
            Customer cliente = customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                    .orElseThrow(() -> new IllegalArgumentException("No encontramos una cuenta con ese número."));
            cliente.setPasswordHash(hash);
            customerRepository.save(cliente);
        } else {
            Driver repartidor = driverRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                    .orElseThrow(() -> new IllegalArgumentException("No encontramos una cuenta con ese número."));
            repartidor.setPasswordHash(hash);
            driverRepository.save(repartidor);
        }

        log.info("Contraseña restablecida para {} ({}) en el restaurante {}", telefono, peticion.tipo(), restaurantId);
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    /**
     * Comprueba el codigo y lo quema. Cada fallo cuenta: tras varios intentos
     * hay que pedir uno nuevo, para que no se pueda probar codigo por codigo.
     */
    private void consumirCodigo(UUID restaurantId, TipoCuenta tipo, String telefono, String codigo) {
        CodigoVerificacion guardado = codigoRepository
                .findFirstByRestaurantIdAndTipoAndPhoneNumberOrderByCreadoEnDesc(restaurantId, tipo, telefono)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Pide un código nuevo: no encontramos uno vigente para ese número."));

        if (!guardado.vigente()) {
            throw new IllegalArgumentException("Ese código ya venció. Pide uno nuevo.");
        }

        if (codigo == null || !passwordEncoder.matches(codigo.trim(), guardado.getCodigoHash())) {
            guardado.setIntentos(guardado.getIntentos() + 1);
            codigoRepository.save(guardado);
            throw new IllegalArgumentException("El código no coincide.");
        }

        guardado.setUsadoEn(LocalDateTime.now());
        codigoRepository.save(guardado);
    }

    /**
     * Rechaza el pedido si ese numero o el restaurante ya pidieron demasiados
     * codigos. Responde 429 para que la pantalla sepa que es cuestion de
     * esperar, no un dato mal escrito.
     */
    private void frenarAbuso(UUID restaurantId, String telefono) {
        if (codigoRepository.contarRecientesDelTelefono(restaurantId, telefono, SEGUNDOS_ENTRE_CODIGOS) > 0) {
            throw demasiados("Ya te mandamos un código. Espera un minuto antes de pedir otro.");
        }
        if (codigoRepository.contarRecientesDelTelefono(restaurantId, telefono, UNA_HORA)
                >= CODIGOS_POR_NUMERO_POR_HORA) {
            throw demasiados("Pediste demasiados códigos para este número. Intenta de nuevo en una hora.");
        }
        if (codigoRepository.contarRecientesDelRestaurante(restaurantId, UNA_HORA)
                >= CODIGOS_POR_RESTAURANTE_POR_HORA) {
            log.warn("Restaurante {} alcanzó el límite de {} códigos por hora", restaurantId,
                    CODIGOS_POR_RESTAURANTE_POR_HORA);
            throw demasiados("Estamos recibiendo muchas solicitudes. Intenta de nuevo en unos minutos.");
        }
    }

    private static ResponseStatusException demasiados(String mensaje) {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, mensaje);
    }

    private void enviarCodigo(Branch branch, String telefono, String codigo) {
        String mensaje = String.join("\n",
                "🔐 Tu código es *" + codigo + "*",
                "",
                "Sirve para abrir tu cuenta en " + branch.getName() + " y vence en "
                        + MINUTOS_DE_VIDA + " minutos.",
                "Si no lo pediste, ignora este mensaje y no lo compartas con nadie.");

        // Un codigo nuevo reemplaza al que no alcanzo a salir: el viejo ya
        // quedo invalidado y solo confundiria.
        colaWhatsapp.encolar(branch.getId(), telefono, mensaje, com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.CODIGO,
                "codigo:" + branch.getRestaurant().getId() + ":" + telefono);
    }

    private void validarContrasena(String password) {
        if (password == null || password.trim().length() < MINIMO_CONTRASENA) {
            throw new IllegalArgumentException(
                    "La contraseña debe tener al menos " + MINIMO_CONTRASENA + " caracteres.");
        }
    }

    /** Mismo mensaje exista o no el numero: no se confirma quien tiene cuenta. */
    private static IllegalArgumentException credencialesInvalidas() {
        return new IllegalArgumentException("Número o contraseña incorrectos.");
    }

    private String nuevoCodigo() {
        StringBuilder sb = new StringBuilder(LARGO_CODIGO);
        for (int i = 0; i < LARGO_CODIGO; i++) {
            sb.append(AZAR.nextInt(10));
        }
        return sb.toString();
    }

    private String limpiar(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    private Branch buscarSucursal(UUID branchId) {
        return branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
    }

    private CuentaResponseDTO comoRespuesta(Customer cliente, UUID restaurantId) {
        return new CuentaResponseDTO(
                jwtService.generarTokenDeCuenta(
                        cliente.getId(), TipoCuenta.CLIENTE, restaurantId, cliente.getPhoneNumber()),
                TipoCuenta.CLIENTE,
                cliente.getId(),
                cliente.getName(),
                cliente.getPhoneNumber(),
                cliente.getEmail());
    }

    private CuentaResponseDTO comoRespuesta(Driver repartidor, UUID restaurantId) {
        return new CuentaResponseDTO(
                jwtService.generarTokenDeCuenta(
                        repartidor.getId(), TipoCuenta.REPARTIDOR, restaurantId, repartidor.getPhoneNumber()),
                TipoCuenta.REPARTIDOR,
                repartidor.getId(),
                repartidor.getNombre(),
                repartidor.getPhoneNumber(),
                repartidor.getEmail());
    }
}
