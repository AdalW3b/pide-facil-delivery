package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Customer;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.CustomerIdentifyRequestDTO;
import com.omnirest.omnirest_backend.dtos.CustomerResponseDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CustomerRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private CustomerService customerService;

    private UUID restaurantId;
    private UUID branchId;
    private Restaurant restaurant;
    private Branch branch;
    private Customer customer;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        branch = Branch.builder()
                .id(branchId)
                .restaurant(restaurant)
                .name("Sucursal Principal")
                .build();

        customer = Customer.builder()
                .id(UUID.randomUUID())
                .restaurant(restaurant)
                .phoneNumber("525551234567")
                .name("Ana Gómez")
                .totalVisits(3)
                .lastVisit(LocalDateTime.now().minusDays(2))
                .build();
    }

    @Test
    @DisplayName("Reconoce al cliente aunque WhatsApp mande el número con el 1 de más")
    void identifyCustomer_ExistingCustomer_IncrementsVisits() {
        // WhatsApp entrega "521...", pero la ficha se guardó como "52...".
        // Es la misma persona: se busca por la forma canónica.
        CustomerIdentifyRequestDTO request = new CustomerIdentifyRequestDTO("5215551234567", null, "Ana G.");

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
        when(customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, "525551234567"))
                .thenReturn(Optional.of(customer));
        when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CustomerResponseDTO response = customerService.identifyCustomer(branchId, request);

        assertNotNull(response);
        assertEquals("525551234567", response.phoneNumber());
        assertEquals(4, response.totalVisits(), "debe sumar la visita a la ficha que ya existía");
        assertFalse(response.isNewCustomer(), "no es un cliente nuevo, solo escribió su número distinto");
        verify(customerRepository).save(customer);
    }

    @Test
    @DisplayName("El mismo número escrito de dos formas no abre dos fichas")
    void identifyCustomer_MismoNumeroOtroFormato_NoDuplica() {
        // El cliente pidió antes por WhatsApp y ahora entra por el menú web,
        // donde escribió su número con espacios y sin el 1.
        CustomerIdentifyRequestDTO request = new CustomerIdentifyRequestDTO("+52 555 123 4567", null, null);

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
        when(customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, "525551234567"))
                .thenReturn(Optional.of(customer));
        when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CustomerResponseDTO response = customerService.identifyCustomer(branchId, request);

        assertFalse(response.isNewCustomer(), "es el mismo cliente, no uno nuevo");
        assertEquals("525551234567", response.phoneNumber());
    }

    @Test
    @DisplayName("identifyCustomer creates new customer if not found")
    void identifyCustomer_NewCustomer_CreatesAndReturnsNew() {
        CustomerIdentifyRequestDTO request = new CustomerIdentifyRequestDTO("5219998887766", "Roberto", null);

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
        when(customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, "529998887766"))
                .thenReturn(Optional.empty());
        when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> {
            Customer c = invocation.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        CustomerResponseDTO response = customerService.identifyCustomer(branchId, request);

        assertNotNull(response);
        // La ficha nueva nace ya en forma canónica, no como llegó.
        assertEquals("529998887766", response.phoneNumber());
        assertEquals("Roberto", response.name());
        assertEquals(1, response.totalVisits());
        assertTrue(response.isNewCustomer());
        verify(customerRepository).save(any(Customer.class));
    }
}
