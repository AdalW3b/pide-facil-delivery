package com.omnirest.omnirest_backend.dtos;

public record WhatsappQrResponseDTO(
    String status,
    String qr,
    String pairingCode
) {}
