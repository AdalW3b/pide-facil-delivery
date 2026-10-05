package com.omnirest.omnirest_backend.security;

import com.omnirest.omnirest_backend.domain.entities.SesionSoporte;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.services.SoporteService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * El candado del modo soporte. Toda petición del operador de la plataforma a
 * datos de un restaurante pasa por aquí, venga de la pantalla que venga:
 * sin sesión de soporte abierta no ve nada, y un cambio exige la ventana
 * que abre el código del dueño. Los cambios quedan en la bitácora.
 *
 * Va aparte de las validaciones de cada servicio porque varias dejaban pasar
 * al operador directo; así hay un solo punto que no se puede olvidar.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CandadoSoporte implements HandlerInterceptor {

    private static final String SESION = "pidefacil.sesionSoporte";

    /** Lo propio de la plataforma: no es dato de un restaurante. */
    private static final List<String> LIBRES = List.of(
            "/api/v1/system/", "/api/v1/admin/", "/api/v1/auth/", "/api/v1/public/",
            "/api/v1/webhooks/", "/api/v1/billing/", "/api/v1/qr/");

    private static final Set<String> SOLO_LECTURA = Set.of("GET", "HEAD", "OPTIONS");

    private final SoporteService soporteService;
    private final BranchRepository branchRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        CustomUserDetails operador = operador();
        if (operador == null) return true;

        String ruta = request.getRequestURI();
        if (!ruta.startsWith("/api/v1/") || LIBRES.stream().anyMatch(ruta::startsWith)) return true;

        UUID restaurante = restauranteDe(request);
        boolean cambio = !SOLO_LECTURA.contains(request.getMethod());

        // Los reportes de toda la plataforma (sin restaurante ni sucursal) no son de nadie en particular.
        if (!cambio && restaurante == null && ruta.startsWith("/api/v1/analytics/")) return true;

        SesionSoporte sesion = soporteService.exigir(operador.id(), restaurante, cambio);
        if (cambio) request.setAttribute(SESION, sesion.getId());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        Object sesion = request.getAttribute(SESION);
        if (sesion instanceof UUID id) {
            try {
                soporteService.registrarCambio(id, request.getMethod(), request.getRequestURI(), response.getStatus());
            } catch (RuntimeException e) {
                log.error("Soporte: no se pudo registrar el cambio {} {}: {}", request.getMethod(), request.getRequestURI(), e.getMessage());
            }
        }
    }

    private static CustomUserDetails operador() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomUserDetails u)) return null;
        return "SYSTEM_ADMIN".equalsIgnoreCase(u.roleName()) ? u : null;
    }

    /** De qué restaurante es la petición: por la sucursal o el restaurante de la ruta o de los parámetros. */
    @SuppressWarnings("unchecked")
    private UUID restauranteDe(HttpServletRequest request) {
        Map<String, String> variables = (Map<String, String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        String sucursal = valor(variables, request, "branchId");
        if (sucursal != null) {
            UUID branchId = uuid(sucursal);
            if (branchId != null) {
                return branchRepository.findById(branchId)
                        .map(b -> b.getRestaurant() != null ? b.getRestaurant().getId() : null)
                        .orElse(null);
            }
        }
        return uuid(valor(variables, request, "restaurantId"));
    }

    private static String valor(Map<String, String> variables, HttpServletRequest request, String nombre) {
        if (variables != null && variables.get(nombre) != null) return variables.get(nombre);
        return request.getParameter(nombre);
    }

    private static UUID uuid(String texto) {
        if (texto == null || texto.isBlank()) return null;
        try {
            return UUID.fromString(texto.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
