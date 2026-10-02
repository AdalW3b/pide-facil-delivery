package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Kiosko;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.KioskoRepository;
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
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Las tablets que funcionan como kiosko. Se activan desde el panel en la
 * misma tablet: el panel recibe un token, lo guarda en el navegador y desde
 * ahi el kiosko lo manda con cada pedido. Sin token valido no se aceptan
 * pedidos de kiosko, asi que la liga sola no sirve para pedir "para comer aqui".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KioskoService {

    private static final SecureRandom AZAR = new SecureRandom();

    private final KioskoRepository kioskoRepository;
    private final BranchRepository branchRepository;

    /** Lo que recibe la tablet al activarse. El token solo se ve esta vez. */
    public record Activado(UUID kioskoId, UUID branchId, String nombre, String sucursal, String token) {
    }

    public record KioskoDTO(UUID id, String nombre, String creadoPor, LocalDateTime creadoEn, LocalDateTime ultimoUso) {
    }

    @Transactional
    public Activado activar(UUID branchId, String nombre, CustomUserDetails user) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        String limpio = nombre == null || nombre.isBlank() ? "Kiosko" : nombre.trim();
        if (limpio.length() > 60) limpio = limpio.substring(0, 60);

        byte[] bytes = new byte[32];
        AZAR.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        Kiosko kiosko = kioskoRepository.save(Kiosko.builder()
                .branchId(branchId)
                .nombre(limpio)
                .tokenHash(huella(token))
                .creadoPor(user != null ? user.username() : null)
                .build());
        log.info("Kiosko '{}' activado en sucursal {} por {}", limpio, branchId, kiosko.getCreadoPor());
        return new Activado(kiosko.getId(), branchId, limpio, branch.getName(), token);
    }

    @Transactional(readOnly = true)
    public List<KioskoDTO> listar(UUID branchId) {
        return kioskoRepository.findByBranchIdAndActivoTrueOrderByCreadoEnAsc(branchId).stream()
                .map(k -> new KioskoDTO(k.getId(), k.getNombre(), k.getCreadoPor(), k.getCreadoEn(), k.getUltimoUso()))
                .toList();
    }

    /** Apaga un kiosko: su tablet deja de poder pedir en ese momento. */
    @Transactional
    public void desactivar(UUID branchId, UUID kioskoId) {
        Kiosko kiosko = kioskoRepository.findByIdAndBranchId(kioskoId, branchId)
                .orElseThrow(() -> new IllegalArgumentException("Kiosko no encontrado en esta sucursal."));
        kiosko.setActivo(false);
        kioskoRepository.save(kiosko);
    }

    /** El kiosko de este token, si esta activo y es de esta sucursal. */
    @Transactional
    public Kiosko validar(UUID branchId, String token) {
        if (token == null || token.isBlank()) {
            throw noActivo();
        }
        Kiosko kiosko = kioskoRepository.findByTokenHash(huella(token.trim()))
                .filter(k -> Boolean.TRUE.equals(k.getActivo()) && branchId.equals(k.getBranchId()))
                .orElseThrow(KioskoService::noActivo);
        kiosko.setUltimoUso(LocalDateTime.now());
        return kioskoRepository.save(kiosko);
    }

    private static ResponseStatusException noActivo() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                "Este kiosko no está activo. Actívalo de nuevo desde el panel.");
    }

    static String huella(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
