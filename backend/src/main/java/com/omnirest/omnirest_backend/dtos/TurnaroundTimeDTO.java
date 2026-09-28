package com.omnirest.omnirest_backend.dtos;

public record TurnaroundTimeDTO(
    Integer tableNumber,
    Long averageMinutes,
    Long totalOrders,
    String branchName
) {}
