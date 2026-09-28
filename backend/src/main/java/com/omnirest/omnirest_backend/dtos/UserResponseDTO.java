package com.omnirest.omnirest_backend.dtos;

import java.util.List;
import java.util.UUID;

public record UserResponseDTO(
    UUID id,
    String name,
    String username,
    RoleInfo role,
    BranchInfo branch,
    Boolean active,
    List<UUID> assignedTableIds,
    String phoneNumber
) {
    public record RoleInfo(UUID id, String name, String defaultRoute) {}
    public record BranchInfo(UUID id, String name) {}
}
