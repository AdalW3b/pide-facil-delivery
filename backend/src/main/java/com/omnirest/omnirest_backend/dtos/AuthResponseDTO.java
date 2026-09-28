package com.omnirest.omnirest_backend.dtos;

public record AuthResponseDTO(
        String token,
        UserDTO user,
        Boolean isDemo) {
}
