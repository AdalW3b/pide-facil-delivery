package com.omnirest.omnirest_backend.dtos;

import java.util.List;
import java.util.UUID;

public record TableAlertDTO(
    Integer tableNumber,
    String type,
    String message,
    List<UUID> assignedUserIds
) {}
