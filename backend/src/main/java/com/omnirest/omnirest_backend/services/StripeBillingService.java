package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.CheckoutSessionRequestDTO;
import com.omnirest.omnirest_backend.dtos.CheckoutSessionResponseDTO;
import com.omnirest.omnirest_backend.dtos.CustomerPortalResponseDTO;
import com.omnirest.omnirest_backend.dtos.SubscriptionInfoDTO;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class StripeBillingService {

    private final RestaurantRepository restaurantRepository;
    private final RentaService rentaService;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.webhook-secret:}")
    private String stripeWebhookSecret;

    @PostConstruct
    public void init() {
        if (stripeSecretKey != null && !stripeSecretKey.isBlank()) {
            Stripe.apiKey = stripeSecretKey;
            log.info("[StripeBillingService] Clave secreta de Stripe inicializada correctamente.");
        } else {
            log.warn("[StripeBillingService] Clave secreta de Stripe no configurada.");
        }
    }

    /**
     * Crea una sesión de Stripe Checkout dinámicamente con price_data
     */
    public CheckoutSessionResponseDTO createCheckoutSession(CheckoutSessionRequestDTO request, UUID authenticatedRestaurantId) {
        UUID targetRestaurantId = authenticatedRestaurantId != null ? authenticatedRestaurantId : request.restaurantId();
        
        long unitAmount = (request.amount() != null && request.amount() > 0)
                ? request.amount() * 100L
                : (request.plan() != null && request.plan().equalsIgnoreCase("pro") ? 5900L : 2900L);

        String currency = (request.currency() != null && !request.currency().isBlank())
                ? request.currency().toLowerCase()
                : "usd";

        String planName = (request.planName() != null && !request.planName().isBlank())
                ? request.planName()
                : ("HeyChef Plan " + (request.plan() != null ? request.plan().toUpperCase() : "PRO"));

        boolean isYearly = "yearly".equalsIgnoreCase(request.cycle());
        SessionCreateParams.LineItem.PriceData.Recurring.Interval interval =
                isYearly ? SessionCreateParams.LineItem.PriceData.Recurring.Interval.YEAR
                         : SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH;

        SessionCreateParams.Builder paramsBuilder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity(1L)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency(currency)
                                                .setUnitAmount(unitAmount)
                                                .setRecurring(
                                                        SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                                                .setInterval(interval)
                                                                .build()
                                                )
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName(planName)
                                                                .setDescription("Suscripción " + (isYearly ? "anual" : "mensual") + " para HeyChef")
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                )
                .setSuccessUrl(request.successUrl())
                .setCancelUrl(request.cancelUrl());

        if (targetRestaurantId != null) {
            paramsBuilder.putMetadata("restaurantId", targetRestaurantId.toString());
        }
        if (request.plan() != null) {
            paramsBuilder.putMetadata("plan", request.plan());
        }
        if (request.cycle() != null) {
            paramsBuilder.putMetadata("cycle", request.cycle());
        }

        try {
            Session session = Session.create(paramsBuilder.build());
            return new CheckoutSessionResponseDTO(session.getUrl(), session.getId());
        } catch (StripeException e) {
            log.error("[StripeBillingService] Error creando Stripe Checkout Session: {}", e.getMessage(), e);
            throw new RuntimeException("Error al comunicarse con Stripe: " + e.getMessage(), e);
        }
    }

    /**
     * Genera la URL del Stripe Customer Portal para gestionar métodos de pago y facturas
     */
    public CustomerPortalResponseDTO createCustomerPortalSession(UUID restaurantId) {
        if (restaurantId != null) {
            Restaurant restaurant = restaurantRepository.findById(restaurantId).orElse(null);
            if (restaurant != null && restaurant.getStripeCustomerId() != null && !restaurant.getStripeCustomerId().isBlank()) {
                try {
                    com.stripe.param.billingportal.SessionCreateParams params =
                            com.stripe.param.billingportal.SessionCreateParams.builder()
                                    .setCustomer(restaurant.getStripeCustomerId())
                                    .setReturnUrl("http://localhost:4200/settings?tab=billing")
                                    .build();
                    com.stripe.model.billingportal.Session portalSession =
                            com.stripe.model.billingportal.Session.create(params);
                    return new CustomerPortalResponseDTO(portalSession.getUrl());
                } catch (Exception e) {
                    log.error("[StripeBillingService] Error creando Stripe Customer Portal session: {}", e.getMessage());
                }
            }
        }
        return new CustomerPortalResponseDTO("https://billing.stripe.com/p/login/test");
    }

    /**
     * Obtiene la información actual de la suscripción del restaurante
     */
    public SubscriptionInfoDTO getSubscriptionInfo(UUID restaurantId) {
        if (restaurantId != null) {
            return restaurantRepository.findById(restaurantId)
                    .map(r -> {
                        String rawPlan = r.getSubscriptionPlan();
                        boolean isDemo = Boolean.TRUE.equals(r.getIsDemo());
                        String plan;
                        String status;
                        String trialEndsAtStr = r.getTrialEndsAt() != null ? r.getTrialEndsAt().toString() : null;

                        if (isDemo) {
                            plan = "DEMO";
                            status = "DEMO";
                        } else if (rawPlan == null || rawPlan.isBlank()) {
                            plan = "NINGUNO";
                            status = "INACTIVE";
                        } else {
                            plan = rawPlan.toUpperCase();
                            String currentStatus = r.getSubscriptionStatus() != null ? r.getSubscriptionStatus().toUpperCase() : "ACTIVE";
                            if ("TRIAL".equals(currentStatus)) {
                                if (r.getTrialEndsAt() != null && r.getTrialEndsAt().isBefore(java.time.LocalDateTime.now())) {
                                    status = "EXPIRED";
                                } else {
                                    status = "TRIAL";
                                }
                            } else {
                                status = currentStatus;
                            }
                        }
                        String customerId = r.getStripeCustomerId();
                        boolean hasPayment = customerId != null && !customerId.isBlank();
                        String nextMonth = ("ACTIVE".equals(status)) ? Instant.now().plus(30, ChronoUnit.DAYS).toString() : null;
                        return new SubscriptionInfoDTO(
                                plan,
                                "monthly",
                                status,
                                trialEndsAtStr,
                                nextMonth,
                                false,
                                customerId,
                                hasPayment
                        );
                    })
                    .orElseGet(this::defaultSubscriptionInfo);
        }
        return defaultSubscriptionInfo();
    }

    private SubscriptionInfoDTO defaultSubscriptionInfo() {
        return new SubscriptionInfoDTO(
                "NINGUNO",
                "monthly",
                "INACTIVE",
                null,
                null,
                false,
                null,
                false
        );
    }

    /**
     * Procesa eventos de Webhook enviados por Stripe.
     *
     * Solo se acepta un evento con la firma de Stripe. Antes, sin el secreto
     * configurado, se procesaba cualquier JSON: cualquiera podia mandar un
     * "invoice.paid" falso y dar por pagada la renta de un restaurante.
     */
    public void processWebhook(String payload, String sigHeader) {
        if (stripeWebhookSecret == null || stripeWebhookSecret.isBlank() || stripeWebhookSecret.equals("whsec_placeholder")) {
            log.error("[StripeBillingService] Webhook rechazado: falta STRIPE_WEBHOOK_SECRET en el servidor.");
            throw new IllegalStateException("El webhook de Stripe no está configurado en el servidor.");
        }
        if (sigHeader == null || sigHeader.isBlank()) {
            log.warn("[StripeBillingService] Webhook rechazado: llegó sin firma de Stripe.");
            throw new IllegalArgumentException("Falta la firma de Stripe.");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, stripeWebhookSecret);
        } catch (Exception e) {
            log.warn("[StripeBillingService] Webhook rechazado, firma inválida: {}", e.getMessage());
            throw new IllegalArgumentException("Firma de webhook inválida.");
        }

        log.info("[StripeBillingService] Webhook recibido: {}", event.getType());

        switch (event.getType()) {
            case "checkout.session.completed":
                handleCheckoutCompleted(event);
                break;
            case "invoice.paid":
                registrarFactura(event, true);
                break;
            case "invoice.payment_failed":
                registrarFactura(event, false);
                break;
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
                actualizarSuscripcion(event);
                break;
            default:
                log.debug("[StripeBillingService] Evento no manejado: {}", event.getType());
                break;
        }
    }

    /**
     * Cada factura de la renta, pagada o fallida, queda en el historial del
     * restaurante. El restaurante se ubica por su cliente de Stripe.
     */
    private void registrarFactura(Event event, boolean pagada) {
        event.getDataObjectDeserializer().getObject().ifPresent(objeto -> {
            if (!(objeto instanceof com.stripe.model.Invoice factura)) return;
            UUID restaurantId = restauranteDeCliente(factura.getCustomer());
            if (restaurantId == null) {
                log.warn("[StripeBillingService] Factura {} de un cliente sin restaurante ({})", factura.getId(), factura.getCustomer());
                return;
            }
            Long centavos = pagada ? factura.getAmountPaid() : factura.getAmountDue();
            java.math.BigDecimal monto = java.math.BigDecimal.valueOf(centavos != null ? centavos : 0L)
                    .movePointLeft(2);
            Long desde = factura.getPeriodStart();
            Long hasta = factura.getPeriodEnd();
            // El periodo que cubre la suscripcion viene en la linea de la factura.
            if (factura.getLines() != null && factura.getLines().getData() != null
                    && !factura.getLines().getData().isEmpty()
                    && factura.getLines().getData().get(0).getPeriod() != null) {
                desde = factura.getLines().getData().get(0).getPeriod().getStart();
                hasta = factura.getLines().getData().get(0).getPeriod().getEnd();
            }
            rentaService.registrarStripe(restaurantId, factura.getId(), pagada, monto, factura.getCurrency(),
                    fecha(desde), fecha(hasta));
        });
    }

    /** Cambio de estado de la suscripcion (activa, vencida, cancelada) desde Stripe. */
    private void actualizarSuscripcion(Event event) {
        event.getDataObjectDeserializer().getObject().ifPresent(objeto -> {
            if (!(objeto instanceof com.stripe.model.Subscription suscripcion)) return;
            UUID restaurantId = restauranteDeCliente(suscripcion.getCustomer());
            if (restaurantId == null) return;
            restaurantRepository.findById(restaurantId).ifPresent(r -> {
                String estado = "customer.subscription.deleted".equals(event.getType())
                        ? "CANCELED"
                        : suscripcion.getStatus() != null ? suscripcion.getStatus().toUpperCase() : r.getSubscriptionStatus();
                r.setSubscriptionStatus(estado);
                r.setStripeSubscriptionId(suscripcion.getId());
                restaurantRepository.save(r);
                log.info("[StripeBillingService] Suscripción de {} ahora {}", r.getName(), estado);
            });
        });
    }

    private UUID restauranteDeCliente(String customerId) {
        if (customerId == null) return null;
        return restaurantRepository.findFirstByStripeCustomerId(customerId).map(Restaurant::getId).orElse(null);
    }

    private static java.time.LocalDate fecha(Long segundos) {
        return segundos == null ? null
                : Instant.ofEpochSecond(segundos).atZone(java.time.ZoneId.of("America/Mexico_City")).toLocalDate();
    }

    private void handleCheckoutCompleted(Event event) {
        EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
        if (dataObjectDeserializer.getObject().isPresent()) {
            StripeObject stripeObject = dataObjectDeserializer.getObject().get();
            if (stripeObject instanceof Session session) {
                String restaurantIdStr = session.getMetadata() != null ? session.getMetadata().get("restaurantId") : null;
                log.info("[StripeBillingService] Checkout completado para restaurante ID: {}", restaurantIdStr);
                String customerId = session.getCustomer();
                String subscriptionId = session.getSubscription();
                if (restaurantIdStr != null) {
                    try {
                        UUID rId = UUID.fromString(restaurantIdStr);
                        restaurantRepository.findById(rId).ifPresent(r -> {
                            r.setActive(true);
                            if (customerId != null) r.setStripeCustomerId(customerId);
                            if (subscriptionId != null) r.setStripeSubscriptionId(subscriptionId);
                            r.setSubscriptionStatus("ACTIVE");
                            restaurantRepository.save(r);
                            log.info("[StripeBillingService] Restaurante {} activado y vinculado con Stripe Customer: {}", r.getName(), customerId);
                        });
                    } catch (Exception ex) {
                        log.error("[StripeBillingService] Error activando restaurante: {}", ex.getMessage());
                    }
                }
            }
        }
    }
}
