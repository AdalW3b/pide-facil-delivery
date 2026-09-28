package com.omnirest.omnirest_backend.dtos;

public record KdsEfficiencyDTO(
    String productName,
    Long avgMinutes,
    String branchName
) {}
