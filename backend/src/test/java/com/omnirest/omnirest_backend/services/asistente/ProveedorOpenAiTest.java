package com.omnirest.omnirest_backend.services.asistente;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** El formato que se le manda a un servicio compatible con OpenAI, contra un servidor de prueba local. */
class ProveedorOpenAiTest {

    private HttpServer servidor;
    private final List<JsonNode> peticiones = new ArrayList<>();
    private final List<String> respuestas = new ArrayList<>();
    private String autorizacion;
    private int estado = 200;

    @BeforeEach
    void setUp() throws Exception {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/v1/chat/completions", ex -> {
            autorizacion = ex.getRequestHeaders().getFirst("Authorization");
            peticiones.add(HttpJson.JSON.readTree(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
            byte[] cuerpo = respuestas.remove(0).getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(estado, cuerpo.length);
            try (OutputStream o = ex.getResponseBody()) {
                o.write(cuerpo);
            }
        });
        servidor.start();
    }

    @AfterEach
    void tearDown() {
        servidor.stop(0);
    }

    private String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort() + "/v1";
    }

    @Test
    @DisplayName("Herramientas, llamada y resultado en el formato de chat/completions")
    void conversacion() {
        respuestas.add("""
                {"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[
                  {"id":"call_1","type":"function","function":{"name":"resumen_ventas","arguments":"{\\"desde\\":\\"2026-10-01\\"}"}}]}}],
                 "usage":{"prompt_tokens":120,"completion_tokens":15}}""");
        respuestas.add("""
                {"choices":[{"message":{"role":"assistant","content":"Vendiste $1,500."}}],
                 "usage":{"prompt_tokens":160,"completion_tokens":8}}""");

        ProveedorLlm p = new ProveedorOpenAi("Servicio", url(), "llave-de-prueba", "deepseek-chat");
        ProveedorLlm.Conversacion c = p.iniciar("Instrucciones", "Contexto", List.of(new ProveedorLlm.Turno(true, "Hola"),
                        new ProveedorLlm.Turno(false, "¿En qué te ayudo?")), "¿Cuánto vendí?",
                List.of(new ProveedorLlm.Herramienta("resumen_ventas", "Ventas", Map.of("type", "object", "properties", Map.of()))), 500);

        ProveedorLlm.Paso uno = c.siguiente();
        assertTrue(uno.pideHerramientas());
        assertEquals("resumen_ventas", uno.llamadas().get(0).nombre());
        assertEquals("{\"desde\":\"2026-10-01\"}", uno.llamadas().get(0).argumentosJson());
        assertEquals(120, uno.tokensEntrada());

        JsonNode primera = peticiones.get(0);
        assertEquals("Bearer llave-de-prueba", autorizacion);
        assertEquals("deepseek-chat", primera.path("model").asString());
        assertEquals(500, primera.path("max_tokens").asInt(), "los compatibles usan max_tokens");
        assertEquals("system", primera.path("messages").path(0).path("role").asString());
        assertEquals(4, primera.path("messages").size());
        assertEquals("function", primera.path("tools").path(0).path("type").asString());

        c.responder(List.of(new ProveedorLlm.Resultado(uno.llamadas().get(0), "{\"total\":1500}", false)));
        ProveedorLlm.Paso dos = c.siguiente();
        assertFalse(dos.pideHerramientas());
        assertEquals("Vendiste $1,500.", dos.texto());

        JsonNode segunda = peticiones.get(1);
        JsonNode mensajes = segunda.path("messages");
        assertEquals("assistant", mensajes.path(4).path("role").asString(), "la llamada del modelo vuelve al historial");
        assertEquals("tool", mensajes.path(5).path("role").asString());
        assertEquals("call_1", mensajes.path(5).path("tool_call_id").asString());
    }

    @Test
    @DisplayName("Una llave rechazada se explica sin mostrar la llave")
    void llaveRechazada() {
        estado = 401;
        respuestas.add("{\"error\":{\"message\":\"Invalid API key llave-de-prueba\"}}");
        ProveedorLlm.Conversacion c = new ProveedorOpenAi("Servicio", url(), "llave-de-prueba", "m")
                .iniciar("i", "c", List.of(), "hola", List.of(), 50);
        ErrorDeProveedor e = assertThrows(ErrorDeProveedor.class, c::siguiente);
        assertTrue(e.getMessage().contains("llave"));
        assertFalse(e.getMessage().contains("llave-de-prueba"));
    }
}
