package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "mv_daily_sales")
@Immutable
@IdClass(DailySalesId.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailySalesView {

    @Id
    @Column(name = "restaurant_id")
    private UUID restaurantId;

    @Id
    @Column(name = "branch_id")
    private UUID branchId;

    @Id
    @Column(name = "sale_date")
    private LocalDate saleDate;

    @Column(name = "total_orders")
    private Long totalOrders;

    @Column(name = "total_revenue")
    private BigDecimal totalRevenue;
}
