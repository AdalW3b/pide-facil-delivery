package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.dtos.AuthResponseDTO;
import com.omnirest.omnirest_backend.dtos.LoginRequestDTO;
import com.omnirest.omnirest_backend.dtos.PublicRegistrationRequestDTO;
import com.omnirest.omnirest_backend.dtos.UserDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.RoleRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.security.FrenoDeIntentos;
import com.omnirest.omnirest_backend.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

        private final AuthenticationManager authenticationManager;
        private final JwtService jwtService;
        private final RestaurantRepository restaurantRepository;
        private final BranchRepository branchRepository;
        private final RoleRepository roleRepository;
        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final FrenoDeIntentos frenoDeIntentos;

        @PostMapping("/login")
        public ResponseEntity<AuthResponseDTO> login(@Valid @RequestBody LoginRequestDTO request,
                        HttpServletRequest http) {
                String cuenta = FrenoDeIntentos.clavePersonal(request.username());
                String ip = FrenoDeIntentos.claveIp(http.getRemoteAddr());
                frenoDeIntentos.comprobar(cuenta, ip);

                Authentication authentication;
                try {
                        authentication = authenticationManager.authenticate(
                                        new UsernamePasswordAuthenticationToken(request.username(), request.password()));
                } catch (BadCredentialsException | DisabledException e) {
                        // Usuario inexistente o contrasena mala dan el mismo mensaje:
                        // distinguirlos le diria a un extrano que usuarios existen.
                        frenoDeIntentos.fallo(cuenta, ip);
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                                        "Usuario o contraseña incorrectos.");
                }
                frenoDeIntentos.exito(cuenta);
                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
                String token = jwtService.generateToken(userDetails);
                List<String> permissions = userDetails.getAuthorities().stream()
                                .map(GrantedAuthority::getAuthority)
                                .toList();

                boolean isDemo = isRestaurantDemo(userDetails.restaurantId());

                UserDTO user = new UserDTO(
                                userDetails.id(),
                                userDetails.username(),
                                userDetails.roleName(),
                                userDetails.defaultRoute(),
                                userDetails.restaurantId(),
                                userDetails.branchId(),
                                permissions,
                                isDemo);
                return ResponseEntity.ok(new AuthResponseDTO(token, user, isDemo));
        }

        @PostMapping("/register")
        @Transactional
        public ResponseEntity<AuthResponseDTO> register(@Valid @RequestBody PublicRegistrationRequestDTO request) {
                if (userRepository.findByUsername(request.username()).isPresent()) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "El nombre de usuario '" + request.username() + "' ya está en uso.");
                }

                String stripeCustomerId = null;
                String stripeSubscriptionId = null;
                String subscriptionPlan = "PRO";
                String subscriptionStatus = "TRIAL";
                java.time.LocalDateTime trialEndsAt = java.time.LocalDateTime.now().plusDays(14);

                if (request.stripeSessionId() != null && !request.stripeSessionId().isBlank()) {
                        try {
                                com.stripe.model.checkout.Session stripeSession =
                                                com.stripe.model.checkout.Session.retrieve(request.stripeSessionId());
                                stripeCustomerId = stripeSession.getCustomer();
                                stripeSubscriptionId = stripeSession.getSubscription();
                                subscriptionStatus = "ACTIVE";
                                trialEndsAt = null;
                                if (request.plan() != null && !request.plan().isBlank()) {
                                    subscriptionPlan = request.plan().toUpperCase();
                                }
                                log.info("[AuthController] Sesión Stripe {} vinculada: Customer={}, Subscription={}, Plan={}",
                                                request.stripeSessionId(), stripeCustomerId, stripeSubscriptionId, subscriptionPlan);
                        } catch (Exception e) {
                                log.error("[AuthController] Error al recuperar sesión de Stripe {}: {}", request.stripeSessionId(), e.getMessage());
                        }
                }

                Restaurant restaurant = Restaurant.builder()
                                .name(request.restaurantName())
                                .isDemo(false)
                                .stripeCustomerId(stripeCustomerId)
                                .stripeSubscriptionId(stripeSubscriptionId)
                                .subscriptionStatus(subscriptionStatus)
                                .subscriptionPlan(subscriptionPlan)
                                .trialEndsAt(trialEndsAt)
                                .build();
                restaurant = restaurantRepository.save(restaurant);

                Branch branch = Branch.builder()
                                .restaurant(restaurant)
                                .name(request.branchName())
                                .address(request.branchAddress())
                                .whatsappNumber(request.whatsappNumber())
                                .build();
                branch = branchRepository.save(branch);

                Role role = roleRepository.findByName("SUPER_ADMIN")
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Rol SUPER_ADMIN no encontrado"));

                User userEntity = User.builder()
                                .restaurant(restaurant)
                                .branch(null)
                                .role(role)
                                .username(request.username())
                                .passwordHash(passwordEncoder.encode(request.password()))
                                .name(request.name())
                                .phoneNumber(request.phoneNumber())
                                .build();
                userEntity = userRepository.save(userEntity);

                CustomUserDetails userDetails = new CustomUserDetails(
                                userEntity.getId(),
                                userEntity.getUsername(),
                                userEntity.getPasswordHash(),
                                userEntity.getRole() != null ? userEntity.getRole().getName() : null,
                                userEntity.getRole() != null ? userEntity.getRole().getDefaultRoute() : null,
                                userEntity.getRestaurant() != null ? userEntity.getRestaurant().getId() : null,
                                userEntity.getBranch() != null ? userEntity.getBranch().getId() : null,
                                userEntity.getAuthorities());

                String token = jwtService.generateToken(userDetails);
                List<String> permissions = userDetails.getAuthorities().stream()
                                .map(GrantedAuthority::getAuthority)
                                .toList();

                boolean isDemo = Boolean.TRUE.equals(restaurant.getIsDemo());

                UserDTO user = new UserDTO(
                                userDetails.id(),
                                userDetails.username(),
                                userDetails.roleName(),
                                userDetails.defaultRoute(),
                                userDetails.restaurantId(),
                                userDetails.branchId(),
                                permissions,
                                isDemo);
                return ResponseEntity.ok(new AuthResponseDTO(token, user, isDemo));
        }

        @GetMapping("/me")
        public ResponseEntity<UserDTO> getMe(@AuthenticationPrincipal CustomUserDetails userDetails) {
                if (userDetails == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
                }
                List<String> permissions = userDetails.getAuthorities().stream()
                                .map(GrantedAuthority::getAuthority)
                                .toList();

                boolean isDemo = isRestaurantDemo(userDetails.restaurantId());

                UserDTO user = new UserDTO(
                                userDetails.id(),
                                userDetails.username(),
                                userDetails.roleName(),
                                userDetails.defaultRoute(),
                                userDetails.restaurantId(),
                                userDetails.branchId(),
                                permissions,
                                isDemo);
                return ResponseEntity.ok(user);
        }

        private boolean isRestaurantDemo(UUID restaurantId) {
                if (restaurantId == null) {
                        return false;
                }
                return restaurantRepository.findById(restaurantId)
                                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                                .orElse(false);
        }
}
