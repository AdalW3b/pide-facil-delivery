package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Customer;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.CustomerIdentifyRequestDTO;
import com.omnirest.omnirest_backend.dtos.CustomerResponseDTO;
import com.omnirest.omnirest_backend.dtos.MenuCategoryDTO;
import com.omnirest.omnirest_backend.dtos.UpdateCustomerNameDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CustomerRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final BranchRepository branchRepository;
    private final ProductRepository productRepository;
    private final AdicionalesService adicionalesService;

    @Transactional
    public CustomerResponseDTO identifyCustomer(UUID branchId, CustomerIdentifyRequestDTO request) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        Restaurant restaurant = branch.getRestaurant();
        UUID restaurantId = restaurant.getId();

        // El mismo celular llega escrito de varias formas segun por donde
        // entre. Se compara y se guarda siempre en la misma, o la persona
        // termina con una ficha por cada canal.
        final String telefono = TelefonoMx.canonico(request.phoneNumber());

        return customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, telefono)
                .map(customer -> {
                    customer.setLastVisit(LocalDateTime.now());
                    customer.setTotalVisits(customer.getTotalVisits() + 1);
                    if (request.name() != null && !request.name().isBlank()) {
                        customer.setName(request.name());
                    } else if ("Cliente".equals(customer.getName()) && request.profileName() != null && !request.profileName().isBlank()) {
                        customer.setName(request.profileName());
                    }
                    Customer savedCustomer = customerRepository.save(customer);
                    return new CustomerResponseDTO(
                            savedCustomer.getId(),
                            savedCustomer.getPhoneNumber(),
                            savedCustomer.getName(),
                            savedCustomer.getTotalVisits(),
                            false
                    );
                })
                .orElseGet(() -> {
                    String name = (request.name() != null && !request.name().isBlank()) ? request.name() : 
                                 ((request.profileName() != null && !request.profileName().isBlank()) ? request.profileName() : "Cliente");
                    Customer customer = Customer.builder()
                            .restaurant(restaurant)
                            .phoneNumber(telefono)
                            .name(name)
                            .totalVisits(1)
                            .lastVisit(LocalDateTime.now())
                            .build();

                    Customer savedCustomer = customerRepository.save(customer);
                    return new CustomerResponseDTO(
                            savedCustomer.getId(),
                            savedCustomer.getPhoneNumber(),
                            savedCustomer.getName(),
                            savedCustomer.getTotalVisits(),
                            true
                    );
                });
    }

    public List<MenuCategoryDTO> getMenuForBranch(UUID branchId) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        UUID restaurantId = branch.getRestaurant().getId();

        List<Product> activeProducts = productRepository.findByCategoryRestaurantIdAndActiveTrue(restaurantId);
        List<com.omnirest.omnirest_backend.domain.entities.GrupoAdicional> grupos =
                adicionalesService.gruposActivos(restaurantId);

        Map<String, List<Product>> grouped = activeProducts.stream()
                .filter(p -> p.getCategory() != null && p.getCategory().getActive())
                .collect(Collectors.groupingBy(p -> p.getCategory().getName()));

        return grouped.entrySet().stream()
                .map(entry -> {
                    List<String> items = entry.getValue().stream()
                            // Los adicionales van en la misma linea del platillo, como
                            // texto: el bot los lee junto al precio y el formato de la
                            // respuesta no cambia para el flujo que ya lo consume.
                            .map(p -> {
                                String linea = p.getName() + " - $" + p.getPrice();
                                List<String> extras = adicionalesService.describirParaBot(p, grupos);
                                return extras.isEmpty() ? linea : linea + " | " + String.join(" | ", extras);
                            })
                            .collect(Collectors.toList());
                    return new MenuCategoryDTO(entry.getKey(), items);
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateCustomerName(String phoneNumber, UpdateCustomerNameDTO dto) {
        List<Customer> customers = customerRepository.findByPhoneNumber(TelefonoMx.canonico(phoneNumber));
        if (customers.isEmpty()) {
            throw new IllegalArgumentException("No customers found with phone number " + phoneNumber);
        }
        // Un mismo telefono puede ser cliente de varios restaurantes. Sin saber
        // de cual se trata, cambiarlos todos pisaria el nombre que ese cliente
        // tiene en los demas, asi que solo se permite cuando no hay ambiguedad.
        if (customers.size() > 1) {
            throw new IllegalArgumentException(
                    "El telefono " + phoneNumber + " pertenece a varios restaurantes: "
                            + "usa la ruta con sucursal para indicar cual actualizar.");
        }
        Customer customer = customers.get(0);
        customer.setName(dto.name());
        customerRepository.save(customer);
    }

    /**
     * Cambia el nombre del cliente de UN restaurante, el de la sucursal que se
     * indica. Es la ruta que usa el bot, y la que usara el menu en linea cuando
     * el cliente entre por su enlace a hacer un pedido.
     */
    @Transactional
    public void updateCustomerName(UUID branchId, String phoneNumber, String nombre) {
        if (nombre == null || nombre.isBlank()) {
            return;
        }
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
        UUID restaurantId = branch.getRestaurant().getId();

        Customer customer = customerRepository
                .findByRestaurantIdAndPhoneNumber(restaurantId, TelefonoMx.canonico(phoneNumber))
                .orElseThrow(() -> new IllegalArgumentException(
                        "No hay un cliente con el telefono " + phoneNumber + " en este restaurante."));

        customer.setName(nombre.trim());
        customerRepository.save(customer);
    }
}
