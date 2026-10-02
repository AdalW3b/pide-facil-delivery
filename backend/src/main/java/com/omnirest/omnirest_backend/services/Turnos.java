package com.omnirest.omnirest_backend.services;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Los turnos con que se llama a los clientes de mostrador: A-001, A-002...
 * Empiezan de nuevo cada dia y son por sucursal.
 */
@Component
@RequiredArgsConstructor
public class Turnos {

    private final JdbcTemplate jdbcTemplate;

    /**
     * El siguiente turno de hoy. Un solo INSERT ... ON CONFLICT lo aparta, asi
     * que dos kioscos que piden al mismo tiempo no sacan el mismo numero.
     */
    public String siguiente(UUID branchId) {
        Integer n = jdbcTemplate.queryForObject(
                "INSERT INTO contador_turnos (branch_id, dia, ultimo) VALUES (?, ?, 1) "
                        + "ON CONFLICT (branch_id, dia) DO UPDATE SET ultimo = contador_turnos.ultimo + 1 "
                        + "RETURNING ultimo",
                Integer.class, branchId, java.sql.Date.valueOf(Combos.hoy()));
        return formato(n != null ? n : 1);
    }

    /** 1 -> A-001 ... 999 -> A-999, 1000 -> B-001: tres cifras se leen mejor en voz alta. */
    static String formato(int n) {
        int i = Math.max(1, n) - 1;
        char letra = (char) ('A' + (i / 999) % 26);
        return letra + "-" + String.format("%03d", i % 999 + 1);
    }
}
