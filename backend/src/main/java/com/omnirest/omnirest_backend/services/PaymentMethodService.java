package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.PaymentMethod;
import com.omnirest.omnirest_backend.dtos.PaymentMethodDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.PaymentMethodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PaymentMethodService {

    private final PaymentMethodRepository paymentMethodRepository;
    private final BranchRepository branchRepository;
    private final SecurityValidationService securityValidationService;

    public List<PaymentMethodDTO> getPaymentMethodsByBranchId(UUID branchId) {
        return paymentMethodRepository.findByBranchId(branchId).stream()
                .map(this::mapToDTO)
                .toList();
    }

    public List<PaymentMethodDTO> getPaymentMethods(UUID branchId) {
        return getPaymentMethodsByBranchId(branchId);
    }

    @Transactional
    public PaymentMethodDTO createPaymentMethod(UUID branchId, PaymentMethodDTO dto) {
        securityValidationService.validateUserAccessToBranch(branchId);

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));

        PaymentMethod paymentMethod = PaymentMethod.builder()
                .branch(branch)
                .name(dto.name())
                .instructions(dto.instructions())
                .active(dto.active() != null ? dto.active() : true)
                .build();

        PaymentMethod saved = paymentMethodRepository.save(paymentMethod);
        return mapToDTO(saved);
    }

    @Transactional
    public PaymentMethodDTO updatePaymentMethod(UUID branchId, UUID id, PaymentMethodDTO dto) {
        securityValidationService.validateUserAccessToBranch(branchId);

        PaymentMethod paymentMethod = paymentMethodRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment method not found: " + id));

        if (!paymentMethod.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("Payment method does not belong to branch: " + branchId);
        }

        paymentMethod.setName(dto.name());
        paymentMethod.setInstructions(dto.instructions());
        if (dto.active() != null) {
            paymentMethod.setActive(dto.active());
        }

        PaymentMethod saved = paymentMethodRepository.save(paymentMethod);
        return mapToDTO(saved);
    }

    @Transactional
    public PaymentMethodDTO toggleStatus(UUID branchId, UUID id) {
        securityValidationService.validateUserAccessToBranch(branchId);

        PaymentMethod paymentMethod = paymentMethodRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment method not found: " + id));

        if (!paymentMethod.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("Payment method does not belong to branch: " + branchId);
        }

        paymentMethod.setActive(!Boolean.TRUE.equals(paymentMethod.getActive()));
        PaymentMethod saved = paymentMethodRepository.save(paymentMethod);
        return mapToDTO(saved);
    }

    private PaymentMethodDTO mapToDTO(PaymentMethod paymentMethod) {
        return new PaymentMethodDTO(
                paymentMethod.getId(),
                paymentMethod.getName(),
                paymentMethod.getActive(),
                paymentMethod.getInstructions()
        );
    }
}
