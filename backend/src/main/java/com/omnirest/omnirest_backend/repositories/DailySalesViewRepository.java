package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.DailySalesId;
import com.omnirest.omnirest_backend.domain.entities.DailySalesView;
import com.omnirest.omnirest_backend.dtos.DailySalesDTO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface DailySalesViewRepository extends JpaRepository<DailySalesView, DailySalesId> {

    @Query("""
        SELECT new com.omnirest.omnirest_backend.dtos.DailySalesDTO(
            a.restaurantId,
            :branchId,
            a.saleDate,
            SUM(a.totalOrders),
            SUM(a.totalRevenue)
        )
        FROM DailySalesView a
        WHERE (:restaurantId IS NULL OR a.restaurantId = :restaurantId)
          AND (:branchId IS NULL OR a.branchId = :branchId)
          AND a.saleDate BETWEEN :startDate AND :endDate
        GROUP BY a.restaurantId, a.saleDate
        ORDER BY a.saleDate ASC
    """)
    List<DailySalesDTO> findDailySales(
        @Param("restaurantId") UUID restaurantId,
        @Param("branchId") UUID branchId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
}
