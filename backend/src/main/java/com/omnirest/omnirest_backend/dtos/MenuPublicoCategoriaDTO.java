package com.omnirest.omnirest_backend.dtos;

import java.util.List;
import java.util.UUID;

public record MenuPublicoCategoriaDTO(
        UUID categoryId,
        String nombre,
        List<MenuPublicoItemDTO> items) {
}
