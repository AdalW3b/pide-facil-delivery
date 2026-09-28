package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.UUID;

public record EmployeePerformanceDTO(
    UUID employeeId,
    String employeeName,
    Long totalOrders,
    BigDecimal totalRevenue,
    String branchName
) {}
