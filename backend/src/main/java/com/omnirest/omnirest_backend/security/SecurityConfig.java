package com.omnirest.omnirest_backend.security;

import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final SecurityFilter securityFilter;

    @Value("${cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/v1/branches/*/payment-methods",
                                "/api/v1/branches/*/payment-methods/**")
                        .permitAll()
                        .requestMatchers("/api/v1/billing/**", "/api/v1/auth/**", "/api/v1/webhooks/**", "/v3/api-docs/**", "/swagger-ui/**",
                                "/swagger-ui.html", "/error", "/ws-omnirest/**", "/ws-pidefacil/**",
                                "/api/v1/qr/**",
                                // Menu y pedidos a domicilio: el cliente entra por un
                                // enlace, sin cuenta. La sucursal va en la ruta.
                                "/api/v1/public/**")
                        .permitAll()
                        .requestMatchers("/api/v1/restaurants/*/menu.pdf").permitAll()
                        .requestMatchers("/api/v1/analytics/**")
                        .hasAnyAuthority("SUPER_ADMIN", "SYSTEM_ADMIN", "BRANCH_MANAGER")
                        .anyRequest().authenticated())
                .addFilterBefore(securityFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Cache-Control", "X-Restaurant-Id", "X-Branch-Id", "*"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public UserDetailsService userDetailsService(UserRepository userRepository) {
        return username -> {
            User user = userRepository.findByUsernameAndActiveTrue(username)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

            var authorities = user.getAuthorities();

            return new CustomUserDetails(
                    user.getId(),
                    user.getUsername(),
                    user.getPasswordHash(),
                    user.getRole() != null ? user.getRole().getName() : null,
                    user.getRole() != null ? user.getRole().getDefaultRoute() : null,
                    user.getRestaurant() != null ? user.getRestaurant().getId() : null,
                    user.getBranch() != null ? user.getBranch().getId() : null,
                    authorities);
        };
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
