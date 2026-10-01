package com.omnirest.omnirest_backend.dtos;

/** Minutos promedio desde que se pidio el platillo hasta que cocina lo marco listo. */
public record KdsEfficiencyDTO(
    String productName,
    Long avgMinutes,
    String branchName,
    /** Cuantos platillos entraron en el promedio. */
    Long piezas
) {}
