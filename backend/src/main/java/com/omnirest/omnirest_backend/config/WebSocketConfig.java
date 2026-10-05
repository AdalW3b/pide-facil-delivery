package com.omnirest.omnirest_backend.config;

import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@lombok.extern.slf4j.Slf4j
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Pattern BRANCH_TOPIC_PATTERN =
            Pattern.compile("^/topic/branches/([0-9a-fA-F\\-]{36})/.*$");

    private final JwtService jwtService;
    private final BranchRepository branchRepository;

    @Lazy
    private final UserDetailsService userDetailsService;

    /** El mismo candado del modo soporte que las peticiones HTTP. */
    @Lazy
    private final com.omnirest.omnirest_backend.services.SoporteService soporteService;

    @Value("${cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        // Se atienden las dos rutas porque el panel de Pide Facil se conecta a
        // /ws-pidefacil. Sin esta, el frontend tocaba una puerta que no existia
        // y no habia tiempo real: habia que recargar para ver los pedidos.
        registry.addEndpoint("/ws-omnirest", "/ws-pidefacil")
                .setAllowedOrigins(origins);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) return message;

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    List<String> authorization = accessor.getNativeHeader("Authorization");
                    if (authorization != null && !authorization.isEmpty()) {
                        String token = authorization.get(0);
                        if (token.startsWith("Bearer ")) {
                            token = token.substring(7);
                        }
                        if (jwtService.validateToken(token)) {
                            String username = jwtService.getUsernameFromToken(token);
                            if (username != null) {
                                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                        userDetails,
                                        null,
                                        userDetails.getAuthorities()
                                );
                                accessor.setUser(auth);
                            }
                        } else {
                            throw new AccessDeniedException("Token JWT inválido o expirado");
                        }
                    } else {
                        throw new AccessDeniedException("Falta cabecera de Autorización en WebSocket");
                    }
                }

                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String destination = accessor.getDestination();
                    if (destination != null) {
                        Matcher matcher = BRANCH_TOPIC_PATTERN.matcher(destination);
                        if (matcher.matches()) {
                            UUID topicBranchId = UUID.fromString(matcher.group(1));
                            try {
                                validateSubscribeAccess(accessor.getUser(), topicBranchId);
                            } catch (AccessDeniedException e) {
                                // Se descarta SOLO esta suscripcion. Lanzar la
                                // excepcion cerraba la conexion entera: el cliente
                                // se reconectaba, pedia lo mismo y volvia a caer,
                                // y en ese ciclo se perdian tambien los avisos de
                                // los canales que si tenia permitidos.
                                log.warn("Suscripcion rechazada a {}: {}", destination, e.getMessage());
                                return null;
                            }
                        }
                    }
                }

                return message;
            }
        });
    }

    private void validateSubscribeAccess(Principal principal, UUID topicBranchId) {
        if (principal == null) {
            throw new AccessDeniedException("Usuario no autenticado para suscripción WebSocket");
        }
        if (!(principal instanceof UsernamePasswordAuthenticationToken authToken)) {
            throw new AccessDeniedException("Principal inválido en suscripción WebSocket");
        }
        if (!(authToken.getPrincipal() instanceof CustomUserDetails user)) {
            throw new AccessDeniedException("UserDetails inválido en suscripción WebSocket");
        }

        String role = user.roleName();
        if ("SYSTEM_ADMIN".equalsIgnoreCase(role)) {
            // El operador solo escucha en vivo una sucursal del restaurante de su
            // sesion de soporte abierta, igual que en las peticiones HTTP.
            UUID restaurante = branchRepository.findById(topicBranchId)
                    .map(b -> b.getRestaurant() != null ? b.getRestaurant().getId() : null)
                    .orElse(null);
            try {
                soporteService.exigir(user.id(), restaurante, false);
            } catch (org.springframework.web.server.ResponseStatusException e) {
                throw new AccessDeniedException(e.getReason());
            }
            return;
        }
        boolean isSuperAdmin = "SUPER_ADMIN".equalsIgnoreCase(role);

        if (isSuperAdmin) {
            // SUPER_ADMIN: verifica que la sucursal del tópico pertenezca a su restaurante
            if (user.restaurantId() != null) {
                branchRepository.findById(topicBranchId).ifPresent(branch -> {
                    if (!user.restaurantId().equals(branch.getRestaurant().getId())) {
                        throw new AccessDeniedException(
                                "Acceso denegado: la sucursal del tópico no pertenece a tu restaurante");
                    }
                });
            }
        } else {
            // BRANCH_MANAGER / STAFF: branchId del JWT debe coincidir exactamente
            if (user.branchId() == null || !user.branchId().equals(topicBranchId)) {
                throw new AccessDeniedException(
                        "Acceso denegado: no puedes suscribirte a tópicos de otra sucursal");
            }
        }
    }
}
