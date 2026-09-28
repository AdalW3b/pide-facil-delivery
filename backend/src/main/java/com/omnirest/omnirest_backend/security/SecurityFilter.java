package com.omnirest.omnirest_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class SecurityFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Autowired
    @Lazy
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        if (jwtService.validateToken(token)) {

            // Un token de cliente o repartidor no corresponde a ningun usuario
            // del personal: buscarlo en esa tabla devolveria 401. Se resuelve
            // aqui, antes, y con sus propias autoridades.
            if (SecurityContextHolder.getContext().getAuthentication() == null
                    && autenticarCuentaPublica(token, request)) {
                filterChain.doFilter(request, response);
                return;
            }

            String username = jwtService.getUsernameFromToken(token);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    UserDetails freshUserDetails = userDetailsService.loadUserByUsername(username);

                    if (freshUserDetails instanceof CustomUserDetails cud) {
                        String restHeader = request.getHeader("X-Restaurant-Id");
                        String branchHeader = request.getHeader("X-Branch-Id");

                        if (("SYSTEM_ADMIN".equalsIgnoreCase(cud.roleName()) || "SUPER_ADMIN".equalsIgnoreCase(cud.roleName()))
                                && restHeader != null && !restHeader.isBlank()) {
                            try {
                                java.util.UUID overrideRestId = java.util.UUID.fromString(restHeader.trim());
                                java.util.UUID overrideBranchId = (branchHeader != null && !branchHeader.isBlank())
                                        ? java.util.UUID.fromString(branchHeader.trim())
                                        : cud.branchId();

                                freshUserDetails = new CustomUserDetails(
                                        cud.id(),
                                        cud.getUsername(),
                                        cud.getPassword(),
                                        cud.roleName(),
                                        cud.defaultRoute(),
                                        overrideRestId,
                                        overrideBranchId,
                                        cud.getAuthorities()
                                );
                            } catch (IllegalArgumentException e) {
                                // Ignore invalid UUID format
                            }
                        }
                    }

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            freshUserDetails,
                            null,
                            freshUserDetails.getAuthorities()
                    );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (UsernameNotFoundException ex) {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\": \"Unauthorized\", \"message\": \"Usuario no encontrado o inactivo\"}");
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Deja autenticado a un cliente o repartidor si el token es suyo.
     *
     * @return true si el token era de una cuenta publica, haya podido leerse o
     *         no; en ese caso no hay que seguir buscandolo entre el personal.
     */
    private boolean autenticarCuentaPublica(String token, HttpServletRequest request) {
        com.omnirest.omnirest_backend.domain.enums.TipoCuenta tipo = jwtService.tipoDeCuenta(token);
        if (tipo == null) {
            return false;
        }

        try {
            java.util.UUID cuentaId = java.util.UUID.fromString(jwtService.getClaim(token, "cuentaId", String.class));
            String restaurante = jwtService.getClaim(token, "restaurantId", String.class);

            CuentaPublicaPrincipal cuenta = new CuentaPublicaPrincipal(
                    cuentaId,
                    tipo,
                    restaurante != null ? java.util.UUID.fromString(restaurante) : null,
                    jwtService.getClaim(token, "telefono", String.class));

            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    cuenta, null, cuenta.autoridades());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception e) {
            // Token de cuenta mal formado: se sigue sin sesion, y el endpoint
            // decidira si eso basta o no.
            logger.warn("Token de cuenta pública ilegible: " + e.getMessage());
        }
        return true;
    }
}
