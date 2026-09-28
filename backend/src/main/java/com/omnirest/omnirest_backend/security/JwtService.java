package com.omnirest.omnirest_backend.security;

import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private final RestaurantRepository restaurantRepository;

    public String generateToken(CustomUserDetails userDetails) {
        List<String> permissions = userDetails.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .toList();

        boolean isDemo = userDetails.restaurantId() != null &&
                restaurantRepository.findById(userDetails.restaurantId())
                        .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                        .orElse(false);

        Map<String, Object> claims = new HashMap<>();
        claims.put("permissions", permissions);
        claims.put("role", userDetails.roleName());
        claims.put("defaultRoute", userDetails.defaultRoute());
        claims.put("restaurantId", userDetails.restaurantId() != null ? userDetails.restaurantId().toString() : null);
        claims.put("branchId", userDetails.branchId() != null ? userDetails.branchId().toString() : null);
        claims.put("userId", userDetails.id() != null ? userDetails.id().toString() : null);
        claims.put("isDemo", isDemo);

        return createToken(claims, userDetails.getUsername());
    }

    /**
     * Token para una cuenta publica: un cliente o un repartidor.
     *
     * No pasa por la tabla de usuarios del personal, asi que el sujeto es el id
     * de su ficha y la marca {@code tipoCuenta} le dice al filtro de seguridad
     * por donde resolverlo.
     */
    public String generarTokenDeCuenta(UUID cuentaId, TipoCuenta tipo, UUID restaurantId, String telefono) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("tipoCuenta", tipo.name());
        claims.put("cuentaId", cuentaId.toString());
        claims.put("restaurantId", restaurantId != null ? restaurantId.toString() : null);
        claims.put("telefono", telefono);

        return createToken(claims, cuentaId.toString());
    }

    /** El tipo de cuenta del token, o null si es de un empleado. */
    public TipoCuenta tipoDeCuenta(String token) {
        try {
            String valor = getClaim(token, "tipoCuenta", String.class);
            return valor == null ? null : TipoCuenta.valueOf(valor);
        } catch (Exception e) {
            return null;
        }
    }

    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    public String getUsernameFromToken(String token) {
        return getClaim(token, Claims::getSubject);
    }

    public <T> T getClaim(String token, String claimName, Class<T> requiredType) {
        Claims claims = getAllClaims(token);
        return claims.get(claimName, requiredType);
    }

    public <T> T getClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = getAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private boolean isTokenExpired(String token) {
        return getClaim(token, Claims::getExpiration).before(new Date());
    }

    private Claims getAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes;
        try {
            keyBytes = java.util.HexFormat.of().parseHex(secret);
        } catch (Exception e) {
            keyBytes = Decoders.BASE64.decode(secret);
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }
}